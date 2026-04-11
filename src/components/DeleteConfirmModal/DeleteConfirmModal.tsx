import { useEffect, useState, type ReactNode } from 'react';
import '../../pages/sales/Shopify/Shopify.scss';

export type DeleteConfirmModalProps = {
    open: boolean;
    title: string;
    description: ReactNode;
    /** Optional highlighted block (same layout as order delete “customer” box). */
    details?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    busyConfirmLabel?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    /** Extra classes on the backdrop (e.g. higher z-index when nested inside another modal). */
    backdropClassName?: string;
};

/**
 * Shared delete confirmation UI — matches Shopify / MarketingSpend delete dialogs
 * (`delete-modal-*` in Shopify.scss).
 */
export function DeleteConfirmModal({
    open,
    title,
    description,
    details,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    busyConfirmLabel,
    onConfirm,
    onCancel,
    backdropClassName,
}: DeleteConfirmModalProps) {
    const [isBusy, setIsBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    const backdropClass = ['delete-modal-backdrop', backdropClassName].filter(Boolean).join(' ');
    const busyLabel = busyConfirmLabel ?? `${confirmLabel.replace(/\s*…$/, '')}…`;

    const handleConfirm = async () => {
        if (isBusy) return;
        try {
            setIsBusy(true);
            await onConfirm();
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" onClick={onCancel} className={backdropClass}>
            <div className="card delete-modal" onClick={(e) => e.stopPropagation()}>
                <div className="delete-modal-inner">
                    <div className="delete-modal-icon-row">
                        <div className="delete-modal-icon-wrap">
                            <span className="delete-modal-icon" aria-hidden="true">
                                ⚠️
                            </span>
                        </div>
                    </div>

                    <h3 className="delete-modal-title">{title}</h3>

                    <p className="delete-modal-text">{description}</p>

                    {details ? <div className="delete-modal-customer-box">{details}</div> : null}

                    <div className="delete-modal-actions">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="delete-modal-cancel"
                            disabled={isBusy}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleConfirm()}
                            className="delete-modal-confirm"
                            disabled={isBusy}
                        >
                            {isBusy ? busyLabel : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
