import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMarketingSpend, addMarketingSpend, updateMarketingSpend, deleteMarketingSpend, type SpendRecord, type MiscRecord } from '../utils/marketing-spend';

type DateFilterMode = 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';
type Platform = 'Meta' | 'Amazon' | 'Flipkart' | 'Miscellaneous';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

function toInputDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

export default function MarketingSpend() {
    const today = toInputDate(new Date());

    const [meta, setMeta] = useState<SpendRecord[]>([]);
    const [amazon, setAmazon] = useState<SpendRecord[]>([]);
    const [flipkart, setFlipkart] = useState<SpendRecord[]>([]);
    const [misc, setMisc] = useState<MiscRecord[]>([]);
    const [mode, setMode] = useState<DateFilterMode>('currentMonth');
    const [customFrom, setCustomFrom] = useState<string>('');
    const [customTo, setCustomTo] = useState<string>('');
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

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            loadMarketingSpend('meta-spend'),
            loadMarketingSpend('amazon-spend'),
            loadMarketingSpend('flipkart-spend'),
            loadMarketingSpend('misc-spend')
        ])
            .then(([metaData, amazonData, flipkartData, miscData]) => {
                if (cancelled) return;
                setMeta(metaData as SpendRecord[]);
                setAmazon(amazonData as SpendRecord[]);
                setFlipkart(flipkartData as SpendRecord[]);
                setMisc(miscData as MiscRecord[]);
            })
            .catch((err) => {
                console.error('Failed to load marketing spend data', err);
                if (!cancelled) {
                    showToast('Failed to load marketing spend data. Please check that the server is running.', 'error');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const filteredMeta = useFilterRows(meta, mode, customFrom, customTo);
    const filteredAmazon = useFilterRows(amazon, mode, customFrom, customTo);
    const filteredFlipkart = useFilterRows(flipkart, mode, customFrom, customTo);
    const filteredMisc = useFilterRows(misc, mode, customFrom, customTo);

    const totals = useMemo(() => ({
        meta: filteredMeta.reduce((s, r) => s + r.amount, 0),
        amazon: filteredAmazon.reduce((s, r) => s + r.amount, 0),
        flipkart: filteredFlipkart.reduce((s, r) => s + r.amount, 0),
        misc: filteredMisc.reduce((s, r) => s + r.amount, 0),
    }), [filteredMeta, filteredAmazon, filteredFlipkart, filteredMisc]);

    return (
        <section style={{ display: 'grid', gap: 12, maxWidth: 1200, margin: '0 auto', width: '100%', padding: 8 }}>
            <div className="card" style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontWeight: 800 }}>Marketing Spend</div>
                <div style={{ color: 'var(--muted)' }}>Capture wallet recharges across channels</div>
                <DateFilterBar
                    mode={mode}
                    setMode={setMode}
                    customFrom={customFrom}
                    setCustomFrom={setCustomFrom}
                    customTo={customTo}
                    setCustomTo={setCustomTo}
                />
                <div style={{ 
                    width: '100%', 
                    display: 'flex',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    marginTop: 12,
                    background: 'var(--bg-elev)',
                }}>
                    <ModernMetricItem 
                        icon="📱" 
                        label="Meta Wallet" 
                        value={formatCurrency(totals.meta)} 
                        iconColor="#1877f2"
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem 
                        icon="📦" 
                        label="Amazon Wallet" 
                        value={formatCurrency(totals.amazon)} 
                        iconColor="#ff9900"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem 
                        icon="🛒" 
                        label="Flipkart Wallet" 
                        value={formatCurrency(totals.flipkart)} 
                        iconColor="#2874f0"
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem 
                        icon="💰" 
                        label="Miscellaneous" 
                        value={formatCurrency(totals.misc)} 
                        iconColor="#8b5cf6"
                        isLast={true}
                        isEven={true}
                    />
                </div>
            </div>

            <UnifiedSpendSection
                    meta={meta}
                    amazon={amazon}
                    flipkart={flipkart}
                misc={misc}
                    mode={mode}
                    customFrom={customFrom}
                    customTo={customTo}
                    loading={loading}
                    onAdd={async (platform, rec) => {
                        try {
                        if (platform === 'Miscellaneous') {
                            const saved = await addMarketingSpend('misc-spend', rec as MiscRecord);
                            setMisc((v) => [saved as MiscRecord, ...v]);
                        } else {
                            const endpoint = platform === 'Meta' ? 'meta-spend' : platform === 'Amazon' ? 'amazon-spend' : 'flipkart-spend';
                            const saved = await addMarketingSpend(endpoint, rec as SpendRecord);
                            if (platform === 'Meta') setMeta((v) => [saved as SpendRecord, ...v]);
                            if (platform === 'Amazon') setAmazon((v) => [saved as SpendRecord, ...v]);
                            if (platform === 'Flipkart') setFlipkart((v) => [saved as SpendRecord, ...v]);
                        }
                            showToast(`${platform} spend added successfully!`, 'success');
                        } catch (err) {
                            console.error('Failed to add spend record', err);
                            showToast('Failed to add spend record. Please check that the server is running and try again.', 'error');
                        }
                    }}
                    onUpdate={async (platform, rec) => {
                        try {
                        if (platform === 'Miscellaneous') {
                            const updated = await updateMarketingSpend('misc-spend', rec as MiscRecord);
                            setMisc((v) => v.map((r) => r.id === updated.id ? updated as MiscRecord : r));
                        } else {
                            const endpoint = platform === 'Meta' ? 'meta-spend' : platform === 'Amazon' ? 'amazon-spend' : 'flipkart-spend';
                            const updated = await updateMarketingSpend(endpoint, rec as SpendRecord);
                            if (platform === 'Meta') setMeta((v) => v.map((r) => r.id === updated.id ? updated as SpendRecord : r));
                            if (platform === 'Amazon') setAmazon((v) => v.map((r) => r.id === updated.id ? updated as SpendRecord : r));
                            if (platform === 'Flipkart') setFlipkart((v) => v.map((r) => r.id === updated.id ? updated as SpendRecord : r));
                        }
                            showToast(`${platform} spend updated successfully!`, 'success');
                        } catch (err) {
                            console.error('Failed to update spend record', err);
                            showToast('Failed to update spend record. Please check that the server is running and try again.', 'error');
                        }
                    }}
                    onDelete={async (platform, id) => {
                        try {
                        if (platform === 'Miscellaneous') {
                            await deleteMarketingSpend('misc-spend', id);
                            setMisc((v) => v.filter((r) => r.id !== id));
                        } else {
                            const endpoint = platform === 'Meta' ? 'meta-spend' : platform === 'Amazon' ? 'amazon-spend' : 'flipkart-spend';
                            await deleteMarketingSpend(endpoint, id);
                            if (platform === 'Meta') setMeta((v) => v.filter((r) => r.id !== id));
                            if (platform === 'Amazon') setAmazon((v) => v.filter((r) => r.id !== id));
                            if (platform === 'Flipkart') setFlipkart((v) => v.filter((r) => r.id !== id));
                        }
                            showToast(`${platform} spend deleted successfully!`, 'delete');
                        } catch (err) {
                            console.error('Failed to delete spend record', err);
                            showToast('Failed to delete spend record. Please check that the server is running and try again.', 'error');
                        }
                    }}
                />
            
            <ToastContainer toasts={toasts} />
        </section>
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

type UnifiedRecord = (SpendRecord & { _source: Platform; _type: 'spend' }) | (MiscRecord & { _source: 'Miscellaneous'; _type: 'misc' });

function UnifiedSpendSection({ meta, amazon, flipkart, misc, onAdd, onUpdate, onDelete, mode, customFrom, customTo, loading }: { 
    meta: SpendRecord[]; 
    amazon: SpendRecord[]; 
    flipkart: SpendRecord[]; 
    misc: MiscRecord[];
    onAdd: (platform: Platform, rec: SpendRecord | MiscRecord) => Promise<void>;
    onUpdate: (platform: Platform, rec: SpendRecord | MiscRecord) => Promise<void>;
    onDelete: (platform: Platform, id: string) => Promise<void>;
    mode: DateFilterMode; 
    customFrom: string; 
    customTo: string;
    loading: boolean;
}) {
    const [platform, setPlatform] = useState<Platform>('Meta');
    const [date, setDate] = useState<string>(toInputDate(new Date()));
    const [amount, setAmount] = useState<string>('');
    const [note, setNote] = useState<string>('');
    const [editingRecord, setEditingRecord] = useState<{ record: UnifiedRecord; platform: Platform } | null>(null);

    useEffect(() => {
        if (editingRecord) {
            setPlatform(editingRecord.platform);
            setDate(toInputDate(new Date(editingRecord.record.date)));
            setAmount(editingRecord.record.amount.toString());
            setNote(editingRecord.record.note || '');
        } else {
            setPlatform('Meta');
            setDate(toInputDate(new Date()));
            setAmount('');
            setNote('');
        }
    }, [editingRecord]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount) return;
        
        if (editingRecord) {
            // Check if platform has changed
            const originalPlatform = editingRecord.platform;
            const platformChanged = originalPlatform !== platform;
            
            if (platformChanged) {
                // Platform changed: delete from old platform, add to new platform
                const oldId = editingRecord.record.id;
                await onDelete(originalPlatform, oldId);
                
                // Create new record with new ID for the new platform
                if (platform === 'Miscellaneous') {
                    const rec: MiscRecord = { 
                        id: `Miscellaneous-${Date.now()}`, 
                        date, 
                        amount: Number(amount || 0), 
                        where: '', 
                        note: note || undefined 
                    };
                    await onAdd(platform, rec);
                } else {
                    const rec: SpendRecord = { 
                        id: `${platform}-${Date.now()}`, 
                        date, 
                        amount: Number(amount || 0), 
                        note: note || undefined 
                    };
                    await onAdd(platform, rec);
                }
            } else {
                // Platform unchanged: normal update
                if (platform === 'Miscellaneous') {
                    const rec: MiscRecord = { 
                        id: editingRecord.record.id, 
                        date, 
                        amount: Number(amount || 0), 
                        where: editingRecord.record._type === 'misc' ? (editingRecord.record as MiscRecord & { _source: 'Miscellaneous'; _type: 'misc' }).where : '', 
                        note: note || undefined 
                    };
                    await onUpdate(platform, rec);
                } else {
        const rec: SpendRecord = { 
                        id: editingRecord.record.id, 
            date, 
            amount: Number(amount || 0), 
            note: note || undefined 
        };
            await onUpdate(platform, rec);
                }
            }
            setEditingRecord(null);
        } else {
            // New record
            if (platform === 'Miscellaneous') {
                const rec: MiscRecord = { 
                    id: `Miscellaneous-${Date.now()}`, 
                    date, 
                    amount: Number(amount || 0), 
                    where: '', 
                    note: note || undefined 
                };
                await onAdd(platform, rec);
            } else {
                const rec: SpendRecord = { 
                    id: `${platform}-${Date.now()}`, 
                    date, 
                    amount: Number(amount || 0), 
                    note: note || undefined 
                };
            await onAdd(platform, rec);
            }
        }
    }

    const combined = useMemo(() => {
        const m = meta.map(r => ({ ...r, _source: 'Meta' as const, _type: 'spend' as const }));
        const a = amazon.map(r => ({ ...r, _source: 'Amazon' as const, _type: 'spend' as const }));
        const f = flipkart.map(r => ({ ...r, _source: 'Flipkart' as const, _type: 'spend' as const }));
        const miscRecords = misc.map(r => ({ ...r, _source: 'Miscellaneous' as const, _type: 'misc' as const }));
        return [...m, ...a, ...f, ...miscRecords].sort((p, q) => new Date(q.date).getTime() - new Date(p.date).getTime());
    }, [meta, amazon, flipkart, misc]);

    const filtered = useFilterRows(combined, mode, customFrom, customTo);

    return (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontWeight: 800 }}>Marketing Spend</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Add wallet recharge and view history for all platforms</div>
            </div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label className="label">Platform</label>
                        <select className="input" value={platform} onChange={(e)=>setPlatform(e.target.value as Platform)} style={{ width: '100%', marginTop: 6 }}>
                            <option value="Meta">Meta</option>
                            <option value="Amazon">Amazon</option>
                            <option value="Flipkart">Flipkart</option>
                            <option value="Miscellaneous">Miscellaneous</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Date</label>
                        <input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
                    </div>
                    <div>
                        <label className="label">Note</label>
                        <input className="input" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Optional description" style={{ width: '100%', marginTop: 6 }} />
                    </div>
                    <div>
                        <label className="label">Amount (₹)</label>
                        <input className="input" type="number" min={0} step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
                    </div>
                    <div>
                        <label className="label" style={{ visibility: 'hidden' }}>Add</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {editingRecord && (
                                <button 
                                    type="button" 
                                    className="icon-btn" 
                                    onClick={() => setEditingRecord(null)}
                                    style={{ width: 'auto', padding: '0 16px' }}
                                >
                                    Cancel
                                </button>
                            )}
                            <button className="button" style={{ width: '100%' }} type="submit">
                                {editingRecord ? 'Save Changes' : 'Add'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <UnifiedTable 
                    rows={filtered} 
                    onEdit={(record, platform) => setEditingRecord({ record, platform })}
                    onDelete={onDelete}
                    loading={loading}
                />
            </div>
        </div>
    );
}

