import type { Order } from '../../../utils/orders';
import { DeleteConfirmModal } from '../../../components/DeleteConfirmModal/DeleteConfirmModal';
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
    return (
        <DeleteConfirmModal
            open
            title="Delete order?"
            description="Are you sure you want to delete this order? This action cannot be undone."
            details={
                <>
                    <div className="delete-modal-customer-label">Customer</div>
                    <div className="delete-modal-customer-name">{order.customer}</div>
                    <div className="delete-modal-customer-amount">
                        Order amount: {formatCurrency(order.amount)}
                    </div>
                </>
            }
            confirmLabel="Delete order"
            busyConfirmLabel="Deleting…"
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
