import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api';
import type { DeliveryStatus } from '../../../utils/orders';
import { DatePicker } from './DatePicker';
import { ModernSelect, ORDER_MODAL_DELIVERY_OPTIONS, type ModernSelectOption } from './ShopifyShared';

type BulkUpdatePayload = {
    ids: string[];
    pickedUpDate?: string;
    returnedAt?: string;
    shippingDetails?: { trackingStatus: DeliveryStatus };
};

const STATUS_OPTIONS: ModernSelectOption<DeliveryStatus>[] = [
    { value: '', label: "Don't change", tone: 'placeholder' },
    ...ORDER_MODAL_DELIVERY_OPTIONS,
];

/** `YYYY-MM-DD` → midnight UTC ISO string, so the calendar day is kept as picked. */
function ymdToIso(value: string): string | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    return `${value}T00:00:00.000Z`;
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
    const [returnedAt, setReturnedAt] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setStatus('');
        setPickedUpAt('');
        setReturnedAt('');
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    const hasChanges = Boolean(status || pickedUpAt || returnedAt);
    const count = orderIds.length;

    const handleSubmit = async () => {
        if (!hasChanges || saving || count === 0) return;
        const payload: BulkUpdatePayload = { ids: orderIds };
        const pickedIso = ymdToIso(pickedUpAt);
        const returnedIso = ymdToIso(returnedAt);
        if (pickedIso) payload.pickedUpDate = pickedIso;
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
        <div role="dialog" aria-modal="true" className="delete-modal-backdrop" onClick={saving ? undefined : onClose}>
            <div className="card delete-modal bulk-update-modal" onClick={(e) => e.stopPropagation()}>
                <div className="delete-modal-inner">
                    <div>
                        <h3 className="bulk-update-modal__title">Update selected orders</h3>
                        <p className="bulk-update-modal__subtitle">
                            {count.toLocaleString()} order{count === 1 ? '' : 's'} selected. Only the fields you fill in
                            will be changed.
                        </p>
                    </div>

                    <div className="bulk-update-modal__field">
                        <span className="bulk-update-modal__label">Shipping Status</span>
                        <ModernSelect<DeliveryStatus>
                            value={status}
                            onChange={setStatus}
                            options={STATUS_OPTIONS}
                            placeholder="Don't change"
                            aria-label="Shipping status"
                            disabled={saving}
                        />
                    </div>

                    <div className="bulk-update-modal__field">
                        <span className="bulk-update-modal__label">Pickup Date</span>
                        <div className="bulk-update-modal__date-row">
                            <DatePicker
                                value={pickedUpAt}
                                onChange={setPickedUpAt}
                                placeholder="Don't change"
                                disabled={saving}
                            />
                            {pickedUpAt ? (
                                <button
                                    type="button"
                                    className="bulk-update-modal__date-clear"
                                    aria-label="Clear pickup date"
                                    onClick={() => setPickedUpAt('')}
                                    disabled={saving}
                                >
                                    ×
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="bulk-update-modal__field">
                        <span className="bulk-update-modal__label">Return Date</span>
                        <div className="bulk-update-modal__date-row">
                            <DatePicker
                                value={returnedAt}
                                onChange={setReturnedAt}
                                placeholder="Don't change"
                                disabled={saving}
                            />
                            {returnedAt ? (
                                <button
                                    type="button"
                                    className="bulk-update-modal__date-clear"
                                    aria-label="Clear return date"
                                    onClick={() => setReturnedAt('')}
                                    disabled={saving}
                                >
                                    ×
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="delete-modal-actions">
                        <button type="button" className="delete-modal-cancel" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="delete-modal-confirm bulk-update-modal__submit"
                            onClick={() => void handleSubmit()}
                            disabled={!hasChanges || saving}
                            title={hasChanges ? undefined : 'Fill in at least one field'}
                        >
                            {saving ? 'Updating…' : `Update ${count.toLocaleString()}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
