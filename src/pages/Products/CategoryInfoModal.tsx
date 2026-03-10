export interface CategoryInfoModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

export function CategoryInfoModal({ title, message, onClose }: CategoryInfoModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      className="products-info-backdrop"
      onClick={onClose}
    >
      <div
        className="card products-info-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="products-info-modal-head">
          <div className="products-info-modal-icon-wrap">ℹ️</div>
          <div className="products-info-modal-head-text">
            <h3 id="info-modal-title" className="products-info-modal-title">
              {title}
            </h3>
            <p className="products-info-modal-message">{message}</p>
          </div>
        </div>
        <div className="products-info-modal-hint">
          <p className="products-info-modal-hint-text">
            Please use a different category name. Each category name must be unique—check the list
            above and try another name.
          </p>
        </div>
        <div className="products-info-modal-actions">
          <button
            type="button"
            className="icon-btn products-info-modal-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button products-info-modal-btn-ok"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
