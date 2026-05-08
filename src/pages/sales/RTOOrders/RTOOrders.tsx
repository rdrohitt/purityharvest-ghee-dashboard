import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShopifyOrderApi } from '../../../types/shopify';
import {
    mapDeliveryStatusFromTracking,
} from '../../../utils/shopify-orders';
import { fetchRtoOrders } from '../../../utils/rto-orders';
import { ShopifyOrdersTable, type GroupedOrdersByDate } from '../Shopify/ShopifyOrdersTable';
import type { Order } from '../../../utils/orders';

type UiRange = 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';

type DateRange = { from: string; to: string };

function toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function computeRange(range: UiRange, customStart: string, customEnd: string): DateRange {
    const now = new Date();
    const today = toInputDate(now);
    if (range === 'today') return { from: today, to: today };
    if (range === 'yesterday') {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        const y = toInputDate(d);
        return { from: y, to: y };
    }
    if (range === 'last7') {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return { from: toInputDate(start), to: today };
    }
    if (range === 'currentMonth') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: toInputDate(start), to: today };
    }
    if (range === 'lastMonth') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: toInputDate(start), to: toInputDate(end) };
    }
    return { from: customStart, to: customEnd };
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RTOOrders() {
    const [range, setRange] = useState<UiRange>('currentMonth');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [customerFilter, setCustomerFilter] = useState('');
    const [orders, setOrders] = useState<ShopifyOrderApi[]>([]);
    const [loading, setLoading] = useState(false);
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const dateRange = useMemo(
        () => computeRange(range, customStart, customEnd),
        [range, customStart, customEnd]
    );

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchRtoOrders({ from: dateRange.from, to: dateRange.to, page: 1, limit: 100 })
            .then((res) => {
                if (cancelled) return;
                setOrders(res.orders);
            })
            .catch((err) => {
                console.error('Failed to load RTO orders', err);
                if (!cancelled) setOrders([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [dateRange.from, dateRange.to]);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!showCustom) return;
            const target = e.target as Node;
            if (popoverRef.current && popoverRef.current.contains(target)) return;
            if (customBtnRef.current && customBtnRef.current.contains(target)) return;
            setShowCustom(false);
        }
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [showCustom]);

    const filtered = useMemo(() => {
        const q = customerFilter.trim().toLowerCase();
        return orders
            .filter((o) => mapDeliveryStatusFromTracking(o.shippingDetails?.trackingStatus, o.returnStatus) === 'rto')
            .filter((o) => {
                if (!q) return true;
                const c = o.customer;
                const name =
                    c && typeof c === 'object' && 'name' in c
                        ? String(c.name ?? '')
                        : String(o.customerName ?? '');
                return name.toLowerCase().includes(q);
            });
    }, [orders, customerFilter]);

    const groupedByDate = useMemo((): GroupedOrdersByDate[] => {
        const groups: GroupedOrdersByDate[] = [];
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
                    shopifyAmount: 0,
                    totalShipping: 0,
                    codCount: 0,
                    paidCount: 0,
                    rtoCount: 0,
                    shopifyOrderCount: 0,
                });
                dateToIndex.set(label, groups.length - 1);
            } else {
                groups[idx].items.push(o);
            }
        }
        for (const g of groups) {
            let totalAmount = 0;
            let shopifyAmount = 0;
            let totalShipping = 0;
            let codCount = 0;
            let paidCount = 0;
            let rtoCount = 0;
            let shopifyOrderCount = 0;
            for (const it of g.items) {
                totalAmount += it.totalAmount;
                totalShipping += it.shippingCharges ?? 0;
                if ((it.platform ?? '').toLowerCase() === 'shopify') {
                    shopifyOrderCount += 1;
                    shopifyAmount += it.totalAmount;
                }
                if (it.paymentMode === 'PAID') paidCount += 1;
                else codCount += 1;
                const delivery = mapDeliveryStatusFromTracking(it.shippingDetails?.trackingStatus, it.returnStatus);
                if (delivery === 'rto') rtoCount += 1;
            }
            g.totalAmount = totalAmount;
            g.shopifyAmount = shopifyAmount;
            g.totalShipping = totalShipping;
            g.codCount = codCount;
            g.paidCount = paidCount;
            g.rtoCount = rtoCount;
            g.shopifyOrderCount = shopifyOrderCount;
            g.metaSpent = 0;
        }
        groups.sort((a, b) => {
            const isoA = a.items[0]?.date ?? a.items[0]?.createdAt ?? '';
            const isoB = b.items[0]?.date ?? b.items[0]?.createdAt ?? '';
            return isoB.localeCompare(isoA);
        });
        return groups;
    }, [filtered]);

    const handleNoopCustomerClick = (_customerId: string, _phone: string) => {};
    const handleNoopOrderAction = (_order: Order) => {};
    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>RTO Orders</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <FilterButton active={range === 'today'} onClick={() => { setRange('today'); setShowCustom(false); }}>Today</FilterButton>
                        <FilterButton active={range === 'yesterday'} onClick={() => { setRange('yesterday'); setShowCustom(false); }}>Yesterday</FilterButton>
                        <FilterButton active={range === 'last7'} onClick={() => { setRange('last7'); setShowCustom(false); }}>Last 7 days</FilterButton>
                        <FilterButton active={range === 'currentMonth'} onClick={() => { setRange('currentMonth'); setShowCustom(false); }}>Current Month</FilterButton>
                        <FilterButton active={range === 'lastMonth'} onClick={() => { setRange('lastMonth'); setShowCustom(false); }}>Last Month</FilterButton>
                        <FilterButton refEl={customBtnRef} active={range === 'custom'} onClick={() => { setRange('custom'); setShowCustom((v) => !v); }}>Custom</FilterButton>
                    </div>
                    <div style={{ flex: 1 }} />
                    <input
                        className="input admin-fluid-search"
                        placeholder="Search customer"
                        value={customerFilter}
                        onChange={(e) => setCustomerFilter(e.target.value)}
                    />
                </div>
                {showCustom ? (
                    <div
                        ref={popoverRef}
                        className="date-range-popover"
                        style={{ position: 'absolute', top: 56, left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label className="label" style={{ fontSize: 12, margin: 0 }}>Start</label>
                                <input className="input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ height: 36 }} />
                            </div>
                            <span style={{ color: 'var(--muted)' }}>-</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label className="label" style={{ fontSize: 12, margin: 0 }}>End</label>
                                <input className="input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ height: 36 }} />
                            </div>
                            <button className="button" style={{ width: 'auto', padding: '0 16px', height: 36 }} onClick={() => setShowCustom(false)}>Apply</button>
                        </div>
                    </div>
                ) : null}
            </div>

            <ShopifyOrdersTable
                groupedByDate={groupedByDate}
                marketingSpend={[]}
                loading={false}
                loadingMessage="Loading RTO orders"
                orderCount={filtered.length}
                summaryCategoryTab="ghee"
                viewMode="rto"
                onCustomerClick={handleNoopCustomerClick}
                onEdit={handleNoopOrderAction}
                onDelete={handleNoopOrderAction}
            />
        </section>
    );
}

function FilterButton({ active, onClick, children, refEl }: { active: boolean; onClick: () => void; children: string; refEl?: React.MutableRefObject<HTMLButtonElement | null> }) {
    return <button ref={refEl as never} onClick={onClick} className={`filter-btn ${active ? 'active' : ''}`}>{children}</button>;
}

