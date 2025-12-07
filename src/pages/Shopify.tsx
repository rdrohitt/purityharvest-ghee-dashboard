import { useEffect, useMemo, useRef, useState } from 'react';
import { loadOrders, addOrder, updateOrder, deleteOrder, type Order, type OrderItem, type PaymentStatus, type FulfillmentStatus, type DeliveryStatus, type Platform, type OrderType } from '../utils/orders';
import { loadProducts, type Product } from '../utils/products';
import { loadMarketingSpend, type SpendRecord } from '../utils/marketing-spend';

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

export default function Shopify() {
    const [range, setRange] = useState<UiRange>('all');
    const [customerFilter, setCustomerFilter] = useState('');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [marketingSpend, setMarketingSpend] = useState<SpendRecord[]>([]);
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
            loadMarketingSpend('meta-spend')
        ])
            .then(([ordersData, productsData, metaData]) => {
                if (cancelled) return;
                setOrders(ordersData);
                setProducts(productsData);
                setMarketingSpend(metaData as SpendRecord[]);
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
            const matchesCustomer = o.customer.toLowerCase().includes(customerFilter.toLowerCase());
            const matchesPayment = !paymentStatusFilter || o.paymentStatus === paymentStatusFilter;
            const matchesFulfillment = !fulfillmentStatusFilter || o.fulfillmentStatus === fulfillmentStatusFilter;
            const matchesDelivery = !deliveryStatusFilter || o.deliveryStatus === deliveryStatusFilter;
            const matchesPlatform = !platformFilter || o.platform === platformFilter;
            const matchesType = !typeFilter || o.type === typeFilter;
            return matchesCustomer && matchesPayment && matchesFulfillment && matchesDelivery && matchesPlatform && matchesType;
        });
    }, [byRange, customerFilter, paymentStatusFilter, fulfillmentStatusFilter, deliveryStatusFilter, platformFilter, typeFilter]);

    const metrics = useMemo(() => {
        const totalSales = filtered.reduce((s, o) => s + o.amount, 0);
        const quantity = filtered.reduce((s, o) => s + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
        const codCharges = filtered.reduce((s, o) => s + (o.codCharges || (o.shippingAmount || 0)), 0);
        const shippingCharges = filtered.reduce((s, o) => s + (o.shippingCharges || 0), 0);
        
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
        
        // Calculate ROAS (Return on Ad Spend) = Revenue / Marketing Spend
        const roas = totalMarketingSpend > 0 ? totalSales / totalMarketingSpend : 0;
        
        // Calculate quantities by size
        const quantityBySize: { [key: string]: number } = {
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
                    }
                }
            });
        });
        
        const deliveredOrders = filtered.filter(o => o.deliveryStatus === 'Delivered');
        const delivered = deliveredOrders.length;
        const deliveredAmount = deliveredOrders.reduce((s, o) => s + o.amount, 0);
        
        const rtoOrders = filtered.filter(o => o.deliveryStatus === 'RTO');
        const rto = rtoOrders.length;
        const rtoAmount = rtoOrders.reduce((s, o) => s + o.amount, 0);
        
        const inTransitOrders = filtered.filter(o => o.deliveryStatus === 'In Transit');
        const inTransit = inTransitOrders.length;
        const inTransitAmount = inTransitOrders.reduce((s, o) => s + o.amount, 0);
        
        return {
            totalSales,
            quantity,
            quantityBySize,
            codCharges,
            shippingCharges,
            roas,
            delivered,
            deliveredAmount,
            rto,
            rtoAmount,
            inTransit,
            inTransitAmount,
            totalOrders: filtered.length
        };
    }, [filtered, marketingSpend]);

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
        const groups: Array<{ label: string; items: Order[]; metaSpent: number }> = [];
        const dateToIndex = new Map<string, number>();
        for (const o of filtered) {
            const label = formatDate(o.date);
            const idx = dateToIndex.get(label);
            if (idx === undefined) {
                groups.push({ label, items: [o], metaSpent: 0 });
                dateToIndex.set(label, groups.length - 1);
            } else {
                groups[idx].items.push(o);
            }
        }
        // compute meta spent as 22% of revenue for that day (mock)
        for (const g of groups) {
            const total = g.items.reduce((s, it) => s + it.amount, 0);
            g.metaSpent = Math.round(total * 0.22);
        }
        return groups;
    }, [filtered]);

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>Shopify</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                        <div style={{ flex: 1 }} />
                        <input className="input" placeholder="Search customer" style={{ width: 240 }} value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
                        <button className="button" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setShowAddOrder(true)}>Add Order</button>
                    </div>
                    <div className="status-filters-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
                            options={['Shopify', 'Abandoned', 'Whatsapp'] as Platform[]}
                        />
                        <StatusFilter
                            label="Type"
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={['New', 'Repeat', 'Reference'] as OrderType[]}
                        />
                        {(paymentStatusFilter || fulfillmentStatusFilter || deliveryStatusFilter || platformFilter || typeFilter) ? (
                            <button 
                                className="filter-btn" 
                                onClick={() => { 
                                    setPaymentStatusFilter(''); 
                                    setFulfillmentStatusFilter(''); 
                                    setDeliveryStatusFilter(''); 
                                    setPlatformFilter(''); 
                                    setTypeFilter(''); 
                                }}
                                style={{ fontSize: 12, padding: '6px 12px' }}
                            >
                                Clear All
                            </button>
                        ) : null}
                    </div>
                </div>
                <div style={{ 
                    width: '100%', 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 0,
                    padding: '16px 0',
                    borderTop: '1px solid var(--border)',
                    marginTop: 12,
                    background: 'var(--bg)',
                }}>
                    <MetricItem label="Total Sales" value={formatCurrency(metrics.totalSales)} isLast={false} />
                    <QuantityMetric quantityBySize={metrics.quantityBySize} isLast={false} />
                    <MetricItemWithAmount label="Delivered" count={metrics.delivered} amount={metrics.deliveredAmount} isLast={false} />
                    <MetricItemWithAmount label="RTO" count={metrics.rto} amount={metrics.rtoAmount} isLast={false} />
                    <MetricItemWithAmount label="In Transit" count={metrics.inTransit} amount={metrics.inTransitAmount} isLast={false} />
                    <MetricItem label="Shipping Charges" value={formatCurrency(metrics.shippingCharges)} isLast={false} />
                    <MetricItem label="ROAS" value={metrics.roas > 0 ? metrics.roas.toFixed(2) : '—'} isLast={true} />
                </div>

                {showCustom ? (
                    <div
                        ref={popoverRef}
                        className="date-range-popover"
                        style={{
                            position: 'absolute',
                            top: 56,
                            left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label className="label" style={{ fontSize: 12, margin: 0 }}>Start</label>
                                <input className="input" type="date" value={customStart} onChange={(e)=>setCustomStart(e.target.value)} style={{ height: 36 }} />
                            </div>
                            <span style={{ color: 'var(--muted)' }}>—</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label className="label" style={{ fontSize: 12, margin: 0 }}>End</label>
                                <input className="input" type="date" value={customEnd} onChange={(e)=>setCustomEnd(e.target.value)} style={{ height: 36 }} />
                            </div>
                            <button className="button" style={{ width: 'auto', padding: '0 16px', height: 36 }} onClick={() => setShowCustom(false)}>Apply</button>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400, tableLayout: 'auto' }}>
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
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Date</Th>
                                <Th>Customer</Th>
                                <Th>Variant</Th>
                                <Th>Amount</Th>
                                <Th>Payment Mode</Th>
                                <Th>Platform</Th>
                                <Th>Delivery Status</Th>
                                <Th>Type</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        Loading orders…
                                    </td>
                                </tr>
                            ) : groupedByDate.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        No orders found. Click "Add Order" to create your first order.
                                    </td>
                                </tr>
                            ) : (
                                groupedByDate.map((group) => (
                                    group.items.map((o, idx) => (
                                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            {idx === 0 ? (
                                                <td rowSpan={group.items.length} style={{ padding: '12px', verticalAlign: 'top', fontWeight: 600, color: 'var(--text)', borderRight: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span>{group.label}</span>
                                                        {group.items.length > 0 && (
                                                            <a
                                                                href={`https://wa.me/918685045943?text=${encodeURIComponent(generateWhatsAppSummary(group.label, group.items, marketingSpend))}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '8px',
                                                                    background: '#25D366',
                                                                    color: 'white',
                                                                    textDecoration: 'none',
                                                                    fontSize: '18px',
                                                                    cursor: 'pointer',
                                                                    flexShrink: 0,
                                                                    border: '2px solid #128C7E',
                                                                    boxShadow: '0 2px 4px rgba(37, 211, 102, 0.3)',
                                                                    transition: 'all 0.2s ease',
                                                                    fontWeight: 'bold'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = '#128C7E';
                                                                    e.currentTarget.style.transform = 'scale(1.1)';
                                                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(37, 211, 102, 0.5)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = '#25D366';
                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 211, 102, 0.3)';
                                                                }}
                                                                title="Send Summary on WhatsApp"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                                                </svg>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            ) : null}
                                            <Td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span title={o.customerAddress} style={{ fontWeight: 600 }}>{o.customer}</span>
                                                <a className="link" href={`tel:${o.customerPhone}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>{o.customerPhone}</a>
                                            </div>
                                            </Td>
                                            <Td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {(o.items ?? []).length === 0 ? <span>—</span> : null}
                                                {(o.items ?? []).map((it: OrderItem, idx: number) => (
                                                    <div key={idx}>{it.variant} × {it.quantity}</div>
                                                ))}
                                            </div>
                                            </Td>
                                            <Td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{formatCurrency(o.amount)}</span>
                                                {o.codCharges ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>COD: {formatCurrency(o.codCharges)}</span> : null}
                                                {o.shippingCharges ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Shipping: {formatCurrency(o.shippingCharges)}</span> : null}
                                                {!o.codCharges && !o.shippingCharges && o.shippingAmount ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Shipping: {formatCurrency(o.shippingAmount)}</span> : null}
                                                {o.discountAmount ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Discount: {formatCurrency(o.discountAmount)}</span> : null}
                                            </div>
                                            </Td>
                                            <Td><StatusTag kind={o.paymentStatus} type="payment" /></Td>
                                            <Td><PlatformTag platform={o.platform} /></Td>
                                            <Td><StatusTag kind={o.deliveryStatus} type="delivery" /></Td>
                                            <Td><TypeTag type={o.type} /></Td>
                                            <Td>
                                                <div style={{ display: 'flex', gap: 8 }}>
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
                                                        onClick={async () => {
                                                            if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
                                                                try {
                                                                    await deleteOrder(o.id);
                                                                    setOrders((prev) => prev.filter((ord) => ord.id !== o.id));
                                                                    showToast('Order deleted successfully!', 'delete');
                                                                } catch (err) {
                                                                    console.error('Failed to delete order', err);
                                                                    showToast('Failed to delete order. Please check that the server is running and try again.', 'error');
                                                                }
                                                            }
                                                        }}
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

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
    return <td style={{ padding: '12px' }}>{children}</td>;
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

function MetricItem({ label, value, isLast }: { label: string; value: string; isLast: boolean }) {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            position: 'relative'
        }}>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px',
                lineHeight: 1.3,
                marginBottom: 2
            }}>
                {label}
            </div>
            <div style={{ 
                fontSize: 15, 
                fontWeight: 700, 
                color: 'var(--text)',
                lineHeight: 1.3,
                letterSpacing: '-0.2px'
            }}>
                {value}
            </div>
        </div>
    );
}

function QuantityMetric({ quantityBySize, isLast }: { quantityBySize: { [key: string]: number }; isLast: boolean }) {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 4,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            position: 'relative'
        }}>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px',
                lineHeight: 1.3,
                marginBottom: 2
            }}>
                Quantity
            </div>
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.4
            }}>
                {quantityBySize['500ml'] > 0 && (
                    <div>500ml → {quantityBySize['500ml'].toLocaleString()}</div>
                )}
                {quantityBySize['1ltr'] > 0 && (
                    <div>1ltr → {quantityBySize['1ltr'].toLocaleString()}</div>
                )}
                {quantityBySize['5ltr'] > 0 && (
                    <div>5ltr → {quantityBySize['5ltr'].toLocaleString()}</div>
                )}
                {quantityBySize['500ml'] === 0 && quantityBySize['1ltr'] === 0 && quantityBySize['5ltr'] === 0 && (
                    <div style={{ fontSize: 15, fontWeight: 700 }}>0</div>
                )}
            </div>
        </div>
    );
}

