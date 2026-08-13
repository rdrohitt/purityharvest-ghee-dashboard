import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Spinner } from '../../components/Spinner';
import { useAppSelector } from '../../store';
import { fetchAllAdScripts, adScriptRowId, deleteAdScript } from '../../utils/ad-scripts';
import type { AdScriptApi } from '../../types/ad-scripts';
import { AddScriptModal } from './AddScriptModal';
import { ScriptDeleteModal } from './ScriptDeleteModal';
import { FollowupsPagination } from '../Followups/FollowupsPagination';
import '../sales/Shopify/Shopify.scss';
import '../Followups/Followups.scss';
import '../Modules/Modules.scss';
import './Scripts.scss';

const SCRIPTS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
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

function scriptStatusLabel(status: string): string {
    const s = status.trim().toLowerCase();
    if (s === 'draft') return 'Draft';
    if (s === 'published') return 'Published';
    if (s === 'approved') return 'Approved';
    if (s === 'archived') return 'Archived';
    if (!status.trim()) return '—';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/** Active tab filters the table. */
type ScriptsCategoryTab = 'all' | 'Ghee' | 'Milk';

const SCRIPTS_CATEGORY_TABS: { id: ScriptsCategoryTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'Ghee', label: 'Ghee' },
    { id: 'Milk', label: 'Milk' },
];

