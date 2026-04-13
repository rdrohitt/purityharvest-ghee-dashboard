import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { apiFetch } from '../../../api';
import {
    deleteOrder,
    type Order,
    type OrderItem,
    type PaymentStatus,
    type DeliveryStatus,
    type Platform,
    type OrderType,
    DELIVERY_STATUSES,
    deliveryStatusLabel,
    normalizeDeliveryStatus,
} from '../../../utils/orders';
import {
    loadOrdersDashboardFromApi,
    shopifyOrderToOrder,
    fetchOrderById,
    orderDetailToOrder,
    mapDeliveryStatusFromTracking,
    mapOrderType,
    getOrderCustomerName,
    getOrderCustomerPhone,
    getOrderAddress,
    getOrderState,
    getOrderPincode,
    updateShopifyOrderFromForm,
    buildDefaultTrackingUrlFromCourier,
    searchOrdersByPhone,
    toBackendFulfillmentStatus,
    toBackendOrderType,
} from '../../../utils/shopify-orders';
import type { ProductVariantApi } from '../../../types/products';
import type {
    AnalyticsOverviewMarketingSpendByPlatform,
    AnalyticsOverviewPaymentSplit,
    AnalyticsOverviewQuantityBySizeBucket,
    AnalyticsOverviewResponse,
    AnalyticsOverviewSalesEbita,
    AnalyticsOverviewSalesEbitaCosts,
    AnalyticsOverviewShippingPipeline,
    AnalyticsOverviewVolume,
} from '../../../types/analytics-overview';
import type { ShopifyOrderApi, ShopifyOrderProduct, ShopifyOrderProductPopulated } from '../../../types/shopify';
import { fetchAnalyticsOverview } from '../../../utils/analytics';
import { loadProducts, type ProductApiItem } from '../../../utils/products';
import { useAppDispatch, useAppSelector, setProducts, setProductsLoading } from '../../../store';
import AddOrderModal, { type ProductVariantOption, formatVariantLabel } from './AddOrderModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import { DatePicker } from './DatePicker';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { formatCurrency, formatDate, FilterButton, generateWhatsAppSummary, StatusFilter, toInputDate } from './ShopifyShared';
import { Spinner } from '../../../components/Spinner';
import { ShopifyOrdersTable } from './ShopifyOrdersTable';
import { ToastContainer, type Toast } from './ToastContainer';
import './Shopify.scss';

const MIN_PHONE_SEARCH_DIGITS = 10;

function digitsOnly(s: string): string {
    return s.replace(/\D/g, '');
}

function toBackendTrackingStatus(status: DeliveryStatus | ''): string | undefined {
    if (!status) return undefined;
    return status;
}

type UiRange = 'all' | 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';
type CategoryTab = 'all' | 'milk' | 'ghee' | 'oils';
type ShippedTab = 'shipped' | 'notShipped';

/**
 * One normalized category label per line (trimmed, lowercased).
 * Prefer API `productId.category.name`; else product catalog map by product id.
 */
