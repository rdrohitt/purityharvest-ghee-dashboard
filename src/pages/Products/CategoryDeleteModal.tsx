import type { CategoryRecord } from '../../types/categories';

export interface CategoryDeleteModalProps {
  category: CategoryRecord | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}

export function CategoryDeleteModal({
  category,
  onConfirm,
  onCancel,
  submitting,
}: CategoryDeleteModalProps) {
  if (!category) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="products-categories-delete-backdrop"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="card products-categories-delete-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="products-categories-delete-header">
          <h3 className="products-categories-delete-title">Delete category</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => !submitting && onCancel()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="products-categories-delete-body">
          <p>
            Are you sure you want to delete the category <strong>{category.name}</strong>?
          </p>
          <p>This action cannot be undone.</p>
        </div>
        <div className="products-categories-delete-footer">
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