function PlatformTag({ platform }: { platform: Platform }) {
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
        case 'Meta':
            style.background = '#dbeafe';
            style.color = '#1e40af';
            style.borderColor = '#93c5fd';
            break;
        case 'Amazon':
            style.background = '#fef3c7';
            style.color = '#92400e';
            style.borderColor = '#fde68a';
            break;
        case 'Flipkart':
            style.background = '#e0e7ff';
            style.color = '#3730a3';
            style.borderColor = '#a5b4fc';
            break;
        case 'Miscellaneous':
            style.background = '#e9d5ff';
            style.color = '#6b21a8';
            style.borderColor = '#c084fc';
            break;
        default:
            style.background = 'var(--bg)';
            style.color = 'var(--text)';
            style.borderColor = 'var(--border)';
    }

    return <span style={style}>{platform}</span>;
}

function UnifiedTable({ rows, onEdit, onDelete, loading }: { 
    rows: UnifiedRecord[];
    onEdit: (record: UnifiedRecord, platform: Platform) => void;
    onDelete: (platform: Platform, id: string) => Promise<void>;
    loading: boolean;
}) {
    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                Loading spend records…
            </div>
        );
    }
    if (rows.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                No spend records found. Add a record to get started.
            </div>
        );
    }
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <Th>Date</Th>
                        <Th>Platform</Th>
                        <Th>Amount</Th>
                        <Th>Note</Th>
                        <Th>Actions</Th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <Td>{formatDate(r.date)}</Td>
                            <Td><PlatformTag platform={r._source} /></Td>
                            <Td>{formatCurrency(r.amount)}</Td>
                            <Td>{r.note || '—'}</Td>
                            <Td>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={() => onEdit(r, r._source)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="icon-btn icon-btn--danger"
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to delete this spend record? This action cannot be undone.')) {
                                                await onDelete(r._source, r.id);
                                            }
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
    return <td style={{ padding: '12px' }}>{children}</td>;
}

