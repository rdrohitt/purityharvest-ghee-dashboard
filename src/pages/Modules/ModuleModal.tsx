import { useState } from 'react';
import { apiFetch } from '../../api';
import type { ModuleCreatePayload, ModuleRecord } from '../../types/modules';
import './Modules.scss';

type Props = {
  mode: 'create' | 'edit';
  initialModule: ModuleRecord | null;
  onClose: () => void;
  onSubmit: (payload: ModuleCreatePayload) => void;
  onSuccess?: () => void;
};

export function ModuleModal({ mode, initialModule, onClose, onSubmit, onSuccess }: Props) {
  const [label, setLabel] = useState(initialModule?.name ?? '');
  const [key, setKey] = useState(initialModule?.key ?? '');
  const [path, setPath] = useState(initialModule?.description ?? '');
  const [icon, setIcon] = useState(initialModule?.icon ?? '');
  const [order, setOrder] = useState(initialModule?.order ?? 1);
  const [active, setActive] = useState(initialModule?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildPayload(): ModuleCreatePayload {
    const trimmedKey = (key || label).trim().toLowerCase().replace(/\s+/g, '-');
    const trimmedPath = path.trim() || (trimmedKey ? `/${trimmedKey}` : '');
    return {
      key: trimmedKey,
      label: label.trim(),
      path: trimmedPath,
      icon: icon.trim() || undefined,
      order: Number(order) || 1,
      active,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedLabel = label.trim();
    const trimmedKey = (key || label).trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmedLabel || !trimmedKey) return;

    const payload = buildPayload();

    if (mode === 'create') {
      setSubmitting(true);
      try {
        const res = await apiFetch('/api/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || res.statusText || 'Failed to create module');
        }
        onSubmit(payload);
        onSuccess?.();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create module');
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!initialModule?.id) return;
      setSubmitting(true);
      try {
        const res = await apiFetch(`/api/modules/${initialModule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || res.statusText || 'Failed to update module');
        }
        onSubmit(payload);
        onSuccess?.();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update module');
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="modules-modal-backdrop" onClick={onClose}>
      <div className="card modules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modules-modal-header">
          <h3 className="modules-modal-title">{mode === 'edit' ? 'Edit Module' : 'Add Module'}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modules-modal-body">
            {error ? <div className="modules-modal-error">{error}</div> : null}
            <div className="modules-form-grid">
              <div className="modules-form-full-row">
                <label className="label">Module Name (Label)</label>
                <input
                  className="input modules-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Orders"
                  required
                />
              </div>
              <div>
                <label className="label">Key</label>
                <input
                  className="input modules-input"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="e.g. orders"
                />
              </div>
              <div>
                <label className="label">Path</label>
                <input
                  className="input modules-input"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="e.g. /orders"
                />
              </div>
              <div>
                <label className="label">Icon</label>
                <input
                  className="input modules-input"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g. arrow"
                />
              </div>
              <div>
                <label className="label">Order</label>
                <input
                  className="input modules-input"
                  type="number"
                  min={0}
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value) || 0)}
                />
              </div>
              <div className="modules-form-checkbox-row">
                <label className="modules-checkbox-label">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>
          </div>

          <div className="modules-modal-footer">
            <button type="button" className="icon-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="button modules-modal-primary-btn"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
