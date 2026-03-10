import { useState, useMemo, useEffect, Fragment } from 'react';
import { Spinner } from '../../components/Spinner';
import type { ProductApiItem, ProductVariantRow } from '../../types/products';
import { loadProducts, addProduct, updateProduct, deleteProduct, syncShopify } from '../../utils/products';
import { useAppDispatch, useAppSelector, setProducts, setProductsLoading, addProductToStore, updateProductInStore, removeProduct } from '../../store';
import { Categories } from './Categories';
import { ProductModal } from './ProductModal';
import './Products.scss';

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/** Normalize category to string whether API returns string or populated object { _id, name, ... }. */
function getCategoryName(cat: ProductApiItem['category']): string {
    if (cat == null) return '';
    if (typeof cat === 'string') return cat;
    return String((cat as { name?: string }).name ?? '');
}

/** Flatten products into one row per variant (or one row if no variants). */
function productToVariantRows(p: ProductApiItem): ProductVariantRow[] {
    const categoryName = getCategoryName(p.category);
    const isShopify = p.isShopify === true;
    if (!p.variants || p.variants.length === 0) {
        return [{
            productId: p._id,
            productName: p.name,
            categoryName,
            variantName: '—',
            price: p.price,
            actualPrice: p.actualPrice,
            stock: 0,
            variantIndex: 0,
            isShopify,
        }];
    }
    return p.variants.map((v, i) => ({
        productId: p._id,
        productName: p.name,
        categoryName,
        variantName: v.name,
        price: v.price,
        actualPrice: v.actualPrice,
        stock: v.stock,
        variantIndex: i,
        isShopify,
    }));
}

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

type ProductsTab = 'category' | 'products';

