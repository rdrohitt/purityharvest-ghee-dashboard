import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { loadAllMarketingSpend, createMarketingSpend, addMarketingSpend, updateMarketingSpend, deleteMarketingSpend, type SpendRecord, type MiscRecord } from '../../utils/marketing-spend';
import type { MarketingSpendApiItem } from '../../types/marketing-spend';
import './MarketingSpend.scss';
import { MarketingSpendEditModal } from './MarketingSpendEditModal';
import { MarketingSpendDeleteModal } from './MarketingSpendDeleteModal';
import { DatePicker, toInputDate } from './DatePicker';

export type DateFilterMode = 'all' | 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';
export type Platform = 'Meta' | 'Amazon' | 'Flipkart' | 'Checkout' | 'Engage' | 'Dolchi' | 'Delhivery' | 'Miscellaneous';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

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
    const [checkout, setCheckout] = useState<SpendRecord[]>([]);
    const [engage, setEngage] = useState<SpendRecord[]>([]);
    const [dolchi, setDolchi] = useState<SpendRecord[]>([]);
    const [delhivery, setDelhivery] = useState<SpendRecord[]>([]);
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

    function applyApiData(all: MarketingSpendApiItem[]) {
        const toSpendRecord = (item: MarketingSpendApiItem): SpendRecord => ({
            id: item._id,
            date: item.date,
            amount: item.amount,
            note: item.note,
        });

        const metaItems = all.filter((i) => i.platform === 'meta1').map(toSpendRecord);
        const amazonItems = all.filter((i) => i.platform === 'amazon').map(toSpendRecord);
        const flipkartItems = all.filter((i) => i.platform === 'flipkart').map(toSpendRecord);
        const checkoutItems = all.filter((i) => i.platform === 'checkout').map(toSpendRecord);
        const engageItems = all.filter((i) => i.platform === 'engage').map(toSpendRecord);
        const dolchiItems = all.filter((i) => i.platform === 'dolchi').map(toSpendRecord);
        const delhiveryItems = all.filter((i) => i.platform === 'delhivery').map(toSpendRecord);
        const miscItems = all
            .filter((i) => i.platform === 'misc')
            .map(
                (item): MiscRecord => ({
                    id: item._id,
                    date: item.date,
                    amount: item.amount,
                    where: '',
                    note: item.note,
                }),
            );

        setMeta(metaItems);
        setAmazon(amazonItems);
        setFlipkart(flipkartItems);
        setCheckout(checkoutItems);
        setEngage(engageItems);
        setDolchi(dolchiItems);
        setDelhivery(delhiveryItems);
        setMisc(miscItems);
    }

    async function refreshFromServer() {
        try {
            setLoading(true);
            const all = await loadAllMarketingSpend();
            applyApiData(all);
        } catch (err) {
            console.error('Failed to reload marketing spend data', err);
            showToast('Failed to reload marketing spend data. Please check that the server is running.', 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        loadAllMarketingSpend()
            .then((all: MarketingSpendApiItem[]) => {
                if (cancelled) return;
                applyApiData(all);
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
    const filteredCheckout = useFilterRows(checkout, mode, customFrom, customTo);
    const filteredEngage = useFilterRows(engage, mode, customFrom, customTo);
    const filteredDolchi = useFilterRows(dolchi, mode, customFrom, customTo);
    const filteredDelhivery = useFilterRows(delhivery, mode, customFrom, customTo);
    const filteredMisc = useFilterRows(misc, mode, customFrom, customTo);

    const totals = useMemo(() => ({
        meta: filteredMeta.reduce((s, r) => s + r.amount, 0),
        amazon: filteredAmazon.reduce((s, r) => s + r.amount, 0),
        flipkart: filteredFlipkart.reduce((s, r) => s + r.amount, 0),
        checkout: filteredCheckout.reduce((s, r) => s + r.amount, 0),
        engage: filteredEngage.reduce((s, r) => s + r.amount, 0),
        dolchi: filteredDolchi.reduce((s, r) => s + r.amount, 0),
        delhivery: filteredDelhivery.reduce((s, r) => s + r.amount, 0),
        misc: filteredMisc.reduce((s, r) => s + r.amount, 0),
    }), [filteredMeta, filteredAmazon, filteredFlipkart, filteredCheckout, filteredEngage, filteredDolchi, filteredDelhivery, filteredMisc]);

    return (
        <section className="marketing-spend-page">
            <div className="card marketing-spend-summary">
                <div className="marketing-spend-summary__title">Marketing Spend</div>
                <div className="marketing-spend-summary__subtitle">Capture wallet recharges across channels</div>
                <DateFilterBar
                    mode={mode}
                    setMode={setMode}
                    customFrom={customFrom}
                    setCustomFrom={setCustomFrom}
                    customTo={customTo}
                    setCustomTo={setCustomTo}
                />
                <div className="marketing-spend-metrics">
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
                        icon="💳" 
                        label="Checkout Wallet" 
                        value={formatCurrency(totals.checkout)} 
                        iconColor="#0f766e"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem 
                        icon="💬" 
                        label="Engage Wallet" 
                        value={formatCurrency(totals.engage)} 
                        iconColor="#7c3aed"
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem 
                        icon="🍫" 
                        label="Dolchi Wallet" 
                        value={formatCurrency(totals.dolchi)} 
                        iconColor="#b45309"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem 
                        icon="🚚" 
                        label="Delhivery Wallet" 
                        value={formatCurrency(totals.delhivery)} 
                        iconColor="#2563eb"
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
                    checkout={checkout}
                    engage={engage}
                    dolchi={dolchi}
                    delhivery={delhivery}
                    misc={misc}
                    mode={mode}
                    customFrom={customFrom}
                    customTo={customTo}
                    loading={loading}
                    onAdd={async (platform, rec) => {
                        try {
                            // Map UI platform labels to API platform keys used by /api/marketing
                            let apiPlatform: string;
                            switch (platform) {
                                case 'Meta':
                                    apiPlatform = 'meta1';
                                    break;
                                case 'Amazon':
                                    apiPlatform = 'amazon';
                                    break;
                                case 'Flipkart':
                                    apiPlatform = 'flipkart';
                                    break;
                                case 'Checkout':
                                    apiPlatform = 'checkout';
                                    break;
                                case 'Engage':
                                    apiPlatform = 'engage';
                                    break;
                                case 'Dolchi':
                                    apiPlatform = 'dolchi';
                                    break;
                                case 'Delhivery':
                                    apiPlatform = 'delhivery';
                                    break;
                                case 'Miscellaneous':
                                    apiPlatform = 'misc';
                                    break;
                                default:
                                    apiPlatform = 'meta1';
                            }

                            await createMarketingSpend({
                                platform: apiPlatform,
                                date: rec.date,
                                amount: rec.amount,
                                note: rec.note,
                            });

                            await refreshFromServer();
                            showToast(`${platform} spend added successfully!`, 'success');
                        } catch (err) {
                            console.error('Failed to add spend record', err);
                            showToast('Failed to add spend record. Please check that the server is running and try again.', 'error');
                        }
                    }}
                    onUpdate={async (platform, rec) => {
                        try {
                            if (platform === 'Miscellaneous') {
                                await updateMarketingSpend('misc-spend', rec as MiscRecord);
                            } else {
                                let endpoint:
                                    | 'meta-spend'
                                    | 'amazon-spend'
                                    | 'flipkart-spend'
                                    | 'checkout-spend'
                                    | 'engage-spend'
                                    | 'dolchi-spend'
                                    | 'delhivery-spend';
                                switch (platform) {
                                    case 'Meta':
                                        endpoint = 'meta-spend';
                                        break;
                                    case 'Amazon':
                                        endpoint = 'amazon-spend';
                                        break;
                                    case 'Flipkart':
                                        endpoint = 'flipkart-spend';
                                        break;
                                    case 'Checkout':
                                        endpoint = 'checkout-spend';
                                        break;
                                    case 'Engage':
                                        endpoint = 'engage-spend';
                                        break;
                                    case 'Dolchi':
                                        endpoint = 'dolchi-spend';
                                        break;
                                    case 'Delhivery':
                                        endpoint = 'delhivery-spend';
                                        break;
                                    default:
                                        endpoint = 'meta-spend';
                                }
                                await updateMarketingSpend(endpoint, rec as SpendRecord);
                            }
                            await refreshFromServer();
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
                            } else {
                                let endpoint:
                                    | 'meta-spend'
                                    | 'amazon-spend'
                                    | 'flipkart-spend'
                                    | 'checkout-spend'
                                    | 'engage-spend'
                                    | 'dolchi-spend'
                                    | 'delhivery-spend';
                                switch (platform) {
                                    case 'Meta':
                                        endpoint = 'meta-spend';
                                        break;
                                    case 'Amazon':
                                        endpoint = 'amazon-spend';
                                        break;
                                    case 'Flipkart':
                                        endpoint = 'flipkart-spend';
                                        break;
                                    case 'Checkout':
                                        endpoint = 'checkout-spend';
                                        break;
                                    case 'Engage':
                                        endpoint = 'engage-spend';
                                        break;
                                    case 'Dolchi':
                                        endpoint = 'dolchi-spend';
                                        break;
                                    case 'Delhivery':
                                        endpoint = 'delhivery-spend';
                                        break;
                                    default:
                                        endpoint = 'meta-spend';
                                }
                                await deleteMarketingSpend(endpoint, id);
                            }
                            await refreshFromServer();
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
        <div
            className={[
                'marketing-spend-metric',
                isEven ? 'marketing-spend-metric--even' : '',
                isLast ? 'marketing-spend-metric--last' : '',
            ].filter(Boolean).join(' ')}
        >
            <div className="marketing-spend-metric__header">
                <span className="marketing-spend-metric__icon" style={{ color: iconColor }}>
                    {icon}
                </span>
                <div className="marketing-spend-metric__label">
                    {label}
                </div>
            </div>
            <div className="marketing-spend-metric__value">
                {value}
            </div>
        </div>
    );
}

export type UnifiedRecord = (SpendRecord & { _source: Platform; _type: 'spend' }) | (MiscRecord & { _source: 'Miscellaneous'; _type: 'misc' });

function UnifiedSpendSection({ meta, amazon, flipkart, checkout, engage, dolchi, delhivery, misc, onAdd, onUpdate, onDelete, mode, customFrom, customTo, loading }: { 
    meta: SpendRecord[]; 
    amazon: SpendRecord[]; 
    flipkart: SpendRecord[]; 
    checkout: SpendRecord[];
    engage: SpendRecord[];
    dolchi: SpendRecord[];
    delhivery: SpendRecord[];
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
    const [editModalState, setEditModalState] = useState<{ record: UnifiedRecord; platform: Platform } | null>(null);
    const [deleteModalState, setDeleteModalState] = useState<{ record: UnifiedRecord; platform: Platform } | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount) return;

        // New record only; edits are handled via modal
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

    const combined = useMemo(() => {
        const m = meta.map(r => ({ ...r, _source: 'Meta' as const, _type: 'spend' as const }));
        const a = amazon.map(r => ({ ...r, _source: 'Amazon' as const, _type: 'spend' as const }));
        const f = flipkart.map(r => ({ ...r, _source: 'Flipkart' as const, _type: 'spend' as const }));
        const c = checkout.map(r => ({ ...r, _source: 'Checkout' as const, _type: 'spend' as const }));
        const e = engage.map(r => ({ ...r, _source: 'Engage' as const, _type: 'spend' as const }));
        const d = dolchi.map(r => ({ ...r, _source: 'Dolchi' as const, _type: 'spend' as const }));
        const dl = delhivery.map(r => ({ ...r, _source: 'Delhivery' as const, _type: 'spend' as const }));
        const miscRecords = misc.map(r => ({ ...r, _source: 'Miscellaneous' as const, _type: 'misc' as const }));
        return [...m, ...a, ...f, ...c, ...e, ...d, ...dl, ...miscRecords].sort((p, q) => new Date(q.date).getTime() - new Date(p.date).getTime());
    }, [meta, amazon, flipkart, checkout, engage, dolchi, delhivery, misc]);

    const filtered = useFilterRows(combined, mode, customFrom, customTo);

    return (
        <div className="card marketing-spend-unified">
            <div className="marketing-spend-unified__header">
                <div className="marketing-spend-unified__title">Marketing Spend</div>
                <div className="marketing-spend-unified__subtitle">Add wallet recharge and view history for all platforms</div>
            </div>
            <div className="marketing-spend-unified__form-wrapper">
                <form onSubmit={submit} className="marketing-spend-unified__form">
                    <div>
                        <label className="label">Platform</label>
                        <select className="input marketing-spend-unified__field" value={platform} onChange={(e)=>setPlatform(e.target.value as Platform)}>
                            <option value="Meta">Meta</option>
                            <option value="Amazon">Amazon</option>
                            <option value="Flipkart">Flipkart</option>
                            <option value="Checkout">Checkout</option>
                            <option value="Engage">Engage</option>
                            <option value="Dolchi">Dolchi</option>
                            <option value="Delhivery">Delhivery</option>
                            <option value="Miscellaneous">Miscellaneous</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Date</label>
                        <DatePicker value={date} onChange={setDate} placeholder="Select date" />
                    </div>
                    <div>
                        <label className="label">Note</label>
                        <input className="input marketing-spend-unified__field" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Optional description" />
                    </div>
                    <div>
                        <label className="label">Amount (₹)</label>
                        <input className="input marketing-spend-unified__field" type="number" min={0} step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} required />
                    </div>
                    <div>
                        <label className="label marketing-spend-unified__submit-label">Add</label>
                        <div className="marketing-spend-unified__actions">
                            <button className="button marketing-spend-unified__submit-btn" type="submit">
                                Add
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <div className="marketing-spend-unified__table-wrapper">
                <UnifiedTable 
                    rows={filtered} 
                    onEdit={(record, platform) => setEditModalState({ record, platform })}
                    onDelete={(platform, id, record) => setDeleteModalState({ record, platform })}
                    loading={loading}
                />
            </div>
            {editModalState && (
                <MarketingSpendEditModal
                    platform={editModalState.platform}
                    record={editModalState.record}
                    onClose={() => setEditModalState(null)}
                    onSubmit={async (updated, platform) => {
                        await onUpdate(platform, updated);
                        setEditModalState(null);
                    }}
                />
            )}
            {deleteModalState && (
                <MarketingSpendDeleteModal
                    record={deleteModalState.record}
                    platform={deleteModalState.platform}
                    onCancel={() => setDeleteModalState(null)}
                    onConfirm={async () => {
                        await onDelete(deleteModalState.platform, deleteModalState.record.id);
                        setDeleteModalState(null);
                    }}
                />
            )}
        </div>
    );
}

function PlatformTag({ platform }: { platform: Platform }) {
    let variantClass = '';
    switch (platform) {
        case 'Meta':
            variantClass = 'platform-tag--meta';
            break;
        case 'Amazon':
            variantClass = 'platform-tag--amazon';
            break;
        case 'Flipkart':
            variantClass = 'platform-tag--flipkart';
            break;
        case 'Checkout':
            variantClass = 'platform-tag--checkout';
            break;
        case 'Engage':
            variantClass = 'platform-tag--engage';
            break;
        case 'Dolchi':
            variantClass = 'platform-tag--dolchi';
            break;
        case 'Miscellaneous':
            variantClass = 'platform-tag--misc';
            break;
        default:
            variantClass = 'platform-tag--default';
    }

    return <span className={`platform-tag ${variantClass}`}>{platform}</span>;
}

function UnifiedTable({ rows, onEdit, onDelete, loading }: { 
    rows: UnifiedRecord[];
    onEdit: (record: UnifiedRecord, platform: Platform) => void;
    onDelete: (platform: Platform, id: string, record: UnifiedRecord) => Promise<void> | void;
    loading: boolean;
}) {
    if (loading) {
        return (
            <div className="marketing-spend-table__loading">
                <Spinner overlay message="Loading spend records…" />
            </div>
        );
    }
    if (rows.length === 0) {
        return (
            <div className="marketing-spend-table__empty">
                No spend records found. Add a record to get started.
            </div>
        );
    }
    return (
        <div className="marketing-spend-table__wrapper">
            <table className="marketing-spend-table">
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
                        <tr key={r.id} className="marketing-spend-table__row">
                            <Td>{formatDate(r.date)}</Td>
                            <Td><PlatformTag platform={r._source} /></Td>
                            <Td>{formatCurrency(r.amount)}</Td>
                            <Td>{r.note || '—'}</Td>
                            <Td>
                                <div className="marketing-spend-table__row-actions">
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
                                        onClick={() => onDelete(r._source, r.id, r)}
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
    return <th className="marketing-spend-table__header-cell">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
    return <td className="marketing-spend-table__cell">{children}</td>;
}

function presetBounds(mode: DateFilterMode): { from: Date; to: Date } | null {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (mode === 'all') {
        return null; // No filtering for 'all'
    }
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
        <div className="filter-group marketing-spend-filter-group">
            <FilterButton active={mode==='all'} onClick={() => { setMode('all'); setShowCustom(false); }}>All</FilterButton>
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
                    className="date-range-popover marketing-spend-filter-group__popover"
                    style={{ left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0 }}
                >
                    <div className="marketing-spend-filter-group__popover-inner">
                        <div className="marketing-spend-filter-group__date-field">
                            <label className="label marketing-spend-filter-group__date-label">Start</label>
                            <input className="input marketing-spend-filter-group__date-input" type="date" value={customFrom} onChange={(e)=>setCustomFrom(e.target.value)} />
                        </div>
                        <span className="marketing-spend-filter-group__dash">—</span>
                        <div className="marketing-spend-filter-group__date-field">
                            <label className="label marketing-spend-filter-group__date-label">End</label>
                            <input className="input marketing-spend-filter-group__date-input" type="date" value={customTo} onChange={(e)=>setCustomTo(e.target.value)} />
                        </div>
                        <button className="button marketing-spend-filter-group__apply-btn" onClick={() => setShowCustom(false)}>Apply</button>
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
            className="marketing-toast-container"
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast marketing-toast"
                    data-type={toast.type}
                >
                    <div className="marketing-toast__inner">
                        <span className="marketing-toast__icon">
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}