function MetricItemWithAmount({ label, count, amount, isLast }: { label: string; count: number; amount: number; isLast: boolean }) {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            position: 'relative'
        }}>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px',
                lineHeight: 1.3,
                marginBottom: 2
            }}>
                {label}
            </div>
            <div style={{ 
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                justifyContent: 'center',
                flexWrap: 'wrap',
                width: '100%'
            }}>
                <div style={{ 
                    fontSize: 15, 
                    fontWeight: 700, 
                    color: 'var(--text)',
                    lineHeight: 1.3,
                    letterSpacing: '-0.2px'
                }}>
                    {count.toLocaleString()}
                </div>
                <div style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: 'var(--muted)',
                    lineHeight: 1.3,
                    opacity: 0.85
                }}>
                    {formatCurrency(amount)}
                </div>
            </div>
        </div>
    );
}

// Simple modal to capture a new order
function AddOrderModal({ 
    products, 
    mode = 'add', 
    initialOrder, 
    onClose, 
    onCreate 
}: { 
    products: Product[]; 
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 60 }}
        >
            <div
                className="card"
                onClick={(e)=>e.stopPropagation()}
                style={{ width: '100%', maxWidth: 1200, maxHeight: '90vh', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>{mode === 'edit' ? 'Edit Order' : 'Add Order'}</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={submit} style={{ display: 'grid', gap: 20, padding: 20, overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Date</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="label">State</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={state} onChange={(e)=>setState(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Pincode</label>
                            <input 
                                className="input" 
                                style={{ width: '100%', marginTop: 6 }} 
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
                            <select className="input" style={{ width: '100%', marginTop: 6 }} value={type} onChange={(e)=>setType(e.target.value as OrderType | '')} required>
                                <option value="">Select Type</option>
                                <option value="New">New</option>
                                <option value="Repeat">Repeat</option>
                                <option value="Reference">Reference</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Customer Name</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={name} onChange={(e)=>setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Phone</label>
                            <input 
                                className="input" 
                                style={{ width: '100%', marginTop: 6 }} 
                                type="tel"
                                value={phone} 
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
                                    if (value.length <= 10) {
                                        setPhone(value);
                                    }
                                }}
                                maxLength={10}
                                pattern="[0-9]{10}"
                                required 
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="label">Address</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={address} onChange={(e)=>setAddress(e.target.value)} required />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            {items.map((it, idx) => {
                                const availableProducts = getAvailableProducts(idx);
                                return (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 44px', gap: 10, alignItems: 'end', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                                        <div>
                                            <label className="label">Variant</label>
                                            <select 
                                                className="input" 
                                                style={{ width: '100%', marginTop: 6 }} 
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
                                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={1} value={it.quantity} onChange={(e)=>updateItem(idx, 'quantity', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className="label">Price (₹)</label>
                                            <input 
                                                className="input" 
                                                style={{ width: '100%', marginTop: 6 }} 
                                                type="number" 
                                                min={0} 
                                                value={it.price || ''} 
                                                onChange={(e)=>updateItem(idx, 'price', e.target.value)} 
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <label className="label" style={{ visibility: 'hidden' }}>Remove</label>
                                            <button type="button" className="icon-btn" onClick={()=>removeItem(idx)} aria-label="Remove item">–</button>
                                        </div>
                                    </div>
                                );
                            })}
                            <button type="button" className="filter-btn" onClick={addItem} style={{ width: 'fit-content' }}>+ Add item</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Platform</label>
                            <select className="input" style={{ width: '100%', marginTop: 6 }} value={platform} onChange={(e)=>setPlatform(e.target.value as Platform | '')} required>
                                <option value="">Select Platform</option>
                                {(['Shopify','Abandoned','Whatsapp'] as Platform[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Payment Mode</label>
                            <select className="input" style={{ width: '100%', marginTop: 6 }} value={payment} onChange={(e)=>setPayment(e.target.value as PaymentStatus | '')} required>
                                <option value="">Select Payment Mode</option>
                                {(['COD','PAID'] as PaymentStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Fullfillment Status</label>
                            <select className="input" style={{ width: '100%', marginTop: 6 }} value={fulfillment} onChange={(e)=>setFulfillment(e.target.value as FulfillmentStatus)} required>
                                {(['Unfulfilled','Fulfilled','Partial'] as FulfillmentStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Delivery Status</label>
                            <select className="input" style={{ width: '100%', marginTop: 6 }} value={delivery} onChange={(e)=>setDelivery(e.target.value as DeliveryStatus)} required>
                                {(['In Transit','Delivered','RTO','Pending Pickup'] as DeliveryStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                        <div>
                            <label className="label">COD Charges (₹)</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={0} step="0.01" value={codCharges} onChange={(e)=>setCodCharges(e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Shipping Charges (₹)</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={0} step="0.01" value={shippingCharges} onChange={(e)=>setShippingCharges(e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Discount (₹)</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={0} step="0.01" value={discount} onChange={(e)=>setDiscount(e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Total Amount (₹)</label>
                            <input 
                                className="input" 
                                style={{ width: '100%', marginTop: 6, backgroundColor: 'var(--bg)', cursor: 'not-allowed' }} 
                                type="number" 
                                min={0} 
                                value={amount} 
                                readOnly
                                required 
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <button type="button" className="icon-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="button" style={{ width: 'auto', padding: '0 16px' }}>
                            {mode === 'edit' ? 'Save Changes' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast"
                    style={{
                        pointerEvents: 'auto',
                        animation: 'slideInRight 0.3s ease-out',
                    }}
                    data-type={toast.type}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}


