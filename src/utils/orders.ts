import { apiFetch } from '../api';

export type PaymentStatus = 'COD' | 'PAID';
export type FulfillmentStatus = 'Unfulfilled' | 'Fulfilled' | 'Partial';
export type DeliveryStatus = 'In Transit' | 'Delivered' | 'RTO' | 'Pending Pickup';
export type Platform = 'Shopify' | 'Abandoned' | 'Whatsapp' | 'Amazon' | 'Flipkart' | 'Calling';
export type OrderType = 'New' | 'Repeat' | 'Reference';

export type OrderItem = { variant: string; quantity: number; lineAmount: number };

export type Order = {
    id: string;
    date: string; // ISO date
    customer: string;
    customerPhone: string;
    customerAddress: string;
    items: OrderItem[];
    is_shipped: boolean;
    amount: number;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
    deliveryStatus: DeliveryStatus;
    pincode?: string;
    shippingAmount?: number; // Deprecated: use shippingCharges instead
    codCharges?: number;
    shippingCharges?: number;
    discountAmount?: number;
    awbNumber?: string;
    notes?: string;
    /** Partial payment / partial amount (Shopify order flow). */
    partialAmount?: number;
    state: string;
    /**
     * Optional metadata for who added the order.
     * Accepts either `addedBy` or `added_by` from the backend.
     */
    addedBy?: string;
    platform?: Platform;
    type?: OrderType;
    /**
     * Optional shipping tracking metadata from the backend (Shopify-style orders).
     * These come from `shippingDetails.trackingUrl` and `shippingDetails.trackingCompany`.
     */
    shippingTrackingUrl?: string;
    shippingTrackingCompany?: string;
};

/**
 * Load orders from the backend API, which reads from orders.json on disk.
 */
export async function loadOrders(): Promise<Order[]> {
    const response = await apiFetch('/api/orders');
    if (!response.ok) {
        throw new Error('Failed to load orders from API');
    }
    const raw = (await response.json()) as any[];
    return raw.map((o) => ({
        ...o,
        // Normalise possible backend shapes
        addedBy: (o.addedBy ?? o.added_by) ?? undefined,
        is_shipped: Boolean((o as { is_shipped?: boolean }).is_shipped),
    })) as Order[];
}

/**
 * Add a new order via the backend API so it is appended to orders.json on disk.
 */
export async function addOrder(order: Order): Promise<Order> {
    const response = await apiFetch('/api/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
    });

    if (!response.ok) {
        throw new Error('Failed to save order');
    }

    return (await response.json()) as Order;
}

/**
 * Update an existing order via the backend API.
 */
export async function updateOrder(order: Order): Promise<Order> {
    const response = await apiFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
    });

    if (!response.ok) {
        throw new Error('Failed to update order');
    }

    return (await response.json()) as Order;
}

/**
 * Delete an order via the backend API.
 */
export async function deleteOrder(id: string): Promise<void> {
    const response = await apiFetch(`/api/orders/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete order');
    }
}
