import { apiFetch } from '../api';
import type { ProductApiItem, ProductsApiResponse } from '../types/products';

export type { ProductApiItem } from '../types/products';
export type Product = ProductApiItem;

export type LoadProductsOptions = {
    page?: number;
    limit?: number;
};

export type ProductsPageResponse = {
    rows: ProductApiItem[];
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

/**
 * Load products from the backend API (GET /api/products).
 */
export async function loadProducts(): Promise<ProductApiItem[]> {
    const page = 1;
    const limit = 20;
    let response = await apiFetch(`/api/products?page=${page}&limit=${limit}`);
    if (response.status === 404) {
        response = await apiFetch(`/products?page=${page}&limit=${limit}`);
    }
    if (!response.ok) {
        throw new Error('Failed to load products from API');
    }
    const json: unknown = await response.json();
    if (Array.isArray(json)) {
        return json as ProductApiItem[];
    }
    if (json && typeof json === 'object') {
        const obj = json as { rows?: unknown; products?: unknown; data?: unknown };
        if (Array.isArray(obj.rows)) return obj.rows as ProductApiItem[];
        if (Array.isArray(obj.products)) return obj.products as ProductApiItem[];
        if (Array.isArray(obj.data)) return obj.data as ProductApiItem[];
    }
    return [];
}

/**
 * Load paginated products from the backend API (GET /api/products?page=&limit=).
 */
export async function loadProductsPage(options: LoadProductsOptions = {}): Promise<ProductsPageResponse> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(500, options.limit ?? 20));
    let response = await apiFetch(`/api/products?page=${page}&limit=${limit}`);
    if (response.status === 404) {
        response = await apiFetch(`/products?page=${page}&limit=${limit}`);
    }
    if (!response.ok) {
        throw new Error('Failed to load products from API');
    }
    const json: unknown = await response.json();
    if (json && typeof json === 'object') {
        const obj = json as Partial<ProductsApiResponse> & {
            products?: unknown;
            data?: unknown;
        };
        const rows = Array.isArray(obj.rows)
            ? (obj.rows as ProductApiItem[])
            : Array.isArray(obj.products)
            ? (obj.products as ProductApiItem[])
            : Array.isArray(obj.data)
            ? (obj.data as ProductApiItem[])
            : [];
        const safeTotal = typeof obj.total === 'number' ? obj.total : rows.length;
        const safeCount = typeof obj.count === 'number' ? obj.count : rows.length;
        const safeLimit = typeof obj.limit === 'number' ? obj.limit : limit;
        const safePage = typeof obj.page === 'number' ? obj.page : page;
        const safeTotalPages =
            typeof obj.totalPages === 'number'
                ? obj.totalPages
                : Math.max(1, Math.ceil((safeTotal || 0) / Math.max(1, safeLimit)));
        return {
            rows,
            count: safeCount,
            total: safeTotal,
            page: safePage,
            limit: safeLimit,
            totalPages: safeTotalPages,
        };
    }
    if (Array.isArray(json)) {
        const rows = json as ProductApiItem[];
        return {
            rows,
            count: rows.length,
            total: rows.length,
            page,
            limit,
            totalPages: 1,
        };
    }
    return {
        rows: [],
        count: 0,
        total: 0,
        page,
        limit,
        totalPages: 1,
    };
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