export default function Products() {
    const dispatch = useAppDispatch();
    const products = useAppSelector((state) => state.products.products);
    const loading = useAppSelector((state) => state.products.loading);

    const [activeTab, setActiveTab] = useState<ProductsTab>('products');
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductApiItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [syncLoading, setSyncLoading] = useState(false);

    useEffect(() => {
        if (products.length > 0) {
            dispatch(setProductsLoading(false));
            return;
        }
        let cancelled = false;
        loadProducts()
            .then((data) => {
                if (!cancelled) dispatch(setProducts(data));
            })
            .catch(() => {
                if (!cancelled) dispatch(setProductsLoading(false));
            });

        return () => {
            cancelled = true;
        };
    }, [dispatch, products.length]);

    const allVariantRows = useMemo(() => products.flatMap(productToVariantRows), [products]);

    const filteredRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const byCategory = categoryFilter
            ? allVariantRows.filter(r => r.categoryName === categoryFilter)
            : allVariantRows;
        if (!q) return byCategory;
        return byCategory.filter(
            r =>
                r.productId.toLowerCase().includes(q) ||
                r.productName.toLowerCase().includes(q) ||
                r.categoryName.toLowerCase().includes(q) ||
                r.variantName.toLowerCase().includes(q)
        );
    }, [allVariantRows, searchQuery, categoryFilter]);

    const categoryOptions = useMemo(() => {
        const set = new Set<string>(products.map(p => getCategoryName(p.category)).filter(Boolean));
        return Array.from(set).sort();
    }, [products]);

    const categoryOptionsWithId = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of products) {
            const cat = p.category;
            if (cat && typeof cat === 'object' && 'name' in cat && '_id' in cat) {
                const name = (cat as { name: string; _id: string }).name;
                if (name && !map.has(name)) map.set(name, (cat as { _id: string })._id);
            }
        }
        return Array.from(map.entries()).map(([name, _id]) => ({ _id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [products]);

    const metrics = useMemo(() => {
        const total = filteredRows.length;
        const prices = filteredRows.map(r => r.price);
        const avgPrice = total ? Math.round(prices.reduce((a, b) => a + b, 0) / total) : 0;
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const categorySet = new Set<string>(filteredRows.map(r => r.categoryName).filter(Boolean));
        const categories = categorySet.size;
        const totalStock = filteredRows.reduce((a, r) => a + r.stock, 0);
        const avgStock = total ? Math.round(totalStock / total) : 0;
        return { total, avgPrice, minPrice, maxPrice, categories, avgStock };
    }, [filteredRows]);

    const groupedByProduct = useMemo(() => {
        const map = new Map<string, { productId: string; productName: string; categoryName: string; rows: ProductVariantRow[] }>();
        for (const row of filteredRows) {
            const existing = map.get(row.productId);
            if (existing) {
                existing.rows.push(row);
            } else {
                map.set(row.productId, {
                    productId: row.productId,
                    productName: row.productName,
                    categoryName: row.categoryName,
                    rows: [row],
                });
            }
        }
        const result = Array.from(map.values());
        result.sort((a, b) => a.productName.localeCompare(b.productName) || a.categoryName.localeCompare(b.categoryName));
        return result;
    }, [filteredRows]);

    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }

    async function handleCreateProduct(newProduct: ProductApiItem) {
        try {
            const saved = await addProduct(newProduct);
            dispatch(addProductToStore(saved));
            setEditingProduct(null);
            setShowAddProduct(false);
            showToast('Product added successfully!', 'success');
        } catch (err) {
            console.error('Failed to create product', err);
            showToast('Failed to create product. Please try again.', 'error');
        }
    }

    async function handleUpdateProduct(updatedProduct: ProductApiItem) {
        try {
            const saved = await updateProduct(updatedProduct);
            const idToName = new Map<string, string>();
            for (const p of products) {
                const c = p.category;
                if (c && typeof c === 'object' && '_id' in c && 'name' in c)
                    idToName.set((c as { _id: string })._id, (c as { name: string }).name);
            }
            const categoryForDisplay =
                typeof saved.category === 'string' && saved.category
                    ? { _id: saved.category, name: idToName.get(saved.category) ?? saved.category }
                    : saved.category;
            const merged = { ...saved, category: categoryForDisplay };
            dispatch(updateProductInStore(merged));
            setEditingProduct(null);
            setShowAddProduct(false);
            showToast('Product updated successfully!', 'success');
        } catch (err) {
            console.error('Failed to update product', err);
            showToast('Failed to update product. Please try again.', 'error');
        }
    }

    async function handleDeleteProduct(id: string) {
        const confirmed = window.confirm('Are you sure you want to delete this product? This action cannot be undone.');
        if (!confirmed) return;
        try {
            await deleteProduct(id);
            dispatch(removeProduct(id));
            showToast('Product deleted successfully!', 'delete');
        } catch (err) {
            console.error('Failed to delete product', err);
            showToast('Failed to delete product. Please try again.', 'error');
        }
    }

    async function handleSyncShopify() {
        setSyncLoading(true);
        try {
            await syncShopify();
            const data = await loadProducts();
            dispatch(setProducts(data));
            showToast('Shopify products synced successfully!', 'success');
        } catch (err) {
            console.error('Failed to sync Shopify', err);
            showToast('Failed to sync Shopify. Please try again.', 'error');
        } finally {
            setSyncLoading(false);
        }
    }

    function openEditProduct(productId: string) {
        const p = products.find((x) => x._id === productId);
        if (p) {
            setEditingProduct(p);
            setShowAddProduct(true);
        }
    }

    return (
        <section className="products-page">
            <ToastContainer toasts={toasts} />
            <div className="card products-tabs-card">
                <div className="products-tabs-row">
                    {(['category', 'products'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            className={activeTab === tab ? 'products-tab products-tab--active' : 'products-tab'}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'category' ? 'Category' : 'Products'}
                        </button>
                    ))}
                </div>

                {activeTab === 'category' && <Categories />}

                {activeTab === 'products' && (
                    <>
            <div className="products-toolbar">
                <div className="products-toolbar-title">Products</div>
                <div className="products-toolbar-row">
                    <div className="products-toolbar-filters">
                        <CategoryFilter
                            label="Category"
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            options={categoryOptions}
                        />
                    </div>
                    <div className="products-toolbar-spacer" />
                    <div className="products-toolbar-search-add">
                        <input
                            className="input products-toolbar-search"
                            placeholder="Search products"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            className="button products-toolbar-add-btn"
                            onClick={() => {
                                setEditingProduct(null);
                                setShowAddProduct(true);
                            }}
                        >
                            Add Product
                        </button>
                        <button
                            type="button"
                            className="button products-toolbar-sync-btn"
                            onClick={handleSyncShopify}
                            disabled={syncLoading}
                        >
                            {syncLoading ? 'Syncing…' : 'Sync Shopify'}
                        </button>
                    </div>
                </div>

                <div className="products-metrics-row">
                    <ModernMetricItem icon="📦" label="Total Products" value={metrics.total.toLocaleString()} iconClass="products-metric-icon--green" isLast={false} isEven={false} />
                    <ModernMetricItem icon="💰" label="Avg Price" value={formatCurrency(metrics.avgPrice)} iconClass="products-metric-icon--blue" isLast={false} isEven={true} />
                    <ModernMetricItem icon="📉" label="Min Price" value={formatCurrency(metrics.minPrice)} iconClass="products-metric-icon--amber" isLast={false} isEven={false} />
                    <ModernMetricItem icon="📈" label="Max Price" value={formatCurrency(metrics.maxPrice)} iconClass="products-metric-icon--red" isLast={false} isEven={true} />
                    <ModernMetricItem icon="🏷️" label="Categories" value={metrics.categories.toString()} iconClass="products-metric-icon--violet" isLast={false} isEven={false} />
                    <ModernMetricItem icon="📦" label="Avg Stock" value={metrics.avgStock.toLocaleString()} iconClass="products-metric-icon--cyan" isLast={true} isEven={true} />
                </div>
            </div>

            <div className="card products-table-card">
                <div className="products-count-bar">
                    {loading ? 'Loading…' : `Showing ${groupedByProduct.length} products (${filteredRows.length} variants)`}
                </div>
                {loading ? (
                    <div className="products-table-loading">
                        <Spinner overlay message="Loading products…" />
                    </div>
                ) : (
                <div className="table-scroll-wrapper">
                    <table className="products-table">
                        <colgroup>
                            <col className="products-col-name" />
                            <col className="products-col-category" />
                            <col className="products-col-variant" />
                            <col className="products-col-price" />
                            <col className="products-col-actual" />
                            <col className="products-col-shopify" />
                            <col className="products-col-actions" />
                        </colgroup>
                        <thead>
                            <tr className="products-thead-row">
                                <Th>Name</Th>
                                <Th>Category</Th>
                                <Th>Variant</Th>
                                <Th>Price</Th>
                                <Th>Actual Price</Th>
                                <Th>Shopify</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedByProduct.map((group) => (
                                <Fragment key={group.productId}>
                                    {group.rows.map((row, idx) => (
                                        <tr key={`${row.productId}-${row.variantIndex}-${idx}`} className="products-tbody-row">
                                            {idx === 0 ? (
                                                <>
                                                    <td rowSpan={group.rows.length} className="products-td products-td--name">
                                                        {group.productName}
                                                    </td>
                                                    <td rowSpan={group.rows.length} className="products-td">
                                                        <span className="tag products-tag products-tag--category">
                                                            {group.categoryName || '—'}
                                                        </span>
                                                    </td>
                                                </>
                                            ) : null}
                                            <Td>{row.variantName}</Td>
                                            <Td>{formatCurrency(row.price)}</Td>
                                            <Td>{row.actualPrice != null ? formatCurrency(row.actualPrice) : '—'}</Td>
                                            {idx === 0 ? (
                                                <td rowSpan={group.rows.length} className="products-td">
                                                    <span className={`tag products-tag ${group.rows[0]?.isShopify ? 'products-tag--shopify' : 'products-tag--no'}`}>
                                                        {group.rows[0]?.isShopify ? 'Shopify' : 'No'}
                                                    </span>
                                                </td>
                                            ) : null}
                                            {idx === 0 ? (
                                                <td rowSpan={group.rows.length} className="products-td">
                                                    <div className="products-actions-cell">
                                                        <button
                                                            type="button"
                                                            className="icon-btn"
                                                            onClick={() => openEditProduct(row.productId)}
                                                        >
                                                            Edit
                                                        </button>
                                                        {!group.rows[0]?.isShopify && (
                                                            <button
                                                                type="button"
                                                                className="icon-btn icon-btn--danger"
                                                                onClick={() => handleDeleteProduct(row.productId)}
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            ) : null}
                                        </tr>
                                    ))}
                                </Fragment>
                            ))}
                            {groupedByProduct.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="products-empty-cell">
                                        No products found
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
                )}
            </div>
                    </>
                )}
            </div>

            {showAddProduct ? (
                <ProductModal
                    mode={editingProduct ? 'edit' : 'add'}
                    initialProduct={editingProduct}
                    categories={categoryOptionsWithId}
                    restrictToActualPriceOnly={editingProduct?.isShopify === true}
                    onClose={() => {
                        setShowAddProduct(false);
                        setEditingProduct(null);
                    }}
                    onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
                />
            ) : null}
        </section>
    );
}

function Th({ children }: { children: string }) {
    return <th className="products-th">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
    return <td className={className ? `products-td ${className}` : 'products-td'}>{children}</td>;
}

function CategoryFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (val: string) => void; options: string[] }) {
    return (
        <div className="products-filter">
            <label className="label products-filter-label">{label}</label>
            <select
                className="input products-filter-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">All</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function ModernMetricItem({ icon, label, value, iconClass, isLast, isEven }: { icon: string; label: string; value: string; iconClass: string; isLast: boolean; isEven: boolean }) {
    return (
        <div className={`products-metric-item ${isLast ? 'products-metric-item--last' : ''} ${isEven ? 'products-metric-item--even' : ''}`}>
            <div className="products-metric-item__head">
                <span className={`products-metric-item__icon ${iconClass}`}>{icon}</span>
                <div className="products-metric-item__label">{label}</div>
            </div>
            <div className="products-metric-item__value">{value}</div>
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div className="products-toast-container">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast products-toast"
                    data-type={toast.type}
                >
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

