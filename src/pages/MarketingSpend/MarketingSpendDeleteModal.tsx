import { useEffect, useState } from 'react';
import type { UnifiedRecord, Platform } from './MarketingSpend';

export interface MarketingSpendDeleteModalProps {
  record: UnifiedRecord | null;
  platform: Platform | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function MarketingSpendDeleteModal({
  record,
  platform,
  onConfirm,
  onCancel,
}: MarketingSpendDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!record) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [record]);

  if (!record || !platform) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      className="delete-modal-backdrop"
    >
      <div
        className="card delete-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-modal-inner">
          <div className="delete-modal-icon-row">
            <div className="delete-modal-icon-wrap">
              <span className="delete-modal-icon" aria-hidden="true">
                ⚠️
              </span>
            </div>
          </div>

          <h3 className="delete-modal-title">Delete spend?</h3>

          <p className="delete-modal-text">
            Are you sure you want to delete this marketing spend entry for <strong>{platform}</strong>? This action cannot be undone.
          </p>

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
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

