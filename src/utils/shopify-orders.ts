import { apiFetch } from '../api';
import type { ShopifyOrderApi, ShopifyOrderCustomer } from '../types/shopify';
import type { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, OrderType } from './orders';

/** Get customer name from order (from customer object or top-level customerName). */
export function getOrderCustomerName(o: ShopifyOrderApi): string {
    const c = o.customer;
    if (c && typeof c === 'object' && 'name' in c) return String((c as ShopifyOrderCustomer).name ?? '');
    return String(o.customerName ?? '');
}

/** Get customer phone from order (from customer object or top-level phoneNumber). */
export function getOrderCustomerPhone(o: ShopifyOrderApi): string {
    const c = o.customer;
    if (c && typeof c === 'object' && 'phoneNumber' in c) return String((c as ShopifyOrderCustomer).phoneNumber ?? '');
    return String(o.phoneNumber ?? '');
}

/** Get customer address from order (from customer object or top-level address). */
export function getOrderAddress(o: ShopifyOrderApi): string {
    const c = o.customer;
    if (c && typeof c === 'object' && 'address' in c) return String((c as ShopifyOrderCustomer).address ?? '');
    return String(o.address ?? '');
}

/**
 * Normalize a raw order from API to ShopifyOrderApi shape (handles id/_id, date/createdAt, etc.).
 */
function normalizeOrder(raw: unknown): ShopifyOrderApi | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const _id = String(o._id ?? o.id ?? o.shopifyOrderId ?? '');
    if (!_id) return null;
    const date = (o.date ?? o.createdAt ?? new Date().toISOString()) as string;
    const customer = o.customer;
    const cust = customer && typeof customer === 'object' ? (customer as Record<string, unknown>) : null;
    const customerName = String(o.customerName ?? cust?.name ?? '');
    const phoneNumber = String(o.phoneNumber ?? cust?.phoneNumber ?? '');
    const address = String(o.address ?? cust?.address ?? '');
    const state = String(o.state ?? cust?.state ?? '');
    const pincode = String(o.pincode ?? cust?.pincode ?? '');
    return {
        _id,
        shopifyOrderId: o.shopifyOrderId as string | undefined,
        customer: (customer as ShopifyOrderApi['customer']) ?? '',
        customerName: customerName || undefined,
        phoneNumber: phoneNumber || undefined,
        address: address || undefined,
        date,
        state,
        pincode,
        type: String(o.type ?? ''),
        products: Array.isArray(o.products) ? o.products as ShopifyOrderApi['products'] : [],
        platform: String(o.platform ?? ''),
        paymentMode: String(o.paymentMode ?? ''),
        fulfillmentStatus: String(o.fulfillmentStatus ?? ''),
        returnStatus: Boolean((o as any).returnStatus),
        codCharges: Number(o.codCharges) || 0,
        shippingCharges: Number(o.shippingCharges) || 0,
        discount: Number(o.discount) || 0,
        totalAmount: Number(o.totalAmount ?? o.amount) || 0,
        notes: String(o.notes ?? ''),
        shippingDetails: o.shippingDetails as ShopifyOrderApi['shippingDetails'],
        createdAt: o.createdAt as string | undefined,
        updatedAt: o.updatedAt as string | undefined,
    };
}

/**
 * Extract orders array from API response (handles array or wrapped shapes).
 */
function extractOrdersArray(json: unknown): unknown[] {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== 'object') return [];
    const obj = json as Record<string, unknown>;
    // Top-level keys
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.orders)) return obj.orders;
    if (Array.isArray(obj.result)) return obj.result;
    if (Array.isArray(obj.list)) return obj.list;
    if (Array.isArray(obj.items)) return obj.items;
    // Nested: data.orders, data.data, data.list, etc.
    const data = obj.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        if (Array.isArray(d.orders)) return d.orders;
        if (Array.isArray(d.data)) return d.data;
        if (Array.isArray(d.list)) return d.list;
        if (Array.isArray(d.items)) return d.items;
    }
    return [];
}

/**
 * Fetch a single order by id from GET /api/orders/:id (for edit modal with full details).
 */
export async function fetchOrderById(id: string): Promise<ShopifyOrderApi> {
    const response = await apiFetch(`/api/orders/${id}`);
    if (!response.ok) {
        throw new Error('Failed to load order');
    }
    const raw = (await response.json()) as unknown;
    const normalized = normalizeOrder(raw);
    if (!normalized) {
        throw new Error('Invalid order response');
    }
    return normalized;
}

/**
 * Map a single-order detail response to Order shape for the edit modal.
 * Uses product name + variant for items when productId is populated.
 */
