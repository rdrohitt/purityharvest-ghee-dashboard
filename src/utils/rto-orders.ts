import { apiFetch } from '../api';
import type { ShopifyOrderApi } from '../types/shopify';
import { buildShopifyOrderPayloadFromForm, shopifyOrderToOrder } from './shopify-orders';

export interface RtoOrdersResponse {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    orders: ShopifyOrderApi[];
}

export type FetchRtoOrdersParams = {
    from: string;
    to: string;
    page?: number;
    limit?: number;
};

export async function fetchRtoOrders({
    from,
    to,
    page = 1,
    limit = 100,
}: FetchRtoOrdersParams): Promise<RtoOrdersResponse> {
    const params = new URLSearchParams({
        from,
        to,
        page: String(page),
        limit: String(limit),
    });
    const response = await apiFetch(`/api/orders/rto?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to load RTO orders');
    }
    const json = (await response.json()) as unknown;
    if (json && typeof json === 'object') {
        const obj = json as Partial<RtoOrdersResponse>;
        const orders = Array.isArray(obj.orders) ? obj.orders : [];
        return {
            count: typeof obj.count === 'number' ? obj.count : orders.length,
            total: typeof obj.total === 'number' ? obj.total : orders.length,
            page: typeof obj.page === 'number' ? obj.page : page,
            limit: typeof obj.limit === 'number' ? obj.limit : limit,
            totalPages: typeof obj.totalPages === 'number' ? obj.totalPages : 1,
            orders,
        };
    }
    return {
        count: 0,
        total: 0,
        page,
        limit,
        totalPages: 1,
        orders: [],
    };
}

export async function updateRtoOrderFields(
    order: ShopifyOrderApi,
    condition: string,
    remarks: string,
): Promise<ShopifyOrderApi> {
    // Keep payload generation aligned with edit PUT flow (no extra GET).
    const basePayload = buildShopifyOrderPayloadFromForm(order, shopifyOrderToOrder(order));
    const normalizedProducts = (basePayload.products || []).map((p, index) => {
        const rawProductId = p.productId;
        const productId =
            typeof rawProductId === 'string'
                ? rawProductId.trim()
                : rawProductId && typeof rawProductId === 'object'
                ? String((rawProductId as { _id?: string })._id ?? '').trim()
                : '';
        if (productId) {
            return { ...p, productId };
        }
        const fallbackRaw = order.products?.[index]?.productId;
        const fallbackProductId =
            typeof fallbackRaw === 'string'
                ? fallbackRaw.trim()
                : fallbackRaw && typeof fallbackRaw === 'object'
                ? String((fallbackRaw as { _id?: string })._id ?? '').trim()
                : '';
        return { ...p, productId: fallbackProductId };
    });
    const payload: ShopifyOrderApi = {
        ...basePayload,
        products: normalizedProducts,
        condition,
        remarks,
    };

    const response = await apiFetch(`/api/orders/${encodeURIComponent(order._id)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error('Failed to update RTO order');
    }

    const json = (await response.json()) as unknown;
    if (!json || typeof json !== 'object') {
        throw new Error('Invalid RTO order response after update');
    }

    return json as ShopifyOrderApi;
}
