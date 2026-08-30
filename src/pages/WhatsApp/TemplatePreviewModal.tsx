import { useEffect } from 'react';
import type { WhatsAppTemplateTableRow } from '../../types/whatsapp-templates';

function statusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'approved') return 'wa-status-tag wa-status-tag--approved';
    if (s === 'rejected') return 'wa-status-tag wa-status-tag--rejected';
    if (s === 'pending' || s === 'submitted') return 'wa-status-tag wa-status-tag--pending';
    return 'wa-status-tag';
}

export default function TemplatePreviewModal({
    row,
    onClose,
}: {
    row: WhatsAppTemplateTableRow;
    onClose: () => void;
}) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <div
            className="wa-preview-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-preview-title"
            onClick={onClose}
        >
            <div className="card wa-preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="wa-preview-header">
                    <div className="wa-preview-header-text">
                        <h3 id="wa-preview-title" className="wa-preview-title">
                            {row.name}
                        </h3>
                        <div className="wa-preview-meta">
                            <span className="wa-status-tag">{row.category || '—'}</span>
                            <span className="wa-status-tag">{row.language}</span>
                            <span className={statusClass(row.status)}>{row.status || '—'}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="icon-btn wa-preview-close"
                        onClick={onClose}
                        aria-label="Close preview"
                    >
                        ✕
                    </button>
                </div>

                <div className="wa-preview-stage">
                    <div className="wa-preview-bubble">
                        {row.headerImageUrl ? (
                            <img
                                className="wa-preview-image"
                                src={row.headerImageUrl}
                                alt=""
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : row.headerFormat && row.headerFormat !== '—' ? (
                            <div className="wa-preview-header-label">{row.headerFormat} header</div>
                        ) : null}
                        <div className="wa-preview-body">{row.body || '—'}</div>
                        {row.footer ? <div className="wa-preview-footer">{row.footer}</div> : null}
                    </div>
                </div>

                {row.variables.length > 0 ? (
                    <div className="wa-preview-vars">
                        <div className="wa-preview-vars-label">Variables</div>
                        <div className="wa-preview-vars-list">{row.variables.join(', ')}</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