export function orderDetailToOrder(o: ShopifyOrderApi): Order {
    const paymentStatus: PaymentStatus = o.paymentMode === 'PAID' ? 'PAID' : 'COD';
    return {
        id: o._id,
        date: o.date,
        customer: getOrderCustomerName(o),
        customerPhone: getOrderCustomerPhone(o),
        customerAddress: getOrderAddress(o),
        items: (o.products || []).map((p) => {
            const productName =
                p.productId && typeof p.productId === 'object' && p.productId?.name
                    ? `${p.productId.name} - `
                    : '';
            const variantLabel = `${productName}${p.variantName || ''}`.trim() || p.variantName || '';
            return {
                variant: variantLabel,
                quantity: p.quantity,
                lineAmount: p.price,
            };
        }),
        amount: o.totalAmount,
        paymentStatus,
        fulfillmentStatus: mapFulfillmentStatus(o.fulfillmentStatus),
        deliveryStatus: mapDeliveryStatusFromTracking(o.shippingDetails?.trackingStatus),
        state: o.state,
        pincode: o.pincode,
        codCharges: o.codCharges,
        shippingCharges: o.shippingCharges,
        discountAmount: o.discount,
        awbNumber: o.shippingDetails?.trackingNumber,
        notes: o.notes,
        platform: 'Shopify',
        type: mapOrderType(o.type),
        shippingTrackingUrl: o.shippingDetails?.trackingUrl,
        shippingTrackingCompany: o.shippingDetails?.trackingCompany,
    };
}

/**
 * Load orders from GET /api/orders (or GET /orders). Optional from/to in YYYY-MM-DD for date filter.
 */
export async function loadOrdersFromApi(options?: { from?: string; to?: string }): Promise<ShopifyOrderApi[]> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    const query = params.toString();
    const path = query ? `/api/orders?${query}` : '/api/orders';
    let response = await apiFetch(path);
    if (response.status === 404) {
        const fallbackPath = query ? `/orders?${query}` : '/orders';
        response = await apiFetch(fallbackPath);
    }
    if (!response.ok) {
        throw new Error('Failed to load orders');
    }
    const json = (await response.json()) as unknown;
    const arr = extractOrdersArray(json);
    return arr.map(normalizeOrder).filter((o): o is ShopifyOrderApi => o !== null);
}

export function mapFulfillmentStatus(s: string): FulfillmentStatus {
    const lower = (s || '').toLowerCase();
    if (lower === 'fulfilled') return 'Fulfilled';
    if (lower === 'partial') return 'Partial';
    return 'Unfulfilled';
}

export function mapDeliveryStatusFromTracking(trackingStatus: string | undefined): DeliveryStatus {
    const lower = (trackingStatus || '').toLowerCase();
    if (lower === 'delivered') return 'Delivered';
    if (lower === 'in transit' || lower === 'in_transit') return 'In Transit';
    if (lower === 'rto') return 'RTO';
    if (lower === 'pending pickup' || lower === 'pending_pickup') return 'Pending Pickup';
    return 'Pending Pickup';
}

export function mapOrderType(t: string): OrderType {
    const lower = (t || '').toLowerCase();
    if (lower === 'new') return 'New';
    if (lower === 'repeat') return 'Repeat';
    if (lower === 'reference') return 'Reference';
    return 'New';
}

function toBackendDeliveryStatus(status: DeliveryStatus): string {
    const lower = status.toLowerCase();
    if (lower === 'delivered') return 'delivered';
    if (lower === 'in transit') return 'in_transit';
    if (lower === 'rto') return 'rto';
    if (lower === 'pending pickup') return 'pending_pickup';
    return lower;
}

function toBackendFulfillmentStatus(status: FulfillmentStatus): string {
    const lower = status.toLowerCase();
    if (lower === 'fulfilled') return 'fulfilled';
    if (lower === 'partial') return 'partial';
    return 'unfulfilled';
}

function toBackendOrderType(t?: OrderType): string | undefined {
    if (!t) return undefined;
    return t.toLowerCase();
}

function toBackendPaymentMode(p: PaymentStatus): string {
    if (p === 'PAID') return 'PAID';
    return 'COD';
}

