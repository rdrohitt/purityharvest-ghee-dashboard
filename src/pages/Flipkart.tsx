import { useEffect, useMemo, useRef, useState } from 'react';
import { type Order, type OrderItem, type PaymentStatus, type FulfillmentStatus, type DeliveryStatus } from '../utils/orders';

function formatCurrency(n: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }

type UiRange = 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';

export default function Flipkart() {
    const [range, setRange] = useState<UiRange>('today');
    const [customerFilter, setCustomerFilter] = useState('');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | ''>('');
    const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState<FulfillmentStatus | ''>('');
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatus | ''>('');
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/flipkart-orders')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load Flipkart orders');
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setOrders(data);
            })
            .catch((err) => {
                console.error('Failed to load Flipkart orders', err);
                if (!cancelled) setOrders([]);
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

    const byRange = useMemo(() => {
        if (range === 'custom') {
            const start = new Date(customStart);
            const end = new Date(customEnd); end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => { const d = new Date(o.date).getTime(); return d >= start.getTime() && d <= end.getTime(); });
        }
        const now = new Date();
        const orderDate = (o: Order) => new Date(o.date).getTime();
        if (range === 'today') {
            const start = new Date(now); start.setHours(0,0,0,0);
            const end = new Date(now); end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => { const d = orderDate(o); return d >= start.getTime() && d <= end.getTime(); });
        } else if (range === 'yesterday') {
            const start = new Date(now); start.setDate(start.getDate()-1); start.setHours(0,0,0,0);
            const end = new Date(start); end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => { const d = orderDate(o); return d >= start.getTime() && d <= end.getTime(); });
        } else if (range === 'last7') {
            const start = new Date(now); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
            const end = new Date(now); end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => { const d = orderDate(o); return d >= start.getTime() && d <= end.getTime(); });
        } else if (range === 'currentMonth') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1); start.setHours(0,0,0,0);
            const end = new Date(now); end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => { const d = orderDate(o); return d >= start.getTime() && d <= end.getTime(); });
        } else if (range === 'lastMonth') {
            const start = new Date(now.getFullYear(), now.getMonth()-1, 1); start.setHours(0,0,0,0);
            const end = new Date(now.getFullYear(), now.getMonth(), 0); end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => { const d = orderDate(o); return d >= start.getTime() && d <= end.getTime(); });
        }
        return generatedPlusUser;
    }, [generatedPlusUser, range, customStart, customEnd]);

    const filtered = useMemo(() => {
        return byRange.filter(o => {
            const matchesCustomer = o.customer.toLowerCase().includes(customerFilter.toLowerCase());
            const matchesPayment = !paymentStatusFilter || o.paymentStatus === paymentStatusFilter;
            const matchesFulfillment = !fulfillmentStatusFilter || o.fulfillmentStatus === fulfillmentStatusFilter;
            const matchesDelivery = !deliveryStatusFilter || o.deliveryStatus === deliveryStatusFilter;
            return matchesCustomer && matchesPayment && matchesFulfillment && matchesDelivery;
        });
    }, [byRange, customerFilter, paymentStatusFilter, fulfillmentStatusFilter, deliveryStatusFilter]);

    const metrics = useMemo(() => {
        const totalSales = filtered.reduce((s, o) => s + o.amount, 0);
        const quantity = filtered.reduce((s, o) => s + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
        const shipping = filtered.reduce((s, o) => s + (o.shippingAmount || 0), 0);
        const adsSpend = Math.round(totalSales * 0.22);
        const delivered = filtered.filter(o => o.deliveryStatus === 'Delivered').length;
        const rto = filtered.filter(o => o.deliveryStatus === 'RTO').length;
        const inTransit = filtered.filter(o => o.deliveryStatus === 'In Transit').length;
        return { totalSales, quantity, shipping, adsSpend, delivered, rto, inTransit, totalOrders: filtered.length };
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

    const groupedByDate = useMemo(() => {
        const groups: Array<{ label: string; items: Order[]; ads: number }> = [];
        const dateToIndex = new Map<string, number>();
        for (const o of filtered) {
            const label = new Date(o.date).toLocaleDateString();
            const idx = dateToIndex.get(label);
            if (idx === undefined) {
                groups.push({ label, items: [o], ads: 0 });
                dateToIndex.set(label, groups.length - 1);
            } else {
                groups[idx].items.push(o);
            }
        }
        for (const g of groups) {
            const total = g.items.reduce((s, it) => s + it.amount, 0);
            g.ads = Math.round(total * 0.22);
        }
        return groups;
    }, [filtered]);

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>Flipkart</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <FilterButton active={range === 'today'} onClick={() => { setRange('today'); setShowCustom(false); }}>Today</FilterButton>
                            <FilterButton active={range === 'yesterday'} onClick={() => { setRange('yesterday'); setShowCustom(false); }}>Yesterday</FilterButton>
                            <FilterButton active={range === 'last7'} onClick={() => { setRange('last7'); setShowCustom(false); }}>Last 7 days</FilterButton>
                            <FilterButton active={range === 'currentMonth'} onClick={() => { setRange('currentMonth'); setShowCustom(false); }}>Current Month</FilterButton>
                            <FilterButton active={range === 'lastMonth'} onClick={() => { setRange('lastMonth'); setShowCustom(false); }}>Last Month</FilterButton>
                            <FilterButton refEl={customBtnRef} active={range === 'custom'} onClick={() => { setRange('custom'); setShowCustom((v)=>!v); }}>Custom</FilterButton>
                        </div>
                        <div style={{ flex: 1 }} />
                        <input className="input" placeholder="Search customer" style={{ width: 240 }} value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
                        <button className="button" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setShowAddOrder(true)}>Add Order</button>
                    </div>
                </div>
                <div style={{ 
                    width: '100%', 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 0,
                    padding: '16px 0',
                    borderTop: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    marginTop: 8,
                    background: 'var(--bg)',
                    borderRadius: 8
                }}>
                    <MetricItem label="Total Sales" value={formatCurrency(metrics.totalSales)} isLast={false} />
                    <MetricItem label="Quantity" value={metrics.quantity.toLocaleString()} isLast={false} />
                    <MetricItemWithAmount label="Delivered" count={metrics.delivered} amount={filtered.filter(o=>o.deliveryStatus==='Delivered').reduce((s,o)=>s+o.amount,0)} isLast={false} />
                    <MetricItemWithAmount label="RTO" count={metrics.rto} amount={filtered.filter(o=>o.deliveryStatus==='RTO').reduce((s,o)=>s+o.amount,0)} isLast={false} />
                    <MetricItemWithAmount label="In Transit" count={metrics.inTransit} amount={filtered.filter(o=>o.deliveryStatus==='In Transit').reduce((s,o)=>s+o.amount,0)} isLast={false} />
                    <MetricItem label="Shipping" value={formatCurrency(metrics.shipping)} isLast={false} />
                    <MetricItem label="Flipkart Ads" value={formatCurrency(metrics.adsSpend)} isLast={true} />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '240px', minWidth: '240px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '160px', minWidth: '160px' }} />
                            <col style={{ width: '160px', minWidth: '160px' }} />
                            <col style={{ width: '160px', minWidth: '160px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Date</Th>
                                <Th>Customer</Th>
                                <Th>Variant</Th>
                                <Th>Amount</Th>
                                <Th>Payment Status</Th>
                                <Th>Fullfillment Status</Th>
                                <Th>Shipping</Th>
                                <Th>Delivery Status</Th>
                                <Th>State</Th>
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
                                                    {group.label}
                                                </td>
                                            ) : null}
                                            <Td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span title={o.customerAddress} style={{ fontWeight: 600 }}>{o.customer}</span>
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
                                            <Td>{formatCurrency(o.amount)}</Td>
                                            <Td><StatusTag kind={o.paymentStatus} type="payment" /></Td>
                                            <Td>{o.fulfillmentStatus}</Td>
                                            <Td>{formatCurrency(o.shippingAmount ?? 0)}</Td>
                                            <Td><StatusTag kind={o.deliveryStatus} type="delivery" /></Td>
                                            <Td>{o.state}</Td>
                                        </tr>
                                    ))
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function FilterButton({ active, onClick, children, refEl }: { active: boolean; onClick: () => void; children: string; refEl?: React.MutableRefObject<HTMLButtonElement | null> }) {
    return (
        <button ref={refEl as any} onClick={onClick} className={`filter-btn ${active ? 'active' : ''}`}>{children}</button>
    );
}
function Th({ children }: { children: string }) { return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td style={{ padding: '12px' }}>{children}</td>; }

function MetricItem({ label, value, isLast }: { label: string; value: string; isLast: boolean }) {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            borderRight: isLast ? 'none' : '1px solid var(--border)'
        }}>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                lineHeight: 1.2
            }}>
                {label}
            </div>
            <div style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: 'var(--text)',
                lineHeight: 1.2
            }}>
                {value}
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
            borderRight: isLast ? 'none' : '1px solid var(--border)'
        }}>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                lineHeight: 1.2
            }}>
                {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                    {count.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.2 }}>
                    {formatCurrency(amount)}
                </div>
            </div>
        </div>
    );
}

function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'Paid') cls = 'tag success';
        else if (kind === 'Pending') cls = 'tag warning';
        else if (kind === 'Failed') cls = 'tag danger';
        else cls = 'tag info';
    } else {
        if (kind === 'Delivered') cls = 'tag success';
        else if (kind === 'In Transit') cls = 'tag info';
        else if (kind === 'Pending Pickup') cls = 'tag warning';
        else if (kind === 'RTO') cls = 'tag danger';
    }
    return <span className={cls}>{kind}</span>;
}

function toInputDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}


