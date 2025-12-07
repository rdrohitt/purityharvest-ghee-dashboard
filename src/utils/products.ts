export type Product = {
    id: string;
    name: string;
    category: string;
    size: string;
    price: number;
    dimension: {
        height: number;
        width: number;
        length: number;
    };
    weight: number;
};

/**
 * Load products from the backend API, which reads from products.json on disk.
 */
export async function loadProducts(): Promise<Product[]> {
    const response = await fetch('/api/products');
    if (!response.ok) {
        throw new Error('Failed to load products from API');
    }
    return (await response.json()) as Product[];
}

/**
 * Add a new product via the backend API so it is appended to products.json on disk.
 */
export async function addProduct(product: Product): Promise<Product> {
    const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
    });

    if (!response.ok) {
        throw new Error('Failed to save product');
    }

    return (await response.json()) as Product;
}

/**
 * Update an existing product via the backend API so the change is written to products.json.
 */
export async function updateProduct(product: Product): Promise<Product> {
    const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
    });

    if (!response.ok) {
        throw new Error('Failed to update product');
    }

    return (await response.json()) as Product;
}

/**
 * Delete a product via the backend API so it is removed from products.json.
 */
export async function deleteProduct(id: string): Promise<void> {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete product (status ${response.status})`);
    }
}

