import { useEffect, useMemo, useRef, useState } from 'react';
import { loadOrders, addOrder, updateOrder, deleteOrder, type Order, type OrderItem, type PaymentStatus, type FulfillmentStatus, type DeliveryStatus, type Platform, type OrderType } from '../utils/orders';
import { loadProducts, type Product } from '../utils/products';
import { loadMarketingSpend, type SpendRecord, type MiscRecord } from '../utils/marketing-spend';
import './Shopify.scss';

function formatCurrency(n: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }

function generateWhatsAppSummary(date: string, orders: Order[], marketingSpend: SpendRecord[]): string {
    // Calculate platform-wise totals for "New" type only
    const platformNewTotals: { [key: string]: number } = {};
    // Calculate platform-wise totals for "Repeat" type only
    const platformRepeatTotals: { [key: string]: number } = {};
    
    orders.forEach(order => {
        const platform = order.platform || 'Unknown';
        
        // Platform + New combination
        if (order.type === 'New') {
            platformNewTotals[platform] = (platformNewTotals[platform] || 0) + order.amount;
        }
        
        // Platform + Repeat combination
        if (order.type === 'Repeat') {
            platformRepeatTotals[platform] = (platformRepeatTotals[platform] || 0) + order.amount;
        }
    });
    
    // Convert date from "01-Dec-2025" format to "2025-12-01" format for comparison
    const dateParts = date.split('-');
    const months: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const dateStr = `${dateParts[2]}-${months[dateParts[1]]}-${dateParts[0]}`;
    
    // Calculate meta spend for the selected date
    const metaSpendForDate = marketingSpend
        .filter(spend => {
            const spendDate = spend.date.split('T')[0]; // Handle both formats
            return spendDate === dateStr;
        })
        .reduce((sum, spend) => sum + spend.amount, 0);
    
    // Build summary message
    let message = `📊 *Daily Sales Summary*\n\n`;
    message += `📅 *Date:* ${date}\n\n`;
    
    if (Object.keys(platformNewTotals).length > 0) {
        message += `*Platform-wise (New Orders Only):*\n`;
        Object.entries(platformNewTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([platform, total]) => {
                message += `• ${platform}: ${formatCurrency(total)}\n`;
            });
        message += `\n`;
    }
    
    if (Object.keys(platformRepeatTotals).length > 0) {
        message += `*Platform-wise (Repeat Orders Only):*\n`;
        Object.entries(platformRepeatTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([platform, total]) => {
                message += `• ${platform}: ${formatCurrency(total)}\n`;
            });
        message += `\n`;
    }
    
    const grandTotal = orders.reduce((sum, o) => sum + o.amount, 0);
    message += `💰 *Grand Total:* ${formatCurrency(grandTotal)}\n\n`;
    message += `📊 *Meta Spend:* ${formatCurrency(metaSpendForDate)}`;
    
    return message;
}

function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

