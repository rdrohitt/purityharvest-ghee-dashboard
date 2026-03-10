import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Spinner } from '../../components/Spinner';
import type { ModuleApiItem, ModuleCreatePayload, ModuleRecord } from '../../types/modules';
import { ModuleModal } from './ModuleModal';
import './Modules.scss';

type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error';
};

function normalizeModules(data: unknown): ModuleRecord[] {
  const list = (Array.isArray(data) ? data : []) as ModuleApiItem[];
  return list.map((item) => ({
    id: item._id,
    key: item.key,
    name: item.label,
    description: item.path || undefined,
    order: item.order,
    active: item.active,
    icon: item.icon,
  }));
}

export default function Modules() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [deleting, setDeleting] = useState<ModuleRecord | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiFetch('/api/modules')
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(res.statusText || 'Failed to load modules');
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        setModules(normalizeModules(data));
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message || 'Failed to load modules');
        setModules([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const refetchModules = useCallback(() => {
    apiFetch('/api/modules')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => setModules(normalizeModules(data)))
      .catch(() => setModules([]));
  }, []);

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

  function handleCreateOrUpdate(payload: ModuleCreatePayload) {
    if (editing) {
      const updated: ModuleRecord = {
        id: editing.id,
        key: payload.key,
        name: payload.label,
        description: payload.path || undefined,
        order: payload.order,
        active: payload.active,
        icon: payload.icon,
      };
      setModules((prev) => prev.map((m) => (m.id === editing.id ? updated : m)));
      showToast('Module updated successfully', 'success');
    } else {
      showToast('Module created successfully', 'success');
    }
    setEditing(null);
    setShowModal(false);
  }

  async function handleDeleteModule(id: string) {
    try {
      const res = await apiFetch(`/api/modules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(res.statusText || 'Failed to delete module');
      setModules((prev) => prev.filter((m) => m.id !== id));
      showToast('Module deleted successfully', 'success');
    } catch (err) {
      console.error('Failed to delete module', err);
      showToast('Failed to delete module. Please try again.', 'error');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="modules-page">
      <ModulesToastContainer toasts={toasts} />

      <div className="card modules-header-card">
        <div className="modules-header-title">Modules</div>
        <div className="modules-header-row">
          <div className="modules-search-row">
            <input
              className="input modules-search"
              placeholder="Search by name, key or description"
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
      </div>

      <div className="card modules-table-card">
        <div className="modules-count-bar">
          {loading
            ? 'Loading…'
            : loadError
              ? loadError
              : `${filtered.length.toLocaleString()} module${filtered.length === 1 ? '' : 's'}`}
        </div>
        {loading ? (
          <div className="modules-table-loading">
            <Spinner overlay message="Loading modules…" />
          </div>
        ) : !loadError ? (
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
        ) : null}
      </div>

      {showModal ? (
        <ModuleModal
          mode={editing ? 'edit' : 'create'}
          initialModule={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSubmit={handleCreateOrUpdate}
          onSuccess={refetchModules}
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