function resolveOrderLineCategoryNorm(
    line: ShopifyOrderProduct,
    productCategoryMap: Map<string, string>,
    catalogLoaded: boolean,
): string {
    const raw = line.productId;
    let productId: string | null = null;
    if (raw && typeof raw === 'object' && '_id' in raw) {
        const pop = raw as ShopifyOrderProductPopulated;
        productId = String(pop._id);
        const cat = pop.category;
        if (cat?.name != null) {
            const n = String(cat.name).trim().toLowerCase();
            if (n) return n;
        }
    } else if (typeof raw === 'string') {
        productId = raw;
    }
    if (productId && catalogLoaded) {
        const fromMap = (productCategoryMap.get(productId) || '').trim().toLowerCase();
        if (fromMap) return fromMap;
    }
    return '';
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
    const [phoneSearchOrders, setPhoneSearchOrders] = useState<ShopifyOrderApi[]>([]);
    const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [appliedCustomStart, setAppliedCustomStart] = useState<string>(toInputDate(new Date()));
    const [appliedCustomEnd, setAppliedCustomEnd] = useState<string>(toInputDate(new Date()));
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
    const [modalApiProducts, setModalApiProducts] = useState<ProductApiItem[]>([]);
    const [modalApiProductsLoading, setModalApiProductsLoading] = useState(false);
    const dispatch = useAppDispatch();
    const products = useAppSelector((state) => state.products.products);
    const productsList = useMemo(() => (Array.isArray(products) ? products : []), [products]);
    const productsLoading = useAppSelector((state) => state.products.loading);
    const [loading, setLoading] = useState(true);
    const [categoryTab, setCategoryTab] = useState<CategoryTab>('ghee');
    const [shippedTab, setShippedTab] = useState<ShippedTab>('shipped');
    const [syncingShopify, setSyncingShopify] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [ordersMeta, setOrdersMeta] = useState<{
        total: number;
        totalPages: number;
        count: number;
        page: number;
        limit: number;
    } | null>(null);
    const [analyticsShippingPipeline, setAnalyticsShippingPipeline] =
        useState<AnalyticsOverviewShippingPipeline | null>(null);
    const [analyticsVolume, setAnalyticsVolume] = useState<AnalyticsOverviewVolume | null>(null);
    const [analyticsPaymentSplit, setAnalyticsPaymentSplit] = useState<AnalyticsOverviewPaymentSplit | null>(null);
    const [analyticsSalesEbita, setAnalyticsSalesEbita] = useState<AnalyticsOverviewSalesEbita | null>(null);
    const [analyticsOverviewLoading, setAnalyticsOverviewLoading] = useState(false);

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
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatus | ''>('');
    const [platformFilter, setPlatformFilter] = useState<Platform | ''>('');
    const [typeFilter, setTypeFilter] = useState<OrderType | ''>('');
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    /** Narrow viewports: metric cards start collapsed; expand from filters toolbar */
    const [mobileMetricsOpen, setMobileMetricsOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (productsList.length > 0 || productsLoading) {
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
    }, [dispatch, productsList.length, productsLoading]);

    useEffect(() => {
        if (!(showAddOrder || editingOrder)) return;
        let cancelled = false;
        setModalApiProductsLoading(true);
        loadProducts()
            .then((data) => {
                if (!cancelled) {
                    setModalApiProducts(data);
                }
            })
            .catch((err) => {
                console.error('Failed to load modal products', err);
                if (!cancelled) {
                    setModalApiProducts([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setModalApiProductsLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [showAddOrder, editingOrder]);

    useEffect(() => {
        if (!(showAddOrder || editingOrder)) return;
        if (productsList.length > 0 || productsLoading) return;
        let cancelled = false;
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
    }, [dispatch, showAddOrder, editingOrder, productsList.length, productsLoading]);

    const getLocalDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Compute from/to for API based on selected range (YYYY-MM-DD)
    const dateRangeForApi = useMemo((): { from: string; to: string } => {
        const now = new Date();
        const todayStr = getLocalDateString(now);
        if (range === 'all') {
            return { from: '2024-01-01', to: todayStr };
        }
        if (range === 'custom') {
            return { from: appliedCustomStart, to: appliedCustomEnd };
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
    }, [range, appliedCustomStart, appliedCustomEnd]);

    const applyAnalyticsOverviewData = useCallback((data: AnalyticsOverviewResponse) => {
        setAnalyticsShippingPipeline(data.shippingPipeline ?? null);
        setAnalyticsVolume(data.volume ?? null);
        setAnalyticsPaymentSplit(data.paymentSplit ?? null);
        setAnalyticsSalesEbita(data.salesEbita ?? null);
    }, []);

    const refreshAnalyticsOverview = useCallback(async () => {
        setAnalyticsOverviewLoading(true);
        try {
            const data = await fetchAnalyticsOverview(dateRangeForApi.from, dateRangeForApi.to);
            applyAnalyticsOverviewData(data);
        } catch (err) {
            console.error('Failed to refresh analytics overview', err);
        } finally {
            setAnalyticsOverviewLoading(false);
        }
    }, [dateRangeForApi.from, dateRangeForApi.to, applyAnalyticsOverviewData]);

    useEffect(() => {
        let cancelled = false;
        setAnalyticsOverviewLoading(true);
        fetchAnalyticsOverview(dateRangeForApi.from, dateRangeForApi.to)
            .then((data) => {
                if (!cancelled) {
                    applyAnalyticsOverviewData(data);
                }
            })
            .catch((err) => {
                console.error('Failed to load analytics overview', err);
                if (!cancelled) {
                    setAnalyticsShippingPipeline(null);
                    setAnalyticsVolume(null);
                    setAnalyticsPaymentSplit(null);
                    setAnalyticsSalesEbita(null);
                }
            })
            .finally(() => {
                if (!cancelled) setAnalyticsOverviewLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [dateRangeForApi.from, dateRangeForApi.to, applyAnalyticsOverviewData]);

    /** GET /api/orders with date range + pagination + selected dropdown filters. */
    const ordersListQuery = useMemo(
        () => ({
            from: dateRangeForApi.from,
            to: dateRangeForApi.to,
            page,
            limit: pageSize,
            type: typeFilter ? String(typeFilter).toLowerCase() : undefined,
            platform: platformFilter ? String(platformFilter).toLowerCase() : undefined,
            paymentMode: paymentStatusFilter || undefined,
            trackingStatus: toBackendTrackingStatus(deliveryStatusFilter),
            shipped: shippedTab === 'shipped' ? true : false,
        }),
        [
            dateRangeForApi.from,
            dateRangeForApi.to,
            page,
            pageSize,
            typeFilter,
            platformFilter,
            paymentStatusFilter,
            deliveryStatusFilter,
            shippedTab,
        ],
    );

    useEffect(() => {
        setPage(1);
    }, [
        dateRangeForApi.from,
        dateRangeForApi.to,
        typeFilter,
        platformFilter,
        paymentStatusFilter,
        deliveryStatusFilter,
        shippedTab,
    ]);

    const loadOrdersPage = async (query = ordersListQuery) => {
        const dash = await loadOrdersDashboardFromApi(query);
        setOrdersMeta({
            total: dash.total,
            totalPages: dash.totalPages,
            count: dash.count,
            page: dash.page,
            limit: dash.limit,
        });
        if (dash.page !== page) {
            setPage(dash.page);
        }
        setOrders(dash.rows);
    };

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
            await loadOrdersPage(ordersListQuery);
            await refreshAnalyticsOverview();
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
        loadOrdersDashboardFromApi(ordersListQuery)
            .then((dash) => {
                if (!cancelled) {
                    setOrdersMeta({
                        total: dash.total,
                        totalPages: dash.totalPages,
                        count: dash.count,
                        page: dash.page,
                        limit: dash.limit,
                    });
                    if (dash.page !== page) {
                        setPage(dash.page);
                    }
                    setOrders(dash.rows);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setOrders([]);
                    setOrdersMeta(null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [ordersListQuery, page]);

    const phoneDigits = useMemo(() => digitsOnly(customerFilter), [customerFilter]);
    const isPhoneSearch = phoneDigits.length === MIN_PHONE_SEARCH_DIGITS;

    useEffect(() => {
        if (!isPhoneSearch) {
            setPhoneSearchOrders([]);
            setPhoneSearchLoading(false);
            return;
        }
        let cancelled = false;
        const t = window.setTimeout(() => {
            (async () => {
                try {
                    setPhoneSearchLoading(true);
                    setPhoneSearchOrders([]);
                    const rows = await searchOrdersByPhone(phoneDigits, dateRangeForApi.from, dateRangeForApi.to);
                    if (!cancelled) setPhoneSearchOrders(rows);
                } catch (err) {
                    console.error('Failed to search orders by phone', err);
                    if (!cancelled) setPhoneSearchOrders([]);
                } finally {
                    if (!cancelled) setPhoneSearchLoading(false);
                }
            })();
        }, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [phoneDigits, isPhoneSearch, dateRangeForApi.from, dateRangeForApi.to]);

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

    const modalProductSource = useMemo(
        () => (modalApiProducts.length > 0 ? modalApiProducts : productsList),
        [modalApiProducts, productsList],
    );

    const productOptions = useMemo((): ProductVariantOption[] => {
        return modalProductSource.flatMap((p) => {
            const variants: ProductVariantApi[] = Array.isArray(p.variants) ? p.variants : [];
            if (variants.length === 0) {
                return [
                    {
                        id: p._id,
                        name: p.name,
                        size: '',
                        price: Number(p.price || 0),
                    },
                ];
            }

            return variants.map((v) => ({
                id: p._id,
                name: p.name,
                size: v.name,
                price: v.price,
            }));
        });
    }, [modalProductSource]);

    const productCategoryMap = useMemo(() => {
        const map = new Map<string, string>();
        productsList.forEach((p) => {
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
    }, [productsList]);

    const generatedPlusUser = useMemo(() => {
        const source = isPhoneSearch ? phoneSearchOrders : orders;
        return [...source].sort((a, b) => {
            const dA = a.createdAt ?? a.date ?? '';
            const dB = b.createdAt ?? b.date ?? '';
            return dA > dB ? -1 : dA < dB ? 1 : 0;
        });
    }, [isPhoneSearch, phoneSearchOrders, orders]);

    // API already returns orders for the selected date range; no client-side date filter
    const byRange = generatedPlusUser;

    const filtered = useMemo(() => {
        return byRange.filter((o: ShopifyOrderApi) => {
            const matchesCustomer = (() => {
                if (!isPhoneSearch) return true;
                if (phoneSearchLoading) return false;
                return true;
            })();
            const paymentStatus = o.paymentMode === 'PAID' ? 'PAID' : 'COD';
            const matchesPayment = !paymentStatusFilter || paymentStatus === paymentStatusFilter;
            const deliveryStatus = mapDeliveryStatusFromTracking(
                o.shippingDetails?.trackingStatus,
                o.returnStatus,
            );
            const matchesDelivery = !deliveryStatusFilter || deliveryStatus === deliveryStatusFilter;
            const matchesPlatform = !platformFilter || (o.platform && o.platform.toLowerCase() === platformFilter.toLowerCase());
            const matchesType = !typeFilter || mapOrderType(o.type) === typeFilter;
            const matchesState = !stateFilter || o.state === stateFilter;
            const matchesShipped =
                shippedTab === 'shipped' ? o.is_shipped === true : o.is_shipped === false;
            const matchesCategory = (() => {
                if (categoryTab === 'all') return true;
                const lines = o.products || [];
                const catalogLoaded = productCategoryMap.size > 0;

                for (const line of lines) {
                    const catNorm = resolveOrderLineCategoryNorm(line, productCategoryMap, catalogLoaded);
                    if (!catNorm) continue;
                    if (categoryTab === 'milk' && catNorm === 'milk') return true;
                    if (categoryTab === 'ghee' && catNorm === 'ghee') return true;
                    if (categoryTab === 'oils' && catNorm.includes('oil')) return true;
                }
                return false;
            })();
            return (
                matchesCustomer &&
                matchesPayment &&
                matchesDelivery &&
                matchesPlatform &&
                matchesType &&
                matchesShipped &&
                matchesState &&
                matchesCategory
            );
        });
    }, [
        byRange,
        isPhoneSearch,
        phoneSearchLoading,
        paymentStatusFilter,
        deliveryStatusFilter,
        platformFilter,
        typeFilter,
        shippedTab,
        stateFilter,
        categoryTab,
        productCategoryMap,
    ]);

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

    /** Remount orders table when a new API page loads so progressive row state resets cleanly. */
    const shopifyOrdersTableKey = useMemo(() => {
        if (isPhoneSearch) {
            if (phoneSearchOrders.length === 0) return `phone-${customerFilter}-empty`;
            return `phone-${customerFilter}-n${phoneSearchOrders.length}-${phoneSearchOrders[0]._id}`;
        }
        if (orders.length === 0) return `p${page}-l${pageSize}-empty`;
        return `p${page}-l${pageSize}-n${orders.length}-${orders[0]._id}-${orders[orders.length - 1]._id}`;
    }, [isPhoneSearch, customerFilter, phoneSearchOrders, orders, page, pageSize]);

    /** During phone search, only block on the phone API — not the paginated `/api/orders` fetch (can be very slow). */
    const showFullPageSpinner = isPhoneSearch ? phoneSearchLoading : loading;

    return (
        <section className="shopify-page">
            {showFullPageSpinner ? (
                <Spinner
                    overlay
                    fixed
                    message={isPhoneSearch ? 'Searching by phone…' : 'Loading Orders'}
                />
            ) : null}
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
                                active={range === 'custom' || showCustom}
                                onClick={() => {
                                    if (!showCustom) {
                                        setCustomStart(appliedCustomStart);
                                        setCustomEnd(appliedCustomEnd);
                                    }
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
                                type="search"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={MIN_PHONE_SEARCH_DIGITS}
                                placeholder={`Enter ${MIN_PHONE_SEARCH_DIGITS} phone digits to search (e.g. 9876543210)`}
                                aria-label={`Phone search; enter ${MIN_PHONE_SEARCH_DIGITS} digits`}
                                value={customerFilter}
                                onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, MIN_PHONE_SEARCH_DIGITS);
                                    setCustomerFilter(digits);
                                }}
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
                            label="Shipping"
                            value={deliveryStatusFilter}
                            onChange={setDeliveryStatusFilter}
                            options={DELIVERY_STATUSES}
                            formatOptionLabel={(v) => deliveryStatusLabel(v)}
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
                                const headers = [
                                    'S.No',
                                    'Customer Name',
                                    'Phone No',
                                    'Address',
                                    'Shipping Status',
                                    'Quantity (L)',
                                    'Amount',
                                    'State',
                                    'Pincode',
                                ];

                                function lineLitersFromOrder(order: ShopifyOrderApi): number {
                                    return (order.products || []).reduce(
                                        (sum: number, p: { variantName: string; quantity: number }) => {
                                            const sizeMatch = (p.variantName || '').match(
                                                /-?\s*(\d+(?:\.\d+)?)\s*(ml|ltr|L)/i,
                                            );
                                            if (!sizeMatch) return sum;
                                            const sizeValue = parseFloat(sizeMatch[1]);
                                            const sizeUnit = sizeMatch[2].toLowerCase();
                                            let litersPerUnit = 0;
                                            if (sizeUnit === 'ml') litersPerUnit = sizeValue / 1000;
                                            else if (sizeUnit === 'l' || sizeUnit === 'ltr')
                                                litersPerUnit = sizeValue;
                                            return sum + litersPerUnit * p.quantity;
                                        },
                                        0,
                                    );
                                }

                                function csvEscapeCell(cell: unknown): string {
                                    const cellStr = String(cell);
                                    if (
                                        cellStr.includes(',') ||
                                        cellStr.includes('"') ||
                                        cellStr.includes('\n')
                                    ) {
                                        return `"${cellStr.replace(/"/g, '""')}"`;
                                    }
                                    return cellStr;
                                }

                                function rowToCsvLine(row: unknown[]): string {
                                    return row.map(csvEscapeCell).join(',');
                                }

                                // Include all orders (COD, PAID, RTO, In Transit, etc.)
                                const exportableOrders = filtered;
                                let sumQuantityL = 0;
                                let sumAmount = 0;
                                const rows = exportableOrders.map((order: ShopifyOrderApi, index: number) => {
                                    const qtyL = lineLitersFromOrder(order);
                                    const amt = Number(order.totalAmount) || 0;
                                    sumQuantityL += qtyL;
                                    sumAmount += amt;
                                    return [
                                        index + 1,
                                        getOrderCustomerName(order),
                                        getOrderCustomerPhone(order),
                                        getOrderAddress(order),
                                        deliveryStatusLabel(
                                            order.shippingDetails?.trackingStatus,
                                            order.returnStatus,
                                        ),
                                        qtyL === 0 ? 0 : Number(qtyL.toFixed(4)),
                                        amt,
                                        getOrderState(order),
                                        getOrderPincode(order),
                                    ];
                                });

                                const totalRow = [
                                    'Total',
                                    '',
                                    '',
                                    '',
                                    '',
                                    Number(sumQuantityL.toFixed(4)),
                                    Number(sumAmount.toFixed(2)),
                                    '',
                                    '',
                                ];

                                const csvContent = [
                                    rowToCsvLine(headers),
                                    ...rows.map(rowToCsvLine),
                                    rowToCsvLine(totalRow),
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
                        {(paymentStatusFilter || deliveryStatusFilter || platformFilter || typeFilter) ? (
                            <button
                                type="button"
                                className="shopify-clear-filters-btn"
                                onClick={() => { 
                                    setPaymentStatusFilter(''); 
                                    setDeliveryStatusFilter(''); 
                                    setPlatformFilter(''); 
                                    setTypeFilter(''); 
                                }}
                            >
                                Clear All
                            </button>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className="shopify-mobile-metrics-toggle"
                        aria-expanded={mobileMetricsOpen}
                        onClick={() => setMobileMetricsOpen((o) => !o)}
                    >
                        <span className="shopify-mobile-metrics-toggle__label">Metrics summary</span>
                        <svg
                            className={`shopify-mobile-metrics-toggle__chev${mobileMetricsOpen ? ' is-open' : ''}`}
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>
                <div
                    className={`shopify-dash-mobile-wrap${mobileMetricsOpen ? ' shopify-dash-mobile-wrap--open' : ''}`}
                >
                    <div className="shopify-dash-mobile-inner">
                        <div className="shopify-dash-grid">
                            <ModernSalesWithEBITAMetric
                                salesEbita={analyticsSalesEbita}
                                loading={analyticsOverviewLoading}
                                isMilkSelected={categoryTab === 'milk'}
                                deliveredSalesAmount={analyticsShippingPipeline?.delivered.amount ?? 0}
                                inTransitSalesAmount={analyticsShippingPipeline?.inTransit.amount ?? 0}
                            />
                            <ModernQuantityMetric
                                volume={analyticsVolume}
                                loading={analyticsOverviewLoading}
                                isMilkSelected={categoryTab === 'milk'}
                            />
                            <ModernDeliveryStatusMetric
                                pipeline={analyticsShippingPipeline}
                                loading={analyticsOverviewLoading}
                                isMilkSelected={categoryTab === 'milk'}
                            />
                            <ModernRoasMetric
                                paymentSplit={analyticsPaymentSplit}
                                loading={analyticsOverviewLoading}
                                deliveredSalesAmount={analyticsShippingPipeline?.delivered.amount ?? 0}
                                inTransitSalesAmount={analyticsShippingPipeline?.inTransit.amount ?? 0}
                                marketingSpendTotal={analyticsSalesEbita?.costs?.marketingSpendTotal ?? 0}
                            />
                        </div>
                    </div>
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
                                onClick={() => {
                                    setAppliedCustomStart(customStart);
                                    setAppliedCustomEnd(customEnd);
                                    setRange('custom');
                                    setShowCustom(false);
                                }}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="shopify-category-tabs">
                <FilterButton
                    active={shippedTab === 'shipped'}
                    onClick={() => setShippedTab('shipped')}
                >
                    Shipped
                </FilterButton>
                <FilterButton
                    active={shippedTab === 'notShipped'}
                    onClick={() => setShippedTab('notShipped')}
                >
                    Not Shipped
                </FilterButton>
            </div>

            <ShopifyOrdersTable
                key={shopifyOrdersTableKey}
                groupedByDate={groupedByDate}
                marketingSpend={[]}
                loading={false}
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
            <footer className="shopify-pagination" aria-label="Orders pagination">
                <div className="shopify-pagination__range">
                    {loading && !isPhoneSearch ? (
                        <span className="shopify-pagination__muted">Loading…</span>
                    ) : isPhoneSearch && phoneSearchLoading ? (
                        <span className="shopify-pagination__muted">Searching by phone…</span>
                    ) : isPhoneSearch && !phoneSearchLoading ? (
                        <>
                            Phone search: showing{' '}
                            <strong>
                                {filtered.length === 0 ? 0 : 1}–{filtered.length}
                            </strong>{' '}
                            of <strong>{filtered.length.toLocaleString()}</strong> in range
                        </>
                    ) : ordersMeta ? (
                        <>
                            Showing{' '}
                            <strong>
                                {ordersMeta.total === 0 ? 0 : (ordersMeta.page - 1) * ordersMeta.limit + 1}–
                                {Math.min(ordersMeta.page * ordersMeta.limit, ordersMeta.total)}
                            </strong>{' '}
                            of <strong>{ordersMeta.total.toLocaleString()}</strong>
                        </>
                    ) : (
                        <span className="shopify-pagination__muted">Total unavailable</span>
                    )}
                </div>
                <label className="shopify-pagination__size">
                    <span className="shopify-pagination__size-lab">Rows per page</span>
                    <select
                        className="shopify-pagination__select"
                        value={pageSize}
                        disabled={(!isPhoneSearch && loading) || (isPhoneSearch && !phoneSearchLoading)}
                        aria-label="Rows per page"
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                        }}
                    >
                        {[20, 50, 100, 250, 500, 1000].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="shopify-pagination__nav">
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={(!isPhoneSearch && loading) || (isPhoneSearch && !phoneSearchLoading) || page <= 1}
                        onClick={() => setPage(1)}
                    >
                        First
                    </button>
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={(!isPhoneSearch && loading) || (isPhoneSearch && !phoneSearchLoading) || page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Prev
                    </button>
                    <span className="shopify-pagination__page-of">
                        Page <strong>{isPhoneSearch && !phoneSearchLoading ? 1 : page}</strong> of{' '}
                        <strong>
                            {isPhoneSearch && !phoneSearchLoading ? 1 : Math.max(1, ordersMeta?.totalPages ?? 1)}
                        </strong>
                    </span>
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={
                            (!isPhoneSearch && loading) ||
                            (isPhoneSearch && !phoneSearchLoading) ||
                            page >= Math.max(1, ordersMeta?.totalPages ?? 1)
                        }
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </button>
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={
                            (!isPhoneSearch && loading) ||
                            (isPhoneSearch && !phoneSearchLoading) ||
                            page >= Math.max(1, ordersMeta?.totalPages ?? 1)
                        }
                        onClick={() => setPage(Math.max(1, ordersMeta?.totalPages ?? 1))}
                    >
                        Last
                    </button>
                </div>
            </footer>

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
                        const wasEditing = editingOrder !== null;
                        setShowAddOrder(false);
                        setEditingOrder(null);
                        // Ensure list refresh uses the same from/to as the date filter (bare GET /orders otherwise).
                        if (wasEditing) {
                            void loadOrdersPage(ordersListQuery).catch(() => {});
                        }
                    }} 
                    onCreate={async (o) => {
                        try {
                            if (editingOrder) {
                                let base = orders.find((ord) => ord._id === editingOrder.id);
                                if (!base) {
                                    base = await fetchOrderById(editingOrder.id);
                                }
                                await updateShopifyOrderFromForm(
                                    base,
                                    o,
                                    (variantLabel) => {
                                        const label = (variantLabel ?? '').trim();
                                        if (!label) return undefined;

                                        const [rawName, ...rest] = label.split('-');
                                        const name = (rawName ?? '').trim();
                                        const size = rest.join('-').trim();

                                        let product: ProductApiItem | undefined =
                                            modalProductSource.find((p) => p.name === name) ||
                                            modalProductSource.find((p) => label.startsWith(p.name));

                                        if (!product) return undefined;

                                        if (!size) {
                                            return product._id;
                                        }

                                        const hasVariant =
                                            Array.isArray(product.variants) &&
                                            product.variants.some((v) => v.name === size);

                                        return hasVariant ? product._id : product._id;
                                    },
                                    modalProductSource,
                                );
                                await loadOrdersPage(ordersListQuery);
                                await refreshAnalyticsOverview();
                                setEditingOrder(null);
                                showToast('Order updated successfully!', 'success');
                            } else {
                                // Build Shopify-style payload for Add Order POST
                                const fulfillmentStatusBackend = toBackendFulfillmentStatus(o.fulfillmentStatus);

                                const shippingStatusBackend = normalizeDeliveryStatus(o.deliveryStatus);

                                const typeBackend = toBackendOrderType(o.type) ?? 'new';

                                const productsPayload = o.items.map((it) => {
                                    const option = productOptions.find(
                                        (p) => formatVariantLabel(p) === (it.variant || '').trim()
                                    );
                                    const unitPrice =
                                        it.quantity > 0 ? it.lineAmount / it.quantity : 0;
                                    return {
                                        productId: option?.id,
                                        quantity: it.quantity,
                                        variantPrice: unitPrice,
                                        price: it.lineAmount,
                                        // Send only the variant name (e.g. "1 Ltr"); omit or empty when product has no variants
                                        variantName: option?.size?.trim()
                                            ? option.size
                                            : undefined,
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
                                        trackingUrl: buildDefaultTrackingUrlFromCourier(
                                            o.awbNumber ?? '',
                                            o.shippingTrackingCompany ?? '',
                                        ),
                                        trackingCompany: o.shippingTrackingCompany ?? '',
                                    },
                                    totalAmount: o.amount,
                                    codCharges: o.codCharges ?? 0,
                                    partialAmount: o.partialAmount ?? 0,
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
                                await loadOrdersPage(ordersListQuery);
                                await refreshAnalyticsOverview();
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
                            await loadOrdersPage(ordersListQuery);
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

const EMPTY_PAYMENT_SPLIT: AnalyticsOverviewPaymentSplit = {
    totalOrders: 0,
    prepaid: { count: 0, percentage: 0 },
    cod: { count: 0, percentage: 0 },
    unknown: { count: 0, percentage: 0 },
};

function formatPctLabel(n: number): string {
    const x = Number(n) || 0;
    if (!Number.isFinite(x)) return '0';
    return x % 1 === 0 ? String(x) : x.toFixed(1);
}

/**
 * Current ROAS = delivered sales amount ÷ marketing spend total.
 * Expected ROAS = (delivered + in-transit) sales amount ÷ marketing spend total.
 * Payment mix donut still uses `paymentSplit`.
 */
function ModernRoasMetric({
    paymentSplit,
    loading,
    deliveredSalesAmount,
    inTransitSalesAmount,
    marketingSpendTotal,
}: {
    paymentSplit: AnalyticsOverviewPaymentSplit | null;
    loading: boolean;
    deliveredSalesAmount: number;
    inTransitSalesAmount: number;
    marketingSpendTotal: number;
}) {
    const ps = paymentSplit ?? EMPTY_PAYMENT_SPLIT;
    const prepaidPct = Math.max(0, Math.min(100, Number(ps.prepaid?.percentage) || 0));
    const codPct = Math.max(0, Math.min(100, Number(ps.cod?.percentage) || 0));
    const hasOrderPaymentMix = (ps.totalOrders ?? 0) > 0 && (prepaidPct > 0 || codPct > 0);

    const spend = Math.max(0, Number(marketingSpendTotal) || 0);
    const delivered = Math.max(0, Number(deliveredSalesAmount) || 0);
    const inTransit = Math.max(0, Number(inTransitSalesAmount) || 0);
    const currentRoas = spend > 0 ? delivered / spend : 0;
    const expectedRoas = spend > 0 ? (delivered + inTransit) / spend : 0;

    const formatRoas = (v: number): string => {
        if (!Number.isFinite(v) || v <= 0) return '0.00';
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
        prepaidPct > 0 || codPct > 0 ? Math.min(360, Math.max(0, (prepaidPct / 100) * 360)) : 0;

    return (
        <article
            className={`shopify-dash-card shopify-dash-card--roas${loading ? ' shopify-dash-card--shimmer' : ''}`}
            aria-busy={loading}
        >
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
                        aria-label={`Prepaid ${formatPctLabel(prepaidPct)} percent, COD ${formatPctLabel(codPct)} percent`}
                    >
                        <div className="shopify-dash-card__gauge-cutout shopify-dash-card__gauge-cutout--payment shopify-dash-card__gauge-cutout--payment-lg">
                            {hasOrderPaymentMix ? (
                                <>
                                    <div className="shopify-dash-card__pay-split-line">
                                        <span className="shopify-dash-card__pay-split-pct">{formatPctLabel(prepaidPct)}%</span>
                                        <span className="shopify-dash-card__pay-split-name">Pre-Paid</span>
                                    </div>
                                    <div className="shopify-dash-card__pay-split-line">
                                        <span className="shopify-dash-card__pay-split-pct">{formatPctLabel(codPct)}%</span>
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

const EMPTY_SALES_EBITA_COSTS: AnalyticsOverviewSalesEbitaCosts = {
    manufacturingDelivered: 0,
    manufacturingExpected: 0,
    marketingSpendTotal: 0,
    marketingSpendByPlatform: {},
};

const EMPTY_SALES_EBITA: AnalyticsOverviewSalesEbita = {
    costs: EMPTY_SALES_EBITA_COSTS,
};

/** Meta ads line: sum buckets whose key starts with "meta" (e.g. meta1). */
function sumMetaMarketingSpend(platform: AnalyticsOverviewMarketingSpendByPlatform): number {
    let s = 0;
    for (const [k, v] of Object.entries(platform)) {
        if (/^meta/i.test(k)) s += Number(v) || 0;
    }
    return s;
}

/** Delhivery + Amazon Shipping from `marketingSpendByPlatform`. */
function shippingMarketingSpendFromPlatforms(platform: AnalyticsOverviewMarketingSpendByPlatform): number {
    return (Number(platform.delhivery) || 0) + (Number(platform.amazon_shipping) || 0);
}

function ModernSalesWithEBITAMetric({
    salesEbita,
    loading,
    isMilkSelected,
    deliveredSalesAmount,
    inTransitSalesAmount,
}: {
    salesEbita: AnalyticsOverviewSalesEbita | null;
    loading: boolean;
    isMilkSelected: boolean;
    deliveredSalesAmount: number;
    inTransitSalesAmount: number;
}) {
    const se = salesEbita ?? EMPTY_SALES_EBITA;
    const costs: AnalyticsOverviewSalesEbitaCosts = {
        ...EMPTY_SALES_EBITA_COSTS,
        ...se.costs,
        marketingSpendByPlatform: {
            ...EMPTY_SALES_EBITA_COSTS.marketingSpendByPlatform,
            ...(se.costs?.marketingSpendByPlatform ?? {}),
        },
    };
    const platform = costs.marketingSpendByPlatform;
    const totalSales = Number(se.totalSales) || 0;
    const spend = Math.max(0, Number(costs.marketingSpendTotal) || 0);
    const delivered = Math.max(0, Number(deliveredSalesAmount) || 0);
    const inTransit = Math.max(0, Number(inTransitSalesAmount) || 0);
    const manufacturingCost = Number(costs.manufacturingDelivered) || 0;
    const expectedManufacturingCost = Number(costs.manufacturingExpected) || 0;
    /** Delivered pipeline amount − (marketingSpendTotal + Mfg · delivered). */
    const ebita = delivered - (spend + manufacturingCost);
    /** (Delivered + In Transit, shipping pipeline) − (Marketing spend · total + Mfg · expected). */
    const expectedEbita = delivered + inTransit - (spend + expectedManufacturingCost);
    const metaSpend = sumMetaMarketingSpend(platform);
    const miscCost = Number(platform.misc) || 0;
    const shippingCost = shippingMarketingSpendFromPlatforms(platform);

    return (
        <article
            className={`shopify-dash-card shopify-dash-card--sales${loading ? ' shopify-dash-card--shimmer' : ''}`}
            aria-busy={loading}
        >
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
                        <span
                            className="shopify-dash-card__stat-v"
                            title="Delivered amount (shipping pipeline) minus marketing spend total and Mfg · delivered"
                        >
                            {formatCurrency(ebita)}
                        </span>
                    </div>
                    <div className={`shopify-dash-card__stat ${expectedEbita >= 0 ? 'shopify-dash-card__stat--pos' : 'shopify-dash-card__stat--neg'}`}>
                        <span className="shopify-dash-card__stat-k">Expected</span>
                        <span
                            className="shopify-dash-card__stat-v"
                            title="(Delivered + In Transit from shipping pipeline) minus (Marketing spend · total + Mfg · expected)"
                        >
                            {formatCurrency(expectedEbita)}
                        </span>
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
                        <li title="Delhivery + Amazon Shipping (marketing spend in range)">
                            <span>Shipping</span>
                            <span>{formatCurrency(shippingCost)}</span>
                        </li>
                        <li title="marketingSpendTotal from analytics overview">
                            <span>Marketing spend · total</span>
                            <span>{formatCurrency(spend)}</span>
                        </li>
                    </ul>
                </section>
            </div>
        </article>
    );
}

const EMPTY_SHIPPING_PIPELINE: AnalyticsOverviewShippingPipeline = {
    delivered: { count: 0, amount: 0 },
    rto: { count: 0, amount: 0 },
    inTransit: { count: 0, amount: 0 },
};

function ModernDeliveryStatusMetric({
    pipeline,
    loading,
    isMilkSelected,
}: {
    pipeline: AnalyticsOverviewShippingPipeline | null;
    loading: boolean;
    isMilkSelected: boolean;
}) {
    const p = pipeline ?? EMPTY_SHIPPING_PIPELINE;
    const delivered = p.delivered.count;
    const deliveredAmount = p.delivered.amount;
    const rto = p.rto.count;
    const rtoAmount = p.rto.amount;
    const inTransit = p.inTransit.count;
    const inTransitAmount = p.inTransit.amount;
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
        <article
            className={`shopify-dash-card shopify-dash-card--ship${isMilkSelected ? ' shopify-dash-card--disabled' : ''}${
                loading ? ' shopify-dash-card--shimmer' : ''
            }`}
            aria-busy={loading}
        >
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
            <ul className="shopify-dash-card__ship-list" aria-busy={loading}>
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

const EMPTY_VOLUME: AnalyticsOverviewVolume = {
    totalLitres: 0,
    litresByType: { girCow: 0, desiCow: 0, buffalo: 0 },
    quantityBySize: {},
};

const VOLUME_SIZE_ROW_DEFS: { apiKeys: string[]; label: string; litersPerUnit: number }[] = [
    { apiKeys: ['500ml'], label: '500 ml', litersPerUnit: 0.5 },
    { apiKeys: ['1litre', '1ltr'], label: '1 L', litersPerUnit: 1 },
    { apiKeys: ['2litre', '2ltr'], label: '2 L', litersPerUnit: 2 },
    { apiKeys: ['5litre', '5ltr'], label: '5 L', litersPerUnit: 5 },
];

function bucketForVolumeRowKeys(
    qbs: AnalyticsOverviewVolume['quantityBySize'],
    apiKeys: string[],
): AnalyticsOverviewQuantityBySizeBucket {
    const empty: AnalyticsOverviewQuantityBySizeBucket = { ordered: 0, delivered: 0, rto: 0, inTransit: 0 };
    for (const k of apiKeys) {
        const b = qbs[k];
        if (b) {
            return {
                ordered: Number(b.ordered) || 0,
                delivered: Number(b.delivered) || 0,
                rto: Number(b.rto) || 0,
                inTransit: Number(b.inTransit) || 0,
            };
        }
    }
    return empty;
}

function ModernQuantityMetric({
    volume,
    loading,
    isMilkSelected,
}: {
    volume: AnalyticsOverviewVolume | null;
    loading: boolean;
    isMilkSelected: boolean;
}) {
    const v = volume ?? EMPTY_VOLUME;
    const totalLitres = Number(v.totalLitres) || 0;
    const lt = v.litresByType;
    const totalDeliveredLitres = VOLUME_SIZE_ROW_DEFS.reduce((sum, row) => {
        const b = bucketForVolumeRowKeys(v.quantityBySize, row.apiKeys);
        return sum + b.delivered * row.litersPerUnit;
    }, 0);
    const hasAnySizeRow = VOLUME_SIZE_ROW_DEFS.some(
        (row) => bucketForVolumeRowKeys(v.quantityBySize, row.apiKeys).ordered > 0,
    );
    const showVolumeDetail = totalLitres > 0 || hasAnySizeRow;
    const formatLiters = (liters: number): string =>
        liters % 1 === 0 ? liters.toLocaleString() + ' L' : liters.toFixed(1).replace(/\.?0+$/, '') + ' L';

    return (
        <article
            className={`shopify-dash-card shopify-dash-card--qty${loading ? ' shopify-dash-card--shimmer' : ''}`}
            aria-busy={loading}
        >
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
                    <p className="shopify-dash-card__figure shopify-dash-card__figure--qty">{formatLiters(totalLitres)}</p>
                    <p className="shopify-dash-card__caption">Total liters</p>
                </div>
                <div className="shopify-dash-card__pill shopify-dash-card__pill--ok">
                    <span className="shopify-dash-card__pill-k">Delivered</span>
                    <span className="shopify-dash-card__pill-v">{formatLiters(totalDeliveredLitres)}</span>
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
                            <span className="shopify-dash-card__ghee-val">{formatLiters(Number(lt.girCow) || 0)}</span>
                        </div>
                        <div className="shopify-dash-card__ghee-col shopify-dash-card__ghee-col--desi">
                            <span className="shopify-dash-card__ghee-label">Desi cow</span>
                            <span className="shopify-dash-card__ghee-val">{formatLiters(Number(lt.desiCow) || 0)}</span>
                        </div>
                        <div className="shopify-dash-card__ghee-col shopify-dash-card__ghee-col--buffalo">
                            <span className="shopify-dash-card__ghee-label">Buffalo </span>
                            <span className="shopify-dash-card__ghee-val">{formatLiters(Number(lt.buffalo) || 0)}</span>
                        </div>
                    </div>
                </section>
                {showVolumeDetail ? (
                    <div className="shopify-dash-card__table-wrap">
                        <div className="shopify-dash-card__table" role="table" aria-label="Units by pack size and status">
                            <div className="shopify-dash-card__tr shopify-dash-card__tr--head" role="row">
                                <span role="columnheader">Size</span>
                                <span role="columnheader" title="Total">Tot</span>
                                <span role="columnheader" title="Delivered">Del</span>
                                <span role="columnheader">RTO</span>
                                <span role="columnheader" title="In transit">Trn</span>
                            </div>
                            {VOLUME_SIZE_ROW_DEFS.map(({ apiKeys, label }) => {
                                const b = bucketForVolumeRowKeys(v.quantityBySize, apiKeys);
                                if (b.ordered <= 0) return null;
                                const rowKey = apiKeys[0] ?? label;
                                return (
                                    <div key={rowKey} className="shopify-dash-card__tr" role="row">
                                        <span className="shopify-dash-card__td--lead" role="cell">{label}</span>
                                        <span className="shopify-dash-card__td--t" role="cell">{b.ordered.toLocaleString()}</span>
                                        <span className="shopify-dash-card__td--d" role="cell">{b.delivered.toLocaleString()}</span>
                                        <span className="shopify-dash-card__td--r" role="cell">{b.rto.toLocaleString()}</span>
                                        <span className="shopify-dash-card__td--i" role="cell">{b.inTransit.toLocaleString()}</span>
                                    </div>
                                );
                            })}
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

