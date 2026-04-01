import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { apiFetch } from '../../../api';
import { updateOrder, deleteOrder, type Order, type OrderItem, type PaymentStatus, type FulfillmentStatus, type DeliveryStatus, type Platform, type OrderType } from '../../../utils/orders';
import { loadOrdersFromApi, shopifyOrderToOrder, fetchOrderById, orderDetailToOrder, mapDeliveryStatusFromTracking, mapFulfillmentStatus, mapOrderType, getOrderCustomerName, getOrderCustomerPhone, updateShopifyOrderFromForm } from '../../../utils/shopify-orders';
import type { ShopifyOrderApi, ShopifyOrderCustomer, ShopifyOrderProduct } from '../../../types/shopify';
import { loadProducts, type ProductApiItem } from '../../../utils/products';
import type { MarketingSpendApiItem } from '../../../types/marketing-spend';
import { loadAllMarketingSpend } from '../../../utils/marketing-spend';
import { useAppDispatch, useAppSelector, setProducts, setProductsLoading } from '../../../store';
import AddOrderModal, { type ProductVariantOption } from './AddOrderModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import { DatePicker } from './DatePicker';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { formatCurrency, formatDate, FilterButton, generateWhatsAppSummary, StatusFilter, toInputDate } from './ShopifyShared';
import { Spinner } from '../../../components/Spinner';
import { ShopifyOrdersTable } from './ShopifyOrdersTable';
import { ToastContainer, type Toast } from './ToastContainer';
import './Shopify.scss';

type UiRange = 'all' | 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';
type CategoryTab = 'all' | 'milk' | 'ghee' | 'oils';

/** Liters sold for each ghee product line (matched by product name from API / catalog). */
export type GheeLitersByKind = { gir: number; desi: number; buffalo: number };

function getShopifyLineProductName(line: ShopifyOrderProduct, productMap: Map<string, ProductApiItem>): string {
    const raw = line.productId;
    if (raw && typeof raw === 'object' && 'name' in raw) {
        return String((raw as { name?: string }).name || '').trim();
    }
    const id = typeof raw === 'string' ? raw : '';
    if (id) {
        const p = productMap.get(id);
        if (p?.name) return String(p.name).trim();
    }
    return '';
}

/** Map Gir / Desi / Buffalo from product name or from a full variant label. */
function classifyGheeKindFromText(text: string): keyof GheeLitersByKind | null {
    const n = text.toLowerCase();
    if (!n) return null;
    if (n.includes('buffalo')) return 'buffalo';
    if (n.includes('gir')) return 'gir';
    if (n.includes('desi')) return 'desi';
    return null;
}

/**
 * Pack-size bucket used by the quantity table and headline "total liters" (must stay in sync).
 * Only 500 ml, 1 L, 5 L (plus 250 ml → same bucket as 500 ml for counting).
 */
function resolveShopifyVariantSizeKey(variantName: string): '' | '500ml' | '1ltr' | '5ltr' {
    const sizeMatch = variantName.match(/-?\s*(\d+(?:\.\d+)?)\s*(ml|ltr|L)/i);
    if (!sizeMatch) return '';
    const sizeValue = parseFloat(sizeMatch[1]);
    const sizeUnit = sizeMatch[2].toLowerCase();
    let sizeKey: '' | '500ml' | '1ltr' | '5ltr' = '';
    if (sizeUnit === 'ml') {
        if (sizeValue === 500) sizeKey = '500ml';
        else if (sizeValue === 1000) sizeKey = '1ltr';
        else if (sizeValue === 5000) sizeKey = '5ltr';
        else if (sizeValue === 250) sizeKey = '500ml';
    } else if (sizeUnit === 'l' || sizeUnit === 'ltr') {
        if (sizeValue === 1) sizeKey = '1ltr';
        else if (sizeValue === 5) sizeKey = '5ltr';
    }
    return sizeKey;
}

function litersInTableBucket(sizeKey: '500ml' | '1ltr' | '5ltr', quantity: number): number {
    if (sizeKey === '500ml') return 0.5 * quantity;
    if (sizeKey === '1ltr') return quantity;
    return 5 * quantity;
}

type ShopifyProps = {
    /**
     * Title shown in the header card.
     * Defaults to "Shopify" for the main orders page.
     */
    title?: string;
    /**
     * Optional state filter – when provided, the page will only show
     * orders whose `state` exactly matches this value.
     * Used by derived pages like Gurugram / Delhi marts.
     */
    stateFilter?: string;
};

