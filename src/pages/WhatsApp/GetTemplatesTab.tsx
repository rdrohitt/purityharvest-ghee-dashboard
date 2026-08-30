import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { Th, Td } from '../sales/Shopify/ShopifyShared';
import '../sales/Shopify/Shopify.scss';
import {
    fetchWhatsAppTemplates,
    flattenTemplateRows,
} from '../../utils/whatsapp-templates';
import type { WhatsAppTemplateTableRow } from '../../types/whatsapp-templates';
import TemplatePreviewModal from './TemplatePreviewModal';

function statusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'approved') return 'wa-status-tag wa-status-tag--approved';
    if (s === 'rejected') return 'wa-status-tag wa-status-tag--rejected';
    if (s === 'pending' || s === 'submitted') return 'wa-status-tag wa-status-tag--pending';
    return 'wa-status-tag';
}

export default function GetTemplatesTab({ integratedNumber }: { integratedNumber: string }) {
    const [rows, setRows] = useState<WhatsAppTemplateTableRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewRow, setPreviewRow] = useState<WhatsAppTemplateTableRow | null>(null);

    const closePreview = useCallback(() => setPreviewRow(null), []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const templates = await fetchWhatsAppTemplates(integratedNumber);
            setRows(flattenTemplateRows(templates));
        } catch (err) {
            setRows([]);
            setError(err instanceof Error ? err.message : 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    }, [integratedNumber]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="wa-templates">
            <div className="wa-templates-bar">
                <span>
                    {loading
                        ? 'Loading templates…'
                        : error
                          ? error
                          : `${rows.length.toLocaleString()} template${rows.length === 1 ? '' : 's'}`}
                </span>
                <button
                    type="button"
                    className="button shopify-refresh-btn wa-templates-refresh"
                    title="Refresh templates"
                    onClick={() => void load()}
                    disabled={loading}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                    </svg>
                    Refresh
                </button>
            </div>

            <div className={`table-scroll-wrapper wa-templates-scroll${loading ? ' wa-templates-scroll--loading' : ''}`}>
                {loading ? <Spinner overlay message="Loading templates…" /> : null}
                <table className="orders-table shopify-orders-table wa-templates-table">
                    <thead>
                        <tr>
                            <Th>Name</Th>
                            <Th>Category</Th>
                            <Th>Language</Th>
                            <Th>Status</Th>
                            <Th>Header</Th>
                            <Th>Body</Th>
                            <Th>Footer</Th>
                            <Th>Variables</Th>
                            <Th>Preview</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && error ? (
                            <tr>
                                <td colSpan={9} className="wa-templates-empty">
                                    Could not load templates. Check MSG91 authkey and try Refresh.
                                </td>
                            </tr>
                        ) : !loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="wa-templates-empty">
                                    No templates found.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.key}>
                                    <Td>
                                        <div className="wa-templates-name">{row.name}</div>
                                        {row.disabled ? <span className="wa-status-tag wa-status-tag--disabled">Disabled</span> : null}
                                    </Td>
                                    <Td>
                                        <span className="wa-status-tag">{row.category || '—'}</span>
                                    </Td>
                                    <Td>{row.language}</Td>
                                    <Td>
                                        <span className={statusClass(row.status)}>{row.status || '—'}</span>
                                    </Td>
                                    <Td>
                                        <div className="wa-templates-header">
                                            <span>{row.headerFormat}</span>
                                            {row.headerImageUrl ? (
                                                <img
                                                    className="wa-templates-thumb"
                                                    src={row.headerImageUrl}
                                                    alt=""
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                    </Td>
                                    <Td>
                                        <div className="wa-templates-body" title={row.body}>
                                            {row.body || '—'}
                                        </div>
                                    </Td>
                                    <Td>{row.footer || '—'}</Td>
                                    <Td>{row.variables.length > 0 ? row.variables.join(', ') : '—'}</Td>
                                    <Td>
                                        <button
                                            type="button"
                                            className="icon-btn wa-preview-btn"
                                            title="Preview template"
                                            aria-label={`Preview ${row.name}`}
                                            onClick={() => setPreviewRow(row)}
                                        >
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        </button>
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {previewRow ? (
                <TemplatePreviewModal row={previewRow} onClose={closePreview} />
            ) : null}
        </div>
    );
}
