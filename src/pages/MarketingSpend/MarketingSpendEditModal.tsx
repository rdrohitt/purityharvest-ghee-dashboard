import { useEffect, useState } from 'react';
import { DatePicker } from './DatePicker';
import type { SpendRecord, MiscRecord } from '../../utils/marketing-spend';

type Platform = 'Meta' | 'Amazon' | 'Flipkart' | 'Checkout' | 'Engage' | 'Dolchi' | 'Delhivery' | 'Miscellaneous';

export type MarketingSpendEditModalProps = {
  platform: Platform;
  record: SpendRecord | MiscRecord;
  onClose: () => void;
  onSubmit: (updated: SpendRecord | MiscRecord, platform: Platform) => Promise<void> | void;
};

export function MarketingSpendEditModal({ platform, record, onClose, onSubmit }: MarketingSpendEditModalProps) {
  const [date, setDate] = useState(record.date);
  const [amount, setAmount] = useState<string>(record.amount.toString());
  const [note, setNote] = useState<string>(record.note ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const next: SpendRecord | MiscRecord =
        platform === 'Miscellaneous'
          ? {
              ...(record as MiscRecord),
              date,
              amount: Number(amount || 0),
              note: note || undefined,
            }
          : {
              ...(record as SpendRecord),
              date,
              amount: Number(amount || 0),
              note: note || undefined,
            };
      await Promise.resolve(onSubmit(next, platform));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="marketing-spend-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="card marketing-spend-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="marketing-spend-modal__header">
          <h3 className="marketing-spend-modal__title">Edit Spend</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="marketing-spend-modal__body">
            <div className="marketing-spend-modal__form">
              <div className="marketing-spend-modal__grid">
                <div>
                  <label className="label">Platform</label>
                  <input
                    className="input marketing-spend-modal__input"
                    value={platform}
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Date</label>
                  <DatePicker value={date} onChange={setDate} placeholder="Select date" />
                </div>
              </div>

              <div className="marketing-spend-modal__grid">
                <div>
                  <label className="label">Amount (₹)</label>
                  <input
                    className="input marketing-spend-modal__input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Note</label>
                  <input
                    className="input marketing-spend-modal__input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="marketing-spend-modal__footer">
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button marketing-spend-modal__submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

