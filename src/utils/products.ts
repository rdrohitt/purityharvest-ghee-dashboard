import { apiFetch } from '../api';
import type { ProductApiItem } from '../types/products';

export type { ProductApiItem } from '../types/products';
export type Product = ProductApiItem;

/**
 * Load products from the backend API (GET /api/products).
 */
export async function loadProducts(): Promise<ProductApiItem[]> {
    const response = await apiFetch('/api/products');
    if (!response.ok) {
        throw new Error('Failed to load products from API');
    }
    return (await response.json()) as ProductApiItem[];
}

/**
 * Add a new product via the backend API (POST /api/products).
 */
export async function addProduct(product: ProductApiItem): Promise<ProductApiItem> {
    const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
    });

    if (!response.ok) {
        throw new Error('Failed to save product');
    }

    return (await response.json()) as ProductApiItem;
}

/**
 * Normalize category to only _id (string) for API payload - do not send full object.
 */
function categoryToId(category: ProductApiItem['category']): string | null {
    if (category == null) return null;
    if (typeof category === 'string') return category;
    return (category as { _id?: string })._id ?? null;
}

/**
 * Update an existing product via the backend API (PUT /api/products/:id).
 * Sends category as only the id string, not the full object.
 */
export async function updateProduct(product: ProductApiItem): Promise<ProductApiItem> {
    const payload = {
        ...product,
        category: categoryToId(product.category),
    };
    const response = await apiFetch(`/api/products/${encodeURIComponent(product._id)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error('Failed to update product');
    }

    return (await response.json()) as ProductApiItem;
}

/**
 * Sync products from Shopify (POST /api/products/sync-shopify).
 */
export async function syncShopify(): Promise<void> {
    const response = await apiFetch('/api/products/sync-shopify', {
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error('Failed to sync Shopify products');
    }
}

/**
 * Delete a product via the backend API (DELETE /api/products/:id).
 */
export async function deleteProduct(id: string): Promise<void> {
    const response = await apiFetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete product (status ${response.status})`);
    }
}

