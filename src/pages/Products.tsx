import { useState, useMemo, useEffect } from 'react';
import { loadProducts, addProduct, updateProduct, deleteProduct, type Product } from '../utils/products';

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const CATEGORY_OPTIONS: string[] = ['Ghee', 'Oils', 'Dry Fruits'];

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        let cancelled = false;
        loadProducts()
            .then((data) => {
                if (cancelled) return;
                setProducts(data);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const filtered = useMemo(() => {
        if (!searchQuery) return products;
        const query = searchQuery.toLowerCase();
        const byText = products.filter(p => 
            p.id.toLowerCase().includes(query) ||
            p.name.toLowerCase().includes(query) ||
            p.size.toLowerCase().includes(query) ||
            (p as any).category?.toLowerCase().includes(query)
        );
        return byText.filter(p => !categoryFilter || (p as any).category === categoryFilter);
    }, [products, searchQuery, categoryFilter]);

    const metrics = useMemo(() => {
        const total = filtered.length;
        const prices = filtered.map(p => p.price);
        const avgPrice = total ? Math.round(prices.reduce((a,b)=>a+b,0)/total) : 0;
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const avgWeight = total ? Math.round(filtered.reduce((a,b)=> a + b.weight, 0)/total) : 0;
        const categorySet = new Set<string>(filtered.map(p => (p as any).category || ''));
        const categories = [...categorySet].filter(Boolean).length;
        return { total, avgPrice, minPrice, maxPrice, avgWeight, categories };
    }, [filtered]);

    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }

    async function handleCreateProduct(newProduct: Product) {
        try {
            // Persist to backend first so products.json is updated
            const saved = await addProduct(newProduct);

            setProducts((prev) => [saved, ...prev]);
            setEditingProduct(null);
            setShowAddProduct(false);
            showToast('Product added successfully!', 'success');
        } catch (err) {
            console.error('Failed to create product', err);
            showToast('Failed to create product. Please check that the server is running and try again.', 'error');
        }
    }

    async function handleUpdateProduct(updatedProduct: Product) {
        try {
            const saved = await updateProduct(updatedProduct);

            setProducts((prev) =>
                prev.map((p) => (p.id === saved.id ? saved : p))
            );
            setEditingProduct(null);
            setShowAddProduct(false);
            showToast('Product updated successfully!', 'success');
        } catch (err) {
            console.error('Failed to update product', err);
            showToast('Failed to update product. Please check that the server is running and try again.', 'error');
        }
    }

    async function handleDeleteProduct(id: string) {
        const confirmed = window.confirm('Are you sure you want to delete this product? This action cannot be undone.');
        if (!confirmed) return;

        try {
            await deleteProduct(id);
            setProducts((prev) => prev.filter((p) => p.id !== id));
            showToast('Product deleted successfully!', 'delete');
        } catch (err) {
            console.error('Failed to delete product', err);
            showToast('Failed to delete product. Please check that the server is running and try again.', 'error');
        }
    }

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden', position: 'relative' }}>
            <ToastContainer toasts={toasts} />
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>Products</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <CategoryFilter
                            label="Category"
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            options={CATEGORY_OPTIONS}
                        />
                    </div>
                    <div style={{ flex: 1 }} />
                    <input
                        className="input"
                        placeholder="Search products"
                        style={{ width: 240 }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="button"
                        style={{ width: 'auto', padding: '0 16px' }}
                        onClick={() => {
                            setEditingProduct(null);
                            setShowAddProduct(true);
                        }}
                    >
                        Add Product
                    </button>
                </div>
                <div style={{ width: '100%', color: 'var(--muted)', fontSize: 14 }}>
                    {loading ? 'Loading products…' : `Showing ${filtered.length} products`}
                </div>

                <div style={{ 
                    width: '100%', 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 12,
                    padding: '12px 0',
                    borderTop: '1px solid var(--border)',
                    marginTop: 8,
                    background: 'var(--bg)'
                }}>
                    <MetricItem label="Total Products" value={metrics.total.toLocaleString()} isLast={false} />
                    <MetricItem label="Avg Price" value={formatCurrency(metrics.avgPrice)} isLast={false} />
                    <MetricItem label="Min Price" value={formatCurrency(metrics.minPrice)} isLast={false} />
                    <MetricItem label="Max Price" value={formatCurrency(metrics.maxPrice)} isLast={false} />
                    <MetricItem label="Categories" value={metrics.categories.toString()} isLast={false} />
                    <MetricItem label="Avg Weight" value={`${metrics.avgWeight} g`} isLast={true} />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '250px', minWidth: '250px' }} />
                            <col style={{ width: '160px', minWidth: '160px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Product ID</Th>
                                <Th>Name</Th>
                                <Th>Category</Th>
                                <Th>Size</Th>
                                <Th>Price</Th>
                                <Th>Dimension (H × W × L)</Th>
                                <Th>Weight</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <Td>{p.id}</Td>
                                    <Td style={{ fontWeight: 600 }}>{p.name}</Td>
                                    <Td>{(p as any).category || '-'}</Td>
                                    <Td>{p.size}</Td>
                                    <Td>{formatCurrency(p.price)}</Td>
                                    <Td>{p.dimension.height} × {p.dimension.width} × {p.dimension.length} cm</Td>
                                    <Td>{p.weight} g</Td>
                                    <Td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                type="button"
                                                className="icon-btn"
                                                onClick={() => {
                                                    setEditingProduct(p);
                                                    setShowAddProduct(true);
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-btn icon-btn--danger"
                                                onClick={() => handleDeleteProduct(p.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </Td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        No products found
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddProduct ? (
                <AddProductModal
                    mode={editingProduct ? 'edit' : 'add'}
                    initialProduct={editingProduct}
                    onClose={() => {
                        setShowAddProduct(false);
                        setEditingProduct(null);
                    }}
                    onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
                    categories={CATEGORY_OPTIONS}
                />
            ) : null}
        </section>
    );
}

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td style={{ padding: '12px', ...style }}>{children}</td>;
}

function CategoryFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (val: string) => void; options: string[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
            <select
                className="input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ height: 32, minWidth: 160, cursor: 'pointer', fontSize: 13 }}
            >
                <option value="">All</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function MetricItem({ label, value, isLast }: { label: string; value: string; isLast: boolean }) {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8
        }}>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                lineHeight: 1.2
            }}>
                {label}
            </div>
            <div style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: 'var(--text)',
                lineHeight: 1.2
            }}>
                {value}
            </div>
        </div>
    );
}