function categoryTagClass(category: string): string {
    const c = category.trim().toLowerCase();
    if (c === 'ghee') return 'scripts-category-tag scripts-category-tag--ghee';
    if (c === 'milk') return 'scripts-category-tag scripts-category-tag--milk';
    if (c === 'oil') return 'scripts-category-tag scripts-category-tag--oil';
    if (c === 'meta ads') return 'scripts-category-tag scripts-category-tag--meta';
    return 'scripts-category-tag scripts-category-tag--default';
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
                        <span className="modules-toast-icon">
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function Scripts() {
    const user = useAppSelector((s) => s.user.user);
    const [allScripts, setAllScripts] = useState<AdScriptApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [categoryTab, setCategoryTab] = useState<ScriptsCategoryTab>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editScriptId, setEditScriptId] = useState<string | null>(null);
    const [scriptModalKey, setScriptModalKey] = useState(0);
    const [deletingScript, setDeletingScript] = useState<AdScriptApi | null>(null);
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
            const rows = await fetchAllAdScripts();
            setAllScripts(rows);
        } catch (e) {
            console.error(e);
            setLoadError(e instanceof Error ? e.message : 'Failed to load scripts');
            showToast('Failed to load scripts.', 'error');
            setAllScripts([]);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = useMemo(() => {
        if (categoryTab === 'all') return allScripts;
        const want = categoryTab.toLowerCase();
        return allScripts.filter((r) => String(r.category ?? '').trim().toLowerCase() === want);
    }, [allScripts, categoryTab]);

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize) || 1);

    useEffect(() => {
        setPage((p) => Math.min(p, totalPages));
    }, [totalPages]);

    const displayPage = Math.min(page, totalPages);
    const pageOffset = (displayPage - 1) * pageSize;
    const items = useMemo(
        () => filtered.slice(pageOffset, pageOffset + pageSize),
        [filtered, pageOffset, pageSize],
    );

    const listMeta = useMemo(
        () => ({
            total: totalRecords,
            totalPages,
            count: items.length,
            page: displayPage,
            limit: pageSize,
        }),
        [totalRecords, totalPages, items.length, displayPage, pageSize],
    );

    const rangeStart =
        totalRecords === 0 || items.length === 0 ? 0 : pageOffset + 1;
    const rangeEnd = totalRecords === 0 || items.length === 0 ? 0 : pageOffset + items.length;

    const emptyListMessage = useMemo(() => {
        if (loading) return '';
        if (loadError) return '';
        if (allScripts.length === 0) {
            return 'No scripts yet. Use “Add script” to create one.';
        }
        if (categoryTab !== 'all') {
            return `No ${categoryTab} scripts yet. Try “All” or add a script.`;
        }
        return 'No scripts to show.';
    }, [loading, loadError, allScripts.length, categoryTab]);

    const tableRowOffset = pageOffset;

    const handleDeleteScript = useCallback(async () => {
        if (!deletingScript) return;
        const id = adScriptRowId(deletingScript);
        await deleteAdScript(id);
        if (editScriptId === id) {
            setModalOpen(false);
            setEditScriptId(null);
        }
        setDeletingScript(null);
        showToast('Script deleted successfully.', 'delete');
        await load();
    }, [deletingScript, editScriptId, load, showToast]);

    return (
        <section className="modules-page scripts-page">
            {loading ? <Spinner overlay fixed message="Loading scripts…" /> : null}
            <ScriptsToastContainer toasts={toasts} />

            <div className="card modules-header-card">
                <div className="modules-header-title">Scripts</div>
                <div className="modules-header-row scripts-page-header-row">
                    <div
                        className="scripts-category-tabs"
                        role="tablist"
                        aria-label="Filter scripts by category"
                    >
                        {SCRIPTS_CATEGORY_TABS.map((tab) => {
                            const mod = tab.id === 'all' ? 'all' : tab.id.toLowerCase();
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={categoryTab === tab.id}
                                    id={`scripts-category-tab-${mod}`}
                                    className={`scripts-category-tab scripts-category-tab--${mod}${
                                        categoryTab === tab.id ? ' is-active' : ''
                                    }`}
                                    onClick={() => {
                                        setCategoryTab(tab.id);
                                        setPage(1);
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="modules-search-row">
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
                          : `${totalRecords.toLocaleString()} script${totalRecords === 1 ? '' : 's'}`}
                </div>
                {loading ? null : !loadError ? (
                    <div className="table-scroll-wrapper">
                        <table className="modules-table scripts-table">
                            <thead>
                                <tr className="modules-row-header">
                                    <ScriptsTh>S.No</ScriptsTh>
                                    <ScriptsTh>Date</ScriptsTh>
                                    <ScriptsTh>Title</ScriptsTh>
                                    <ScriptsTh>Category</ScriptsTh>
                                    <ScriptsTh>Status</ScriptsTh>
                                    <ScriptsTh>Description</ScriptsTh>
                                    <ScriptsTh aria-label="Actions">&nbsp;</ScriptsTh>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((row, index) => (
                                    <tr key={adScriptRowId(row)} className="modules-row">
                                        <ScriptsTd className="scripts-table-sno">{tableRowOffset + index + 1}</ScriptsTd>
                                        <ScriptsTd>{formatDisplayDate(row.date)}</ScriptsTd>
                                        <ScriptsTd className="modules-td--strong">
                                            <button
                                                type="button"
                                                className="modules-name-btn scripts-title-author-btn"
                                                onClick={() => {
                                                    setEditScriptId(adScriptRowId(row));
                                                    setScriptModalKey((k) => k + 1);
                                                    setModalOpen(true);
                                                }}
                                            >
                                                <span className="modules-name scripts-title-cell">{row.title}</span>
                                                {String(row.author ?? '').trim() ? (
                                                    <span className="scripts-title-cell__author">
                                                        - by {String(row.author).trim()}
                                                    </span>
                                                ) : null}
                                            </button>
                                        </ScriptsTd>
                                        <ScriptsTd>
                                            <span className={categoryTagClass(row.category)}>{row.category}</span>
                                        </ScriptsTd>
                                        <ScriptsTd>
                                            <span className={statusClass(row.status)}>{scriptStatusLabel(row.status)}</span>
                                        </ScriptsTd>
                                        <ScriptsTd>
                                            <ScriptDescriptionCell html={row.description} />
                                        </ScriptsTd>
                                        <ScriptsTd className="scripts-table-actions">
                                            <button
                                                type="button"
                                                className="icon-btn icon-btn--danger scripts-table-delete-btn"
                                                aria-label={`Delete ${row.title}`}
                                                title="Delete script"
                                                onClick={() => setDeletingScript(row)}
                                            >
                                                🗑️
                                            </button>
                                        </ScriptsTd>
                                    </tr>
                                ))}
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="modules-empty">
                                            {emptyListMessage}
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                ) : null}
                {!loadError ? (
                    <FollowupsPagination
                        loading={loading}
                        dashboardMeta={listMeta}
                        totalRecords={totalRecords}
                        totalPages={totalPages}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        page={displayPage}
                        pageSize={pageSize}
                        setPage={setPage}
                        setPageSize={setPageSize}
                        pageSizeOptions={SCRIPTS_PAGE_SIZE_OPTIONS}
                        ariaLabel="Scripts pagination"
                    />
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
                    onSaved={() => {
                        void load();
                    }}
                    showToast={showToast}
                />
            ) : null}

            <ScriptDeleteModal
                script={deletingScript}
                onCancel={() => setDeletingScript(null)}
                onConfirm={async () => {
                    try {
                        await handleDeleteScript();
                    } catch (err) {
                        console.error(err);
                        showToast('Failed to delete script. Please try again.', 'error');
                    }
                }}
            />
        </section>
    );
}