function presetBounds(mode: DateFilterMode): { from: Date; to: Date } | null {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (mode === 'today') {
        const from = startOfDay(now);
        const to = endOfDay(now);
        return { from, to };
    }
    if (mode === 'yesterday') {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        const from = startOfDay(y);
        const to = endOfDay(y);
        return { from, to };
    }
    if (mode === 'last7') {
        const from = new Date(now);
        from.setDate(now.getDate() - 6); // include today => 7 days
        const to = endOfDay(now);
        return { from: startOfDay(from), to };
    }
    if (mode === 'currentMonth') {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { from, to };
    }
    if (mode === 'lastMonth') {
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { from, to };
    }
    return null;
}

function useFilterRows<T extends { date: string }>(rows: T[], mode: DateFilterMode, customFrom: string, customTo: string): T[] {
    return useMemo(() => {
        let from: Date | null = null;
        let to: Date | null = null;
        const pb = presetBounds(mode);
        if (pb) { from = pb.from; to = pb.to; }
        if (mode === 'custom') {
            from = customFrom ? new Date(customFrom) : null;
            to = customTo ? new Date(customTo) : null;
        }
        if (!from && !to) return rows;
        return rows.filter(r => {
            const d = new Date(r.date);
            if (from && d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
            if (to && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)) return false;
            return true;
        });
    }, [rows, mode, customFrom, customTo]);
}