function AddProductModal({
    mode,
    initialProduct,
    onClose,
    onSubmit,
    categories,
}: {
    mode: 'add' | 'edit';
    initialProduct: Product | null;
    onClose: () => void;
    onSubmit: (product: Product) => void;
    categories: string[];
}) {
    const [name, setName] = useState('');
    const [size, setSize] = useState('');
    const [category, setCategory] = useState('');
    const [price, setPrice] = useState<string>('');
    const [height, setHeight] = useState<string>('');
    const [width, setWidth] = useState<string>('');
    const [length, setLength] = useState<string>('');
    const [weight, setWeight] = useState<string>('');

    useEffect(() => {
        if (initialProduct) {
            setName(initialProduct.name);
            setSize(initialProduct.size);
            setCategory((initialProduct as any).category || '');
            setPrice(String(initialProduct.price ?? ''));
            setHeight(String(initialProduct.dimension?.height ?? ''));
            setWidth(String(initialProduct.dimension?.width ?? ''));
            setLength(String(initialProduct.dimension?.length ?? ''));
            setWeight(String(initialProduct.weight ?? ''));
        } else {
            setName('');
            setSize('');
            setCategory('');
            setPrice('');
            setHeight('');
            setWidth('');
            setLength('');
            setWeight('');
        }
    }, [initialProduct, mode]);

    function submit(e: React.FormEvent) {
        e.preventDefault();

        const base = {
            name,
            category,
            size,
            price: parseFloat(price) || 0,
            dimension: {
                height: parseFloat(height) || 0,
                width: parseFloat(width) || 0,
                length: parseFloat(length) || 0,
            },
            weight: parseFloat(weight) || 0,
        };

        const product: Product =
            mode === 'edit' && initialProduct
                ? { ...base, id: initialProduct.id }
                : { ...base, id: '' as string };

        onSubmit(product);
    }

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 60 }}
        >
            <div
                className="card"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 720, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>{mode === 'edit' ? 'Edit Product' : 'Add Product'}</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={submit} style={{ display: 'grid', gap: 20, padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="label">Product Name</label>
                            <input
                                className="input"
                                style={{ width: '100%', marginTop: 6 }}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter product name"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Category</label>
                            <select
                                className="input"
                                style={{ width: '100%', marginTop: 6 }}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                required
                            >
                                <option value="">Select category</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Size</label>
                            <input
                                className="input"
                                style={{ width: '100%', marginTop: 6 }}
                                value={size}
                                onChange={(e) => setSize(e.target.value)}
                                placeholder="e.g., 500ml, 1L"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Price (₹)</label>
                            <input
                                className="input"
                                style={{ width: '100%', marginTop: 6 }}
                                type="number"
                                min={0}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label" style={{ marginBottom: 8, display: 'block' }}>Dimensions</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                            <div>
                                <label className="label" style={{ fontSize: 12 }}>Height (cm)</label>
                                <input
                                    className="input"
                                    style={{ width: '100%', marginTop: 6 }}
                                    type="number"
                                    min={0}
                                    value={height}
                                    onChange={(e) => setHeight(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label" style={{ fontSize: 12 }}>Width (cm)</label>
                                <input
                                    className="input"
                                    style={{ width: '100%', marginTop: 6 }}
                                    type="number"
                                    min={0}
                                    value={width}
                                    onChange={(e) => setWidth(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label" style={{ fontSize: 12 }}>Length (cm)</label>
                                <input
                                    className="input"
                                    style={{ width: '100%', marginTop: 6 }}
                                    type="number"
                                    min={0}
                                    value={length}
                                    onChange={(e) => setLength(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="label">Weight (g)</label>
                        <input
                            className="input"
                            style={{ width: '100%', marginTop: 6 }}
                            type="number"
                            min={0}
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <button type="button" className="icon-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="button" style={{ width: 'auto', padding: '0 16px' }}>
                            {mode === 'edit' ? 'Save Changes' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast"
                    style={{
                        pointerEvents: 'auto',
                        animation: 'slideInRight 0.3s ease-out',
                    }}
                    data-type={toast.type}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

