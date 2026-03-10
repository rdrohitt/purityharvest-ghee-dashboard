import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Spinner } from '../../components/Spinner';
import type { CategoryApiItem, CategoryCreatePayload, CategoryRecord } from '../../types/categories';
import { CategoryDeleteModal } from './CategoryDeleteModal';
import { CategoryEditModal } from './CategoryEditModal';
import { CategoryInfoModal } from './CategoryInfoModal';

type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'delete';
};

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="products-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast products-toast" data-type={toast.type}>
          <div className="products-toast-content">
            <span className="products-toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Categories() {
  const [categoriesFromApi, setCategoriesFromApi] = useState<CategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [infoModalMessage, setInfoModalMessage] = useState<string | null>(null);
  const [infoModalTitle, setInfoModalTitle] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryUpdateSubmitting, setCategoryUpdateSubmitting] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryRecord | null>(null);
  const [categoryDeleteSubmitting, setCategoryDeleteSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categoriesFromApi;
    return categoriesFromApi.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoriesFromApi, categorySearch]);

  const fetchCategories = useCallback(() => {
    setCategoriesLoading(true);
    setCategoriesLoadError(null);
    apiFetch('/api/categories')
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || 'Failed to load categories');
        return res.json() as Promise<CategoryApiItem[]>;
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const normalized: CategoryRecord[] = list
          .map((item) => ({
            id: item._id,
            name: item.name ?? '',
          }))
          .filter((c) => c.name);
        setCategoriesFromApi(normalized);
      })
      .catch((err: Error) => {
        setCategoriesLoadError(err.message || 'Failed to load categories');
        setCategoriesFromApi([]);
      })
      .finally(() => setCategoriesLoading(false));
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setCategoryError(null);
    setCategorySubmitting(true);
    try {
      const payload: CategoryCreatePayload = { name };
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = res.statusText || 'Failed to add category';
        const text = await res.text();
        if (text) {
          try {
            const body = JSON.parse(text) as { message?: string };
            if (body?.message) message = body.message;
            else message = text;
          } catch {
            message = text;
          }
        }
        setInfoModalTitle("Couldn't add category");
        setInfoModalMessage(message);
        return;
      }
      setNewCategoryName('');
      setCategoryError(null);
      showToast('Category added successfully!', 'success');
      fetchCategories();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to add category');
      showToast('Failed to add category. Please try again.', 'error');
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function handleUpdateCategory(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCategoryUpdateSubmitting(true);
    setCategoryError(null);
    try {
      const res = await apiFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        let message = res.statusText || 'Failed to update category';
        const text = await res.text();
        if (text) {
          try {
            const body = JSON.parse(text) as { message?: string };
            if (body?.message) message = body.message;
            else message = text;
          } catch {
            message = text;
          }
        }
        setEditingCategory(null);
        setInfoModalTitle("Couldn't update category");
        setInfoModalMessage(message);
        return;
      }
      setEditingCategory(null);
      showToast('Category updated successfully!', 'success');
      fetchCategories();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to update category');
      showToast('Failed to update category. Please try again.', 'error');
    } finally {
      setCategoryUpdateSubmitting(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setCategoryDeleteSubmitting(true);
    setCategoryError(null);
    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        let message = text || res.statusText || 'Failed to delete category';
        try {
          const body = JSON.parse(text) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          // use message as is
        }
        setCategoryError(message);
        showToast(message, 'error');
        return;
      }
      setCategoryToDelete(null);
      showToast('Category deleted successfully.', 'success');
      fetchCategories();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete category';
      setCategoryError(msg);
      showToast(msg, 'error');
    } finally {
      setCategoryDeleteSubmitting(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} />

      {infoModalMessage && (
        <CategoryInfoModal
          title={infoModalTitle ?? "Couldn't add category"}
          message={infoModalMessage}
          onClose={() => {
            setInfoModalTitle(null);
            setInfoModalMessage(null);
          }}
        />
      )}

      <CategoryEditModal
        category={editingCategory}
        name={editCategoryName}
        onNameChange={setEditCategoryName}
        onSave={() => editingCategory && handleUpdateCategory(editingCategory.id, editCategoryName)}
        onClose={() => setEditingCategory(null)}
        submitting={categoryUpdateSubmitting}
      />

      <CategoryDeleteModal
        category={categoryToDelete}
        onConfirm={() => categoryToDelete && handleDeleteCategory(categoryToDelete.id)}
        onCancel={() => setCategoryToDelete(null)}
        submitting={categoryDeleteSubmitting}
      />

      <div className="card products-categories-header-card">
        <div className="products-categories-header-title">Categories</div>
        <div className="products-categories-header-row">
          <div className="products-categories-search-row">
            <input
              className="input products-categories-search"
              placeholder="Search by name"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
            <form onSubmit={handleAddCategory} className="products-categories-add-form">
              <input
                className="input products-categories-add-input"
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button
                type="submit"
                className="button products-categories-add-btn"
                disabled={categorySubmitting || !newCategoryName.trim()}
              >
                {categorySubmitting ? 'Adding…' : 'Add Category'}
              </button>
            </form>
          </div>
        </div>
        {categoryError && <div className="products-categories-error">{categoryError}</div>}
      </div>

      <div className="card products-categories-table-card">
        <div className="products-categories-count-bar">
          {categoriesLoading
            ? 'Loading…'
            : categoriesLoadError
              ? categoriesLoadError
              : `${filteredCategories.length.toLocaleString()} categor${filteredCategories.length === 1 ? 'y' : 'ies'}`}
        </div>
        {categoriesLoading ? (
          <div className="products-categories-table-loading">
            <Spinner overlay message="Loading categories…" />
          </div>
        ) : !categoriesLoadError ? (
          <div className="table-scroll-wrapper">
            <table className="products-categories-table">
              <thead>
                <tr className="products-categories-row-header">
                  <th className="products-categories-th">Name</th>
                  <th className="products-categories-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <tr key={cat.id || cat.name} className="products-categories-row">
                    <td className="products-categories-td products-categories-td--strong">
                      <button
                        type="button"
                        className="products-categories-name-btn"
                        onClick={() => {
                          setEditingCategory(cat);
                          setEditCategoryName(cat.name);
                        }}
                      >
                        <span className="products-categories-name">{cat.name}</span>
                      </button>
                    </td>
                    <td className="products-categories-td">
                      <div className="products-categories-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            setEditingCategory(cat);
                            setEditCategoryName(cat.name);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          onClick={() => setCategoryToDelete(cat)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="products-categories-empty">
                      {categoriesFromApi.length === 0
                        ? 'No categories yet. Add a category above.'
                        : 'No categories match your search.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
