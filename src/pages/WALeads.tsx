import { useEffect, useMemo, useRef, useState } from 'react';
import { type Order, type OrderItem, type PaymentStatus, type FulfillmentStatus, type DeliveryStatus } from '../utils/orders';

type WAPaymentStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed';

function formatCurrency(n: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }

type UiRange = 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';

export default function WALeads() {
    const [range, setRange] = useState<UiRange>('today');
    const [customerFilter, setCustomerFilter] = useState('');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<WAPaymentStatus | ''>('');
    const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState<FulfillmentStatus | ''>('');
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatus | ''>('');
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/wa-leads-orders')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load WA Leads orders');
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setOrders(data);
            })
            .catch((err) => {
                console.error('Failed to load WA Leads orders', err);
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
            const end = new Date(customEnd);
            end.setHours(23,59,59,999);
            return generatedPlusUser.filter(o => {
                const d = new Date(o.date).getTime();
                return d >= start.getTime() && d <= end.getTime();
            });
        }
        
        const now = new Date();
        const orderDate = (o: Order) => new Date(o.date).getTime();
        
        if (range === 'today') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return generatedPlusUser.filter(o => {
                const d = orderDate(o);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'yesterday') {
            const start = new Date(now);
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            return generatedPlusUser.filter(o => {
                const d = orderDate(o);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'last7') {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return generatedPlusUser.filter(o => {
                const d = orderDate(o);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'currentMonth') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return generatedPlusUser.filter(o => {
                const d = orderDate(o);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'lastMonth') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            end.setHours(23, 59, 59, 999);
            return generatedPlusUser.filter(o => {
                const d = orderDate(o);
                return d >= start.getTime() && d <= end.getTime();
            });
        }
        
        return generatedPlusUser;
    }, [generatedPlusUser, range, customStart, customEnd]);

    const filtered = useMemo(() => {
        return byRange.filter(o => {
            const matchesCustomer = o.customer.toLowerCase().includes(customerFilter.toLowerCase());
            const matchesPayment = !paymentStatusFilter || (o.paymentStatus as string) === paymentStatusFilter;
            const matchesFulfillment = !fulfillmentStatusFilter || o.fulfillmentStatus === fulfillmentStatusFilter;
            const matchesDelivery = !deliveryStatusFilter || o.deliveryStatus === deliveryStatusFilter;
            return matchesCustomer && matchesPayment && matchesFulfillment && matchesDelivery;
        });
    }, [byRange, customerFilter, paymentStatusFilter, fulfillmentStatusFilter, deliveryStatusFilter]);

    const metrics = useMemo(() => {
        const totalSales = filtered.reduce((s, o) => s + o.amount, 0);
        const quantity = filtered.reduce((s, o) => s + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
        const shipping = filtered.reduce((s, o) => s + (o.shippingAmount || 0), 0);
        
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
            leads: filtered.length,
            leadsAmount: totalSales,
            totalSales,
            quantity,
            shipping,
            delivered,
            deliveredAmount,
            rto,
            rtoAmount,
            inTransit,
            inTransitAmount,
            totalOrders: filtered.length
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

    const groupedByDate = useMemo(() => {
        const groups: Array<{ label: string; items: Order[] }> = [];
        const dateToIndex = new Map<string, number>();
        for (const o of filtered) {
            const label = new Date(o.date).toLocaleDateString();
            const idx = dateToIndex.get(label);
            if (idx === undefined) {
                groups.push({ label, items: [o] });
                dateToIndex.set(label, groups.length - 1);
            } else {
                groups[idx].items.push(o);
            }
        }
        return groups;
    }, [filtered]);

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>WA Leads</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                        <button className="button" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setShowAddOrder(true)}>Add Lead</button>
                    </div>
                    <div className="status-filters-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <StatusFilter
                            label="Payment"
                            value={paymentStatusFilter}
                            onChange={setPaymentStatusFilter}
                            options={['Paid', 'Pending', 'Refunded', 'Failed'] as WAPaymentStatus[]}
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
                        {(paymentStatusFilter || fulfillmentStatusFilter || deliveryStatusFilter) ? (
                            <button 
                                className="filter-btn" 
                                onClick={() => { setPaymentStatusFilter(''); setFulfillmentStatusFilter(''); setDeliveryStatusFilter(''); }}
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
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 0,
                    padding: '16px 0',
                    borderTop: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    marginTop: 8,
                    background: 'var(--bg)',
                    borderRadius: 8
                }}>
                    <MetricItemWithAmount label="Total Leads" count={metrics.leads} amount={metrics.leadsAmount} isLast={false} />
                    <MetricItemWithAmount label="Converted" count={metrics.delivered} amount={metrics.deliveredAmount} isLast={false} />
                    <MetricItem label="Quantity" value={metrics.quantity.toLocaleString()} isLast={false} />
                    <MetricItemWithAmount label="RTO" count={metrics.rto} amount={metrics.rtoAmount} isLast={false} />
                    <MetricItemWithAmount label="In Transit" count={metrics.inTransit} amount={metrics.inTransitAmount} isLast={false} />
                    <MetricItem label="Shipping" value={formatCurrency(metrics.shipping)} isLast={true} />
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '240px', minWidth: '240px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '160px', minWidth: '160px' }} />
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
                                        No orders found. Click "Add Lead" to create your first order.
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

            {showAddOrder ? (
                <AddOrderModal 
                    onClose={() => setShowAddOrder(false)} 
                    onCreate={async (o) => {
                        try {
                            const response = await fetch('/api/wa-leads-orders', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(o),
                            });
                            if (!response.ok) throw new Error('Failed to save order');
                            const saved = await response.json();
                            setOrders((prev) => [saved, ...prev]);
                            setShowAddOrder(false);
                        } catch (err) {
                            console.error('Failed to create order', err);
                            alert('Failed to create order. Please check that the server is running and try again.');
                        }
                    }} 
                />
            ) : null}
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

function AddOrderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (o: Order) => void }) {
    const [date, setDate] = useState<string>(toInputDate(new Date()));
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [state, setState] = useState('');
    const [payment, setPayment] = useState<WAPaymentStatus>('Paid');
    const [fulfillment, setFulfillment] = useState<FulfillmentStatus>('Unfulfilled');
    const [delivery, setDelivery] = useState<DeliveryStatus>('In Transit');
    const [pincode, setPincode] = useState('');
    const [shipping, setShipping] = useState<string>('');
    const [discount, setDiscount] = useState<string>('');
    const [items, setItems] = useState<Array<{ variant: string; quantity: number }>>([{ variant: '', quantity: 1 }]);
    const [amount, setAmount] = useState<string>('');

    function addItem() { setItems((prev) => [...prev, { variant: '500ml Ghee', quantity: 1 }]); }
    function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }
    function updateItem(idx: number, key: 'variant' | 'quantity', value: string) {
        setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: key === 'quantity' ? Number(value || 0) : value } : it));
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const order: Order = {
            id: '', // Server will generate the ID
            date: new Date(date).toISOString(),
            customer: name,
            customerPhone: phone,
            customerAddress: address,
            items: items.map((it) => ({ variant: it.variant, quantity: it.quantity, lineAmount: 0 } as OrderItem)),
            amount: Number(amount || 0),
            paymentStatus: payment as PaymentStatus,
            fulfillmentStatus: fulfillment,
            deliveryStatus: delivery,
            pincode: pincode || undefined,
            shippingAmount: shipping ? Number(shipping) : undefined,
            state,
        };
        onCreate(order);
    }

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 60 }}
        >
            <div
                className="card"
                onClick={(e)=>e.stopPropagation()}
                style={{ width: '100%', maxWidth: 820, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Add Lead</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={submit} style={{ display: 'grid', gap: 20, padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
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
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={pincode} onChange={(e)=>setPincode(e.target.value)} required />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Customer Name</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={name} onChange={(e)=>setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Phone</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={phone} onChange={(e)=>setPhone(e.target.value)} required />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="label">Address</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={address} onChange={(e)=>setAddress(e.target.value)} required />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            {items.map((it, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 44px', gap: 10, alignItems: 'end', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                                    <div>
                                        <label className="label">Variant</label>
                                        <input className="input" style={{ width: '100%', marginTop: 6 }} placeholder="Variant name" value={it.variant} onChange={(e)=>updateItem(idx, 'variant', e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="label">Quantity</label>
                                        <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={1} value={it.quantity} onChange={(e)=>updateItem(idx, 'quantity', e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="label" style={{ visibility: 'hidden' }}>Remove</label>
                                        <button type="button" className="icon-btn" onClick={()=>removeItem(idx)} aria-label="Remove item">–</button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" className="filter-btn" onClick={addItem} style={{ width: 'fit-content' }}>+ Add item</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Payment Status</label>
                            <select className="input" style={{ width: '100%', marginTop: 6 }} value={payment} onChange={(e)=>setPayment(e.target.value as WAPaymentStatus)} required>
                                {(['Paid','Pending','Refunded','Failed'] as WAPaymentStatus[]).map((p)=> <option key={p} value={p}>{p}</option>)}
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Total Amount (₹)</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={0} value={amount} onChange={(e)=>setAmount(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Shipping (₹)</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={0} value={shipping} onChange={(e)=>setShipping(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Discount (₹)</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} type="number" min={0} value={discount} onChange={(e)=>setDiscount(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <button type="button" className="icon-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="button" style={{ width: 'auto', padding: '0 16px' }}>Create</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

