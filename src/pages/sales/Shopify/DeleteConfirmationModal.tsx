import { useEffect, useState } from 'react';
import type { Order } from '../../../utils/orders';
import { formatCurrency } from './ShopifyShared';

export function DeleteConfirmationModal({
    order,
    onConfirm,
    onCancel,
}: {
    order: Order;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}) {
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    const handleConfirm = async () => {
        if (isDeleting) return;
        try {
            setIsDeleting(true);
            await onConfirm();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" onClick={onCancel} className="delete-modal-backdrop">
            <div className="card delete-modal" onClick={(e) => e.stopPropagation()}>
                <div className="delete-modal-inner">
                    <div className="delete-modal-icon-row">
                        <div className="delete-modal-icon-wrap">
                            <span className="delete-modal-icon" aria-hidden="true">
                                ⚠️
                            </span>
                        </div>
                    </div>

                    <h3 className="delete-modal-title">Delete order?</h3>

                    <p className="delete-modal-text">
                        Are you sure you want to delete this order? This action cannot be undone.
                    </p>

                    <div className="delete-modal-customer-box">
                        <div className="delete-modal-customer-label">Customer</div>
                        <div className="delete-modal-customer-name">{order.customer}</div>
                        <div className="delete-modal-customer-amount">
                            Order amount: {formatCurrency(order.amount)}
                        </div>
                    </div>

                    <div className="delete-modal-actions">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="delete-modal-cancel"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="delete-modal-confirm"
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting…' : 'Delete order'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
