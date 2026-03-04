import { useMemo, useState } from 'react';
import './Modules.scss';

type ModuleRecord = {
  id: string;
  key: string;
  name: string;
  description?: string;
};

type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error';
};

const INITIAL_MODULES: ModuleRecord[] = [
  { id: 'MOD-001', key: 'orders', name: 'Orders', description: 'Order management and fulfillment' },
  { id: 'MOD-002', key: 'products', name: 'Products', description: 'Product catalog and pricing' },
  { id: 'MOD-003', key: 'marts', name: 'Marts', description: 'Gurugram / Delhi marts operations' },
  { id: 'MOD-004', key: 'reports', name: 'Reports', description: 'Analytics and performance reports' },
  { id: 'MOD-005', key: 'users', name: 'Users & Roles', description: 'User access and permissions' },
];

export default function Modules() {
  const [modules, setModules] = useState<ModuleRecord[]>(INITIAL_MODULES);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [deleting, setDeleting] = useState<ModuleRecord | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) =>
      [m.name, m.key, m.description ?? ''].some((v) => v.toLowerCase().includes(q))
    );
  }, [modules, search]);

  function handleCreateOrUpdate(payload: Omit<ModuleRecord, 'id'>) {
    if (editing) {
      setModules((prev) => prev.map((m) => (m.id === editing.id ? { id: editing.id, ...payload } : m)));
      showToast('Module updated successfully', 'success');
    } else {
      const nextIndex = modules.length + 1;
      const id = `MOD-${nextIndex.toString().padStart(3, '0')}`;
      setModules((prev) => [{ id, ...payload }, ...prev]);
      showToast('Module created successfully', 'success');
    }
    setEditing(null);
    setShowModal(false);
  }

  function handleDeleteModule(id: string) {
    setModules((prev) => prev.filter((m) => m.id !== id));
    showToast('Module deleted successfully', 'success');
    setDeleting(null);
  }

  return (
    <section className="modules-page">
      <ModulesToastContainer toasts={toasts} />

      <div className="card modules-header-card">
        <div className="modules-header-title">Modules</div>
        <div className="modules-header-row">
          <div className="modules-header-spacer" />
          <input
            className="input modules-search"
            placeholder="Search modules"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="button modules-create-btn"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            Add Module
          </button>
        </div>
      </div>

      <div className="card modules-table-card">
        <div className="modules-count-bar">
          {`${filtered.length.toLocaleString()} module${filtered.length === 1 ? '' : 's'}`}
        </div>
        <div className="table-scroll-wrapper">
          <table className="modules-table">
            <thead>
              <tr className="modules-row-header">
                <ModulesTh>Name</ModulesTh>
                <ModulesTh>Key</ModulesTh>
                <ModulesTh>Description</ModulesTh>
                <ModulesTh>Actions</ModulesTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="modules-row">
                  <ModulesTd className="modules-td--strong">
                    <button
                      type="button"
                      className="modules-name-btn"
                      onClick={() => {
                        setEditing(m);
                        setShowModal(true);
                      }}
                    >
                      <span className="modules-name">{m.name}</span>
                      <span className="modules-meta">{m.id}</span>
                    </button>
                  </ModulesTd>
                  <ModulesTd>
                    <span className="modules-key-pill">{m.key}</span>
                  </ModulesTd>
                  <ModulesTd>{m.description || '—'}</ModulesTd>
                  <ModulesTd>
                    <div className="modules-actions">
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => setDeleting(m)}
                      >
                        Delete
                      </button>
                    </div>
                  </ModulesTd>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="modules-empty">
                    No modules found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showModal ? (
        <ModulesModal
          mode={editing ? 'edit' : 'create'}
          initialModule={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSubmit={handleCreateOrUpdate}
        />
      ) : null}

      {deleting ? (
        <div
          role="dialog"
          aria-modal="true"
          className="modules-confirm-backdrop"
          onClick={() => setDeleting(null)}
        >
          <div
            className="card modules-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modules-confirm-header">
              <h3 className="modules-confirm-title">Delete module</h3>
              <button
                className="icon-btn"
                onClick={() => setDeleting(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modules-confirm-body">
              <p>
                Are you sure you want to delete the module{' '}
                <strong>{deleting.name}</strong>?
              </p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="modules-confirm-footer">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => handleDeleteModule(deleting.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ModulesTh({ children }: { children: string }) {
  return <th className="modules-th">{children}</th>;
}

function ModulesTd({ children, className }: { children: React.ReactNode; className?: string }) {
  const cls = className ? `modules-td ${className}` : 'modules-td';
  return <td className={cls}>{children}</td>;
}

function ModulesToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="modules-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast modules-toast" data-type={toast.type}>
          <div className="modules-toast-content">
            <span className="modules-toast-icon">{toast.type === 'success' ? '✓' : '✕'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModulesModal({
  mode,
  initialModule,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialModule: ModuleRecord | null;
  onClose: () => void;
  onSubmit: (module: Omit<ModuleRecord, 'id'>) => void;
}) {
  const [name, setName] = useState(initialModule?.name ?? '');
  const [key, setKey] = useState(initialModule?.key ?? '');
  const [description, setDescription] = useState(initialModule?.description ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedKey = (key || name).trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmedName || !trimmedKey) return;
    onSubmit({
      name: trimmedName,
      key: trimmedKey,
      description: description.trim() || undefined,
    });
  }

  return (
    <div role="dialog" aria-modal="true" className="modules-modal-backdrop" onClick={onClose}>
      <div className="card modules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modules-modal-header">
          <h3 className="modules-modal-title">{mode === 'edit' ? 'Edit Module' : 'Add Module'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form className="modules-modal-body" onSubmit={handleSubmit}>
          <div className="modules-form-grid">
            <div className="modules-form-full-row">
              <label className="label">Module Name</label>
              <input
                className="input modules-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input modules-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for this module"
              rows={3}
            />
          </div>

          <div className="modules-modal-footer">
            <button type="button" className="icon-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button modules-modal-primary-btn">
              {mode === 'edit' ? 'Save Changes' : 'Add Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

