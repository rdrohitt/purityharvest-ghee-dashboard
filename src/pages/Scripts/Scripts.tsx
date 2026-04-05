import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Spinner } from '../../components/Spinner';
import { useAppSelector } from '../../store';
import { fetchAdScripts, adScriptRowId } from '../../utils/ad-scripts';
import type { AdScriptApi } from '../../types/ad-scripts';
import { AddScriptModal } from './AddScriptModal';
import '../Modules/Modules.scss';
import './Scripts.scss';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error';
};

function formatDisplayDate(iso: string): string {
    try {
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime())) return iso;
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return iso;
    }
}

function statusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'published') return 'scripts-status scripts-status--published';
    if (s === 'approved') return 'scripts-status scripts-status--approved';
    if (s === 'archived') return 'scripts-status scripts-status--archived';
    return 'scripts-status scripts-status--draft';
}

function htmlToPlainText(html: string): string {
    return String(html ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function ScriptDescriptionCell({ html }: { html: string }) {
    const trimmed = String(html ?? '').trim();
    if (!trimmed) return <span className="scripts-desc-cell">—</span>;
    const looksRich = /<[a-z][\s\S]*>/i.test(trimmed);
    if (looksRich) {
        return <div className="scripts-desc-html" dangerouslySetInnerHTML={{ __html: trimmed }} />;
    }
    return <span className="scripts-desc-cell">{trimmed}</span>;
}

function ScriptsTh({ children }: { children: string }) {
    return <th className="modules-th">{children}</th>;
}

function ScriptsTd({ children, className }: { children: ReactNode; className?: string }) {
    const cls = className ? `modules-td ${className}` : 'modules-td';
    return <td className={cls}>{children}</td>;
}

function ScriptsToastContainer({ toasts }: { toasts: Toast[] }) {
    if (toasts.length === 0) return null;
    return (
        <div className="modules-toast-container">
            {toasts.map((toast) => (
                <div key={toast.id} className="toast modules-toast" data-type={toast.type}>
                    <div className="modules-toast-content">
                        <span className="modules-toast-icon">{toast.type === 'success' ? '✓' : '✕'}</span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function Scripts() {
    const user = useAppSelector((s) => s.user.user);
    const [items, setItems] = useState<AdScriptApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editScriptId, setEditScriptId] = useState<string | null>(null);
    const [scriptModalKey, setScriptModalKey] = useState(0);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const defaultAuthor = useMemo(
        () => user?.name?.trim() || user?.username?.trim() || '',
        [user?.name, user?.username],
    );

    const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2500);
    }, []);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError(null);
            const list = await fetchAdScripts();
            setItems(list);
        } catch (e) {
            console.error(e);
            setLoadError(e instanceof Error ? e.message : 'Failed to load scripts');
            showToast('Failed to load scripts.', 'error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((row) =>
            [row.title, row.author, row.category, row.status, htmlToPlainText(row.description)].some((v) =>
                v.toLowerCase().includes(q),
            ),
        );
    }, [items, search]);

    return (
        <section className="modules-page scripts-page">
            {loading ? <Spinner overlay fixed message="Loading scripts…" /> : null}
            <ScriptsToastContainer toasts={toasts} />

            <div className="card modules-header-card">
                <div className="modules-header-title">Scripts</div>
                <div className="modules-header-row">
                    <div className="modules-search-row">
                        <input
                            className="input modules-search"
                            placeholder="Search by title, author, category, or description"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="button" className="icon-btn scripts-refresh-btn" onClick={() => void load()} title="Refresh">
                            ↻
                        </button>
                        <button
                            type="button"
                            className="button modules-create-btn"
                            onClick={() => {
                                setEditScriptId(null);
                                setScriptModalKey((k) => k + 1);
                                setModalOpen(true);
                            }}
                        >
                            Add script
                        </button>
                    </div>
                </div>
            </div>

            <div className="card modules-table-card">
                <div className="modules-count-bar">
                    {loading
                        ? 'Loading…'
                        : loadError
                          ? loadError
                          : `${filtered.length.toLocaleString()} script${filtered.length === 1 ? '' : 's'}`}
                </div>
                {loading ? null : !loadError ? (
                    <div className="table-scroll-wrapper">
                        <table className="modules-table scripts-table">
                            <thead>
                                <tr className="modules-row-header">
                                    <ScriptsTh>Date</ScriptsTh>
                                    <ScriptsTh>Title</ScriptsTh>
                                    <ScriptsTh>Category</ScriptsTh>
                                    <ScriptsTh>Status</ScriptsTh>
                                    <ScriptsTh>Author</ScriptsTh>
                                    <ScriptsTh>Description</ScriptsTh>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((row) => (
                                    <tr key={adScriptRowId(row)} className="modules-row">
                                        <ScriptsTd>{formatDisplayDate(row.date)}</ScriptsTd>
                                        <ScriptsTd className="modules-td--strong">
                                            <button
                                                type="button"
                                                className="modules-name-btn"
                                                onClick={() => {
                                                    setEditScriptId(adScriptRowId(row));
                                                    setScriptModalKey((k) => k + 1);
                                                    setModalOpen(true);
                                                }}
                                            >
                                                <span className="modules-name scripts-title-cell">{row.title}</span>
                                            </button>
                                        </ScriptsTd>
                                        <ScriptsTd>
                                            <span className="modules-key-pill">{row.category}</span>
                                        </ScriptsTd>
                                        <ScriptsTd>
                                            <span className={statusClass(row.status)}>{row.status}</span>
                                        </ScriptsTd>
                                        <ScriptsTd>{row.author}</ScriptsTd>
                                        <ScriptsTd>
                                            <ScriptDescriptionCell html={row.description} />
                                        </ScriptsTd>
                                    </tr>
                                ))}
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="modules-empty">
                                            {items.length === 0
                                                ? 'No scripts yet. Use “Add script” to create one.'
                                                : 'No scripts match your search.'}
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </div>

            {modalOpen ? (
                <AddScriptModal
                    key={`${editScriptId ?? 'new'}-${scriptModalKey}`}
                    onClose={() => {
                        setModalOpen(false);
                        setEditScriptId(null);
                    }}
                    defaultAuthor={defaultAuthor}
                    editScriptId={editScriptId}
                    onSaved={(doc, isNew) =>
                        setItems((prev) =>
                            isNew
                                ? [doc, ...prev]
                                : prev.map((x) => (adScriptRowId(x) === adScriptRowId(doc) ? doc : x)),
                        )
                    }
                    showToast={showToast}
                />
            ) : null}
        </section>
    );
}
