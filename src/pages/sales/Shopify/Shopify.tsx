import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../api';
import { updateOrder, deleteOrder, type Order, type OrderItem, type PaymentStatus, type FulfillmentStatus, type DeliveryStatus, type Platform, type OrderType } from '../../../utils/orders';
import { loadOrdersFromApi, shopifyOrderToOrder, fetchOrderById, orderDetailToOrder, mapDeliveryStatusFromTracking, mapFulfillmentStatus, mapOrderType, getOrderCustomerName, getOrderCustomerPhone, updateShopifyOrderFromForm } from '../../../utils/shopify-orders';
import type { ShopifyOrderApi, ShopifyOrderCustomer } from '../../../types/shopify';
import { loadProducts, type ProductApiItem } from '../../../utils/products';
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
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [orders, setOrders] = useState<ShopifyOrderApi[]>([]);
    const dispatch = useAppDispatch();
    const products = useAppSelector((state) => state.products.products);
    const productsLoading = useAppSelector((state) => state.products.loading);
    const [loading, setLoading] = useState(true);
    const [categoryTab, setCategoryTab] = useState<CategoryTab>('ghee');
    
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
            await apiFetch('/api/orders/sync-shopify', { method: 'POST' });
            const toInclusive = addOneDay(dateRangeForApi.to);
            const ordersData = await loadOrdersFromApi({ from: dateRangeForApi.from, to: toInclusive });
            setOrders(ordersData);
        } catch (err) {
            console.error('Failed to sync Shopify orders', err);
        } finally {
            setLoading(false);
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
        const shippingCharges = filtered.reduce((s, o) => s + (o.shippingCharges || 0), 0);
        const deliveryStatusFor = (o: ShopifyOrderApi) =>
            o.returnStatus ? 'RTO' : mapDeliveryStatusFromTracking(o.shippingDetails?.trackingStatus);
        const deliveredOrders = filtered.filter(o => deliveryStatusFor(o) === 'Delivered');
        const delivered = deliveredOrders.length;
        const deliveredAmount = deliveredOrders.reduce((s, o) => s + o.totalAmount, 0);

        // Marketing spend, misc cost, ROAS, manufacturing cost, EBITA — hardcoded 0 (no API)
        const totalMarketingSpend = 0;
        const totalMiscCost = 0;
        const roas = 0;
        const manufacturingCost = 0;
        const ebita = 0;
        
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
                const sizeMatch = variantName.match(/-?\s*(\d+(?:\.\d+)?)\s*(ml|ltr|L)/i);
                if (sizeMatch) {
                    const sizeValue = parseFloat(sizeMatch[1]);
                    const sizeUnit = sizeMatch[2].toLowerCase();
                    let sizeKey = '';
                    if (sizeUnit === 'ml') {
                        if (sizeValue === 500) sizeKey = '500ml';
                        else if (sizeValue === 1000) sizeKey = '1ltr';
                        else if (sizeValue === 5000) sizeKey = '5ltr';
                        else if (sizeValue === 250) sizeKey = '500ml';
                    } else if (sizeUnit === 'l' || sizeUnit === 'ltr') {
                        if (sizeValue === 1) sizeKey = '1ltr';
                        else if (sizeValue === 5) sizeKey = '5ltr';
                    }
                    if (sizeKey && quantityBySize.hasOwnProperty(sizeKey)) {
                        quantityBySize[sizeKey] += p.quantity;
                        if (delStatus === 'Delivered') deliveredQuantityBySize[sizeKey] += p.quantity;
                        if (delStatus === 'RTO') rtoQuantityBySize[sizeKey] += p.quantity;
                        if (delStatus === 'In Transit') inTransitQuantityBySize[sizeKey] += p.quantity;
                    }
                }
            });
        });
        const rtoOrders = filtered.filter((o: ShopifyOrderApi) => deliveryStatusFor(o) === 'RTO');
        const rto = rtoOrders.length;
        const rtoAmount = rtoOrders.reduce((s, o) => s + o.totalAmount, 0);
        const inTransitOrders = filtered.filter((o: ShopifyOrderApi) => deliveryStatusFor(o) === 'In Transit');
        const inTransit = inTransitOrders.length;
        const inTransitAmount = inTransitOrders.reduce((s, o) => s + o.totalAmount, 0);
        
        return {
            totalSales,
            quantity,
            quantityBySize,
            deliveredQuantityBySize,
            rtoQuantityBySize,
            inTransitQuantityBySize,
            codCharges,
            shippingCharges,
            roas,
            delivered,
            deliveredAmount,
            rto,
            rtoAmount,
            inTransit,
            inTransitAmount,
            totalOrders: filtered.length,
            ebita,
            manufacturingCost,
            totalMiscCost,
            totalMarketingSpend
        };
    }, [filtered]);

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
                    <div className="status-filters-row shopify-status-filters">
                        <StatusFilter
                            label="Payment Mode"
                            value={paymentStatusFilter}
                            onChange={setPaymentStatusFilter}
                            options={['COD', 'PAID'] as PaymentStatus[]}
                        />
                        <StatusFilter
                            label="Fulfillment"
                            value={fulfillmentStatusFilter}
                            onChange={setFulfillmentStatusFilter}
                            options={['Unfulfilled', 'Fulfilled', 'Partial'] as FulfillmentStatus[]}
                        />
                        <StatusFilter
                            label="Delivery"
                            value={deliveryStatusFilter}
                            onChange={setDeliveryStatusFilter}
                            options={['In Transit', 'Delivered', 'RTO', 'Pending Pickup'] as DeliveryStatus[]}
                        />
                        <StatusFilter
                            label="Platform"
                            value={platformFilter}
                            onChange={setPlatformFilter}
                            options={['Shopify', 'Abandoned', 'Whatsapp', 'Amazon', 'Flipkart'] as Platform[]}
                        />
                        <StatusFilter
                            label="Type"
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={['New', 'Repeat', 'Reference'] as OrderType[]}
                        />
                        <button 
                            className="filter-btn shopify-export-btn" 
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
                            <span>📥</span>
                            Export CSV
                        </button>
                        {(paymentStatusFilter || fulfillmentStatusFilter || deliveryStatusFilter || platformFilter || typeFilter) ? (
                            <button 
                                className="filter-btn shopify-clear-filters-btn" 
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
                <div className="shopify-metrics-row">
                    <ModernSalesWithEBITAMetric 
                        totalSales={metrics.totalSales}
                        ebita={metrics.ebita}
                        manufacturingCost={metrics.manufacturingCost}
                        metaSpend={metrics.totalMarketingSpend}
                        miscCost={metrics.totalMiscCost}
                        shippingCost={metrics.shippingCharges}
                        iconColor="#16a34a"
                        isLast={false}
                        isEven={false}
                    />
                    <ModernQuantityMetric 
                        quantityBySize={metrics.quantityBySize}
                        deliveredQuantityBySize={metrics.deliveredQuantityBySize}
                        rtoQuantityBySize={metrics.rtoQuantityBySize}
                        inTransitQuantityBySize={metrics.inTransitQuantityBySize}
                        iconColor="#3b82f6"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernDeliveryStatusMetric 
                        delivered={metrics.delivered}
                        deliveredAmount={metrics.deliveredAmount}
                        rto={metrics.rto}
                        rtoAmount={metrics.rtoAmount}
                        inTransit={metrics.inTransit}
                        inTransitAmount={metrics.inTransitAmount}
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem 
                        icon="📦" 
                        label="Shipping Charges" 
                        value={formatCurrency(metrics.shippingCharges)} 
                        iconColor="#8b5cf6"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem 
                        icon="📊" 
                        label="ROAS" 
                        value={metrics.roas > 0 ? metrics.roas.toFixed(2) : '—'} 
                        iconColor="#ec4899"
                        isLast={true}
                        isEven={true}
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
                marketingSpend={[]}
                loading={loading}
                orderCount={filtered.length}
                onCustomerClick={(phone) => {
                    setSelectedCustomerPhone(phone);
                    setShowCustomerProfile(true);
                }}
                onEdit={(order) => setEditingOrderId(order.id)}
                onDelete={setOrderToDelete}
            />

            {loadingOrderDetail ? (
                <Spinner overlay fixed message="Loading order…" />
            ) : null}

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

            {showCustomerProfile && selectedCustomerPhone ? (
                <CustomerProfileModal
                    customerPhone={selectedCustomerPhone}
                    orders={orders.map(shopifyOrderToOrder)}
                    onClose={() => {
                        setShowCustomerProfile(false);
                        setSelectedCustomerPhone(null);
                    }}
                    onCopyPhone={copyPhoneToClipboard}
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


function ModernMetricItem({ icon, label, value, iconColor, isLast, isEven }: { icon: string; label: string; value: string; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div className={`shopify-metric ${isEven ? 'shopify-metric--even' : ''} ${isLast ? 'shopify-metric--last' : ''}`}>
            <div className="shopify-metric-header">
                <span className="shopify-metric-icon">{icon}</span>
                <div className="shopify-metric-label">{label}</div>
            </div>
            <div className="shopify-metric-value">{value}</div>
        </div>
    );
}

function ModernSalesWithEBITAMetric({ totalSales, ebita, manufacturingCost, metaSpend, miscCost, shippingCost, iconColor, isLast, isEven }: { totalSales: number; ebita: number; manufacturingCost: number; metaSpend: number; miscCost: number; shippingCost: number; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div className={`shopify-metric ${isEven ? 'shopify-metric--even' : ''} ${isLast ? 'shopify-metric--last' : ''}`}>
            <div className="shopify-metric-header">
                <span className="shopify-metric-icon">💰</span>
                <div className="shopify-metric-label">Total Sales / EBITA</div>
            </div>
            <div className="shopify-metric-body">
                <div className="shopify-metric-value">{formatCurrency(totalSales)}</div>
                <div className={`shopify-metric-ebita-row ${ebita >= 0 ? 'shopify-metric-ebita--positive' : 'shopify-metric-ebita--negative'}`}>
                    EBITA: {formatCurrency(ebita)}
                </div>
                <div className="shopify-metric-breakdown">
                    <div className="shopify-metric-breakdown-row"><span>Manufacturing:</span><span>{formatCurrency(manufacturingCost)}</span></div>
                    <div className="shopify-metric-breakdown-row"><span>Meta:</span><span>{formatCurrency(metaSpend)}</span></div>
                    <div className="shopify-metric-breakdown-row"><span>Misc:</span><span>{formatCurrency(miscCost)}</span></div>
                    <div className="shopify-metric-breakdown-row"><span>Shipping:</span><span>{formatCurrency(shippingCost)}</span></div>
                </div>
            </div>
        </div>
    );
}

function ModernDeliveryStatusMetric({ delivered, deliveredAmount, rto, rtoAmount, inTransit, inTransitAmount, isLast, isEven }: { delivered: number; deliveredAmount: number; rto: number; rtoAmount: number; inTransit: number; inTransitAmount: number; isLast: boolean; isEven: boolean }) {
    return (
        <div className={`shopify-metric ${isEven ? 'shopify-metric--even' : ''} ${isLast ? 'shopify-metric--last' : ''}`}>
            <div className="shopify-metric-header">
                <span className="shopify-metric-icon">📦</span>
                <div className="shopify-metric-label">Shipping Status</div>
            </div>
            <div className="shopify-metric-body">
                <div className="shopify-metric-delivery-row"><span className="shopify-metric-delivery--delivered">✅ Delivered</span><span>{delivered} - {formatCurrency(deliveredAmount)}</span></div>
                <div className="shopify-metric-delivery-row"><span className="shopify-metric-delivery--rto">↩️ RTO</span><span>{rto} - {formatCurrency(rtoAmount)}</span></div>
                <div className="shopify-metric-delivery-row"><span className="shopify-metric-delivery--transit">🚚 In Transit</span><span>{inTransit} - {formatCurrency(inTransitAmount)}</span></div>
            </div>
        </div>
    );
}

function ModernQuantityMetric({ quantityBySize, deliveredQuantityBySize, rtoQuantityBySize, inTransitQuantityBySize, iconColor, isLast, isEven }: { quantityBySize: { [key: string]: number }; deliveredQuantityBySize: { [key: string]: number }; rtoQuantityBySize: { [key: string]: number }; inTransitQuantityBySize: { [key: string]: number }; iconColor: string; isLast: boolean; isEven: boolean }) {
    const totalQuantityInLiters = (quantityBySize['500ml'] || 0) * 0.5 + (quantityBySize['1ltr'] || 0) * 1 + (quantityBySize['5ltr'] || 0) * 5;
    const totalDeliveredInLiters = (deliveredQuantityBySize['500ml'] || 0) * 0.5 + (deliveredQuantityBySize['1ltr'] || 0) * 1 + (deliveredQuantityBySize['5ltr'] || 0) * 5;
    const formatLiters = (liters: number): string => (liters % 1 === 0 ? liters.toLocaleString() + ' L' : liters.toFixed(1).replace(/\.?0+$/, '') + ' L');

    return (
        <div className={`shopify-metric ${isEven ? 'shopify-metric--even' : ''} ${isLast ? 'shopify-metric--last' : ''}`}>
            <div className="shopify-metric-header">
                <span className="shopify-metric-icon">📊</span>
                <div className="shopify-metric-label">Quantity</div>
            </div>
            <div className="shopify-metric-body">
                <div className="shopify-metric-qty-total">{formatLiters(totalQuantityInLiters)}</div>
                <div className="shopify-metric-qty-delivered">Delivered: {formatLiters(totalDeliveredInLiters)}</div>
                <div className="shopify-metric-qty-sizes">
                    {quantityBySize['500ml'] > 0 && (
                        <div className="shopify-metric-qty-row">
                            <span className="shopify-metric-qty-size-label">500ml</span>
                            <span className="shopify-metric-qty-size-vals">
                                <span className="shopify-metric-qty-val--total">{quantityBySize['500ml'].toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--delivered">{(deliveredQuantityBySize['500ml'] || 0).toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--rto">{(rtoQuantityBySize['500ml'] || 0).toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--transit">{(inTransitQuantityBySize['500ml'] || 0).toLocaleString()}</span>
                            </span>
                        </div>
                    )}
                    {quantityBySize['1ltr'] > 0 && (
                        <div className="shopify-metric-qty-row">
                            <span className="shopify-metric-qty-size-label">1ltr</span>
                            <span className="shopify-metric-qty-size-vals">
                                <span className="shopify-metric-qty-val--total">{quantityBySize['1ltr'].toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--delivered">{(deliveredQuantityBySize['1ltr'] || 0).toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--rto">{(rtoQuantityBySize['1ltr'] || 0).toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--transit">{(inTransitQuantityBySize['1ltr'] || 0).toLocaleString()}</span>
                            </span>
                        </div>
                    )}
                    {quantityBySize['5ltr'] > 0 && (
                        <div className="shopify-metric-qty-row">
                            <span className="shopify-metric-qty-size-label">5ltr</span>
                            <span className="shopify-metric-qty-size-vals">
                                <span className="shopify-metric-qty-val--total">{quantityBySize['5ltr'].toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--delivered">{(deliveredQuantityBySize['5ltr'] || 0).toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--rto">{(rtoQuantityBySize['5ltr'] || 0).toLocaleString()}</span>
                                <span className="shopify-metric-qty-arrow">→</span>
                                <span className="shopify-metric-qty-val--transit">{(inTransitQuantityBySize['5ltr'] || 0).toLocaleString()}</span>
                            </span>
                        </div>
                    )}
                </div>
                {totalQuantityInLiters === 0 && <div className="shopify-metric-qty-zero">0 L</div>}
            </div>
        </div>
    );
}

function ModernMetricItemWithAmount({ icon, label, count, amount, iconColor, isLast, isEven }: { icon: string; label: string; count: number; amount: number; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div className={`shopify-metric ${isEven ? 'shopify-metric--even' : ''} ${isLast ? 'shopify-metric--last' : ''}`}>
            <div className="shopify-metric-header">
                <span className="shopify-metric-icon">{icon}</span>
                <div className="shopify-metric-label">{label}</div>
            </div>
            <div className="shopify-metric-body">
                <div className="shopify-metric-value">{count.toLocaleString()}</div>
                <div className="shopify-metric-amount">{formatCurrency(amount)}</div>
            </div>
        </div>
    );
}

