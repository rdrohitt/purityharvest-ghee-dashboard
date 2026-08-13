import { DeleteConfirmModal } from '../../components/DeleteConfirmModal/DeleteConfirmModal';

export type ProductDeleteTarget = {
    productId: string;
    productName: string;
    categoryName: string;
};

type Props = {
    product: ProductDeleteTarget | null;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
};

export function ProductDeleteModal({ product, onConfirm, onCancel }: Props) {
    const name = String(product?.productName ?? '').trim();

    return (
        <DeleteConfirmModal
            open={Boolean(product)}
            title="Delete product?"
            description={
                <>Are you sure you want to delete this product? This action cannot be undone.</>
            }
            details={
                name ? (
                    <>
                        <div className="delete-modal-customer-label">Product</div>
                        <div className="delete-modal-customer-name">{name}</div>
                        {String(product?.categoryName ?? '').trim() ? (
                            <div className="delete-modal-customer-amount">{String(product?.categoryName).trim()}</div>
                        ) : null}
                    </>
                ) : undefined
            }
            confirmLabel="Delete product"
            busyConfirmLabel="Deleting…"
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
