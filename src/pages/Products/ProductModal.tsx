import { useState, useEffect } from 'react';
import { Spinner } from '../../components/Spinner';
import type { ProductApiItem } from '../../types/products';
import './Products.scss';

export type VariantFormRow = { name: string; price: string; actualPrice: string; stock: string };

export type ProductModalProps = {
    mode: 'add' | 'edit';
    initialProduct: ProductApiItem | null;
    categories: { _id: string; name: string }[];
    restrictToActualPriceOnly?: boolean;
    onClose: () => void;
    onSubmit: (product: ProductApiItem) => void | Promise<void>;
};

export function ProductModal({
    mode,
    initialProduct,
    categories,
    restrictToActualPriceOnly,
    onClose,
    onSubmit,
}: ProductModalProps) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [variants, setVariants] = useState<VariantFormRow[]>([{ name: '', price: '', actualPrice: '', stock: '0' }]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (initialProduct) {
            setName(initialProduct.name);
            const cat = initialProduct.category;
            const id = cat && typeof cat === 'object' && '_id' in cat ? (cat as { _id: string })._id : '';
            setCategoryId(id || '');
            const v = initialProduct.variants?.length
                ? initialProduct.variants.map((x) => ({
                    name: x.name,
                    price: String(x.price),
                    actualPrice: x.actualPrice != null ? String(x.actualPrice) : '',
                    stock: String(x.stock),
                }))
                : [{ name: '', price: '', actualPrice: '', stock: '0' }];
            setVariants(v);
        } else {
            setName('');
            setCategoryId('');
            setVariants([{ name: '', price: '', actualPrice: '', stock: '0' }]);
        }
    }, [initialProduct, mode]);

    function addVariant() {
        setVariants((prev) => [...prev, { name: '', price: '', actualPrice: '', stock: '0' }]);
    }

    function removeVariant(i: number) {
        if (variants.length <= 1) return;
        setVariants((prev) => prev.filter((_, idx) => idx !== i));
    }

    function updateVariant(i: number, field: keyof VariantFormRow, value: string) {
        setVariants((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            if (restrictToActualPriceOnly && initialProduct) {
                const cat = initialProduct.category;
                const categoryIdOnly = typeof cat === 'object' && cat !== null && cat._id ? cat._id : (typeof cat === 'string' ? cat : null);
                const product: ProductApiItem = {
                    ...initialProduct,
                    category: categoryIdOnly,
                    variants: initialProduct.variants.map((v, i) => ({
                        ...v,
                        actualPrice: variants[i]?.actualPrice === '' ? null : (parseFloat(variants[i]?.actualPrice ?? '') || null),
                    })),
                };
                const firstActual = product.variants[0]?.actualPrice ?? null;
                product.actualPrice = firstActual;
                await Promise.resolve(onSubmit(product));
                return;
            }
            const variantList = variants
                .filter((v) => v.name.trim())
                .map((v) => ({
                    name: v.name.trim(),
                    price: parseFloat(v.price) || 0,
                    actualPrice: v.actualPrice === '' ? null : (parseFloat(v.actualPrice) || null),
                    stock: parseInt(v.stock, 10) || 0,
                }));
            const firstPrice = variantList[0]?.price ?? 0;
            const firstActual = variantList[0]?.actualPrice ?? null;
            const product: ProductApiItem = {
                _id: mode === 'edit' && initialProduct ? initialProduct._id : '',
                name: name.trim(),
                price: firstPrice,
                actualPrice: firstActual,
                category: categoryId || null,
                variants: variantList,
            };
            if (mode === 'edit' && initialProduct) {
                (product as any).shopifyProductId = initialProduct.shopifyProductId;
                (product as any).isShopify = initialProduct.isShopify;
                (product as any).createdAt = initialProduct.createdAt;
                (product as any).updatedAt = initialProduct.updatedAt;
            }
            await Promise.resolve(onSubmit(product));
        } finally {
            setSubmitting(false);
        }
    }

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div role="dialog" aria-modal="true" className="products-add-modal-backdrop" onClick={onClose}>
            <div className="card products-add-modal" onClick={(e) => e.stopPropagation()}>
                <div className="products-add-modal-header">
                    <h3 className="products-add-modal-title">
                        {restrictToActualPriceOnly ? 'Edit Actual Price (Shopify)' : mode === 'edit' ? 'Edit Product' : 'Add Product'}
                    </h3>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={submit} className="products-add-modal-form">
                    <div className="products-add-modal-grid">
                        <div className="products-add-modal-grid-full">
                            <label className="label">Product Name</label>
                            <input
                                className="input products-add-modal-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter product name"
                                required
                                readOnly={restrictToActualPriceOnly}
                                disabled={restrictToActualPriceOnly}
                            />
                        </div>
                        <div>
                            <label className="label">Category</label>
                            <select
                                className="input products-add-modal-input"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                required
                                disabled={restrictToActualPriceOnly}
                            >
                                <option value="">Select category</option>
                                {categories.map((c) => (
                                    <option key={c._id} value={c._id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="products-add-modal-variants">
                        <div className="products-add-modal-variants-head">
                            <label className="label products-add-modal-dimensions-label">Variants</label>
                            {!restrictToActualPriceOnly && (
                                <button type="button" className="icon-btn" onClick={addVariant}>
                                    Add variant
                                </button>
                            )}
                        </div>
                        <div className="products-add-modal-variants-table-wrap">
                            <table className="products-add-modal-variants-table">
                                <thead>
                                    <tr>
                                        <th className="products-add-modal-variants-th">Variant name</th>
                                        <th className="products-add-modal-variants-th">Price (₹)</th>
                                        <th className="products-add-modal-variants-th">Actual (₹)</th>
                                        <th className="products-add-modal-variants-th">Stock</th>
                                        {!restrictToActualPriceOnly && <th className="products-add-modal-variants-th">Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((row, i) => (
                                        <tr key={i}>
                                            <td>
                                                <input
                                                    className="input products-add-modal-input"
                                                    value={row.name}
                                                    onChange={(e) => updateVariant(i, 'name', e.target.value)}
                                                    placeholder="e.g. 500 ml, 1 Ltr"
                                                    readOnly={restrictToActualPriceOnly}
                                                    disabled={restrictToActualPriceOnly}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="input products-add-modal-input"
                                                    type="number"
                                                    min={0}
                                                    value={row.price}
                                                    onChange={(e) => updateVariant(i, 'price', e.target.value)}
                                                    readOnly={restrictToActualPriceOnly}
                                                    disabled={restrictToActualPriceOnly}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="input products-add-modal-input"
                                                    type="number"
                                                    min={0}
                                                    value={row.actualPrice}
                                                    onChange={(e) => updateVariant(i, 'actualPrice', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="input products-add-modal-input"
                                                    type="number"
                                                    min={0}
                                                    value={row.stock}
                                                    onChange={(e) => updateVariant(i, 'stock', e.target.value)}
                                                    readOnly={restrictToActualPriceOnly}
                                                    disabled={restrictToActualPriceOnly}
                                                />
                                            </td>
                                            {!restrictToActualPriceOnly && (
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="icon-btn icon-btn--danger"
                                                        onClick={() => removeVariant(i)}
                                                        disabled={variants.length <= 1}
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="products-add-modal-actions">
                        <button type="button" className="icon-btn" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="button products-add-modal-submit-btn" disabled={submitting}>
                            {submitting ? (
                                <span className="products-add-modal-submit-content">
                                    <Spinner size="sm" />
                                    {mode === 'edit' ? 'Saving…' : 'Creating…'}
                                </span>
                            ) : (
                                mode === 'edit' ? 'Save Changes' : 'Create'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
