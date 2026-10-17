import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../../../api';
import { deliveryStatusLabel, type DeliveryStatus } from '../../../utils/orders';
import { DatePicker } from './DatePicker';
import {
    ModernSelect,
    ORDER_MODAL_DELIVERY_OPTIONS,
    toInputDate,
    type ModernSelectOption,
} from './ShopifyShared';

type BulkUpdatePayload = {
    ids: string[];
    pickedUpDate?: string;
    deliveredAt?: string;
    returnedAt?: string;
    shippingDetails?: { trackingStatus: DeliveryStatus };
};

const STATUS_OPTIONS: ModernSelectOption<DeliveryStatus>[] = [
    { value: '', label: "Don't change", tone: 'placeholder' },
    ...ORDER_MODAL_DELIVERY_OPTIONS,
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `YYYY-MM-DD` → midnight UTC ISO string, so the calendar day is kept as picked. */
function ymdToIso(value: string): string | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    return `${value}T00:00:00.000Z`;
}

function formatYmd(ymd: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return ymd;
    return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
}

function FieldShell({
    label,
    active,
    onClear,
    clearLabel,
    disabled,
    children,
    trailing,
}: {
    label: string;
    active: boolean;
    onClear?: () => void;
    clearLabel?: string;
    disabled?: boolean;
    children: ReactNode;
    trailing?: ReactNode;
}) {
    return (
        <div className={`bulk-update-field${active ? ' bulk-update-field--active' : ''}`}>
            <div className="bulk-update-field__head">
                <span className="bulk-update-field__label">{label}</span>
                <div className="bulk-update-field__head-actions">
                    {trailing}
                    {active && onClear ? (
                        <button
                            type="button"
                            className="bulk-update-field__clear"
                            onClick={onClear}
                            disabled={disabled}
                            aria-label={clearLabel ?? `Clear ${label}`}
                        >
                            Clear
                        </button>
                    ) : (
                        <span className="bulk-update-field__hint">Optional</span>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
}

export function BulkUpdateOrdersModal({
    open,
    orderIds,
    onClose,
    onUpdated,
    onError,
}: {
    open: boolean;
    orderIds: string[];
    onClose: () => void;
    onUpdated: (count: number) => void | Promise<void>;
    onError: (message: string) => void;
}) {
    const [status, setStatus] = useState<DeliveryStatus | ''>('');
    const [pickedUpAt, setPickedUpAt] = useState('');
    const [deliveredAt, setDeliveredAt] = useState('');
    const [returnedAt, setReturnedAt] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setStatus('');
        setPickedUpAt('');
        setDeliveredAt('');
        setReturnedAt('');
        setSaving(false);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, saving, onClose]);

    const changeChips = useMemo(() => {
        const chips: { key: string; label: string; value: string }[] = [];
        if (status) {
            chips.push({ key: 'status', label: 'Status', value: deliveryStatusLabel(status) });
        }
        if (pickedUpAt) {
            chips.push({ key: 'pickup', label: 'Pickup', value: formatYmd(pickedUpAt) });
        }
        if (deliveredAt) {
            chips.push({ key: 'delivered', label: 'Delivered', value: formatYmd(deliveredAt) });
        }
        if (returnedAt) {
            chips.push({ key: 'return', label: 'Return', value: formatYmd(returnedAt) });
        }
        return chips;
    }, [status, pickedUpAt, deliveredAt, returnedAt]);

    if (!open) return null;

    const hasChanges = changeChips.length > 0;
    const count = orderIds.length;
    const today = toInputDate(new Date());

    const clearAll = () => {
        setStatus('');
        setPickedUpAt('');
        setDeliveredAt('');
        setReturnedAt('');
    };

    const handleSubmit = async () => {
        if (!hasChanges || saving || count === 0) return;
        const payload: BulkUpdatePayload = { ids: orderIds };
        const pickedIso = ymdToIso(pickedUpAt);
        const deliveredIso = ymdToIso(deliveredAt);
        const returnedIso = ymdToIso(returnedAt);
        if (pickedIso) payload.pickedUpDate = pickedIso;
        if (deliveredIso) payload.deliveredAt = deliveredIso;
        if (returnedIso) payload.returnedAt = returnedIso;
        if (status) payload.shippingDetails = { trackingStatus: status };

        try {
            setSaving(true);
            const res = await apiFetch('/api/orders/bulk-update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let message = `Bulk update failed (${res.status})`;
                try {
                    const body = (await res.json()) as { message?: string };
                    if (body?.message) message = body.message;
                } catch {
                    // keep default message
                }
                throw new Error(message);
            }
            await onUpdated(count);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Bulk update failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-update-title"
            className="delete-modal-backdrop bulk-update-backdrop"
            onClick={saving ? undefined : onClose}
        >
            <div className="card delete-modal bulk-update-modal" onClick={(e) => e.stopPropagation()}>
                <header className="bulk-update-modal__header">
                    <div className="bulk-update-modal__header-main">
                        <span className="bulk-update-modal__badge" aria-hidden="true">
                            {count.toLocaleString()}
                        </span>
                        <div className="bulk-update-modal__heading">
                            <h3 id="bulk-update-title" className="bulk-update-modal__title">
                                Update selected orders
                            </h3>
                            <p className="bulk-update-modal__subtitle">
                                Only filled fields will be applied to{' '}
                                <strong>
                                    {count.toLocaleString()} order{count === 1 ? '' : 's'}
                                </strong>
                                .
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="bulk-update-modal__close"
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </header>

                <div className="bulk-update-modal__body">
                    <FieldShell
                        label="Shipping status"
                        active={Boolean(status)}
                        onClear={() => setStatus('')}
                        clearLabel="Clear shipping status"
                        disabled={saving}
                    >
                        <ModernSelect<DeliveryStatus>
                            value={status}
                            onChange={setStatus}
                            options={STATUS_OPTIONS}
                            placeholder="Don't change"
                            aria-label="Shipping status"
                            disabled={saving}
                        />
                    </FieldShell>

                    <div className="bulk-update-modal__section-lab">Timeline</div>

                    <div className="bulk-update-modal__dates">
                        <FieldShell
                            label="Pickup date"
                            active={Boolean(pickedUpAt)}
                            onClear={() => setPickedUpAt('')}
                            clearLabel="Clear pickup date"
                            disabled={saving}
                            trailing={
                                !pickedUpAt ? (
                                    <button
                                        type="button"
                                        className="bulk-update-field__today"
                                        onClick={() => setPickedUpAt(today)}
                                        disabled={saving}
                                    >
                                        Today
                                    </button>
                                ) : null
                            }
                        >
                            <DatePicker
                                value={pickedUpAt}
                                onChange={setPickedUpAt}
                                placeholder="Don't change"
                                disabled={saving}
                            />
                        </FieldShell>

                        <FieldShell
                            label="Delivered on"
                            active={Boolean(deliveredAt)}
                            onClear={() => setDeliveredAt('')}
                            clearLabel="Clear delivered on"
                            disabled={saving}
                            trailing={
                                !deliveredAt ? (
                                    <button
                                        type="button"
                                        className="bulk-update-field__today"
                                        onClick={() => setDeliveredAt(today)}
                                        disabled={saving}
                                    >
                                        Today
                                    </button>
                                ) : null
                            }
                        >
                            <DatePicker
                                value={deliveredAt}
                                onChange={setDeliveredAt}
                                placeholder="Don't change"
                                disabled={saving}
                            />
                        </FieldShell>

                        <FieldShell
                            label="Return date"
                            active={Boolean(returnedAt)}
                            onClear={() => setReturnedAt('')}
                            clearLabel="Clear return date"
                            disabled={saving}
                            trailing={
                                !returnedAt ? (
                                    <button
                                        type="button"
                                        className="bulk-update-field__today"
                                        onClick={() => setReturnedAt(today)}
                                        disabled={saving}
                                    >
                                        Today
                                    </button>
                                ) : null
                            }
                        >
                            <DatePicker
                                value={returnedAt}
                                onChange={setReturnedAt}
                                placeholder="Don't change"
                                disabled={saving}
                            />
                        </FieldShell>
                    </div>
                </div>

                <footer className="bulk-update-modal__footer">
                    <div className="bulk-update-modal__summary" aria-live="polite">
                        {hasChanges ? (
                            <>
                                <div className="bulk-update-modal__chips">
                                    {changeChips.map((chip) => (
                                        <span key={chip.key} className="bulk-update-chip">
                                            <span className="bulk-update-chip__lab">{chip.label}</span>
                                            <span className="bulk-update-chip__val">{chip.value}</span>
                                        </span>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="bulk-update-modal__reset"
                                    onClick={clearAll}
                                    disabled={saving}
                                >
                                    Reset all
                                </button>
                            </>
                        ) : (
                            <span className="bulk-update-modal__empty">Pick at least one field to update</span>
                        )}
                    </div>

                    <div className="bulk-update-modal__actions">
                        <button type="button" className="bulk-update-modal__cancel" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="bulk-update-modal__submit"
                            onClick={() => void handleSubmit()}
                            disabled={!hasChanges || saving}
                            title={hasChanges ? undefined : 'Fill in at least one field'}
                        >
                            {saving ? (
                                <span className="bulk-update-modal__submit-busy">
                                    <span className="bulk-update-modal__spinner" aria-hidden="true" />
                                    Updating…
                                </span>
                            ) : (
                                `Update ${count.toLocaleString()}`
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