export default function Shopify({ title = 'Shopify', stateFilter }: ShopifyProps) {
    const [range, setRange] = useState<UiRange>('currentMonth');
    const [customerFilter, setCustomerFilter] = useState('');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
    const [showCustomerProfile, setShowCustomerProfile] = useState(false);
    const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [orders, setOrders] = useState<ShopifyOrderApi[]>([]);
    const dispatch = useAppDispatch();
    const products = useAppSelector((state) => state.products.products);
    const productsLoading = useAppSelector((state) => state.products.loading);
    // Marketing spend must come directly from the API (not Redux),
    // otherwise EBITA + misc/shipping values can be stale when navigating modules.
    const [marketingSpendRecords, setMarketingSpendRecords] = useState<MarketingSpendApiItem[]>([]);
    const [marketingSpendLoading, setMarketingSpendLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [categoryTab, setCategoryTab] = useState<CategoryTab>('ghee');
    const [syncingShopify, setSyncingShopify] = useState(false);
    
    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([]);
    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }
    const copyPhoneToClipboard = async (phone: string) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(phone);
            } else if (typeof document !== 'undefined') {
                const textarea = document.createElement('textarea');
                textarea.value = phone;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            showToast('Phone number copied to clipboard', 'success');
        } catch (err) {
            console.error('Failed to copy phone number', err);
            showToast('Unable to copy phone number. Please copy manually.', 'error');
        }
    };
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | ''>('');
    const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState<FulfillmentStatus | ''>('');
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatus | ''>('');
    const [platformFilter, setPlatformFilter] = useState<Platform | ''>('');
    const [typeFilter, setTypeFilter] = useState<OrderType | ''>('');
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (products && products.length > 0) {
            return;
        }
        dispatch(setProductsLoading(true));
        loadProducts()
            .then((data) => {
                if (!cancelled) {
                    dispatch(setProducts(data));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    dispatch(setProductsLoading(false));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [dispatch, products]);

    useEffect(() => {
        let cancelled = false;
        setMarketingSpendLoading(true);

        loadAllMarketingSpend()
            .then((data) => {
                if (!cancelled) {
                    setMarketingSpendRecords(data);
                }
            })
            .catch((err) => {
                console.error('Failed to load marketing spend data', err);
            })
            .finally(() => {
                if (!cancelled) {
                    setMarketingSpendLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const getLocalDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /** Add one day to YYYY-MM-DD so backend's exclusive "to" includes the last day. */
    const addOneDay = (ymd: string): string => {
        const d = new Date(ymd + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        return getLocalDateString(d);
    };

    // Compute from/to for API based on selected range (YYYY-MM-DD); to is sent as next day so backend includes last day
    const dateRangeForApi = useMemo((): { from: string; to: string } => {
        const now = new Date();
        const todayStr = getLocalDateString(now);
        if (range === 'all') {
            return { from: '2024-01-01', to: todayStr };
        }
        if (range === 'custom') {
            return { from: customStart, to: customEnd };
        }
        if (range === 'today') {
            return { from: todayStr, to: todayStr };
        }
        if (range === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);
            return { from: yesterdayStr, to: yesterdayStr };
        }
        if (range === 'last7') {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            return { from: getLocalDateString(start), to: todayStr };
        }
        if (range === 'currentMonth') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: getLocalDateString(start), to: todayStr };
        }
        if (range === 'lastMonth') {
            const year = now.getFullYear();
            const month = now.getMonth();
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            return { from: getLocalDateString(start), to: getLocalDateString(end) };
        }
        return { from: '2024-01-01', to: todayStr };
    }, [range, customStart, customEnd]);

    const syncShopifyOrders = async () => {
        try {
            setLoading(true);
            setSyncingShopify(true);
            const res = await apiFetch('/api/orders/sync-shopify', { method: 'POST' });
            if (!res.ok) {
                console.error('Sync Shopify failed with status', res.status);
                showToast('Failed to Sync', 'error');
                return;
            }
            const toInclusive = addOneDay(dateRangeForApi.to);
            const ordersData = await loadOrdersFromApi({ from: dateRangeForApi.from, to: toInclusive });
            setOrders(ordersData);
        } catch (err) {
            console.error('Failed to sync Shopify orders', err);
            showToast('Failed to Sync', 'error');
        } finally {
            setLoading(false);
            setSyncingShopify(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const toInclusive = addOneDay(dateRangeForApi.to);
        loadOrdersFromApi({ from: dateRangeForApi.from, to: toInclusive })
            .then((ordersData) => {
                if (!cancelled) setOrders(ordersData);
            })
            .catch(() => {
                if (!cancelled) setOrders([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [dateRangeForApi.from, dateRangeForApi.to]);

    // When Edit is clicked, fetch full order from GET /api/orders/:id then open modal
    useEffect(() => {
        if (!editingOrderId) return;
        let cancelled = false;
        setLoadingOrderDetail(true);
        fetchOrderById(editingOrderId)
            .then((full) => {
                if (!cancelled) {
                    setEditingOrder(orderDetailToOrder(full));
                    setEditingOrderId(null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    showToast('Failed to load order details', 'error');
                    setEditingOrderId(null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingOrderDetail(false);
            });
        return () => {
            cancelled = true;
        };
    }, [editingOrderId]);

    const productOptions = useMemo((): ProductVariantOption[] => {
        return products.flatMap((p) =>
            (p.variants || []).map((v) => ({
                id: p._id,
                name: p.name,
                size: v.name,
                price: v.price,
            }))
        );
    }, [products]);

    const productCategoryMap = useMemo(() => {
        const map = new Map<string, string>();
        products.forEach((p) => {
            let categoryName = '';
            const cat = p.category as any;
            if (cat && typeof cat === 'object' && 'name' in cat) {
                categoryName = String(cat.name ?? '');
            } else if (typeof p.category === 'string') {
                categoryName = p.category;
            }
            if (p._id && categoryName) {
                map.set(p._id, categoryName.toLowerCase());
            }
        });
        return map;
    }, [products]);

    const generatedPlusUser = useMemo(() => {
        return [...orders].sort((a, b) => {
            const dA = a.createdAt ?? a.date ?? '';
            const dB = b.createdAt ?? b.date ?? '';
            return dA > dB ? -1 : dA < dB ? 1 : 0;
        });
    }, [orders]);

    // API already returns orders for the selected date range; no client-side date filter
    const byRange = generatedPlusUser;

    const filtered = useMemo(() => {
        return byRange.filter((o: ShopifyOrderApi) => {
            const searchTerm = customerFilter.toLowerCase();
            const name = getOrderCustomerName(o);
            const phone = getOrderCustomerPhone(o);
            const matchesCustomer =
                name.toLowerCase().includes(searchTerm) ||
                (phone && phone.includes(searchTerm));
            const paymentStatus = o.paymentMode === 'PAID' ? 'PAID' : 'COD';
            const matchesPayment = !paymentStatusFilter || paymentStatus === paymentStatusFilter;
            const matchesFulfillment = !fulfillmentStatusFilter || mapFulfillmentStatus(o.fulfillmentStatus) === fulfillmentStatusFilter;
            const deliveryStatus = o.returnStatus ? 'RTO' : mapDeliveryStatusFromTracking(o.shippingDetails?.trackingStatus);
            const matchesDelivery = !deliveryStatusFilter || deliveryStatus === deliveryStatusFilter;
            const matchesPlatform = !platformFilter || (o.platform && o.platform.toLowerCase() === platformFilter.toLowerCase());
            const matchesType = !typeFilter || mapOrderType(o.type) === typeFilter;
            const matchesState = !stateFilter || o.state === stateFilter;
            const matchesCategory = (() => {
                if (categoryTab === 'all') return true;
                const lines = o.products || [];
                for (const line of lines) {
                    const rawProductId = (line as any).productId;
                    let productId: string | null = null;
                    if (rawProductId && typeof rawProductId === 'object' && '_id' in rawProductId) {
                        productId = String((rawProductId as { _id: string })._id);
                    } else if (typeof rawProductId === 'string') {
                        productId = rawProductId;
                    }
                    if (!productId) continue;
                    const catLower = productCategoryMap.get(productId) || '';
                    if (!catLower) continue;
                    if (categoryTab === 'milk' && catLower.includes('milk')) return true;
                    if (categoryTab === 'ghee' && catLower.includes('ghee')) return true;
                    if (categoryTab === 'oils' && (catLower.includes('oil') || catLower.includes('oils'))) return true;
                }
                return false;
            })();
            return (
                matchesCustomer &&
                matchesPayment &&
                matchesFulfillment &&
                matchesDelivery &&
                matchesPlatform &&
                matchesType &&
                matchesState &&
                matchesCategory
            );
        });
    }, [
        byRange,
        customerFilter,
        paymentStatusFilter,
        fulfillmentStatusFilter,
        deliveryStatusFilter,
        platformFilter,
        typeFilter,
        stateFilter,
        categoryTab,
        productCategoryMap,
    ]);

    const metrics = useMemo(() => {
        const totalSales = filtered.reduce((s, o) => s + o.totalAmount, 0);
        const quantity = filtered.reduce((s, o) => s + (o.products || []).reduce((sum, p) => sum + p.quantity, 0), 0);
        const codCharges = filtered.reduce((s, o) => s + (o.codCharges || 0), 0);
        const deliveryStatusFor = (o: ShopifyOrderApi) =>
            o.returnStatus ? 'RTO' : mapDeliveryStatusFromTracking(o.shippingDetails?.trackingStatus);
        const deliveredOrders = filtered.filter(o => deliveryStatusFor(o) === 'Delivered');
        const inTransitOrders = filtered.filter(o => deliveryStatusFor(o) === 'In Transit');
        const delivered = deliveredOrders.length;
        const deliveredAmount = deliveredOrders.reduce((s, o) => s + o.totalAmount, 0);
        const deliveredShippingCharges = deliveredOrders.reduce((s, o) => s + (o.shippingCharges || 0), 0);

        const inTransit = inTransitOrders.length;
        const inTransitAmount = inTransitOrders.reduce((s, o) => s + o.totalAmount, 0);

        // Marketing spend from Redux store; if store was empty we fetched and populated it above.
        const fromDate = new Date(`${dateRangeForApi.from}T00:00:00`);
        const toDate = new Date(`${dateRangeForApi.to}T23:59:59.999`);
        const spendInRange = marketingSpendRecords.filter((rec) => {
            const d = new Date(rec.date);
            return !Number.isNaN(d.getTime()) && d >= fromDate && d <= toDate;
        });
        const metaSpend = spendInRange
            .filter((rec) => String(rec.platform).toLowerCase() === 'meta1')
            .reduce((sum, rec) => sum + Number(rec.amount || 0), 0);
        // "Misc" here means all platforms except meta1 and delhivery.
        // (e.g. misc, engage, checkout, amazon, flipkart, dolchi, etc.)
        const miscSpend = spendInRange
            .filter((rec) => {
                const platform = String(rec.platform).toLowerCase();
                return platform !== 'meta1' && platform !== 'delhivery';
            })
            .reduce((sum, rec) => sum + Number(rec.amount || 0), 0);
        const delhiverySpend = spendInRange
            .filter((rec) => String(rec.platform).toLowerCase() === 'delhivery')
            .reduce((sum, rec) => sum + Number(rec.amount || 0), 0);

        // ROAS denominator: all ad/marketing expenses in range (Meta + other non-Delhivery platforms)
        const totalMarketingSpend = metaSpend + miscSpend;
        const totalMiscCost = miscSpend;
        const roasCurrent = totalMarketingSpend > 0 ? deliveredAmount / totalMarketingSpend : 0;
        const roasExpected = totalMarketingSpend > 0 ? (deliveredAmount + inTransitAmount) / totalMarketingSpend : 0;

        const orderCountForPaymentMix = filtered.length;
        let paidOrderCount = 0;
        for (const o of filtered) {
            if (o.paymentMode === 'PAID') paidOrderCount += 1;
        }
        const paidOrdersPct =
            orderCountForPaymentMix > 0
                ? Math.round((paidOrderCount / orderCountForPaymentMix) * 100)
                : 0;
        const codOrdersPct =
            orderCountForPaymentMix > 0 ? Math.max(0, 100 - paidOrdersPct) : 0;

        // Manufacturing cost based on delivered lines and product actual cost from /api/products.
        const productMap = new Map<string, ProductApiItem>();
        products.forEach((p) => {
            if (p?._id) productMap.set(p._id, p);
        });

        const resolveUnitActualCost = (line: ShopifyOrderApi['products'][number]): number => {
            const rawProductId = line.productId;
            const productId =
                rawProductId && typeof rawProductId === 'object' && '_id' in rawProductId
                    ? String(rawProductId._id ?? '')
                    : typeof rawProductId === 'string'
                    ? rawProductId
                    : '';

            const product = productMap.get(productId);
            if (!product) {
                return Number(line.price || line.variantPrice || 0);
            }

            const variantName = String(line.variantName || '').trim().toLowerCase();
            const matchedVariant = (product.variants || []).find((v) => {
                const vName = String(v.name || '').trim().toLowerCase();
                return vName === variantName || vName.includes(variantName) || variantName.includes(vName);
            });

            const unitActual =
                matchedVariant?.actualPrice ??
                product.actualPrice ??
                matchedVariant?.price ??
                product.price ??
                line.price ??
                line.variantPrice ??
                0;

            return Number(unitActual || 0);
        };

        const manufacturingCost = deliveredOrders.reduce((sum, order) => {
            const orderManufacturing = (order.products || []).reduce((lineSum, line) => {
                const qty = Number(line.quantity || 0);
                const unitActualCost = resolveUnitActualCost(line);
                return lineSum + unitActualCost * qty;
            }, 0);
            return sum + orderManufacturing;
        }, 0);

        const shippingCharges = deliveredShippingCharges;
        const manufacturingCostInTransit = inTransitOrders.reduce((sum, order) => {
            const orderManufacturing = (order.products || []).reduce((lineSum, line) => {
                const qty = Number(line.quantity || 0);
                const unitActualCost = resolveUnitActualCost(line);
                return lineSum + unitActualCost * qty;
            }, 0);
            return sum + orderManufacturing;
        }, 0);

        const expectedManufacturingCost = manufacturingCost + manufacturingCostInTransit;
        const ebita = deliveredAmount - manufacturingCost - metaSpend - delhiverySpend - miscSpend;
        const expectedEbita =
            (deliveredAmount + inTransitAmount) -
            expectedManufacturingCost -
            metaSpend -
            delhiverySpend -
            miscSpend;
        
        // Calculate quantities by size
        const quantityBySize: { [key: string]: number } = {
            '500ml': 0,
            '1ltr': 0,
            '5ltr': 0
        };
        
        // Calculate delivered quantities by size
        const deliveredQuantityBySize: { [key: string]: number } = {
            '500ml': 0,
            '1ltr': 0,
            '5ltr': 0
        };
        
        // Calculate RTO quantities by size
        const rtoQuantityBySize: { [key: string]: number } = {
            '500ml': 0,
            '1ltr': 0,
            '5ltr': 0
        };
        
        // Calculate In Transit quantities by size
        const inTransitQuantityBySize: { [key: string]: number } = {
            '500ml': 0,
            '1ltr': 0,
            '5ltr': 0
        };
        
        filtered.forEach((o: ShopifyOrderApi) => {
            const delStatus = deliveryStatusFor(o);
            (o.products || []).forEach(p => {
                const variantName = p.variantName || '';
                const sizeKey = resolveShopifyVariantSizeKey(variantName);
                if (sizeKey) {
                    quantityBySize[sizeKey] += p.quantity;
                    if (delStatus === 'Delivered') deliveredQuantityBySize[sizeKey] += p.quantity;
                    if (delStatus === 'RTO') rtoQuantityBySize[sizeKey] += p.quantity;
                    if (delStatus === 'In Transit') inTransitQuantityBySize[sizeKey] += p.quantity;
                }
            });
        });

        const gheeLitersByKind: GheeLitersByKind = { gir: 0, desi: 0, buffalo: 0 };
        filtered.forEach((o: ShopifyOrderApi) => {
            (o.products || []).forEach((p) => {
                const productName = getShopifyLineProductName(p, productMap);
                const variantLabel = String(p.variantName || '');
                const kind =
                    classifyGheeKindFromText(productName) ?? classifyGheeKindFromText(variantLabel);
                if (!kind) return;
                const sizeKey = resolveShopifyVariantSizeKey(variantLabel);
                if (!sizeKey) return;
                const L = litersInTableBucket(sizeKey, Number(p.quantity || 0));
                if (L <= 0) return;
                gheeLitersByKind[kind] += L;
            });
        });

        const rtoOrders = filtered.filter((o: ShopifyOrderApi) => deliveryStatusFor(o) === 'RTO');
        const rto = rtoOrders.length;
        const rtoAmount = rtoOrders.reduce((s, o) => s + o.totalAmount, 0);
        
        return {
            totalSales,
            quantity,
            quantityBySize,
            deliveredQuantityBySize,
            rtoQuantityBySize,
            inTransitQuantityBySize,
            gheeLitersByKind,
            codCharges,
            shippingCharges,
            roasCurrent,
            roasExpected,
            paidOrdersPct,
            codOrdersPct,
            delivered,
            deliveredAmount,
            rto,
            rtoAmount,
            inTransit,
            inTransitAmount,
            totalOrders: filtered.length,
            ebita,
            expectedEbita,
            manufacturingCost,
            expectedManufacturingCost,
            totalMiscCost,
            totalMarketingSpend,
            metaSpend,
            miscSpend,
            delhiverySpend,
        };
    }, [filtered, products, marketingSpendRecords, dateRangeForApi.from, dateRangeForApi.to]);

    const marketingSpendForSummary = useMemo(() => {
        return marketingSpendRecords.map((rec) => ({
            id: rec._id,
            date: rec.date,
            amount: rec.amount,
            note: rec.note,
            createdByName: rec.createdBy?.name,
            updatedByName: rec.updatedBy?.name,
        }));
    }, [marketingSpendRecords]);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!showCustom) return;
            const target = e.target as Node;
            if (popoverRef.current && popoverRef.current.contains(target)) return;
            if (customBtnRef.current && customBtnRef.current.contains(target as Node)) return;
            setShowCustom(false);
        }
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [showCustom]);

    // Group orders by order date (date = when order was placed; fallback to createdAt)
    const groupedByDate = useMemo(() => {
        const groups: Array<{
            label: string;
            items: ShopifyOrderApi[];
            metaSpent: number;
            totalAmount: number;
            totalShipping: number;
            codCount: number;
            paidCount: number;
        }> = [];
        const dateToIndex = new Map<string, number>();
        for (const o of filtered) {
            const orderDateIso = o.date ?? o.createdAt;
            const label = orderDateIso ? formatDate(orderDateIso) : 'No date';
            const idx = dateToIndex.get(label);
            if (idx === undefined) {
                groups.push({
                    label,
                    items: [o],
                    metaSpent: 0,
                    totalAmount: 0,
                    totalShipping: 0,
                    codCount: 0,
                    paidCount: 0,
                });
                dateToIndex.set(label, groups.length - 1);
            } else {
                groups[idx].items.push(o);
            }
        }
        for (const g of groups) {
            let totalAmount = 0;
            let totalShipping = 0;
            let codCount = 0;
            let paidCount = 0;
            for (const it of g.items) {
                totalAmount += it.totalAmount;
                totalShipping += it.shippingCharges ?? 0;
                if (it.paymentMode === 'COD') codCount += 1;
                if (it.paymentMode === 'PAID') paidCount += 1;
            }
            g.totalAmount = totalAmount;
            g.totalShipping = totalShipping;
            g.codCount = codCount;
            g.paidCount = paidCount;
            g.metaSpent = 0;
        }
        // Sort groups by order date descending (newest first)
        groups.sort((a, b) => {
            const isoA = a.items[0]?.date ?? a.items[0]?.createdAt ?? '';
            const isoB = b.items[0]?.date ?? b.items[0]?.createdAt ?? '';
            return isoB.localeCompare(isoA);
        });
        return groups;
    }, [filtered]);

    return (
        <section className="shopify-page">
            <div className="card shopify-header-card">
                <div className="shopify-header-title">{title}</div>
                <div className="shopify-header-main">
                    <div className="shopify-category-tabs">
                        <FilterButton
                            active={categoryTab === 'all'}
                            onClick={() => setCategoryTab('all')}
                        >
                            All products
                        </FilterButton>
                        <FilterButton
                            active={categoryTab === 'milk'}
                            onClick={() => setCategoryTab('milk')}
                        >
                            Milk
                        </FilterButton>
                        <FilterButton
                            active={categoryTab === 'ghee'}
                            onClick={() => setCategoryTab('ghee')}
                        >
                            Ghee
                        </FilterButton>
                        <FilterButton
                            active={categoryTab === 'oils'}
                            onClick={() => setCategoryTab('oils')}
                        >
                            Oils
                        </FilterButton>
                    </div>
                    <div className="shopify-header-filters">
                        <div className="filter-group shopify-header-filter-group">
                            <FilterButton active={range === 'all'} onClick={() => { setRange('all'); setShowCustom(false); }}>All</FilterButton>
                            <FilterButton active={range === 'today'} onClick={() => { setRange('today'); setShowCustom(false); }}>Today</FilterButton>
                            <FilterButton active={range === 'yesterday'} onClick={() => { setRange('yesterday'); setShowCustom(false); }}>Yesterday</FilterButton>
                            <FilterButton active={range === 'last7'} onClick={() => { setRange('last7'); setShowCustom(false); }}>Last 7 days</FilterButton>
                            <FilterButton active={range === 'currentMonth'} onClick={() => { setRange('currentMonth'); setShowCustom(false); }}>Current Month</FilterButton>
                            <FilterButton active={range === 'lastMonth'} onClick={() => { setRange('lastMonth'); setShowCustom(false); }}>Last Month</FilterButton>
                            <FilterButton
                                refEl={customBtnRef}
                                active={range === 'custom'}
                                onClick={() => {
                                    setRange('custom');
                                    setShowCustom((v) => !v);
                                }}
                            >Custom</FilterButton>
                        </div>
                        <div className="shopify-header-spacer" />
                        <div className="shopify-search-wrapper">
                            <span className="shopify-search-icon" aria-hidden>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            </span>
                            <input
                                className="input shopify-search-input"
                                placeholder="Search customer or phone"
                                value={customerFilter}
                                onChange={(e) => setCustomerFilter(e.target.value)}
                            />
                        </div>
                        <div className="shopify-header-actions">
                            <button
                                className="button shopify-add-order-btn"
                                onClick={() => setShowAddOrder(true)}
                            >
                                <span>+</span> Add Order
                            </button>
                            <button
                                className="button shopify-refresh-btn"
                                type="button"
                                title="Sync latest Shopify orders"
                                onClick={syncShopifyOrders}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="status-filters-row shopify-status-filters shopify-status-filters--toolbar">
                        <StatusFilter
                            layout="ribbon"
                            label="Payment"
                            value={paymentStatusFilter}
                            onChange={setPaymentStatusFilter}
                            options={['COD', 'PAID'] as PaymentStatus[]}
                        />
                        <StatusFilter
                            layout="ribbon"
                            label="Fulfill"
                            value={fulfillmentStatusFilter}
                            onChange={setFulfillmentStatusFilter}
                            options={['Unfulfilled', 'Fulfilled', 'Partial'] as FulfillmentStatus[]}
                        />
                        <StatusFilter
                            layout="ribbon"
                            label="Delivery"
                            value={deliveryStatusFilter}
                            onChange={setDeliveryStatusFilter}
                            options={['In Transit', 'Delivered', 'RTO', 'Pending Pickup'] as DeliveryStatus[]}
                        />
                        <StatusFilter
                            layout="ribbon"
                            label="Platform"
                            value={platformFilter}
                            onChange={setPlatformFilter}
                            options={['Shopify', 'Abandoned', 'Whatsapp', 'Amazon', 'Flipkart', 'Calling'] as Platform[]}
                        />
                        <StatusFilter
                            layout="ribbon"
                            label="Type"
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={['New', 'Repeat', 'Reference'] as OrderType[]}
                        />
                        <button
                            type="button"
                            className="shopify-export-btn"
                            onClick={() => {
                                // Export to CSV
                                const headers = ['S.no', 'Name', 'Mobile', 'Quantity (L)', 'Amount', 'Shipping Status', 'State'];
                                // Include all orders (COD, PAID, RTO, In Transit, etc.)
                                const exportableOrders = filtered;
                                const rows = exportableOrders.map((order: ShopifyOrderApi, index: number) => {
                                    const totalQuantityLiters = (order.products || []).reduce((sum: number, p: { variantName: string; quantity: number }) => {
                                        const sizeMatch = (p.variantName || '').match(/-?\s*(\d+(?:\.\d+)?)\s*(ml|ltr|L)/i);
                                        if (!sizeMatch) return sum;
                                        const sizeValue = parseFloat(sizeMatch[1]);
                                        const sizeUnit = sizeMatch[2].toLowerCase();
                                        let litersPerUnit = 0;
                                        if (sizeUnit === 'ml') litersPerUnit = sizeValue / 1000;
                                        else if (sizeUnit === 'l' || sizeUnit === 'ltr') litersPerUnit = sizeValue;
                                        return sum + litersPerUnit * p.quantity;
                                    }, 0);
                                    return [
                                        index + 1,
                                        getOrderCustomerName(order),
                                        getOrderCustomerPhone(order),
                                        totalQuantityLiters,
                                        order.totalAmount,
                                        order.returnStatus
                                            ? 'RTO'
                                            : order.shippingDetails?.trackingStatus ||
                                              mapDeliveryStatusFromTracking(order.shippingDetails?.trackingStatus) ||
                                              '',
                                        order.state || ''
                                    ];
                                });
                                
                                // Create CSV content
                                const csvContent = [
                                    headers.join(','),
                                    ...rows.map(row => row.map(cell => {
                                        // Escape commas and quotes in CSV
                                        const cellStr = String(cell);
                                        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                                            return `"${cellStr.replace(/"/g, '""')}"`;
                                        }
                                        return cellStr;
                                    }).join(','))
                                ].join('\n');
                                
                                // Create blob and download
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                showToast('Orders exported successfully!', 'success');
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Export CSV
                        </button>
                        {(paymentStatusFilter || fulfillmentStatusFilter || deliveryStatusFilter || platformFilter || typeFilter) ? (
                            <button
                                type="button"
                                className="shopify-clear-filters-btn"
                                onClick={() => { 
                                    setPaymentStatusFilter(''); 
                                    setFulfillmentStatusFilter(''); 
                                    setDeliveryStatusFilter(''); 
                                    setPlatformFilter(''); 
                                    setTypeFilter(''); 
                                }}
                            >
                                Clear All
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className="shopify-dash-grid">
                    <ModernSalesWithEBITAMetric
                        totalSales={metrics.totalSales}
                        ebita={metrics.ebita}
                        expectedEbita={metrics.expectedEbita}
                        manufacturingCost={metrics.manufacturingCost}
                        expectedManufacturingCost={metrics.expectedManufacturingCost}
                        metaSpend={metrics.metaSpend}
                        miscCost={metrics.miscSpend}
                        delhiveryCost={metrics.delhiverySpend}
                        isMilkSelected={categoryTab === 'milk'}
                    />
                    <ModernQuantityMetric
                        quantityBySize={metrics.quantityBySize}
                        deliveredQuantityBySize={metrics.deliveredQuantityBySize}
                        rtoQuantityBySize={metrics.rtoQuantityBySize}
                        inTransitQuantityBySize={metrics.inTransitQuantityBySize}
                        gheeLitersByKind={metrics.gheeLitersByKind}
                        isMilkSelected={categoryTab === 'milk'}
                    />
                    <ModernDeliveryStatusMetric
                        delivered={metrics.delivered}
                        deliveredAmount={metrics.deliveredAmount}
                        rto={metrics.rto}
                        rtoAmount={metrics.rtoAmount}
                        inTransit={metrics.inTransit}
                        inTransitAmount={metrics.inTransitAmount}
                        isMilkSelected={categoryTab === 'milk'}
                    />
                    <ModernRoasMetric
                        currentRoas={metrics.roasCurrent}
                        expectedRoas={metrics.roasExpected}
                        paidOrdersPct={metrics.paidOrdersPct}
                        codOrdersPct={metrics.codOrdersPct}
                    />
                </div>

                {showCustom ? (
                    <div
                        ref={popoverRef}
                        className="date-range-popover shopify-date-range-popover"
                        style={{
                            left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0,
                        }}
                    >
                        <div className="shopify-date-range-inner">
                            <div className="shopify-date-range-field">
                                <label className="label shopify-date-range-label">Start</label>
                                <div className="shopify-date-range-picker">
                                    <DatePicker value={customStart} onChange={setCustomStart} placeholder="Select start date" />
                                </div>
                            </div>
                            <span className="shopify-date-range-separator">—</span>
                            <div className="shopify-date-range-field">
                                <label className="label shopify-date-range-label">End</label>
                                <div className="shopify-date-range-picker">
                                    <DatePicker value={customEnd} onChange={setCustomEnd} placeholder="Select end date" />
                                </div>
                            </div>
                            <button
                                className="button shopify-date-range-apply"
                                onClick={() => setShowCustom(false)}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            <ShopifyOrdersTable
                groupedByDate={groupedByDate}
                marketingSpend={marketingSpendForSummary}
                loading={loading || marketingSpendLoading}
                orderCount={filtered.length}
                onCustomerClick={(customerId, phone) => {
                    setCustomerProfileLoading(true);
                    setSelectedCustomerId(customerId);
                    setSelectedCustomerPhone(phone);
                    setShowCustomerProfile(true);
                }}
                onEdit={(order) => setEditingOrderId(order.id)}
                onDelete={setOrderToDelete}
            />

            {loadingOrderDetail && <Spinner overlay fixed message="Loading order…" />}
            {customerProfileLoading && <Spinner overlay fixed message="Loading customer…" />}
            {syncingShopify && <Spinner overlay fixed message="Syncing Shopify orders…" />}

            {showAddOrder || editingOrder ? (
                <AddOrderModal 
                    products={productOptions}
                    orders={orders.map(shopifyOrderToOrder)}
                    mode={editingOrder ? 'edit' : 'add'}
                    initialOrder={editingOrder || undefined}
                    onClose={() => {
                        setShowAddOrder(false);
                        setEditingOrder(null);
                    }} 
                    onCreate={async (o) => {
                        try {
                            if (editingOrder) {
                                const base = orders.find((ord) => ord._id === editingOrder.id);
                                if (base) {
                                    await updateShopifyOrderFromForm(base, o, (variantLabel) => {
                                        const label = (variantLabel ?? '').trim();
                                        if (!label) return undefined;

                                        const [rawName, ...rest] = label.split('-');
                                        const name = (rawName ?? '').trim();
                                        const size = rest.join('-').trim();

                                        let product: ProductApiItem | undefined =
                                            products.find((p) => p.name === name) ||
                                            products.find((p) => label.startsWith(p.name));

                                        if (!product) return undefined;

                                        if (!size) {
                                            return product._id;
                                        }

                                        const hasVariant =
                                            Array.isArray(product.variants) &&
                                            product.variants.some((v) => v.name === size);

                                        return hasVariant ? product._id : product._id;
                                    });
                                } else {
                                    await updateOrder(o);
                                }
                                const fresh = await loadOrdersFromApi();
                                setOrders(fresh);
                                setEditingOrder(null);
                                showToast('Order updated successfully!', 'success');
                            } else {
                                // Build Shopify-style payload for Add Order POST
                                const fulfillmentStatusBackend = (() => {
                                    const lower = o.fulfillmentStatus.toLowerCase();
                                    if (lower === 'fulfilled') return 'fulfilled';
                                    if (lower === 'partial') return 'partial';
                                    return 'unfulfilled';
                                })();

                                const shippingStatusBackend = (() => {
                                    const lower = o.deliveryStatus.toLowerCase();
                                    if (lower === 'delivered') return 'delivered';
                                    if (lower === 'in transit') return 'in_transit';
                                    if (lower === 'rto') return 'rto';
                                    if (lower === 'pending pickup') return 'pending_pickup';
                                    return lower;
                                })();

                                const typeBackend = (o.type ?? 'New').toLowerCase();

                                const productsPayload = o.items.map((it) => {
                                    const option = productOptions.find(
                                        (p) => `${p.name} - ${p.size}` === it.variant
                                    );
                                    const unitPrice =
                                        it.quantity > 0 ? it.lineAmount / it.quantity : 0;
                                    return {
                                        productId: option?.id,
                                        quantity: it.quantity,
                                        price: unitPrice,
                                        // Send only the variant name (e.g. "1 Ltr") to match product API
                                        variantName: option?.size,
                                    };
                                });

                                const platformBackend = (o.platform ?? 'Shopify').toLowerCase();

                                const payload = {
                                    customerData: {
                                        name: o.customer,
                                        phoneNumber: o.customerPhone,
                                        address: o.customerAddress,
                                        state: o.state,
                                        pincode: o.pincode ?? '',
                                    },
                                    date: o.date,
                                    type: typeBackend,
                                    products: productsPayload,
                                    platform: platformBackend,
                                    paymentMode: o.paymentStatus,
                                    fulfillmentStatus: fulfillmentStatusBackend,
                                    shippingDetails: {
                                        trackingNumber: o.awbNumber ?? '',
                                        trackingStatus: shippingStatusBackend ?? '',
                                        trackingUrl: o.shippingTrackingUrl ?? '',
                                        trackingCompany: o.shippingTrackingCompany ?? '',
                                    },
                                    totalAmount: o.amount,
                                    codCharges: o.codCharges ?? 0,
                                    discount: o.discountAmount ?? 0,
                                    notes: o.notes ?? '',
                                    is_shipped: o.is_shipped,
                                };

                                await apiFetch('/api/orders', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(payload),
                                });
                                const fresh = await loadOrdersFromApi();
                                setOrders(fresh);
                                setShowAddOrder(false);
                                showToast('Order added successfully!', 'success');
                            }
                        } catch (err) {
                            console.error('Failed to save order', err);
                            showToast('Failed to save order. Please check that the server is running and try again.', 'error');
                        }
                    }} 
                />
            ) : null}

            {showCustomerProfile && selectedCustomerPhone && selectedCustomerId ? (
                <CustomerProfileModal
                    customerId={selectedCustomerId}
                    customerPhone={selectedCustomerPhone}
                    onClose={() => {
                        setShowCustomerProfile(false);
                        setSelectedCustomerPhone(null);
                        setSelectedCustomerId(null);
                        setCustomerProfileLoading(false);
                    }}
                    onCopyPhone={copyPhoneToClipboard}
                    onLoaded={() => setCustomerProfileLoading(false)}
                />
            ) : null}

            {orderToDelete ? (
                <DeleteConfirmationModal
                    order={orderToDelete}
                    onConfirm={async () => {
                        try {
                            await deleteOrder(orderToDelete.id);
                            const fresh = await loadOrdersFromApi();
                            setOrders(fresh);
                            showToast('Order deleted successfully!', 'delete');
                            setOrderToDelete(null);
                        } catch (err) {
                            console.error('Failed to delete order', err);
                            showToast('Failed to delete order. Please check that the server is running and try again.', 'error');
                        }
                    }}
                    onCancel={() => setOrderToDelete(null)}
                />
            ) : null}
            
            <ToastContainer toasts={toasts} />
        </section>
    );
}

function IconWallet() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
    );
}

function IconBars() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
    );
}

function IconPackage() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    );
}

function IconTrending() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </svg>
    );
}

function ModernMetricItem({ icon, label, value, iconColor, isLast, isEven }: { icon: string; label: string; value: string; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <article className="shopify-dash-card shopify-dash-card--plain">
            <header className="shopify-dash-card__head">
                <span className="shopify-dash-card__icon shopify-dash-card__icon--plain" style={{ color: iconColor }} aria-hidden>
                    {icon}
                </span>
                <h3 className="shopify-dash-card__heading">{label}</h3>
            </header>
            <p className="shopify-dash-card__figure shopify-dash-card__figure--sm">{value}</p>
        </article>
    );
}

function ModernRoasMetric({
    currentRoas,
    expectedRoas,
    paidOrdersPct,
    codOrdersPct,
}: {
    currentRoas: number;
    expectedRoas: number;
    paidOrdersPct: number;
    codOrdersPct: number;
}) {
    const formatRoas = (v: number): string => {
        if (!Number.isFinite(v) || v <= 0) return '—';
        return v.toFixed(2);
    };

    const gaugeDeg =
        Number.isFinite(currentRoas) &&
        currentRoas > 0 &&
        Number.isFinite(expectedRoas) &&
        expectedRoas > 0
            ? Math.min(360, (currentRoas / expectedRoas) * 360)
            : Number.isFinite(currentRoas) && currentRoas > 0
              ? Math.min(360, (currentRoas / 5) * 360)
              : 0;

    const paymentSplitDeg =
        paidOrdersPct > 0 || codOrdersPct > 0
            ? Math.min(360, Math.max(0, (paidOrdersPct / 100) * 360))
            : 0;
    const hasOrderPaymentMix = paidOrdersPct > 0 || codOrdersPct > 0;

    return (
        <article className="shopify-dash-card shopify-dash-card--roas">
            <div className="shopify-dash-card__accent" aria-hidden />
            <div className="shopify-dash-card__noise" aria-hidden />
            <header className="shopify-dash-card__head">
                <div className="shopify-dash-card__icon" aria-hidden>
                    <IconTrending />
                </div>
                <div className="shopify-dash-card__titles">
                    <p className="shopify-dash-card__eyebrow">Ads efficiency</p>
                    <h3 className="shopify-dash-card__heading">Return on ad spend</h3>
                </div>
            </header>
            <div className="shopify-dash-card__roas-stack">
                <div className="shopify-dash-card__roas-body">
                    <div
                        className="shopify-dash-card__gauge"
                        style={{ '--shopify-gauge-deg': `${gaugeDeg}deg` } as CSSProperties}
                        role="img"
                        aria-label={`ROAS ${formatRoas(currentRoas)}, expected ${formatRoas(expectedRoas)}`}
                    >
                        <div className="shopify-dash-card__gauge-cutout">
                            <span className="shopify-dash-card__gauge-value">{formatRoas(currentRoas)}</span>
                            <span className="shopify-dash-card__gauge-label">current</span>
                        </div>
                    </div>
                    <div className="shopify-dash-card__roas-side">
                        <p className="shopify-dash-card__compare-label">Target</p>
                        <p className="shopify-dash-card__compare-value">{formatRoas(expectedRoas)}</p>
                        <p className="shopify-dash-card__compare-hint">expected ROAS</p>
                    </div>
                </div>
                <div className="shopify-dash-card__roas-payment-row">
                    <div
                        className={`shopify-dash-card__gauge shopify-dash-card__gauge--payment shopify-dash-card__gauge--payment-lg${
                            hasOrderPaymentMix ? '' : ' shopify-dash-card__gauge--payment-empty'
                        }`}
                        style={
                            {
                                '--shopify-pay-split': `${paymentSplitDeg}deg`,
                            } as CSSProperties
                        }
                        role="img"
                        aria-label={`Orders Paid ${paidOrdersPct} percent, COD ${codOrdersPct} percent`}
                    >
                        <div className="shopify-dash-card__gauge-cutout shopify-dash-card__gauge-cutout--payment shopify-dash-card__gauge-cutout--payment-lg">
                            {hasOrderPaymentMix ? (
                                <>
                                    <div className="shopify-dash-card__pay-split-line">
                                        <span className="shopify-dash-card__pay-split-pct">{paidOrdersPct}%</span>
                                        <span className="shopify-dash-card__pay-split-name">Pre-Paid</span>
                                    </div>
                                    <div className="shopify-dash-card__pay-split-line">
                                        <span className="shopify-dash-card__pay-split-pct">{codOrdersPct}%</span>
                                        <span className="shopify-dash-card__pay-split-name">COD</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="shopify-dash-card__gauge-value shopify-dash-card__gauge-value--sm">—</span>
                                    <span className="shopify-dash-card__gauge-label">orders</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

function ModernSalesWithEBITAMetric({
    totalSales,
    ebita,
    expectedEbita,
    manufacturingCost,
    expectedManufacturingCost,
    metaSpend,
    miscCost,
    delhiveryCost,
    isMilkSelected,
}: {
    totalSales: number;
    ebita: number;
    expectedEbita: number;
    manufacturingCost: number;
    expectedManufacturingCost: number;
    metaSpend: number;
    miscCost: number;
    delhiveryCost: number;
    isMilkSelected: boolean;
}) {
    return (
        <article className="shopify-dash-card shopify-dash-card--sales">
            <div className="shopify-dash-card__accent" aria-hidden />
            <div className="shopify-dash-card__noise" aria-hidden />
            <header className="shopify-dash-card__head">
                <div className="shopify-dash-card__icon" aria-hidden>
                    <IconWallet />
                </div>
                <div className="shopify-dash-card__titles">
                    <p className="shopify-dash-card__eyebrow">Revenue</p>
                    <h3 className="shopify-dash-card__heading">Sales & EBITA</h3>
                </div>
            </header>
            <div className="shopify-dash-card__hero">
                <p className="shopify-dash-card__figure">{formatCurrency(totalSales)}</p>
                <p className="shopify-dash-card__caption">Total sales in range</p>
            </div>
            <div className={isMilkSelected ? 'shopify-milk-blocked-area shopify-milk-blocked-area--active' : 'shopify-milk-blocked-area'}>
                {isMilkSelected ? (
                    <div className="shopify-dash-card__disabled-overlay" aria-live="polite">
                        Not For Milk
                    </div>
                ) : null}
                <div className="shopify-dash-card__stat-row">
                    <div className={`shopify-dash-card__stat ${ebita >= 0 ? 'shopify-dash-card__stat--pos' : 'shopify-dash-card__stat--neg'}`}>
                        <span className="shopify-dash-card__stat-k">EBITA</span>
                        <span className="shopify-dash-card__stat-v">{formatCurrency(ebita)}</span>
                    </div>
                    <div className={`shopify-dash-card__stat ${expectedEbita >= 0 ? 'shopify-dash-card__stat--pos' : 'shopify-dash-card__stat--neg'}`}>
                        <span className="shopify-dash-card__stat-k">Expected</span>
                        <span className="shopify-dash-card__stat-v">{formatCurrency(expectedEbita)}</span>
                        <span className="shopify-dash-card__stat-h">Incl. in-transit orders</span>
                    </div>
                </div>
                <section className="shopify-dash-card__panel" aria-label="Cost breakdown">
                    <div className="shopify-dash-card__panel-head">
                        <span className="shopify-dash-card__panel-title">Costs</span>
                    </div>
                    <ul className="shopify-dash-card__cost-list">
                        <li><span>Mfg · delivered</span><span>{formatCurrency(manufacturingCost)}</span></li>
                        <li><span>Mfg · expected</span><span>{formatCurrency(expectedManufacturingCost)}</span></li>
                        <li><span>Meta ads</span><span>{formatCurrency(metaSpend)}</span></li>
                        <li><span>Misc</span><span>{formatCurrency(miscCost)}</span></li>
                        <li><span>Delhivery</span><span>{formatCurrency(delhiveryCost)}</span></li>
                    </ul>
                </section>
            </div>
        </article>
    );
}

function ModernDeliveryStatusMetric({
    delivered,
    deliveredAmount,
    rto,
    rtoAmount,
    inTransit,
    inTransitAmount,
    isMilkSelected,
}: {
    delivered: number;
    deliveredAmount: number;
    rto: number;
    rtoAmount: number;
    inTransit: number;
    inTransitAmount: number;
    isMilkSelected: boolean;
}) {
    const totalOrders = delivered + rto + inTransit;
    const totalAmount = deliveredAmount + rtoAmount + inTransitAmount;
    const pct = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);
    const orderPct = {
        delivered: pct(delivered, totalOrders),
        rto: pct(rto, totalOrders),
        inTransit: totalOrders > 0 ? Math.max(0, 100 - pct(delivered, totalOrders) - pct(rto, totalOrders)) : 0,
    };
    const amountPct = {
        delivered: pct(deliveredAmount, totalAmount),
        rto: pct(rtoAmount, totalAmount),
        inTransit:
            totalAmount > 0 ? Math.max(0, 100 - pct(deliveredAmount, totalAmount) - pct(rtoAmount, totalAmount)) : 0,
    };

    const splitSegClass = (pctVal: number): string =>
        pctVal > 0 && pctVal < 9 ? ' shopify-dash-card__ship-split-seg--narrow' : '';

    return (
        <article className={`shopify-dash-card shopify-dash-card--ship${isMilkSelected ? ' shopify-dash-card--disabled' : ''}`}>
            <div className="shopify-dash-card__accent" aria-hidden />
            <div className="shopify-dash-card__noise" aria-hidden />
            {isMilkSelected ? (
                <div className="shopify-dash-card__disabled-overlay" aria-live="polite">
                    Not For Milk
                </div>
            ) : null}
            <header className="shopify-dash-card__head">
                <div className="shopify-dash-card__icon" aria-hidden>
                    <IconPackage />
                </div>
                <div className="shopify-dash-card__titles">
                    <p className="shopify-dash-card__eyebrow">Fulfillment</p>
                    <h3 className="shopify-dash-card__heading">Shipping pipeline</h3>
                </div>
            </header>
            <ul className="shopify-dash-card__ship-list">
                <li className="shopify-dash-card__ship-item shopify-dash-card__ship-item--delivered">
                    <div className="shopify-dash-card__ship-track" />
                    <div className="shopify-dash-card__ship-body">
                        <span className="shopify-dash-card__ship-name">Delivered</span>
                        <span className="shopify-dash-card__ship-count">{delivered} orders</span>
                    </div>
                    <span className="shopify-dash-card__ship-amt">{formatCurrency(deliveredAmount)}</span>
                </li>
                <li className="shopify-dash-card__ship-item shopify-dash-card__ship-item--rto">
                    <div className="shopify-dash-card__ship-track" />
                    <div className="shopify-dash-card__ship-body">
                        <span className="shopify-dash-card__ship-name">RTO</span>
                        <span className="shopify-dash-card__ship-count">{rto} orders</span>
                    </div>
                    <span className="shopify-dash-card__ship-amt">{formatCurrency(rtoAmount)}</span>
                </li>
                <li className="shopify-dash-card__ship-item shopify-dash-card__ship-item--transit">
                    <div className="shopify-dash-card__ship-track" />
                    <div className="shopify-dash-card__ship-body">
                        <span className="shopify-dash-card__ship-name">In transit</span>
                        <span className="shopify-dash-card__ship-count">{inTransit} orders</span>
                    </div>
                    <span className="shopify-dash-card__ship-amt">{formatCurrency(inTransitAmount)}</span>
                </li>
            </ul>
            <div className="shopify-dash-card__ship-charts">
                <section className="shopify-dash-card__ship-chart" aria-label="Order share by status">
                    <p className="shopify-dash-card__ship-chart-label">Orders</p>
                    {totalOrders > 0 ? (
                        <div
                            className="shopify-dash-card__ship-split-bar"
                            role="img"
                            aria-label={`Delivered ${orderPct.delivered}%, RTO ${orderPct.rto}%, In transit ${orderPct.inTransit}%`}
                        >
                            {orderPct.delivered > 0 ? (
                                <div
                                    className={
                                        'shopify-dash-card__ship-split-seg shopify-dash-card__ship-split-seg--delivered' +
                                        splitSegClass(orderPct.delivered)
                                    }
                                    style={{ flex: `0 0 ${orderPct.delivered}%` }}
                                >
                                    <span className="shopify-dash-card__ship-split-pct">{orderPct.delivered}%</span>
                                </div>
                            ) : null}
                            {orderPct.rto > 0 ? (
                                <div
                                    className={
                                        'shopify-dash-card__ship-split-seg shopify-dash-card__ship-split-seg--rto' +
                                        splitSegClass(orderPct.rto)
                                    }
                                    style={{ flex: `0 0 ${orderPct.rto}%` }}
                                >
                                    <span className="shopify-dash-card__ship-split-pct">{orderPct.rto}%</span>
                                </div>
                            ) : null}
                            {orderPct.inTransit > 0 ? (
                                <div
                                    className={
                                        'shopify-dash-card__ship-split-seg shopify-dash-card__ship-split-seg--transit' +
                                        splitSegClass(orderPct.inTransit)
                                    }
                                    style={{ flex: `0 0 ${orderPct.inTransit}%` }}
                                >
                                    <span className="shopify-dash-card__ship-split-pct">{orderPct.inTransit}%</span>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="shopify-dash-card__ship-split-bar shopify-dash-card__ship-split-bar--empty" aria-hidden />
                    )}
                </section>
                <section className="shopify-dash-card__ship-chart" aria-label="Amount share by status">
                    <p className="shopify-dash-card__ship-chart-label">Amount</p>
                    {totalAmount > 0 ? (
                        <div
                            className="shopify-dash-card__ship-split-bar"
                            role="img"
                            aria-label={`Delivered ${amountPct.delivered}%, RTO ${amountPct.rto}%, In transit ${amountPct.inTransit}%`}
                        >
                            {amountPct.delivered > 0 ? (
                                <div
                                    className={
                                        'shopify-dash-card__ship-split-seg shopify-dash-card__ship-split-seg--delivered' +
                                        splitSegClass(amountPct.delivered)
                                    }
                                    style={{ flex: `0 0 ${amountPct.delivered}%` }}
                                >
                                    <span className="shopify-dash-card__ship-split-pct">{amountPct.delivered}%</span>
                                </div>
                            ) : null}
                            {amountPct.rto > 0 ? (
                                <div
                                    className={
                                        'shopify-dash-card__ship-split-seg shopify-dash-card__ship-split-seg--rto' +
                                        splitSegClass(amountPct.rto)
                                    }
                                    style={{ flex: `0 0 ${amountPct.rto}%` }}
                                >
                                    <span className="shopify-dash-card__ship-split-pct">{amountPct.rto}%</span>
                                </div>
                            ) : null}
                            {amountPct.inTransit > 0 ? (
                                <div
                                    className={
                                        'shopify-dash-card__ship-split-seg shopify-dash-card__ship-split-seg--transit' +
                                        splitSegClass(amountPct.inTransit)
                                    }
                                    style={{ flex: `0 0 ${amountPct.inTransit}%` }}
                                >
                                    <span className="shopify-dash-card__ship-split-pct">{amountPct.inTransit}%</span>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="shopify-dash-card__ship-split-bar shopify-dash-card__ship-split-bar--empty" aria-hidden />
                    )}
                </section>
            </div>
        </article>
    );
}

function ModernQuantityMetric({
    quantityBySize,
    deliveredQuantityBySize,
    rtoQuantityBySize,
    inTransitQuantityBySize,
    gheeLitersByKind,
    isMilkSelected,
}: {
    quantityBySize: { [key: string]: number };
    deliveredQuantityBySize: { [key: string]: number };
    rtoQuantityBySize: { [key: string]: number };
    inTransitQuantityBySize: { [key: string]: number };
    gheeLitersByKind: GheeLitersByKind;
    isMilkSelected: boolean;
}) {
    const totalQuantityInLiters = (quantityBySize['500ml'] || 0) * 0.5 + (quantityBySize['1ltr'] || 0) * 1 + (quantityBySize['5ltr'] || 0) * 5;
    const totalDeliveredInLiters = (deliveredQuantityBySize['500ml'] || 0) * 0.5 + (deliveredQuantityBySize['1ltr'] || 0) * 1 + (deliveredQuantityBySize['5ltr'] || 0) * 5;
    const formatLiters = (liters: number): string => (liters % 1 === 0 ? liters.toLocaleString() + ' L' : liters.toFixed(1).replace(/\.?0+$/, '') + ' L');

    const sizeRows: { key: '500ml' | '1ltr' | '5ltr'; label: string }[] = [
        { key: '500ml', label: '500 ml' },
        { key: '1ltr', label: '1 L' },
        { key: '5ltr', label: '5 L' },
    ];

    return (
        <article className="shopify-dash-card shopify-dash-card--qty">
            <div className="shopify-dash-card__accent" aria-hidden />
            <div className="shopify-dash-card__noise" aria-hidden />
            <header className="shopify-dash-card__head">
                <div className="shopify-dash-card__icon" aria-hidden>
                    <IconBars />
                </div>
                <div className="shopify-dash-card__titles">
                    <p className="shopify-dash-card__eyebrow">Volume</p>
                    <h3 className="shopify-dash-card__heading">Quantity</h3>
                </div>
            </header>
            <div className="shopify-dash-card__hero shopify-dash-card__hero--split">
                <div>
                    <p className="shopify-dash-card__figure shopify-dash-card__figure--qty">{formatLiters(totalQuantityInLiters)}</p>
                    <p className="shopify-dash-card__caption">Total liters</p>
                </div>
                <div className="shopify-dash-card__pill shopify-dash-card__pill--ok">
                    <span className="shopify-dash-card__pill-k">Delivered</span>
                    <span className="shopify-dash-card__pill-v">{formatLiters(totalDeliveredInLiters)}</span>
                </div>
            </div>
            <div className={isMilkSelected ? 'shopify-milk-blocked-area shopify-milk-blocked-area--active' : 'shopify-milk-blocked-area'}>
                {isMilkSelected ? (
                    <div className="shopify-dash-card__disabled-overlay" aria-live="polite">
                        Not For Milk
                    </div>
                ) : null}
                <section className="shopify-dash-card__ghee-strip" aria-label="Ghee volume by type">
                    <p className="shopify-dash-card__ghee-strip-title">Ghee · total liters by type</p>
                    <div className="shopify-dash-card__ghee-cols">
                        <div className="shopify-dash-card__ghee-col shopify-dash-card__ghee-col--gir">
                            <span className="shopify-dash-card__ghee-label">Gir cow</span>
                            <span className="shopify-dash-card__ghee-val">{formatLiters(gheeLitersByKind.gir)}</span>
                        </div>
                        <div className="shopify-dash-card__ghee-col shopify-dash-card__ghee-col--desi">
                            <span className="shopify-dash-card__ghee-label">Desi cow</span>
                            <span className="shopify-dash-card__ghee-val">{formatLiters(gheeLitersByKind.desi)}</span>
                        </div>
                        <div className="shopify-dash-card__ghee-col shopify-dash-card__ghee-col--buffalo">
                            <span className="shopify-dash-card__ghee-label">Buffalo </span>
                            <span className="shopify-dash-card__ghee-val">{formatLiters(gheeLitersByKind.buffalo)}</span>
                        </div>
                    </div>
                </section>
                {totalQuantityInLiters > 0 ? (
                    <div className="shopify-dash-card__table-wrap">
                        <div className="shopify-dash-card__table" role="table" aria-label="Units by pack size and status">
                            <div className="shopify-dash-card__tr shopify-dash-card__tr--head" role="row">
                                <span role="columnheader">Size</span>
                                <span role="columnheader" title="Total">Tot</span>
                                <span role="columnheader" title="Delivered">Del</span>
                                <span role="columnheader">RTO</span>
                                <span role="columnheader" title="In transit">Trn</span>
                            </div>
                            {sizeRows.map(({ key, label }) =>
                                quantityBySize[key] > 0 ? (
                                    <div key={key} className="shopify-dash-card__tr" role="row">
                                        <span className="shopify-dash-card__td--lead" role="cell">{label}</span>
                                        <span className="shopify-dash-card__td--t" role="cell">{quantityBySize[key].toLocaleString()}</span>
                                        <span className="shopify-dash-card__td--d" role="cell">{(deliveredQuantityBySize[key] || 0).toLocaleString()}</span>
                                        <span className="shopify-dash-card__td--r" role="cell">{(rtoQuantityBySize[key] || 0).toLocaleString()}</span>
                                        <span className="shopify-dash-card__td--i" role="cell">{(inTransitQuantityBySize[key] || 0).toLocaleString()}</span>
                                    </div>
                                ) : null,
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="shopify-dash-card__empty">No volume in this range</p>
                )}
            </div>
        </article>
    );
}

function ModernMetricItemWithAmount({ icon, label, count, amount, iconColor, isLast, isEven }: { icon: string; label: string; count: number; amount: number; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <article className="shopify-dash-card shopify-dash-card--plain">
            <header className="shopify-dash-card__head">
                <span className="shopify-dash-card__icon shopify-dash-card__icon--plain" style={{ color: iconColor }} aria-hidden>
                    {icon}
                </span>
                <h3 className="shopify-dash-card__heading">{label}</h3>
            </header>
            <p className="shopify-dash-card__figure shopify-dash-card__figure--sm">{count.toLocaleString()}</p>
            <p className="shopify-dash-card__sub">{formatCurrency(amount)}</p>
        </article>
    );
}