function DateFilterBar({ mode, setMode, customFrom, setCustomFrom, customTo, setCustomTo }: {
    mode: DateFilterMode;
    setMode: (m: DateFilterMode) => void;
    customFrom: string;
    setCustomFrom: (v: string) => void;
    customTo: string;
    setCustomTo: (v: string) => void;
}) {
    const [showCustom, setShowCustom] = useState(false);
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

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

    return (
        <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
            <FilterButton active={mode==='today'} onClick={() => { setMode('today'); setShowCustom(false); }}>Today</FilterButton>
            <FilterButton active={mode==='yesterday'} onClick={() => { setMode('yesterday'); setShowCustom(false); }}>Yesterday</FilterButton>
            <FilterButton active={mode==='last7'} onClick={() => { setMode('last7'); setShowCustom(false); }}>Last 7 days</FilterButton>
            <FilterButton active={mode==='currentMonth'} onClick={() => { setMode('currentMonth'); setShowCustom(false); }}>Current Month</FilterButton>
            <FilterButton active={mode==='lastMonth'} onClick={() => { setMode('lastMonth'); setShowCustom(false); }}>Last Month</FilterButton>
            <FilterButton
                refEl={customBtnRef}
                active={mode==='custom'}
                onClick={() => { setMode('custom'); setShowCustom((v)=>!v); }}
            >Custom</FilterButton>

            {showCustom ? (
                <div
                    ref={popoverRef}
                    className="date-range-popover"
                    style={{ position: 'absolute', top: 44, left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label className="label" style={{ fontSize: 12, margin: 0 }}>Start</label>
                            <input className="input" type="date" value={customFrom} onChange={(e)=>setCustomFrom(e.target.value)} style={{ height: 36 }} />
                        </div>
                        <span style={{ color: 'var(--muted)' }}>—</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label className="label" style={{ fontSize: 12, margin: 0 }}>End</label>
                            <input className="input" type="date" value={customTo} onChange={(e)=>setCustomTo(e.target.value)} style={{ height: 36 }} />
                        </div>
                        <button className="button" style={{ width: 'auto', padding: '0 16px', height: 36 }} onClick={() => setShowCustom(false)}>Apply</button>
                    </div>
                </div>
            ) : null}
        </div>
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



