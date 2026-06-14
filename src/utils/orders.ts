import { apiFetch } from '../api';

export type PaymentStatus = 'COD' | 'PAID';
export type FulfillmentStatus = 'Unfulfilled' | 'Fulfilled' | 'Partial';

/** Shipping / tracking status as stored in API (`shippingDetails.trackingStatus`). */
export type DeliveryStatus = 'in_transit' | 'delivered' | 'rto' | 'pending_pickup';

export const DELIVERY_STATUSES: DeliveryStatus[] = ['pending_pickup', 'in_transit', 'delivered', 'rto'];

const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
    in_transit: 'In Transit',
    delivered: 'Delivered',
    rto: 'RTO',
    pending_pickup: 'Pending Pickup',
};

/** Human-readable label for UI (dropdowns, tags, tables). */
export function deliveryStatusLabel(status: string | undefined, returnStatus?: boolean): string {
    const n = normalizeDeliveryStatus(status, returnStatus);
    return DELIVERY_LABELS[n] ?? (status || '—');
}

/** Normalize API or legacy display strings to canonical `DeliveryStatus`. */
export function normalizeDeliveryStatus(input: string | undefined, returnStatus?: boolean): DeliveryStatus {
    if (returnStatus === true) return 'rto';
    const raw = String(input ?? '').trim();
    const s = raw.toLowerCase().replace(/\s+/g, ' ');
    if (s === 'in_transit' || s === 'in-transit' || s === 'in transit') return 'in_transit';
    if (s === 'delivered') return 'delivered';
    if (s === 'rto') return 'rto';
    if (s === 'pending_pickup' || s === 'pending pickup') return 'pending_pickup';
    return 'pending_pickup';
}
export type Platform = 'Shopify' | 'Abandoned' | 'Whatsapp' | 'Amazon' | 'Flipkart' | 'Calling' | 'Collaboration';
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
    /** Local calendar date YYYY-MM-DD; API `pickedUpDate` (shown DD-MMM-YYYY in UI). */
    pickedUpDate?: string;
    /** Local calendar date YYYY-MM-DD; API `deliveredAt`. */
    deliveredAt?: string;
    /** Local calendar date YYYY-MM-DD; API `returnedAt`. */
    returnedAt?: string;
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
        deliveryStatus: normalizeDeliveryStatus(
            (o as { deliveryStatus?: string }).deliveryStatus,
            Boolean((o as { returnStatus?: boolean }).returnStatus),
        ) as DeliveryStatus,
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