export function buildShopifyOrderPayloadFromForm(
    base: ShopifyOrderApi,
    form: Order,
    resolveProductId?: (variantLabel: string) => string | undefined,
): ShopifyOrderApi {
    const paymentMode = toBackendPaymentMode(form.paymentStatus);
    const fulfillmentStatus = toBackendFulfillmentStatus(form.fulfillmentStatus);
    const deliveryStatus = toBackendDeliveryStatus(form.deliveryStatus);
    const awb = form.awbNumber || base.shippingDetails?.trackingNumber || '';
    const trackingUrl =
        awb || base.shippingDetails?.trackingNumber
            ? `https://www.delhivery.com/track/package/${encodeURIComponent(awb || base.shippingDetails!.trackingNumber)}`
            : base.shippingDetails?.trackingUrl || '';

    const baseProducts = (base.products || []) as ShopifyOrderApi['products'];

    const updatedProducts: ShopifyOrderApi['products'] = form.items.map((line) => {
        const existing = baseProducts.find((p) => p.variantName === line.variant);

        // Derive a clean variant name (e.g. "1 Ltr") from the form label "Product Name - 1 Ltr"
        const parsedVariantName = (() => {
            const label = (line.variant || '').trim();
            if (!label) return label;
            const parts = label.split('-');
            if (parts.length <= 1) return label;
            return parts.slice(1).join('-').trim();
        })();

        const rawProductId = existing ? (existing as any).productId : undefined;
        const productIdFromBase =
            typeof rawProductId === 'string'
                ? rawProductId
                : rawProductId && typeof rawProductId === 'object'
                ? String((rawProductId as { _id?: string })._id ?? '')
                : '';
        const productIdFromResolver = resolveProductId ? resolveProductId(line.variant) ?? '' : '';
        const productId = productIdFromBase || productIdFromResolver;

        const baseVariantSku = existing ? (existing as any).variantSku : undefined;
        const variantSku =
            typeof baseVariantSku === 'string' && baseVariantSku.trim().length > 0
                ? baseVariantSku
                : 'NA';

        const unitPrice =
            line.quantity && line.quantity > 0
                ? line.lineAmount / line.quantity
                : existing?.variantPrice ?? 0;

        const baseRest = (existing as any) ?? {};

        return {
            ...baseRest,
            productId,
            variantSku,
            // Prefer existing.variantName from backend; otherwise send only size (e.g. "1 Ltr")
            variantName: existing?.variantName ?? parsedVariantName,
            quantity: line.quantity,
            price: line.lineAmount,
            variantPrice: unitPrice,
        } as ShopifyOrderApi['products'][number];
    });

    const customerId =
        typeof base.customer === 'string'
            ? base.customer
            : base.customer && typeof base.customer === 'object'
            ? String((base.customer as ShopifyOrderCustomer)._id ?? '')
            : '';

    return {
        ...base,
        customer: customerId || base.customer,
        customerName: form.customer,
        phoneNumber: form.customerPhone,
        address: form.customerAddress,
        date: form.date,
        state: form.state,
        pincode: form.pincode ?? '',
        type: toBackendOrderType(form.type) ?? base.type,
        products: updatedProducts,
        platform: base.platform || 'shopify',
        paymentMode,
        fulfillmentStatus,
        codCharges: form.codCharges ?? base.codCharges,
        shippingCharges: form.shippingCharges ?? base.shippingCharges,
        discount: form.discountAmount ?? base.discount,
        totalAmount: form.amount,
        notes: form.notes ?? base.notes,
        shippingDetails: {
            trackingNumber: awb,
            trackingStatus: deliveryStatus,
            trackingUrl,
            trackingCompany: base.shippingDetails?.trackingCompany || 'Delhivery',
        },
    };
}

export async function updateShopifyOrderFromForm(
    base: ShopifyOrderApi,
    form: Order,
    resolveProductId?: (variantLabel: string) => string | undefined,
): Promise<ShopifyOrderApi> {
    const payload = buildShopifyOrderPayloadFromForm(base, form, resolveProductId);
    const response = await apiFetch(`/api/orders/${encodeURIComponent(base._id)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error('Failed to update Shopify order');
    }
    const json = (await response.json()) as unknown;
    const normalized = normalizeOrder(json);
    if (!normalized) {
        throw new Error('Invalid Shopify order response after update');
    }
    return normalized;
}

/**
 * Map a Shopify API order to the app's Order shape for table/filters.
 */
export function shopifyOrderToOrder(o: ShopifyOrderApi): Order {
    const paymentStatus: PaymentStatus = o.paymentMode === 'PAID' ? 'PAID' : 'COD';
    return {
        id: o._id,
        date: o.date,
        customer: getOrderCustomerName(o),
        customerPhone: getOrderCustomerPhone(o),
        customerAddress: getOrderAddress(o),
        items: (o.products || []).map((p) => ({
            variant: p.variantName,
            quantity: p.quantity,
            lineAmount: p.price,
        })),
        amount: o.totalAmount,
        paymentStatus,
        fulfillmentStatus: mapFulfillmentStatus(o.fulfillmentStatus),
        deliveryStatus: mapDeliveryStatusFromTracking(o.shippingDetails?.trackingStatus),
        state: o.state,
        pincode: o.pincode,
        codCharges: o.codCharges,
        shippingCharges: o.shippingCharges,
        discountAmount: o.discount,
        awbNumber: o.shippingDetails?.trackingNumber,
        notes: o.notes,
        platform: 'Shopify',
        type: mapOrderType(o.type),
        shippingTrackingUrl: o.shippingDetails?.trackingUrl,
        shippingTrackingCompany: o.shippingDetails?.trackingCompany,
    };
}
