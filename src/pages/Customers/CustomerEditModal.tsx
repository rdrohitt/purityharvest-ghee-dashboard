import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import type { CustomerApi } from '../../types/shopify';

export function CustomerEditModal({
    customerId,
    onClose,
}: {
    customerId: string;
    onClose: () => void;
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

    if (!customer && (loading || error)) {
        return null;
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!customer || saving) return;
        try {
            setSaving(true);
            setError(null);
            const res = await apiFetch(`/api/customers/${encodeURIComponent(customer._id)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(customer),
            });
            if (!res.ok) {
                throw new Error('Failed to update customer');
            }
            onClose();
        } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update customer');
        } finally {
            setSaving(false);
        }
    }

    const avatarInitial = customer?.name?.charAt(0)?.toUpperCase() ?? '?';

    return (
        <div role="dialog" aria-modal="true" className="customer-modal-backdrop" onClick={onClose}>
            <div className="card customer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="customer-modal-header">
                    <div className="customer-modal-header-left">
                        <div className="customer-avatar">
                            <span className="customer-avatar-initial">{avatarInitial}</span>
                        </div>
                        <div className="customer-modal-header-text">
                            <h3 className="customer-modal-title">Edit Customer</h3>
                        </div>
                    </div>
                    <div className="customer-modal-header-actions">
                        <button className="icon-btn customer-modal-close" onClick={onClose} aria-label="Close">
                            ✕
                        </button>
                    </div>
                </div>

                <form className="customer-modal-content" onSubmit={handleSave}>
                    <div className="customer-info-card">
                        {error && (
                            <div className="tracking-error" style={{ marginBottom: 8 }}>
                                {error}
                            </div>
                        )}
                        <div className="customer-info-grid-2">
                            <div>
                                <div className="customer-info-label">Name</div>
                                <input
                                    className="input shopify-add-modal-input"
                                    value={customer?.name ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                                    }
                                    required
                                />
                            </div>
                            <div>
                                <div className="customer-info-label">Phone</div>
                                <input
                                    className="input shopify-add-modal-input"
                                    value={customer?.phoneNumber ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, phoneNumber: e.target.value } : prev,
                                        )
                                    }
                                    required
                                />
                            </div>
                        </div>
                        <div className="customer-info-grid-2" style={{ marginTop: 10 }}>
                            <div>
                                <div className="customer-info-label">Email</div>
                                <input
                                    className="input shopify-add-modal-input"
                                    type="email"
                                    value={customer?.email ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                                    }
                                />
                            </div>
                            <div>
                                <div className="customer-info-label">Pincode</div>
                                <input
                                    className="input shopify-add-modal-input"
                                    value={customer?.pincode ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) => (prev ? { ...prev, pincode: e.target.value } : prev))
                                    }
                                />
                            </div>
                        </div>
                        <div className="customer-info-address" style={{ marginTop: 10 }}>
                            <div className="customer-info-label">Address</div>
                            <textarea
                                className="input customer-notes-textarea"
                                value={customer?.address ?? ''}
                                onChange={(e) =>
                                    setCustomer((prev) => (prev ? { ...prev, address: e.target.value } : prev))
                                }
                            />
                        </div>
                        <div className="customer-info-grid-2" style={{ marginTop: 10 }}>
                            <div>
                                <div className="customer-info-label">State</div>
                                <input
                                    className="input shopify-add-modal-input"
                                    value={customer?.state ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) => (prev ? { ...prev, state: e.target.value } : prev))
                                    }
                                />
                            </div>
                            <div>
                                <div className="customer-info-label">Country Code</div>
                                <input
                                    className="input shopify-add-modal-input"
                                    value={customer?.countryCode ?? ''}
                                    onChange={(e) =>
                                        setCustomer((prev) =>
                                            prev ? { ...prev, countryCode: e.target.value } : prev,
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="shopify-add-modal-footer">
                        <button
                            type="button"
                            className="icon-btn"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button shopify-add-modal-submit"
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

