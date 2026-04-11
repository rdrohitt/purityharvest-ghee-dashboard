import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { apiFetch } from '../../api';
import { Spinner } from '../../components/Spinner';
import type { CustomerApi } from '../../types/shopify';
import {
    ADD_MODAL_FIELD_ICONS,
    AddModalInputWrap,
    AddModalSection,
} from '../sales/Shopify/AddOrderModal';
import '../sales/Shopify/Shopify.scss';

export function CustomerEditModal({
    customerId,
    onClose,
    onSaved,
}: {
    customerId: string;
    onClose: () => void;
    /** Called after a successful PUT so the parent can refetch or merge. */
    onSaved?: () => void;
}) {
    const [customer, setCustomer] = useState<CustomerApi | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!customerId) return;
            try {
                setLoading(true);
                setError(null);
                const res = await apiFetch(`/api/customers/${encodeURIComponent(customerId)}`);
                if (!res.ok) {
                    throw new Error('Failed to load customer');
                }
                const json = (await res.json()) as CustomerApi;
                if (!cancelled) {
                    setCustomer(json);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load customer');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    async function handleSave(e: FormEvent) {
        e.preventDefault();
        if (!customer || saving) return;
        try {
            setSaving(true);
            setError(null);
            const id = encodeURIComponent(customerId);
            const res = await apiFetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...customer, _id: customerId }),
            });
            if (!res.ok) {
                throw new Error('Failed to update customer');
            }
            onSaved?.();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update customer');
        } finally {
            setSaving(false);
        }
    }

    const shell = (title: string, body: ReactNode, footer?: ReactNode) => (
        <div role="dialog" aria-modal="true" className="shopify-add-modal-backdrop">
            <div
                className="card shopify-add-modal-card shopify-add-modal-card--narrow"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shopify-add-modal-header">
                    <h3 className="shopify-add-modal-title">{title}</h3>
                    <button
                        type="button"
                        className="icon-btn shopify-add-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                {body}
                {footer}
            </div>
        </div>
    );

    if (loading && !customer) {
        return shell(
            'Edit Customer',
            <div className="shopify-add-modal-body">
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 12,
                        padding: '32px 0',
                    }}
                >
                    <Spinner size="md" />
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Loading customer…</p>
                </div>
            </div>,
        );
    }

    if (error && !customer) {
        return shell(
            'Edit Customer',
            <div className="shopify-add-modal-body">
                <div className="tracking-error">{error}</div>
            </div>,
            <div className="shopify-add-modal-footer">
                <button type="button" className="icon-btn" onClick={onClose}>
                    Close
                </button>
            </div>,
        );
    }

    if (!customer) {
        return null;
    }

    return shell(
        'Edit Customer',
        <form className="shopify-add-modal-form" onSubmit={handleSave}>
            <div className="shopify-add-modal-body">
                <AddModalSection id="customer-edit-section" title="Customer details">
                    {error ? <div className="tracking-error">{error}</div> : null}
                    <div className="shopify-add-modal-section-grid">
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="label">Name</label>
                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.user}>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="text"
                                    value={customer.name ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, name: e.target.value } : prev,
                                        )
                                    }
                                    required
                                />
                            </AddModalInputWrap>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="label">Phone</label>
                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.phone}>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="tel"
                                    value={customer.phoneNumber ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, phoneNumber: e.target.value } : prev,
                                        )
                                    }
                                    required
                                />
                            </AddModalInputWrap>
                        </div>
                    </div>
                    <div className="shopify-add-modal-section-grid">
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="label">Email</label>
                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.mail}>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="email"
                                    value={customer.email ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, email: e.target.value } : prev,
                                        )
                                    }
                                />
                            </AddModalInputWrap>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="label">Pincode</label>
                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.hash}>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="text"
                                    value={customer.pincode ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, pincode: e.target.value } : prev,
                                        )
                                    }
                                />
                            </AddModalInputWrap>
                        </div>
                    </div>
                    <div className="shopify-add-modal-notes">
                        <label className="label">Address</label>
                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.mapPin} variant="textarea">
                            <textarea
                                className="input shopify-add-modal-notes-textarea"
                                value={customer.address ?? ''}
                                onChange={(e) =>
                                    setCustomer((prev) =>
                                        prev ? { ...prev, address: e.target.value } : prev,
                                    )
                                }
                                rows={4}
                            />
                        </AddModalInputWrap>
                    </div>
                    <div className="shopify-add-modal-section-grid">
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="label">State</label>
                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.building}>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="text"
                                    value={customer.state ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, state: e.target.value } : prev,
                                        )
                                    }
                                />
                            </AddModalInputWrap>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="label">Country code</label>
                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.phone}>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="text"
                                    value={customer.countryCode ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, countryCode: e.target.value } : prev,
                                        )
                                    }
                                />
                            </AddModalInputWrap>
                        </div>
                    </div>
                </AddModalSection>
            </div>
            <div className="shopify-add-modal-footer">
                <button type="button" className="icon-btn" onClick={onClose} disabled={saving}>
                    Cancel
                </button>
                <button
                    type="submit"
                    className="button shopify-add-modal-submit"
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Spinner size="sm" className="shopify-add-modal-submit-spinner" /> Saving…
                        </>
                    ) : (
                        'Save changes'
                    )}
                </button>
            </div>
        </form>,
    );
}
