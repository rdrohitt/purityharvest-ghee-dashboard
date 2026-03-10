import type { CategoryRecord } from '../../types/categories';

export interface CategoryEditModalProps {
  category: CategoryRecord | null;
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  submitting: boolean;
}

export function CategoryEditModal({
  category,
  name,
  onNameChange,
  onSave,
  onClose,
  submitting,
}: CategoryEditModalProps) {
  if (!category) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-category-modal-title"
      className="products-edit-category-backdrop"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="card products-edit-category-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="products-edit-category-modal-head">
          <div className="products-edit-category-modal-icon-wrap">
            <span className="products-edit-category-modal-icon" aria-hidden="true">
              ✏️
            </span>
          </div>
          <div className="products-edit-category-modal-head-text">
            <h3 id="edit-category-modal-title" className="products-edit-category-modal-title">
              Edit category
            </h3>
            <p className="products-edit-category-modal-subtitle">
              Update the name below. It will be reflected across products using this category.
            </p>
          </div>
        </div>
        <div className="products-edit-category-modal-hint">
          <p>Use a clear, unique name so it's easy to find when assigning products.</p>
        </div>
        <div className="products-edit-category-modal-field">
          <label htmlFor="edit-category-name-input" className="products-edit-category-modal-label">
            Category name
          </label>
          <input
            id="edit-category-name-input"
            className="input products-edit-category-modal-input"
            type="text"
            placeholder="e.g. Ghee, Oils, Dry Fruits"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus
          />
        </div>
        <div className="products-edit-category-modal-actions">
          <button
            type="button"
            className="icon-btn"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            disabled={submitting || !name.trim()}
            onClick={onSave}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
