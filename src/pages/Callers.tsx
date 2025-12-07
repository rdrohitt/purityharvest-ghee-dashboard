import { useEffect, useMemo, useRef, useState } from 'react';
import { generateMockCallers, type Caller } from '../utils/callers';

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

type UiRange = 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';

function toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function Callers() {
    const [range, setRange] = useState<UiRange>('currentMonth');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [showAddCaller, setShowAddCaller] = useState(false);
    const [callers, setCallers] = useState<Caller[]>(() => generateMockCallers(50));
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const baseCallers = callers;

    const filtered = useMemo(() => {
        if (range === 'custom') {
            const start = new Date(customStart);
            const end = new Date(customEnd);
            end.setHours(23, 59, 59, 999);
            return baseCallers.filter(c => {
                const d = new Date(c.lastCallDate).getTime();
                return d >= start.getTime() && d <= end.getTime();
            });
        }
        
        const now = new Date();
        const callDate = (c: Caller) => new Date(c.lastCallDate).getTime();
        
        if (range === 'today') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return baseCallers.filter(c => {
                const d = callDate(c);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'yesterday') {
            const start = new Date(now);
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            return baseCallers.filter(c => {
                const d = callDate(c);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'last7') {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return baseCallers.filter(c => {
                const d = callDate(c);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'currentMonth') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return baseCallers.filter(c => {
                const d = callDate(c);
                return d >= start.getTime() && d <= end.getTime();
            });
        } else if (range === 'lastMonth') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            end.setHours(23, 59, 59, 999);
            return baseCallers.filter(c => {
                const d = callDate(c);
                return d >= start.getTime() && d <= end.getTime();
            });
        }
        
        return baseCallers;
    }, [baseCallers, range, customStart, customEnd]);

    function handleCreateCaller(newCaller: Caller) {
        setCallers((prev) => [newCaller, ...prev]);
        setShowAddCaller(false);
    }

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

    const totalRevenue = filtered.reduce((s, c) => s + c.totalRevenue, 0);

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>Callers</div>
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
                        <button className="button" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setShowAddCaller(true)}>Add Caller</button>
                    </div>
                    <div style={{ width: '100%', color: 'var(--muted)', fontSize: 14 }}>
                        Showing {filtered.length} callers · Total Revenue: {formatCurrency(totalRevenue)}
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
                                    <input className="input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ height: 36 }} />
                                </div>
                                <span style={{ color: 'var(--muted)' }}>—</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label className="label" style={{ fontSize: 12, margin: 0 }}>End</label>
                                    <input className="input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ height: 36 }} />
                                </div>
                                <button className="button" style={{ width: 'auto', padding: '0 16px', height: 36 }} onClick={() => setShowCustom(false)}>Apply</button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Name</Th>
                                <Th>Phone</Th>
                                <Th>Total Revenue Generated</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <Td style={{ fontWeight: 600 }}>{c.name}</Td>
                                    <Td>
                                        <a className="link" href={`tel:${c.phone}`}>{c.phone}</a>
                                    </Td>
                                    <Td>{formatCurrency(c.totalRevenue)}</Td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        No callers found
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddCaller ? (
                <AddCallerModal onClose={() => setShowAddCaller(false)} onCreate={handleCreateCaller} />
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

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td style={{ padding: '12px', ...style }}>{children}</td>;
}

function AddCallerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (caller: Caller) => void }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [revenue, setRevenue] = useState<string>('');

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const newCaller: Caller = {
            id: `CALLER-${Date.now()}`,
            name,
            phone,
            totalRevenue: parseFloat(revenue) || 0,
            lastCallDate: new Date().toISOString(),
        };
        onCreate(newCaller);
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
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 520, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Add Caller</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={submit} style={{ display: 'grid', gap: 20, padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
                    <div>
                        <label className="label">Name</label>
                        <input
                            className="input"
                            style={{ width: '100%', marginTop: 6 }}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter caller name"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Phone</label>
                        <input
                            className="input"
                            style={{ width: '100%', marginTop: 6 }}
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Enter phone number"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Total Revenue (₹)</label>
                        <input
                            className="input"
                            style={{ width: '100%', marginTop: 6 }}
                            type="number"
                            min={0}
                            value={revenue}
                            onChange={(e) => setRevenue(e.target.value)}
                            placeholder="Enter total revenue"
                            required
                        />
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