type UiRange = 'all' | 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

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
    const [range, setRange] = useState<UiRange>('all');
    const [customerFilter, setCustomerFilter] = useState('');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [showCustomerProfile, setShowCustomerProfile] = useState(false);
    const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [marketingSpend, setMarketingSpend] = useState<SpendRecord[]>([]);
    const [miscSpend, setMiscSpend] = useState<MiscRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
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
        Promise.all([
            loadOrders(), 
            loadProducts(),
            loadMarketingSpend('meta-spend'),
            loadMarketingSpend('misc-spend')
        ])
            .then(([ordersData, productsData, metaData, miscData]) => {
                if (cancelled) return;
                setOrders(ordersData);
                setProducts(productsData);
                setMarketingSpend(metaData as SpendRecord[]);
                setMiscSpend(miscData as MiscRecord[]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const generatedPlusUser = useMemo(() => {
        return [...orders].sort((a, b) => (a.date < b.date ? 1 : -1));
    }, [orders]);

    // Helper function to get date string in YYYY-MM-DD format
    // For order dates (stored as ISO UTC strings), extract the date part directly from the string
    // For local dates, use local time
    const getDateStringFromISO = (isoString: string): string => {
        // Extract YYYY-MM-DD directly from ISO string (e.g., "2025-12-05T00:00:00.000Z" -> "2025-12-05")
        return isoString.split('T')[0];
    };
    
    const getLocalDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const byRange = useMemo(() => {
        if (range === 'all') {
            // Show all orders
            return generatedPlusUser;
        }
        
        if (range === 'custom') {
            // Custom range uses date inputs which are in local time (YYYY-MM-DD format)
            const startStr = customStart; // Already in YYYY-MM-DD format
            const endStr = customEnd; // Already in YYYY-MM-DD format
            return generatedPlusUser.filter(o => {
                // Extract date directly from ISO string to avoid timezone issues
                const orderDateStr = getDateStringFromISO(o.date);
                return orderDateStr >= startStr && orderDateStr <= endStr;
            });
        }
        
        const now = new Date();
        const todayStr = getLocalDateString(now);
        
        if (range === 'today') {
            return generatedPlusUser.filter(o => {
                // Extract date directly from ISO string to avoid timezone issues
                const orderDateStr = getDateStringFromISO(o.date);
                return orderDateStr === todayStr;
            });
        } else if (range === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);
            return generatedPlusUser.filter(o => {
                const orderDateStr = getDateStringFromISO(o.date);
                return orderDateStr === yesterdayStr;
            });
        } else if (range === 'last7') {
            const start = new Date(now);
            start.setDate(start.getDate() - 6); // Last 7 days (including today)
            const startStr = getLocalDateString(start);
            const endStr = todayStr;
            return generatedPlusUser.filter(o => {
                const orderDateStr = getDateStringFromISO(o.date);
                return orderDateStr >= startStr && orderDateStr <= endStr;
            });
        } else if (range === 'currentMonth') {
            const year = now.getFullYear();
            const month = now.getMonth();
            const start = new Date(year, month, 1);
            const startStr = getLocalDateString(start);
            const endStr = todayStr;
            return generatedPlusUser.filter(o => {
                const orderDateStr = getDateStringFromISO(o.date);
                return orderDateStr >= startStr && orderDateStr <= endStr;
            });
        } else if (range === 'lastMonth') {
            const year = now.getFullYear();
            const month = now.getMonth();
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            const startStr = getLocalDateString(start);
            const endStr = getLocalDateString(end);
            return generatedPlusUser.filter(o => {
                const orderDateStr = getDateStringFromISO(o.date);
                return orderDateStr >= startStr && orderDateStr <= endStr;
            });
        }
        
        return generatedPlusUser;
    }, [generatedPlusUser, range, customStart, customEnd]);

    const filtered = useMemo(() => {
        return byRange.filter(o => {
            const searchTerm = customerFilter.toLowerCase();
            const matchesCustomer =
                o.customer.toLowerCase().includes(searchTerm) ||
                (o.customerPhone && o.customerPhone.includes(searchTerm));
            const matchesPayment = !paymentStatusFilter || o.paymentStatus === paymentStatusFilter;
            const matchesFulfillment = !fulfillmentStatusFilter || o.fulfillmentStatus === fulfillmentStatusFilter;
            const matchesDelivery = !deliveryStatusFilter || o.deliveryStatus === deliveryStatusFilter;
            const matchesPlatform = !platformFilter || o.platform === platformFilter;
            const matchesType = !typeFilter || o.type === typeFilter;
            const matchesState = !stateFilter || o.state === stateFilter;
            return (
                matchesCustomer &&
                matchesPayment &&
                matchesFulfillment &&
                matchesDelivery &&
                matchesPlatform &&
                matchesType &&
                matchesState
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
    ]);

    const metrics = useMemo(() => {
        const totalSales = filtered.reduce((s, o) => s + o.amount, 0);
        const quantity = filtered.reduce((s, o) => s + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
        const codCharges = filtered.reduce((s, o) => s + (o.codCharges || (o.shippingAmount || 0)), 0);
        const shippingCharges = filtered.reduce((s, o) => s + (o.shippingCharges || 0), 0);
        
        // Calculate delivered orders amount first (needed for ROAS calculation)
        const deliveredOrders = filtered.filter(o => o.deliveryStatus === 'Delivered');
        const delivered = deliveredOrders.length;
        const deliveredAmount = deliveredOrders.reduce((s, o) => s + o.amount, 0);
        
        // Calculate total marketing spend from meta-spend.json for the same date range
        let totalMarketingSpend = 0;
        if (filtered.length > 0) {
            // Get date range from filtered orders
            const orderDates = filtered.map(o => getDateStringFromISO(o.date));
            const minDate = orderDates.sort()[0];
            const maxDate = orderDates.sort().reverse()[0];
            
            // Filter meta-spend by date range
            // Marketing spend dates are in YYYY-MM-DD format (from date input)
            totalMarketingSpend = marketingSpend
                .filter(spend => {
                    // Marketing spend dates are already in YYYY-MM-DD format
                    const spendDate = spend.date.split('T')[0]; // Handle both formats
                    return spendDate >= minDate && spendDate <= maxDate;
                })
                .reduce((sum, spend) => sum + spend.amount, 0);
        }
        
        // Calculate ROAS (Return on Ad Spend) = Delivered Orders Amount / Meta Spend
        const roas = totalMarketingSpend > 0 ? deliveredAmount / totalMarketingSpend : 0;
        
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
        
        filtered.forEach(o => {
            o.items.forEach(item => {
                // Extract size from variant (e.g., "A2 Desi Cow Ghee - 500ml" -> "500ml")
                const sizeMatch = item.variant.match(/-?\s*(\d+(?:\.\d+)?)\s*(ml|ltr|L)/i);
                if (sizeMatch) {
                    const sizeValue = parseFloat(sizeMatch[1]);
                    const sizeUnit = sizeMatch[2].toLowerCase();
                    let sizeKey = '';
                    
                    if (sizeUnit === 'ml') {
                        // Convert ml to appropriate category
                        if (sizeValue === 500) {
                            sizeKey = '500ml';
                        } else if (sizeValue === 1000) {
                            // 1000ml = 1 liter
                            sizeKey = '1ltr';
                        } else if (sizeValue === 5000) {
                            // 5000ml = 5 liters
                            sizeKey = '5ltr';
                        } else if (sizeValue === 250) {
                            // Handle 250ml as well if needed, or map to 500ml
                            sizeKey = '500ml';
                        }
                    } else if (sizeUnit === 'l' || sizeUnit === 'ltr') {
                        if (sizeValue === 1) {
                            sizeKey = '1ltr';
                        } else if (sizeValue === 5) {
                            sizeKey = '5ltr';
                        }
                    }
                    
                    if (sizeKey && quantityBySize.hasOwnProperty(sizeKey)) {
                        quantityBySize[sizeKey] += item.quantity;
                        
                        // Also add to delivered quantity if order is delivered
                        if (o.deliveryStatus === 'Delivered') {
                            deliveredQuantityBySize[sizeKey] += item.quantity;
                        }
                        
                        // Also add to RTO quantity if order is RTO
                        if (o.deliveryStatus === 'RTO') {
                            rtoQuantityBySize[sizeKey] += item.quantity;
                        }
                        
                        // Also add to In Transit quantity if order is in transit
                        if (o.deliveryStatus === 'In Transit') {
                            inTransitQuantityBySize[sizeKey] += item.quantity;
                        }
                    }
                }
            });
        });
        
        const rtoOrders = filtered.filter(o => o.deliveryStatus === 'RTO');
        const rto = rtoOrders.length;
        const rtoAmount = rtoOrders.reduce((s, o) => s + o.amount, 0);
        
        const inTransitOrders = filtered.filter(o => o.deliveryStatus === 'In Transit');
        const inTransit = inTransitOrders.length;
        const inTransitAmount = inTransitOrders.reduce((s, o) => s + o.amount, 0);
        
        // Calculate total quantity in liters for manufacturing cost (only for delivered orders)
        // 500ml = 0.5 liters, 1ltr = 1 liter, 5ltr = 5 liters
        const deliveredLiters = (deliveredQuantityBySize['500ml'] || 0) * 0.5 + 
                                (deliveredQuantityBySize['1ltr'] || 0) * 1 + 
                                (deliveredQuantityBySize['5ltr'] || 0) * 5;
        
        // Manufacturing cost: 1 liter = Rs 860 (only for delivered orders)
        const manufacturingCost = deliveredLiters * 860;
        
        // Calculate miscellaneous costs from misc-spend.json for the same date range
        let totalMiscCost = 0;
        if (filtered.length > 0) {
            // Get date range from filtered orders
            const orderDates = filtered.map(o => getDateStringFromISO(o.date));
            const minDate = orderDates.sort()[0];
            const maxDate = orderDates.sort().reverse()[0];
            
            // Filter misc-spend by date range
            totalMiscCost = miscSpend
                .filter(spend => {
                    const spendDate = spend.date.split('T')[0]; // Handle both formats
                    return spendDate >= minDate && spendDate <= maxDate;
                })
                .reduce((sum, spend) => sum + spend.amount, 0);
        }
        
        // Calculate EBITA on delivered orders only = Delivered Sales - (Manufacturing Cost + Total Shipping Cost + Miscellaneous Cost + Meta Spend)
        // Note: Shipping cost includes all orders (delivered, RTO, in transit)
        const ebita = deliveredAmount - (manufacturingCost + shippingCharges + totalMiscCost + totalMarketingSpend);
        
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
    }, [filtered, marketingSpend, miscSpend]);

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

    // Group orders by display date for rowSpan rendering
    const groupedByDate = useMemo(() => {
        const groups: Array<{
            label: string;
            items: Order[];
            metaSpent: number;
            totalAmount: number;
            totalShipping: number;
            codCount: number;
            paidCount: number;
        }> = [];
        const dateToIndex = new Map<string, number>();
        for (const o of filtered) {
            const label = formatDate(o.date);
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
                totalAmount += it.amount;
                const shipping =
                    (it.shippingCharges ?? 0) ||
                    (it.shippingAmount ?? 0);
                totalShipping += shipping;
                if (it.paymentStatus === 'COD') codCount += 1;
                if (it.paymentStatus === 'PAID') paidCount += 1;
            }
            g.totalAmount = totalAmount;
            g.totalShipping = totalShipping;
            g.codCount = codCount;
            g.paidCount = paidCount;
            // compute meta spent as 22% of revenue for that day (mock)
            g.metaSpent = Math.round(totalAmount * 0.22);
        }
        return groups;
    }, [filtered]);

    return (
        <section className="shopify-page">
            <div className="card shopify-header-card">
                <div className="shopify-header-title">{title}</div>
                <div className="shopify-header-main">
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
                        <button
                            className="button shopify-add-order-btn"
                            onClick={() => setShowAddOrder(true)}
                        >
                            <span>+</span> Add Order
                        </button>
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
                                const rows = exportableOrders.map((order, index) => {
                                    // Calculate total quantity in liters for this order
                                    const totalQuantityLiters = order.items.reduce((sum, item) => {
                                        // Extract size from variant (e.g., "A2 Desi Cow Ghee - 500ml" -> "500ml")
                                        const sizeMatch = item.variant.match(/-?\s*(\d+(?:\.\d+)?)\s*(ml|ltr|L)/i);
                                        if (!sizeMatch) return sum;
                                        
                                        const sizeValue = parseFloat(sizeMatch[1]);
                                        const sizeUnit = sizeMatch[2].toLowerCase();
                                        let litersPerUnit = 0;

                                        if (sizeUnit === 'ml') {
                                            // Convert ml to liters
                                            litersPerUnit = sizeValue / 1000;
                                        } else if (sizeUnit === 'l' || sizeUnit === 'ltr') {
                                            litersPerUnit = sizeValue;
                                        }

                                        return sum + (litersPerUnit * item.quantity);
                                    }, 0);

                                    return [
                                        index + 1,
                                        order.customer,
                                        order.customerPhone,
                                        totalQuantityLiters,
                                        order.amount,
                                        order.deliveryStatus || '',
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

            <div className="card shopify-orders-card">
                <div className="shopify-orders-count-bar">
                    {loading ? '—' : `${filtered.length.toLocaleString()} order${filtered.length === 1 ? '' : 's'}`}
                </div>
                <div className="table-scroll-wrapper">
                    <table className="orders-table shopify-orders-table">
                        <colgroup>
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '300px', minWidth: '300px' }} />
                            <col style={{ width: '160px', minWidth: '160px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                        </colgroup>
                        <thead>
                            <tr className="shopify-orders-header-row">
                                <Th>Date</Th>
                                <Th>Customer</Th>
                                <Th>Variant</Th>
                                <Th align="right">Amount</Th>
                                <Th>Payment Mode</Th>
                                <Th>Platform</Th>
                                <Th>Shipping Status</Th>
                                <Th>Type</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="shopify-orders-empty-cell">
                                        Loading orders…
                                    </td>
                                </tr>
                            ) : groupedByDate.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="shopify-orders-empty-cell">
                                        No orders found. Click "Add Order" to create your first order.
                                    </td>
                                </tr>
                            ) : (
                                groupedByDate.map((group) => (
                                    group.items.map((o, idx) => (
                                        <tr key={o.id} className="shopify-orders-row">
                                            {idx === 0 ? (
                                                <td
                                                    rowSpan={group.items.length}
                                                    className="shopify-orders-date-cell"
                                                >
                                                    <div className="shopify-orders-date-wrapper">
                                                        <div className="shopify-orders-date-header">
                                                            <span>{group.label}</span>
                                                            {group.items.length > 0 && (
                                                                <a
                                                                    href={`https://wa.me/918685045943?text=${encodeURIComponent(generateWhatsAppSummary(group.label, group.items, marketingSpend))}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="shopify-whatsapp-summary-link"
                                                                    title="Send summary on WhatsApp"
                                                                >
                                                                    <svg
                                                                        width="18"
                                                                        height="18"
                                                                        viewBox="0 0 24 24"
                                                                        fill="currentColor"
                                                                        style={{ display: 'block' }}
                                                                    >
                                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                    </svg>
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className="shopify-orders-date-badges">
                                                            <span
                                                                className="shopify-badge shopify-badge--orders"
                                                            >
                                                                {group.items.length} Orders
                                                            </span>
                                                            <span
                                                                className="shopify-badge shopify-badge--amount"
                                                            >
                                                                {formatCurrency(group.totalAmount)}
                                                            </span>
                                                            {group.totalShipping > 0 && (
                                                                <span
                                                                    className="shopify-badge shopify-badge--shipping"
                                                                >
                                                                    Shipping {formatCurrency(group.totalShipping)}
                                                                </span>
                                                            )}
                                                            <span
                                                                className="shopify-badge shopify-badge--cod"
                                                            >
                                                                COD {group.codCount}
                                                            </span>
                                                            <span
                                                                className="shopify-badge shopify-badge--paid"
                                                            >
                                                                Paid {group.paidCount}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                            ) : null}
                                            <Td>
                                            <div className="shopify-customer-cell">
                                                <span 
                                                    title={o.customerAddress} 
                                                    className="shopify-customer-name"
                                                    onClick={() => {
                                                        setSelectedCustomerPhone(o.customerPhone);
                                                        setShowCustomerProfile(true);
                                                    }}
                                                >
                                                    {o.customer}
                                                </span>
                                                <a
                                                    className="link shopify-customer-phone"
                                                    href={`tel:${o.customerPhone}`}
                                                >
                                                    {o.customerPhone}
                                                </a>
                                            </div>
                                            </Td>
                                            <Td>
                                            <div className="shopify-items-cell">
                                                {(o.items ?? []).length === 0 ? <span>—</span> : null}
                                                {(o.items ?? []).map((it: OrderItem, idx: number) => (
                                                    <div key={idx}>{it.variant} × {it.quantity}</div>
                                                ))}
                                            </div>
                                            </Td>
                                            <Td>
                                            <div className="shopify-amount-cell">
                                                <span className="shopify-amount-main">{formatCurrency(o.amount)}</span>
                                                {o.codCharges ? (
                                                    <span className="shopify-amount-meta">
                                                        COD: {formatCurrency(o.codCharges)}
                                                    </span>
                                                ) : null}
                                                {o.shippingCharges ? (
                                                    <span className="shopify-amount-meta">
                                                        Shipping: {formatCurrency(o.shippingCharges)}
                                                    </span>
                                                ) : null}
                                                {!o.codCharges && !o.shippingCharges && o.shippingAmount ? (
                                                    <span className="shopify-amount-meta">
                                                        Shipping: {formatCurrency(o.shippingAmount)}
                                                    </span>
                                                ) : null}
                                                {o.discountAmount ? (
                                                    <span className="shopify-amount-meta">
                                                        Discount: {formatCurrency(o.discountAmount)}
                                                    </span>
                                                ) : null}
                                            </div>
                                            </Td>
                                            <Td><StatusTag kind={o.paymentStatus} type="payment" /></Td>
                                            <Td><PlatformTag platform={o.platform} /></Td>
                                            <Td><StatusTag kind={o.deliveryStatus} type="delivery" /></Td>
                                            <Td><TypeTag type={o.type} /></Td>
                                            <Td>
                                                <div className="shopify-row-actions">
                                                    <button
                                                        type="button"
                                                        className="icon-btn"
                                                        onClick={() => setEditingOrder(o)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="icon-btn icon-btn--danger"
                                                        onClick={() => setOrderToDelete(o)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </Td>
                                        </tr>
                                    ))
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddOrder || editingOrder ? (
                <AddOrderModal 
                    products={products}
                    orders={orders}
                    mode={editingOrder ? 'edit' : 'add'}
                    initialOrder={editingOrder || undefined}
                    onClose={() => {
                        setShowAddOrder(false);
                        setEditingOrder(null);
                    }} 
                    onCreate={async (o) => {
                        try {
                            if (editingOrder) {
                                const updated = await updateOrder(o);
                                setOrders((prev) => prev.map((ord) => ord.id === updated.id ? updated : ord));
                                setEditingOrder(null);
                                showToast('Order updated successfully!', 'success');
                            } else {
                                const saved = await addOrder(o);
                                setOrders((prev) => [saved, ...prev]);
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
                    orders={orders}
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
                            setOrders((prev) => prev.filter((ord) => ord.id !== orderToDelete.id));
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

function FilterButton({ active, onClick, children, refEl }: { active: boolean; onClick: () => void; children: string; refEl?: React.MutableRefObject<HTMLButtonElement | null> }) {
    return (
        <button
            ref={refEl as any}
            onClick={onClick}
            className={`filter-btn ${active ? 'active' : ''}`}
        >
            {children}
        </button>
    );
}

function Th({ children, align = 'left' }: { children: string; align?: 'left' | 'center' | 'right' }) {
    return <th style={{ textAlign: align, padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td style={{ padding: '12px', ...style }}>{children}</td>;
}

function StatusFilter<T extends string>({ label, value, onChange, options }: { label: string; value: T | ''; onChange: (val: T | '') => void; options: T[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
            <select
                className="input"
                value={value}
                onChange={(e) => onChange(e.target.value as T | '')}
                style={{ height: 32, minWidth: 120, cursor: 'pointer', fontSize: 13 }}
            >
                <option value="">All</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'PAID') cls = 'tag success';
        else if (kind === 'COD') cls = 'tag warning';
        else cls = 'tag info';
    } else {
        if (kind === 'Delivered') cls = 'tag success';
        else if (kind === 'In Transit') cls = 'tag info';
        else if (kind === 'Pending Pickup') cls = 'tag warning';
        else if (kind === 'RTO') cls = 'tag danger';
    }
    return <span className={cls}>{kind}</span>;
}

function PlatformTag({ platform }: { platform?: Platform | string }) {
    if (!platform) return <span>—</span>;
    
    let style: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '26px',
        padding: '0 10px',
        fontSize: '12px',
        fontWeight: 700,
        borderRadius: '999px',
        border: '1px solid',
    };

    switch (platform) {
        case 'Shopify':
            style.background = '#dbeafe';
            style.color = '#1e40af';
            style.borderColor = '#93c5fd';
            break;
        case 'Whatsapp':
            style.background = '#dcfce7';
            style.color = '#166534';
            style.borderColor = '#86efac';
            break;
        case 'Abandoned':
            style.background = '#fed7aa';
            style.color = '#9a3412';
            style.borderColor = '#fdba74';
            break;
        default:
            style.background = 'var(--bg)';
            style.color = 'var(--text)';
            style.borderColor = 'var(--border)';
    }

    return <span style={style}>{platform}</span>;
}

function TypeTag({ type }: { type?: OrderType | string }) {
    if (!type) return <span>—</span>;
    
    let style: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '26px',
        padding: '0 10px',
        fontSize: '12px',
        fontWeight: 700,
        borderRadius: '999px',
        border: '1px solid',
    };

    switch (type) {
        case 'New':
            style.background = '#dcfce7';
            style.color = '#166534';
            style.borderColor = '#86efac';
            break;
        case 'Repeat':
            style.background = '#e9d5ff';
            style.color = '#6b21a8';
            style.borderColor = '#c084fc';
            break;
        case 'Reference':
            style.background = '#fef3c7';
            style.color = '#92400e';
            style.borderColor = '#fde68a';
            break;
        default:
            style.background = 'var(--bg)';
            style.color = 'var(--text)';
            style.borderColor = 'var(--border)';
    }

    return <span style={style}>{type}</span>;
}

function toInputDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function DatePicker({ value, onChange, required, placeholder }: { value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const date = value ? new Date(value) : new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1);
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value) : null;
    const displayValue = selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current && popupRef.current) {
            const inputRect = inputRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 350; // Approximate height of calendar
            const popupWidth = 280;
            
            // Position below the input by default
            let top = inputRect.bottom + window.scrollY + 4;
            let left = inputRect.left + window.scrollX;
            
            // Check if there's enough space below, if not, position above
            if (inputRect.bottom + popupHeight > window.innerHeight) {
                top = inputRect.top + window.scrollY - popupHeight - 4;
            }
            
            // Check if there's enough space on the right, if not, adjust left
            if (inputRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function handleDateSelect(day: number) {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(toInputDate(newDate));
        setIsOpen(false);
    }

    function handlePrevMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }

    function handleNextMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }

    function handleToday() {
        const today = new Date();
        onChange(toInputDate(today));
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input"
                style={{
                    width: '100%',
                    marginTop: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}
            >
                <span style={{ color: displayValue ? 'var(--text)' : 'var(--muted)' }}>
                    {displayValue || placeholder || 'Select date'}
                </span>
                <span style={{ fontSize: 18, color: 'var(--muted)' }}>📅</span>
            </div>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                tabIndex={-1}
            />
            {isOpen && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: 20,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 10000,
                        minWidth: 300,
                        maxWidth: 300,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Previous month"
                        >
                            ‹
                        </button>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Next month"
                        >
                            ›
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
                        {weekDays.map((day) => (
                            <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', padding: '8px 0' }}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {Array(firstDayOfMonth).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {days.map((day) => {
                            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                            const isSelected = selectedDate && 
                                date.getDate() === selectedDate.getDate() &&
                                date.getMonth() === selectedDate.getMonth() &&
                                date.getFullYear() === selectedDate.getFullYear();
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateSelect(day)}
                                    style={{
                                        padding: '10px 4px',
                                        border: 'none',
                                        background: isSelected ? '#16a34a' : isToday ? '#dcfce7' : 'transparent',
                                        color: isSelected ? '#ffffff' : isToday ? '#16a34a' : '#111827',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = '#f3f4f6';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = 'transparent';
                                        } else if (isToday && !isSelected) {
                                            e.currentTarget.style.background = '#dcfce7';
                                        }
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={handleToday}
                        style={{
                            marginTop: 16,
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #e5e7eb',
                            background: '#f9fafb',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#111827',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                    >
                        Today
                    </button>
                </div>
            )}
        </div>
    );
}

function ModernMetricItem({ icon, label, value, iconColor, isLast, isEven }: { icon: string; label: string; value: string; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div style={{ 
            background: isEven ? '#f8f9fa' : 'transparent',
            flex: 1,
            padding: '12px 10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = isEven ? '#f8f9fa' : 'transparent';
        }}
        >
            <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2
            }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>{icon}</span>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                    letterSpacing: '0.4px',
            }}>
                {label}
                </div>
            </div>
            <div style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: 'var(--text)',
                lineHeight: 1.2,
                letterSpacing: '-0.2px'
            }}>
                {value}
            </div>
        </div>
    );
}

function ModernSalesWithEBITAMetric({ totalSales, ebita, manufacturingCost, metaSpend, miscCost, shippingCost, iconColor, isLast, isEven }: { totalSales: number; ebita: number; manufacturingCost: number; metaSpend: number; miscCost: number; shippingCost: number; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div style={{ 
            background: isEven ? '#f8f9fa' : 'transparent',
            flex: 1,
            padding: '12px 10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = isEven ? '#f8f9fa' : 'transparent';
        }}
        >
            <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2
            }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>💰</span>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                    letterSpacing: '0.4px',
            }}>
                Total Sales / EBITA
                </div>
            </div>
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 3
            }}>
                <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.2px'
                }}>
                    {formatCurrency(totalSales)}
                </div>
                <div style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: ebita >= 0 ? '#10b981' : '#ef4444',
                    lineHeight: 1.2
                }}>
                    EBITA: {formatCurrency(ebita)}
                </div>
                <div style={{ 
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                }}>
                    <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 500, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Manufacturing:</span>
                        <span>{formatCurrency(manufacturingCost)}</span>
                    </div>
                    <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 500, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Meta:</span>
                        <span>{formatCurrency(metaSpend)}</span>
                    </div>
                    <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 500, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Misc:</span>
                        <span>{formatCurrency(miscCost)}</span>
                    </div>
                    <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 500, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Shipping:</span>
                        <span>{formatCurrency(shippingCost)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModernDeliveryStatusMetric({ delivered, deliveredAmount, rto, rtoAmount, inTransit, inTransitAmount, isLast, isEven }: { delivered: number; deliveredAmount: number; rto: number; rtoAmount: number; inTransit: number; inTransitAmount: number; isLast: boolean; isEven: boolean }) {
    return (
        <div style={{ 
            background: isEven ? '#f8f9fa' : 'transparent',
            flex: 1,
            padding: '12px 10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = isEven ? '#f8f9fa' : 'transparent';
        }}
        >
            <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2
            }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>📦</span>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                    letterSpacing: '0.4px',
            }}>
                Shipping Status
                </div>
            </div>
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                width: '100%'
            }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#10b981' }}>✅ Delivered</span>
                    <span>{delivered} - {formatCurrency(deliveredAmount)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#f59e0b' }}>↩️ RTO</span>
                    <span>{rto} - {formatCurrency(rtoAmount)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#06b6d4' }}>🚚 In Transit</span>
                    <span>{inTransit} - {formatCurrency(inTransitAmount)}</span>
                </div>
            </div>
        </div>
    );
}

function ModernQuantityMetric({ quantityBySize, deliveredQuantityBySize, rtoQuantityBySize, inTransitQuantityBySize, iconColor, isLast, isEven }: { quantityBySize: { [key: string]: number }; deliveredQuantityBySize: { [key: string]: number }; rtoQuantityBySize: { [key: string]: number }; inTransitQuantityBySize: { [key: string]: number }; iconColor: string; isLast: boolean; isEven: boolean }) {
    // Calculate total quantity in liters: 500ml = 0.5L, 1ltr = 1L, 5ltr = 5L
    const totalQuantityInLiters = (quantityBySize['500ml'] || 0) * 0.5 + 
                                   (quantityBySize['1ltr'] || 0) * 1 + 
                                   (quantityBySize['5ltr'] || 0) * 5;
    
    // Calculate total delivered quantity in liters
    const totalDeliveredInLiters = (deliveredQuantityBySize['500ml'] || 0) * 0.5 + 
                                   (deliveredQuantityBySize['1ltr'] || 0) * 1 + 
                                   (deliveredQuantityBySize['5ltr'] || 0) * 5;
    
    const formatLiters = (liters: number): string => {
        if (liters % 1 === 0) {
            return liters.toLocaleString() + ' L';
        }
        return liters.toFixed(1).replace(/\.?0+$/, '') + ' L';
    };
    
    return (
        <div style={{ 
            background: isEven ? '#f8f9fa' : 'transparent',
            flex: 1,
            padding: '12px 10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = isEven ? '#f8f9fa' : 'transparent';
        }}
        >
            <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2
            }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>📊</span>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.4px',
            }}>
                Quantity
                </div>
            </div>
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 3
            }}>
                {/* Total Quantity - Big and Bold */}
                <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: '#3b82f6',
                    lineHeight: 1.2,
                    letterSpacing: '-0.2px'
                }}>
                    {formatLiters(totalQuantityInLiters)}
                </div>
                
                {/* Total Delivered */}
                <div style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: '#10b981',
                    lineHeight: 1.2
                }}>
                    Delivered: {formatLiters(totalDeliveredInLiters)}
                </div>
                
                {/* Separator and Breakdown */}
                <div style={{ 
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                }}>
                    {/* Size Breakdown */}
                    {quantityBySize['500ml'] > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18 }}>
                            <span style={{ fontSize: 10, minWidth: 35 }}>500ml</span>
                            <span style={{ fontSize: 11, display: 'flex', gap: 3, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{quantityBySize['500ml'].toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#10b981', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(deliveredQuantityBySize['500ml'] || 0).toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#ef4444', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(rtoQuantityBySize['500ml'] || 0).toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#06b6d4', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(inTransitQuantityBySize['500ml'] || 0).toLocaleString()}</span>
                            </span>
                    </div>
                )}
                {quantityBySize['1ltr'] > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18 }}>
                            <span style={{ fontSize: 10, minWidth: 35 }}>1ltr</span>
                            <span style={{ fontSize: 11, display: 'flex', gap: 3, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{quantityBySize['1ltr'].toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#10b981', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(deliveredQuantityBySize['1ltr'] || 0).toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#ef4444', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(rtoQuantityBySize['1ltr'] || 0).toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#06b6d4', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(inTransitQuantityBySize['1ltr'] || 0).toLocaleString()}</span>
                            </span>
                    </div>
                )}
                {quantityBySize['5ltr'] > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18 }}>
                            <span style={{ fontSize: 10, minWidth: 35 }}>5ltr</span>
                            <span style={{ fontSize: 11, display: 'flex', gap: 3, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{quantityBySize['5ltr'].toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#10b981', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(deliveredQuantityBySize['5ltr'] || 0).toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#ef4444', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(rtoQuantityBySize['5ltr'] || 0).toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: 10, lineHeight: 1 }}>→</span>
                                <span style={{ color: '#06b6d4', fontWeight: 600, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{(inTransitQuantityBySize['5ltr'] || 0).toLocaleString()}</span>
                            </span>
                    </div>
                )}
                </div>
                
                {totalQuantityInLiters === 0 && (
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>0 L</div>
                )}
            </div>
        </div>
    );
}

function ModernMetricItemWithAmount({ icon, label, count, amount, iconColor, isLast, isEven }: { icon: string; label: string; count: number; amount: number; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div style={{ 
            background: isEven ? '#f8f9fa' : 'transparent',
            flex: 1,
            padding: '12px 10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = isEven ? '#f8f9fa' : 'transparent';
        }}
        >
            <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2
            }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>{icon}</span>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                    letterSpacing: '0.4px',
            }}>
                {label}
                </div>
            </div>
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 3
            }}>
                <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.2px'
                }}>
                    {count.toLocaleString()}
                </div>
                <div style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: 'var(--muted)',
                    lineHeight: 1.2
                }}>
                    {formatCurrency(amount)}
                </div>
            </div>
        </div>
    );
}

// Simple modal to capture a new order
function PhoneDropdown({ customers, selectedPhone, onSelect, onNewPhone, phone, required }: { 
    customers: Order[]; 
    selectedPhone: string; 
    phone: string;
    onSelect: (customer: Order) => void; 
    onNewPhone?: (phone: string) => void;
    required?: boolean 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Find selected customer
    const selectedCustomer = customers.find(c => c.customerPhone === selectedPhone);

    // Filter customers based on phone number search (numeric only)
    const activeSearch = searchQuery.trim() || phone.trim();
    const filteredCustomers = useMemo(() => {
        if (!activeSearch) return customers;
        // Only search by phone number (numeric)
        const query = activeSearch.replace(/\D/g, '');
        if (!query) return customers;
        return customers.filter(c => 
            c.customerPhone.replace(/\D/g, '').includes(query)
        );
    }, [customers, activeSearch]);

    // Check if search query doesn't match any customer (for "Create new" option)
    const showCreateNew = activeSearch.length > 0 && filteredCustomers.length === 0 && phone.trim() !== '' && phone.replace(/\D/g, '').length === 10;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && containerRef.current && popupRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 300;
            const popupWidth = 400;
            
            let top = containerRect.bottom + window.scrollY + 4;
            let left = containerRect.left + window.scrollX;
            
            if (containerRect.bottom + popupHeight > window.innerHeight) {
                top = containerRect.top + window.scrollY - popupHeight - 4;
            }
            
            if (containerRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen, filteredCustomers.length]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative', width: '100%' }}>
                <input
                    type="tel"
                    className="input"
                    value={phone}
                    onChange={(e) => {
                        // Only allow numeric input
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                            if (onNewPhone) {
                                onNewPhone(value);
                            }
                            setSearchQuery(value);
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Type phone number to search..."
                    maxLength={10}
                    pattern="[0-9]{10}"
                    style={{
                        width: '100%',
                        marginTop: 6,
                        paddingRight: '32px',
                    }}
                    required={required}
                />
                <div
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        cursor: 'pointer',
                        padding: '4px',
                        marginTop: 6,
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'auto',
                    }}
                >
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>▼</span>
                </div>
            </div>
            {isOpen && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 8,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 10000,
                        minWidth: 400,
                        maxWidth: 400,
                        maxHeight: 300,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        ref={inputRef}
                        type="tel"
                        placeholder="Search by phone number..."
                        value={searchQuery || phone}
                        onChange={(e) => {
                            // Only allow numeric input
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                                setSearchQuery(value);
                                if (onNewPhone) {
                                    onNewPhone(value);
                                }
                            }
                        }}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            fontSize: 14,
                            marginBottom: 8,
                            outline: 'none',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredCustomers.length === 0 && !showCreateNew ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                                {searchQuery.trim() ? 'No customers found' : 'Start typing phone number to search...'}
                            </div>
                        ) : (
                            <>
                                {filteredCustomers.map((customer) => {
                                    const isSelected = selectedPhone === customer.customerPhone;
                                    return (
                                        <div
                                            key={customer.customerPhone}
                                            onClick={() => {
                                                onSelect(customer);
                                                setIsOpen(false);
                                                setSearchQuery('');
                                            }}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: '10px 12px',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                background: isSelected ? '#f0fdf4' : 'transparent',
                                                border: isSelected ? '1.5px solid #10b981' : '1.5px solid transparent',
                                                transition: 'all 0.2s',
                                                marginBottom: 4,
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = '#f9fafb';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'transparent';
                                                }
                                            }}
                                        >
                                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                                                {customer.customer}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                                {customer.customerPhone}
                                            </span>
                                        </div>
                                    );
                                })}
                                {showCreateNew && (
                                    <div
                                        onClick={() => {
                                            if (onNewPhone) {
                                                onNewPhone(searchQuery.trim() || phone.trim());
                                            }
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '10px 12px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: 'transparent',
                                            border: '1.5px solid #10b981',
                                            transition: 'all 0.2s',
                                            marginTop: 8,
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f0fdf4';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <span style={{ fontSize: 16 }}>➕</span>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                                                Create new customer
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                                Phone: "{searchQuery.trim() || phone.trim()}"
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
            <input
                type="hidden"
                value={selectedPhone}
                required={required}
            />
        </div>
    );
}

function AddOrderModal({ 
    products, 
    orders,
    mode = 'add', 
    initialOrder, 
    onClose, 
    onCreate 
}: { 
    products: Product[]; 
    orders: Order[];
    mode?: 'add' | 'edit';
    initialOrder?: Order;
    onClose: () => void; 
    onCreate: (o: Order) => void | Promise<void> 
}) {
    const [date, setDate] = useState<string>(initialOrder ? toInputDate(new Date(initialOrder.date)) : toInputDate(new Date()));
    const [name, setName] = useState(initialOrder?.customer || '');
    const [phone, setPhone] = useState(initialOrder?.customerPhone || '');
    const [address, setAddress] = useState(initialOrder?.customerAddress || '');
    const [state, setState] = useState(initialOrder?.state || '');
    const [pincode, setPincode] = useState(initialOrder?.pincode || '');
    const [type, setType] = useState<OrderType | ''>(initialOrder?.type || '');
    const [payment, setPayment] = useState<PaymentStatus | ''>(initialOrder?.paymentStatus || '');
    const [fulfillment, setFulfillment] = useState<FulfillmentStatus>(initialOrder?.fulfillmentStatus || 'Unfulfilled');
    const [delivery, setDelivery] = useState<DeliveryStatus>(initialOrder?.deliveryStatus || 'In Transit');
    const [platform, setPlatform] = useState<Platform | ''>(initialOrder?.platform || '');
    const [codCharges, setCodCharges] = useState<string>(initialOrder?.codCharges?.toString() || initialOrder?.shippingAmount?.toString() || '');
    const [shippingCharges, setShippingCharges] = useState<string>(initialOrder?.shippingCharges?.toString() || '');
    const [discount, setDiscount] = useState<string>(initialOrder?.discountAmount?.toString() || '');
    const [notes, setNotes] = useState<string>(initialOrder?.notes || '');
    const [items, setItems] = useState<Array<{ variant: string; quantity: number; price: number }>>(
        initialOrder?.items && initialOrder.items.length > 0
            ? initialOrder.items.map((it) => {
                // Extract price from lineAmount / quantity
                const price = it.quantity > 0 ? it.lineAmount / it.quantity : 0;
                return { variant: it.variant, quantity: it.quantity, price };
            })
            : [{ variant: '', quantity: 1, price: 0 }]
    );
    const [amount, setAmount] = useState<string>('');
    const [awb, setAwb] = useState<string>(initialOrder?.awbNumber || '');
    const [tracking, setTracking] = useState<{
        awb: string;
        statusText?: string;
        statusLocation?: string;
        statusDateTime?: string;
        expectedDeliveryDate?: string;
        pickupDate?: string;
        origin?: string;
        destination?: string;
        scans: Array<{
            status: string;
            instructions: string;
            location: string;
            dateTime: string;
        }>;
    } | null>(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState<string | null>(null);

    // Extract unique customers from orders (grouped by phone number)
    const uniqueCustomers = useMemo(() => {
        const customerMap = new Map<string, Order>();
        orders.forEach(order => {
            const phone = order.customerPhone;
            if (!customerMap.has(phone)) {
                customerMap.set(phone, order);
            } else {
                // Keep the most recent order for each customer
                const existing = customerMap.get(phone)!;
                if (new Date(order.date) > new Date(existing.date)) {
                    customerMap.set(phone, order);
                }
            }
        });
        return Array.from(customerMap.values())
            .sort((a, b) => a.customer.localeCompare(b.customer));
    }, [orders]);

    // Get available products (exclude already selected ones)
    const getAvailableProducts = (currentIdx: number) => {
        const selectedVariants = items
            .map((it, idx) => idx !== currentIdx ? it.variant : '')
            .filter(Boolean);
        return products.filter((product) => {
            const variantStr = `${product.name} - ${product.size}`;
            return !selectedVariants.includes(variantStr);
        });
    };

    // Auto-calculate total amount: sum of (price * quantity) + codCharges - discount
    // Note: Shipping charges are separate and not included in total amount
    useEffect(() => {
        const itemsTotal = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
        const codChargesAmount = Number(codCharges) || 0;
        const discountAmount = Number(discount) || 0;
        const total = itemsTotal + codChargesAmount - discountAmount;
        setAmount(String(total));
    }, [items, codCharges, discount]);

    // Live tracking for Delhivery AWB
    useEffect(() => {
        const trimmed = awb.trim();
        if (!trimmed) {
            setTracking(null);
            setTrackingError(null);
            return;
        }

        let cancelled = false;
        setTrackingLoading(true);
        setTrackingError(null);

        fetch(`/api/delhivery-track?awb=${encodeURIComponent(trimmed)}`)
            .then(async (res) => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Request failed with ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                const shipment = data?.ShipmentData?.[0]?.Shipment;
                if (!shipment) {
                    setTracking(null);
                    setTrackingError('No tracking information found for this AWB.');
                    return;
                }

                const status = shipment.Status || {};
                const scans = Array.isArray(shipment.Scans)
                    ? shipment.Scans.map((s: any) => s.ScanDetail).filter(Boolean)
                    : [];

                const mappedScans =
                    scans
                        .map((scan: any) => ({
                            status: scan.Scan || '',
                            instructions: scan.Instructions || '',
                            location: scan.ScannedLocation || '',
                            dateTime: scan.ScanDateTime || '',
                        }))
                        // sort by datetime ascending
                        .sort((a: any, b: any) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()) ?? [];

                setTracking({
                    awb: shipment.AWB,
                    statusText: status.Status || '',
                    statusLocation: status.StatusLocation || '',
                    statusDateTime: status.StatusDateTime || '',
                    expectedDeliveryDate: shipment.ExpectedDeliveryDate || shipment.PromisedDeliveryDate || null,
                    pickupDate: shipment.PickUpDate || shipment.PickedupDate || null,
                    origin: shipment.Origin || shipment.PickupLocation || '',
                    destination: shipment.Destination || (shipment.Consignee && shipment.Consignee.City) || '',
                    scans: mappedScans,
                });
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load Delhivery tracking', err);
                setTracking(null);
                setTrackingError('Failed to load tracking details. Please try again.');
            })
            .finally(() => {
                if (!cancelled) {
                    setTrackingLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [awb]);

    function addItem() { setItems((prev) => [...prev, { variant: '', quantity: 1, price: 0 }]); }
    function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }
    function updateItem(idx: number, key: 'variant' | 'quantity' | 'price', value: string | number) {
        setItems((prev) => {
            const updated = prev.map((it, i) => {
                if (i === idx) {
                    if (key === 'variant') {
                        // When variant changes, find the product and set its price
                        const variantStr = value as string;
                        const product = products.find((p) => `${p.name} - ${p.size}` === variantStr);
                        return { ...it, variant: variantStr, price: product ? product.price : 0 };
                    } else if (key === 'quantity') {
                        return { ...it, quantity: Number(value) || 0 };
                    } else {
                        return { ...it, price: Number(value) || 0 };
                    }
                }
                return it;
            });
            return updated;
        });
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!payment || !platform) {
            alert('Please select both Platform and Payment Mode');
            return;
        }
        const order: Order = {
            id: initialOrder?.id || '', // Server will generate the ID if not provided
            date: new Date(date).toISOString(),
            customer: name,
            customerPhone: phone,
            customerAddress: address,
            items: items.map((it) => ({ 
                variant: it.variant, 
                quantity: it.quantity, 
                lineAmount: it.price * it.quantity 
            } as OrderItem)),
            amount: Number(amount || 0),
            paymentStatus: payment as PaymentStatus,
            fulfillmentStatus: fulfillment,
            deliveryStatus: delivery,
            pincode: pincode || undefined,
            codCharges: codCharges ? Number(codCharges) : undefined,
            shippingCharges: shippingCharges ? Number(shippingCharges) : undefined,
            discountAmount: discount ? Number(discount) : undefined,
            awbNumber: awb || undefined,
            notes: notes || undefined,
            state,
            platform: platform as Platform,
            type: type ? type as OrderType : undefined,
        };
        onCreate(order);
    }

    // prevent page scroll while modal is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="shopify-add-modal-backdrop"
        >
            <div
                className="card shopify-add-modal-card"
                onClick={(e)=>e.stopPropagation()}
            >
                <div className="shopify-add-modal-header">
                    <h3 className="shopify-add-modal-title">
                        {mode === 'edit' ? 'Edit Order' : 'Add Order'}
                    </h3>
                    <button
                        className="icon-btn shopify-add-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <form
                    onSubmit={submit}
                    className="shopify-add-modal-form"
                >
                    <div
                        className="shopify-add-modal-body"
                    >
                        <div className="shopify-add-modal-grid">
                        <div className="shopify-add-modal-left">
                            {/* Customer & address */}
                            <div className="shopify-add-modal-section-title">Customer & address</div>
                            <div className="shopify-add-modal-section-grid">
                                <div>
                                    <label className="label">Phone</label>
                                    <PhoneDropdown
                                        customers={uniqueCustomers}
                                        selectedPhone={phone}
                                        phone={phone}
                                        onSelect={(customer) => {
                                            setName(customer.customer);
                                            setPhone(customer.customerPhone);
                                            setAddress(customer.customerAddress);
                                            setState(customer.state);
                                            setPincode(customer.pincode || '');
                                        }}
                                        onNewPhone={(newPhone) => {
                                            setPhone(newPhone);
                                            // Clear other fields when creating new customer
                                            setName('');
                                            setAddress('');
                                            setState('');
                                            setPincode('');
                                        }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Customer Name</label>
                                    <input 
                                        className="input shopify-add-modal-input" 
                                        type="text"
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)}
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="shopify-add-modal-single-column">
                                <div>
                                    <label className="label">Address</label>
                                    <input
                                        className="input shopify-add-modal-input"
                                        value={address}
                                        onChange={(e)=>setAddress(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="shopify-add-modal-section-title">Date & location</div>
                            <div className="shopify-add-modal-section-grid">
                                <div>
                                    <label className="label">Date</label>
                                    <DatePicker value={date} onChange={setDate} placeholder="Select date" />
                                </div>
                                <div>
                                    <label className="label">State</label>
                                    <input
                                        className="input shopify-add-modal-input"
                                        value={state}
                                        onChange={(e)=>setState(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Pincode</label>
                                    <input 
                                        className="input shopify-add-modal-input" 
                                        type="tel"
                                        value={pincode} 
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
                                            if (value.length <= 6) {
                                                setPincode(value);
                                            }
                                        }}
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="label">Type</label>
                                    <select
                                        className="input shopify-add-modal-input"
                                        value={type}
                                        onChange={(e)=>setType(e.target.value as OrderType | '')}
                                        required
                                    >
                                        <option value="">Select Type</option>
                                        <option value="New">New</option>
                                        <option value="Repeat">Repeat</option>
                                        <option value="Reference">Reference</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="shopify-add-modal-section-title shopify-add-modal-section-title--spaced">
                                    Order items
                                </div>
                                <div className="shopify-add-modal-items">
                                    {items.map((it, idx) => {
                                        const availableProducts = getAvailableProducts(idx);
                                        return (
                                            <div key={idx} className="shopify-add-modal-item-row">
                                                <div>
                                                    <label className="label">Variant</label>
                                                    <select 
                                                        className="input shopify-add-modal-input" 
                                                        value={it.variant} 
                                                        onChange={(e)=>updateItem(idx, 'variant', e.target.value)} 
                                                        required
                                                    >
                                                        <option value="">Select product</option>
                                                        {availableProducts.map((product) => (
                                                            <option key={product.id} value={`${product.name} - ${product.size}`}>
                                                                {product.name} - {product.size}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="label">Quantity</label>
                                                    <input
                                                        className="input shopify-add-modal-input"
                                                        type="number"
                                                        min={1}
                                                        value={it.quantity}
                                                        onChange={(e)=>updateItem(idx, 'quantity', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">Price (₹)</label>
                                                    <input 
                                                        className="input shopify-add-modal-input" 
                                                        type="number" 
                                                        min={0} 
                                                        value={it.price || ''} 
                                                        onChange={(e)=>updateItem(idx, 'price', e.target.value)} 
                                                        required 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label shopify-add-modal-label-hidden">Remove</label>
                                                    <button type="button" className="icon-btn" onClick={()=>removeItem(idx)} aria-label="Remove item">–</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        className="filter-btn shopify-add-modal-add-item-btn"
                                        onClick={addItem}
                                    >
                                        + Add item
                                    </button>
                                </div>
                            </div>

                            <div className="shopify-add-modal-section-title">Platform & status</div>
                            <div className="shopify-add-modal-section-grid">
                                <div>
                                    <label className="label">Platform</label>
                                    <select
                                        className="input shopify-add-modal-input"
                                        value={platform}
                                        onChange={(e)=>setPlatform(e.target.value as Platform | '')}
                                        required
                                    >
                                        <option value="">Select Platform</option>
                                        {(['Shopify','Abandoned','Whatsapp','Amazon','Flipkart'] as Platform[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Payment Mode</label>
                                    <select
                                        className="input shopify-add-modal-input"
                                        value={payment}
                                        onChange={(e)=>setPayment(e.target.value as PaymentStatus | '')}
                                        required
                                    >
                                        <option value="">Select Payment Mode</option>
                                        {(['COD','PAID'] as PaymentStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Fullfillment Status</label>
                                    <select
                                        className="input shopify-add-modal-input"
                                        value={fulfillment}
                                        onChange={(e)=>setFulfillment(e.target.value as FulfillmentStatus)}
                                        required
                                    >
                                        {(['Unfulfilled','Fulfilled','Partial'] as FulfillmentStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Shipping Status</label>
                                    <select
                                        className="input shopify-add-modal-input"
                                        value={delivery}
                                        onChange={(e)=>setDelivery(e.target.value as DeliveryStatus)}
                                        required
                                    >
                                        {(['In Transit','Delivered','RTO','Pending Pickup'] as DeliveryStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="shopify-add-modal-section-title">Charges & amount</div>
                            <div className="shopify-add-modal-section-grid">
                                <div>
                                    <label className="label">COD Charges (₹)</label>
                                    <input
                                        className="input shopify-add-modal-input"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={codCharges}
                                        onChange={(e)=>setCodCharges(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">Shipping Charges (₹)</label>
                                    <input
                                        className="input shopify-add-modal-input"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={shippingCharges}
                                        onChange={(e)=>setShippingCharges(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">Discount (₹)</label>
                                    <input
                                        className="input shopify-add-modal-input"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={discount}
                                        onChange={(e)=>setDiscount(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">Total Amount (₹)</label>
                                    <input 
                                        className="input shopify-add-modal-input shopify-add-modal-input--readonly" 
                                        type="number" 
                                        min={0} 
                                        value={amount} 
                                        readOnly
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="shopify-add-modal-notes">
                                <label className="label">Notes</label>
                                <textarea
                                    className="input shopify-add-modal-notes-textarea"
                                    placeholder="Internal notes about this order (optional)"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="shopify-add-modal-sidebar">
                            <div className="shopify-add-modal-tracking-card">
                                <div className="shopify-add-modal-tracking-title">Tracking (optional)</div>
                                <label className="label shopify-add-modal-tracking-label">AWB No</label>
                                <input
                                    className="input shopify-add-modal-tracking-input"
                                    type="text"
                                    value={awb}
                                    onChange={(e) => setAwb(e.target.value)}
                                    placeholder="Enter Delhivery AWB"
                                />
                            </div>
                            <div>
                                <div className="label shopify-add-modal-shipping-timeline-label">
                                    Shipping timeline
                                </div>
                                <ShippingTimeline
                                    status={delivery}
                                    awb={awb}
                                    tracking={tracking}
                                    loading={trackingLoading}
                                    error={trackingError}
                                />
                            </div>
                        </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            justifyContent: 'flex-end',
                            borderTop: '1px solid var(--border)',
                            padding: '16px 24px',
                            flexShrink: 0,
                            background: 'var(--bg-elev)',
                            boxShadow: '0 -2px 8px rgba(15, 79, 60, 0.04)',
                        }}
                    >
                        <button type="button" className="icon-btn" onClick={onClose} style={{ padding: '0 20px' }}>Cancel</button>
                        <button
                            type="submit"
                            className="button"
                            style={{
                                width: 'auto',
                                padding: '0 24px',
                                transition: 'transform 0.15s ease, box-shadow 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 125, 91, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {mode === 'edit' ? 'Save changes' : 'Create order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ShippingTimeline({
    status,
    awb,
    tracking,
    loading,
    error,
}: {
    status: DeliveryStatus;
    awb: string;
    tracking: {
        awb: string;
        statusText?: string;
        statusLocation?: string;
        statusDateTime?: string;
        expectedDeliveryDate?: string;
        pickupDate?: string;
        origin?: string;
        destination?: string;
        scans: Array<{
            status: string;
            instructions: string;
            location: string;
            dateTime: string;
        }>;
    } | null;
    loading: boolean;
    error: string | null;
}) {
    const steps: DeliveryStatus[] = ['Pending Pickup', 'In Transit', 'Delivered', 'RTO'];
    const [blinkOn, setBlinkOn] = useState(true);

    useEffect(() => {
        const id = setInterval(() => {
            setBlinkOn((v) => !v);
        }, 800);
        return () => clearInterval(id);
    }, []);

    function formatShortDate(input?: string) {
        if (!input) return '';
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return input;
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    const currentStepIndex = steps.indexOf(status);
    const safeCurrentStep = currentStepIndex === -1 ? 0 : currentStepIndex;

    const scans = tracking?.scans ?? [];
    const sortedScans = [...scans].sort(
        (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );

    const hasAwb = awb.trim().length > 0;

    if (!hasAwb) {
        return (
            <div
                style={{
                    background: 'linear-gradient(135deg, var(--bg-elev) 0%, color-mix(in srgb, var(--primary) 4%, var(--bg-elev)) 100%)',
                    borderRadius: 12,
                    border: '1px dashed var(--border)',
                    padding: 20,
                    fontSize: 13,
                    color: 'var(--muted)',
                    textAlign: 'center',
                    lineHeight: 1.5,
                }}
            >
                <span style={{ display: 'block', marginBottom: 6, fontSize: 20 }}>📦</span>
                Enter an AWB number above to view live Delhivery tracking.
            </div>
        );
    }

    const hasTrackingInfo = !!tracking && (sortedScans.length > 0 || tracking.statusText || tracking.statusLocation);

    if (!hasTrackingInfo && !loading && !error) {
        return (
            <div
                style={{
                    background: 'linear-gradient(135deg, var(--bg-elev) 0%, color-mix(in srgb, var(--primary) 4%, var(--bg-elev)) 100%)',
                    borderRadius: 12,
                    border: '1px dashed var(--border)',
                    padding: 20,
                    fontSize: 13,
                    color: 'var(--muted)',
                    textAlign: 'center',
                    lineHeight: 1.5,
                }}
            >
                <span style={{ display: 'block', marginBottom: 6, fontSize: 20 }}>🔍</span>
                No tracking information found for this AWB yet.
            </div>
        );
    }

    return (
        <div
            style={{
                background: 'var(--bg-elev)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                padding: 14,
                display: 'grid',
                gap: 12,
                boxShadow: '0 1px 3px rgba(15, 79, 60, 0.04)',
            }}
        >
            {/* Header with AWB + key dates */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 12,
                    borderRadius: 10,
                    background:
                        tracking && tracking.statusText === 'Delivered'
                            ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                            : 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
                    border: '1px solid rgba(148, 163, 184, 0.4)',
                    transition: 'box-shadow 0.2s ease',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#4b5563',
                            }}
                        >
                            AWB
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                            {awb || 'Not assigned'}
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'rgba(15, 23, 42, 0.9)',
                            color: '#f9fafb',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                        }}
                    >
                        <span style={{ fontSize: 11 }}>🚚</span>
                        <span>Delhivery</span>
                    </div>
                </div>

                {tracking && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: 8,
                            marginTop: 6,
                            fontSize: 11,
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    color: '#4b5563',
                                    marginBottom: 2,
                                }}
                            >
                                Pickup
                            </div>
                            <div style={{ color: '#111827', fontWeight: 500 }}>
                                {formatShortDate(tracking.pickupDate) || '—'}
                            </div>
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    color: '#4b5563',
                                    marginBottom: 2,
                                }}
                            >
                                Expected Delivery
                            </div>
                            <div style={{ color: '#111827', fontWeight: 500 }}>
                                {formatShortDate(tracking.expectedDeliveryDate) || '—'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Shipment status steps (vertical, only when tracking info exists) */}
            {hasTrackingInfo && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginTop: 2,
                    }}
                >
                    {steps.map((step, index) => {
                        const isActive = index === safeCurrentStep;
                        const isPast = index < safeCurrentStep;

                        let activeColor = '#0f172a';
                        let glowColor = 'rgba(15,23,42,0.15)';
                        if (step === 'In Transit') {
                            activeColor = '#2563eb'; // blue
                            glowColor = 'rgba(37,99,235,0.20)';
                        } else if (step === 'Delivered') {
                            activeColor = '#16a34a'; // green
                            glowColor = 'rgba(22,163,74,0.20)';
                        } else if (step === 'RTO') {
                            activeColor = '#b91c1c'; // red
                            glowColor = 'rgba(185,28,28,0.25)';
                        }

                        return (
                            <div
                                key={step}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <div
                                    style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 999,
                                        border: '2px solid',
                                        borderColor: isActive
                                            ? activeColor
                                            : isPast
                                            ? '#4b5563'
                                            : '#d1d5db',
                                        background: isActive
                                            ? activeColor
                                            : isPast
                                            ? '#4b5563'
                                            : '#f9fafb',
                                        opacity: isActive ? (blinkOn ? 1 : 0.25) : 1,
                                        boxShadow: isActive
                                            ? blinkOn
                                                ? `0 0 0 4px ${glowColor}`
                                                : 'none'
                                            : 'none',
                                        transition: 'opacity 0.2s ease-out, box-shadow 0.2s ease-out',
                                    }}
                                />
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: isActive ? 700 : isPast ? 600 : 500,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: isActive ? activeColor : isPast ? '#4b5563' : '#9ca3af',
                                    }}
                                >
                                    {step}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Status helper text (only when AWB is present) */}
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {loading && <div className="tracking-loading">Loading live tracking…</div>}
                {!loading && error && <div className="tracking-error">{error}</div>}
            </div>

            {/* All live events (latest first) */}
            {tracking && sortedScans.length > 0 && (
                <div className="tracking-scans">
                    <div className="tracking-scans-title">Latest updates</div>
                    <div className="tracking-scans-list">
                    {[...sortedScans].reverse().map((scan, idx) => {
                        const d = scan.dateTime ? new Date(scan.dateTime) : null;
                        const ts = d
                            ? d.toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                              })
                            : scan.dateTime;
                        return (
                            <div
                                key={`${scan.status}-${scan.dateTime}-${idx}`}
                                className="tracking-scan-item"
                            >
                                <div className="tracking-scan-header">
                                    <div className="tracking-scan-status">{scan.status}</div>
                                    {ts && <span className="tracking-scan-ts">{ts}</span>}
                                </div>
                                {scan.instructions && (
                                    <div className="tracking-scan-instructions">{scan.instructions}</div>
                                )}
                                {scan.location && (
                                    <div className="tracking-scan-location">📍 {scan.location}</div>
                                )}
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}
        </div>
    );
}

function CustomerProfileModal({ customerPhone, orders, onClose, onCopyPhone }: { customerPhone: string; orders: Order[]; onClose: () => void; onCopyPhone?: (phone: string) => void }) {
    // Get all orders for this customer (grouped by phone number)
    const customerOrders = useMemo(() => {
        return orders.filter(o => o.customerPhone === customerPhone)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, customerPhone]);

    // Get customer profile from the most recent order
    const customerProfile = useMemo(() => {
        if (customerOrders.length === 0) return null;
        const latestOrder = customerOrders[0];
        return {
            name: latestOrder.customer,
            phone: latestOrder.customerPhone,
            address: latestOrder.customerAddress,
            state: latestOrder.state,
            pincode: latestOrder.pincode || '—',
        };
    }, [customerOrders]);

    const totalOrders = customerOrders.length;
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.amount, 0);
    const deliveredCount = customerOrders.filter((o) => o.deliveryStatus === 'Delivered').length;
    const rtoCount = customerOrders.filter((o) => o.deliveryStatus === 'RTO').length;
    const inTransitCount = customerOrders.filter((o) => o.deliveryStatus === 'In Transit').length;

    const [activeTab, setActiveTab] = useState<'orders' | 'followups' | 'notes'>('orders');
    const [notes, setNotes] = useState<string>('');
    const [copyFeedback, setCopyFeedback] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleCopyPhoneClick = async () => {
        if (!customerProfile?.phone) return;
        if (onCopyPhone) {
            onCopyPhone(customerProfile.phone);
        } else {
            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(customerProfile.phone);
                }
            } catch (err) {
                console.error('Failed to copy phone number', err);
            }
        }
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 1800);
    };

    if (!customerProfile) {
        return null;
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="customer-modal-backdrop"
        >
            <div
                className="card customer-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="customer-modal-header">
                    <div className="customer-modal-header-left">
                        <div className="customer-avatar">
                            <span className="customer-avatar-initial">
                                {customerProfile.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </span>
                        </div>
                        <div className="customer-modal-header-text">
                            <h3 className="customer-modal-title">{customerProfile.name}</h3>
                            <div className="customer-modal-meta">
                                <span
                                    className="customer-modal-meta-item customer-modal-phone"
                                    onClick={handleCopyPhoneClick}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyPhoneClick(); } }}
                                    role="button"
                                    tabIndex={0}
                                    title="Copy number"
                                >
                                    <span className="customer-modal-meta-icon" aria-hidden>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    </span>
                                    <span className="customer-modal-phone-value">{customerProfile.phone}</span>
                                    {copyFeedback && <span className="customer-copy-feedback">Copied!</span>}
                                </span>
                                <span className="customer-modal-meta-item">
                                    <span className="customer-modal-meta-icon" aria-hidden>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    </span>
                                    <span>{customerProfile.state}</span>
                                </span>
                                <span className="customer-modal-meta-item">
                                    <span className="customer-modal-meta-icon" aria-hidden>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01"/></svg>
                                    </span>
                                    <span>{customerProfile.pincode}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="customer-modal-header-actions">
                        <a
                            href={`tel:${customerProfile.phone}`}
                            className="customer-modal-action-btn customer-modal-call"
                            aria-label="Call customer"
                        >
                            Call
                        </a>
                        <button
                            type="button"
                            className="customer-modal-action-btn customer-modal-copy"
                            onClick={handleCopyPhoneClick}
                            aria-label="Copy phone"
                            title="Copy number"
                        >
                            {copyFeedback ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            className="icon-btn customer-modal-close"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="customer-modal-content">
                    {/* Customer data at top */}
                    <div className="customer-info-card">
                        <div className="customer-info-grid">
                            <div className="customer-info-address">
                                <div className="customer-info-label">Address</div>
                                <div className="customer-info-value">{customerProfile.address}</div>
                            </div>
                        </div>
                        <div className="customer-stats-row">
                            {[
                                { label: 'Total orders', value: String(totalOrders), className: 'customer-stat--orders' },
                                { label: 'Total amount', value: formatCurrency(totalAmount), className: 'customer-stat--amount' },
                                { label: 'Delivered', value: String(deliveredCount), className: 'customer-stat--delivered' },
                                { label: 'RTO', value: String(rtoCount), className: 'customer-stat--rto' },
                                { label: 'In transit', value: String(inTransitCount), className: 'customer-stat--transit' },
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    className={`customer-stat ${stat.className}`}
                                >
                                    <div className="customer-stat-label">{stat.label}</div>
                                    <div className="customer-stat-value">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Orders, Followups, Notes below */}
                    <div className="customer-tabs">
                            <div className="customer-tabs-header">
                                {[
                                    { id: 'orders', label: 'Order history' },
                                    { id: 'followups', label: 'Followups' },
                                    { id: 'notes', label: 'Notes' },
                                ].map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`customer-tab ${isActive ? 'is-active' : ''}`}
                                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                        >
                                            <span className="customer-tab-label">{tab.label}</span>
                                            {tab.id === 'orders' && (
                                                <span className="customer-tab-pill">
                                                    {totalOrders}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className={`customer-tabs-body is-${activeTab}`}>
                                {activeTab === 'orders' && (
                                    <div className="table-scroll-wrapper customer-orders-wrapper">
                                        <table className="customer-orders-table">
                                            <thead>
                                                <tr className="customer-orders-header-row">
                                                    <Th>Date</Th>
                                                    <Th>Items</Th>
                                                    <Th>Amount</Th>
                                                    <Th>Payment</Th>
                                                    <Th>Delivery</Th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {customerOrders.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="customer-orders-empty-cell">
                                                            No orders found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    customerOrders.map((order) => (
                                                        <tr
                                                            key={order.id}
                                                            className="customer-orders-row"
                                                        >
                                                            <Td>{formatDate(order.date)}</Td>
                                                            <Td>
                                                                <div className="customer-orders-items">
                                                                    {(order.items ?? []).length === 0 ? (
                                                                        <span>—</span>
                                                                    ) : null}
                                                                    {(order.items ?? []).map(
                                                                        (it: OrderItem, idx: number) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="customer-orders-item-line"
                                                                            >
                                                                                {it.variant} × {it.quantity}
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </Td>
                                                            <td className="customer-orders-amount">
                                                                {formatCurrency(order.amount)}
                                                            </td>
                                                            <Td>
                                                                <StatusTag
                                                                    kind={order.paymentStatus}
                                                                    type="payment"
                                                                />
                                                            </Td>
                                                            <Td>
                                                                <StatusTag
                                                                    kind={order.deliveryStatus}
                                                                    type="delivery"
                                                                />
                                                            </Td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {activeTab === 'followups' && (
                                    <div className="customer-followups-card">
                                        <div className="customer-followups-header">
                                            <span className="customer-followups-title">Followups</span>
                                            <span className="customer-followups-pill">Coming soon</span>
                                        </div>
                                        <div className="customer-followups-text">
                                            Use the Followups page to schedule and record calls for this customer. This tab will show those records here in a future update.
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'notes' && (
                                    <div className="customer-notes-card">
                                        <div className="customer-notes-header">
                                            <span className="customer-notes-title">Notes</span>
                                            <span className="customer-notes-subtitle">Session-only (not saved)</span>
                                        </div>
                                        <textarea
                                            className="input customer-notes-textarea"
                                            placeholder="Type quick notes about this customer…"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                </div>
            </div>
        </div>
    );
}

function DeleteConfirmationModal({ order, onConfirm, onCancel }: { order: Order; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    const handleConfirm = async () => {
        if (isDeleting) return;
        try {
            setIsDeleting(true);
            await onConfirm();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onCancel}
            className="delete-modal-backdrop"
        >
            <div
                className="card delete-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="delete-modal-inner">
                    <div className="delete-modal-icon-row">
                        <div className="delete-modal-icon-wrap">
                            <span className="delete-modal-icon" aria-hidden="true">
                                ⚠️
                            </span>
                        </div>
                    </div>

                    <h3 className="delete-modal-title">
                        Delete order?
                    </h3>

                    <p className="delete-modal-text">
                        Are you sure you want to delete this order? This action cannot be undone.
                    </p>

                    <div className="delete-modal-customer-box">
                        <div className="delete-modal-customer-label">
                            Customer
                        </div>
                        <div className="delete-modal-customer-name">
                            {order.customer}
                        </div>
                        <div className="delete-modal-customer-amount">
                            Order amount: {formatCurrency(order.amount)}
                        </div>
                    </div>

                    <div className="delete-modal-actions">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="delete-modal-cancel"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="delete-modal-confirm"
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting…' : 'Delete order'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div className="shopify-toast-container">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast shopify-toast"
                    data-type={toast.type}
                >
                    <div className="shopify-toast-content">
                        <span className="shopify-toast-icon">
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}


