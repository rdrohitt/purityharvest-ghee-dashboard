import { apiFetch } from '../api';
import type { ProductApiItem } from '../types/products';
import type { ShopifyOrderApi, ShopifyOrderCustomer, ShopifyOrderProduct } from '../types/shopify';
import type { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, OrderType } from './orders';
import { normalizeDeliveryStatus } from './orders';

/** Match Add Order / Shopify product picker label to a catalog product (same rules as Shopify order save UI). */
function findProductByVariantLabel(
    products: ProductApiItem[] | undefined,
    variantLabel: string,
): ProductApiItem | undefined {
    if (!products?.length) return undefined;
    const label = variantLabel.trim();
    if (!label) return undefined;
    const name = (label.split('-')[0] ?? '').trim();
    return (
        products.find((p) => p.name === name) ||
        products.find((p) => label.startsWith(p.name)) ||
        undefined
    );
}

/**
 * Unit selling price from an order line (`variantPrice` when set; else legacy `price` as unit).
 */
export function getShopifyProductUnitPrice(p: ShopifyOrderProduct): number {
    const qty = Number(p.quantity) || 0;
    const vp = Number(p.variantPrice);
    const pr = Number(p.price);
    const hasVp = Number.isFinite(vp) && vp > 0;
    const hasPr = Number.isFinite(pr) && pr > 0;
    if (hasVp) return vp;
    if (hasPr && qty > 0) return pr;
    return hasPr ? pr : 0;
}

/**
 * Line total (`price` when sent with `variantPrice` as line total; else unit × qty).
 */
export function getShopifyProductLineAmount(p: ShopifyOrderProduct): number {
    const qty = Number(p.quantity) || 0;
    const vp = Number(p.variantPrice);
    const pr = Number(p.price);
    const hasVp = Number.isFinite(vp) && vp > 0;
    const hasPr = Number.isFinite(pr) && pr > 0;
    if (hasVp && hasPr) return pr;
    if (hasVp && qty > 0) return vp * qty;
    if (hasPr && qty > 0) return pr * qty;
    return hasPr ? pr : 0;
}

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
    const updatedBy = o.updatedBy as ShopifyOrderApi['updatedBy'] | undefined;
    const pincode = String(o.pincode ?? cust?.pincode ?? '');
    const shippingDetailsRaw =
        o.shippingDetails && typeof o.shippingDetails === 'object'
            ? (o.shippingDetails as Record<string, unknown>)
            : null;
    const trackingNumber = String(
        shippingDetailsRaw?.trackingNumber ?? o.trackingNumber ?? ''
    ).trim();
    const trackingStatus = String(
        shippingDetailsRaw?.trackingStatus ?? o.trackingStatus ?? ''
    ).trim();
    const trackingCompany = String(
        shippingDetailsRaw?.trackingCompany ??
            shippingDetailsRaw?.trackingCompanyName ??
            o.trackingCompany ??
            o.trackingCompanyName ??
            ''
    ).trim();
    const trackingUrl = buildDefaultTrackingUrlFromCourier(trackingNumber, trackingCompany);
    const shippingDetails =
        trackingNumber || trackingStatus || trackingUrl || trackingCompany
            ? {
                  trackingNumber,
                  trackingStatus,
                  trackingUrl,
                  trackingCompany,
              }
            : undefined;
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
        is_shipped: Boolean((o as any).is_shipped),
        codCharges: Number(o.codCharges) || 0,
        shippingCharges: Number(o.shippingCharges) || 0,
        partialAmount:
            o.partialAmount !== undefined && o.partialAmount !== null
                ? Number(o.partialAmount) || 0
                : Number(o.shippingCharges) || 0,
        discount: Number(o.discount) || 0,
        totalAmount: Number(o.totalAmount ?? o.amount) || 0,
        notes: String(o.notes ?? ''),
        updatedBy,
        shippingDetails: shippingDetails as ShopifyOrderApi['shippingDetails'],
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
    if (Array.isArray(obj.rows)) return obj.rows;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.orders)) return obj.orders;
    if (Array.isArray(obj.result)) return obj.result;
    if (Array.isArray(obj.list)) return obj.list;
    if (Array.isArray(obj.items)) return obj.items;
    // Nested: data.orders, data.data, data.list, etc.
    const data = obj.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        if (Array.isArray(d.rows)) return d.rows;
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
    const platformLabel = (() => {
        const lower = (o.platform || '').toLowerCase();
        if (lower === 'shopify') return 'Shopify';
        if (lower === 'abandoned') return 'Abandoned';
        if (lower === 'whatsapp') return 'Whatsapp';
        if (lower === 'amazon') return 'Amazon';
        if (lower === 'flipkart') return 'Flipkart';
        if (lower === 'calling') return 'Calling';
        return (o.platform || '') as any;
    })();
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
                lineAmount: getShopifyProductLineAmount(p),
            };
        }),
        amount: o.totalAmount,
        paymentStatus,
        fulfillmentStatus: mapFulfillmentStatus(o.fulfillmentStatus),
        deliveryStatus: mapDeliveryStatusFromTracking(
            o.shippingDetails?.trackingStatus,
            o.returnStatus,
        ),
        state: o.state,
        pincode: o.pincode,
        codCharges: o.codCharges,
        shippingCharges: o.shippingCharges,
        partialAmount: o.partialAmount ?? o.shippingCharges,
        discountAmount: o.discount,
        awbNumber: o.shippingDetails?.trackingNumber,
        notes: o.notes,
        platform: platformLabel,
        type: mapOrderType(o.type),
        shippingTrackingUrl:
            buildDefaultTrackingUrlFromCourier(
                o.shippingDetails?.trackingNumber ?? '',
                o.shippingDetails?.trackingCompany ?? '',
            ) || undefined,
        shippingTrackingCompany: o.shippingDetails?.trackingCompany,
        is_shipped: Boolean(o.is_shipped),
    };
}

export type LoadOrdersOptions = {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    type?: string;
    platform?: string;
    paymentMode?: string;
    trackingStatus?: string;
};

export type OrdersDashboardResponse = {
    rows: ShopifyOrderApi[];
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

/**
 * Load paginated orders from GET /api/orders (or GET /orders).
 * Supports optional from/to (YYYY-MM-DD), page, and limit.
 */
export async function loadOrdersDashboardFromApi(options?: LoadOrdersOptions): Promise<OrdersDashboardResponse> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    if (typeof options?.page === 'number' && Number.isFinite(options.page)) {
        params.set('page', String(Math.max(1, Math.trunc(options.page))));
    }
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
        params.set('limit', String(Math.max(1, Math.min(1000, Math.trunc(options.limit)))));
    }
    if (options?.type) params.set('type', options.type);
    if (options?.platform) params.set('platform', options.platform);
    if (options?.paymentMode) params.set('paymentMode', options.paymentMode);
    if (options?.trackingStatus) params.set('trackingStatus', options.trackingStatus);
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
    if (json && typeof json === 'object' && !Array.isArray(json)) {
        const obj = json as Record<string, unknown>;
        const arr = extractOrdersArray(json);
        const rows = arr.map(normalizeOrder).filter((o): o is ShopifyOrderApi => o !== null);
        const fallbackLimit = Number(params.get('limit')) || rows.length || 1;
        const total = typeof obj.total === 'number' ? obj.total : rows.length;
        const page = typeof obj.page === 'number' ? obj.page : Number(params.get('page')) || 1;
        const limit = typeof obj.limit === 'number' ? obj.limit : fallbackLimit;
        const totalPages =
            typeof obj.totalPages === 'number'
                ? obj.totalPages
                : Math.max(1, Math.ceil(total / Math.max(1, limit)));
        const count = typeof obj.count === 'number' ? obj.count : rows.length;
        return {
            rows,
            count,
            total,
            page,
            limit,
            totalPages,
        };
    }
    const arr = extractOrdersArray(json);
    const rows = arr.map(normalizeOrder).filter((o): o is ShopifyOrderApi => o !== null);
    return {
        rows,
        count: rows.length,
        total: rows.length,
        page: Number(params.get('page')) || 1,
        limit: Number(params.get('limit')) || rows.length || 1,
        totalPages: 1,
    };
}

/**
 * Load orders list from GET /api/orders (or GET /orders). Optional from/to in YYYY-MM-DD for date filter.
 */
export async function loadOrdersFromApi(options?: LoadOrdersOptions): Promise<ShopifyOrderApi[]> {
    const dash = await loadOrdersDashboardFromApi(options);
    return dash.rows;
}

export function mapFulfillmentStatus(s: string): FulfillmentStatus {
    const lower = (s || '').toLowerCase();
    if (lower === 'fulfilled') return 'Fulfilled';
    if (lower === 'partial') return 'Partial';
    return 'Unfulfilled';
}

export function mapDeliveryStatusFromTracking(
    trackingStatus: string | undefined,
    returnStatus?: boolean,
): DeliveryStatus {
    return normalizeDeliveryStatus(trackingStatus, returnStatus);
}

export function mapOrderType(t: string): OrderType {
    const lower = (t || '').toLowerCase();
    if (lower === 'new') return 'New';
    if (lower === 'repeat') return 'Repeat';
    if (lower === 'reference') return 'Reference';
    return 'New';
}

function toBackendFulfillmentStatus(status: FulfillmentStatus): string {
    const lower = status.toLowerCase();
    if (lower === 'fulfilled') return 'fulfilled';
    if (lower === 'partial') return 'partial';
    return 'unfulfilled';
}

/**
 * When no explicit tracking URL is stored, build one from AWB and courier partner (case-insensitive).
 */
export function buildDefaultTrackingUrlFromCourier(awb: string, courierPartner: string): string {
    const trimmed = String(awb ?? '').trim();
    if (!trimmed) return '';
    const c = String(courierPartner ?? '').trim().toLowerCase();
    const enc = encodeURIComponent(trimmed);
    if (c.includes('amazon')) {
        return `https://track.amazon.in/tracking/${enc}`;
    }
    // Delhivery and other couriers: same public tracker used when partner is Delhivery or unspecified
    return `https://www.delhivery.com/track-v2/package/${enc}`;
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
    products?: ProductApiItem[],
): ShopifyOrderApi {
    const paymentMode = toBackendPaymentMode(form.paymentStatus);
    const fulfillmentStatus = toBackendFulfillmentStatus(form.fulfillmentStatus);
    const isRto = form.deliveryStatus === 'rto';
    /** Backend: RTO is indicated by returnStatus; tracking stays "delivered". */
    const trackingStatusForApi = isRto
        ? 'delivered'
        : String(normalizeDeliveryStatus(String(form.deliveryStatus)));
    const awb = form.awbNumber || base.shippingDetails?.trackingNumber || '';
    const trackingCompany =
        (form.shippingTrackingCompany && form.shippingTrackingCompany.trim()) ||
        base.shippingDetails?.trackingCompany ||
        'Delhivery';
    const trackingUrl = buildDefaultTrackingUrlFromCourier(awb, trackingCompany);

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
                : existing
                ? getShopifyProductUnitPrice(existing as ShopifyOrderProduct)
                : 0;

        const baseRest = (existing as any) ?? {};

        const catalogProduct = findProductByVariantLabel(products, line.variant || '');
        const catalogVariants = Array.isArray(catalogProduct?.variants) ? catalogProduct!.variants : [];
        const variantNameForPayload =
            catalogProduct && catalogVariants.length === 0
                ? catalogProduct.name.trim()
                : existing?.variantName ?? parsedVariantName;

        return {
            ...baseRest,
            productId,
            variantSku,
            // No catalog variants: send product name as variantName (backend expects a non-empty label).
            // Otherwise prefer existing.variantName; else size parsed from "Name - Size" label.
            variantName: variantNameForPayload,
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

    const platformBackend = (form.platform && String(form.platform).trim())
        ? String(form.platform).toLowerCase()
        : String(base.platform || 'shopify').toLowerCase();

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
        platform: platformBackend,
        paymentMode,
        fulfillmentStatus,
        is_shipped: form.is_shipped,
        codCharges: form.codCharges ?? base.codCharges,
        shippingCharges: base.shippingCharges,
        partialAmount:
            form.partialAmount !== undefined && form.partialAmount !== null
                ? Number(form.partialAmount) || 0
                : base.partialAmount ?? base.shippingCharges,
        discount: form.discountAmount ?? base.discount,
        totalAmount: form.amount,
        notes: form.notes ?? base.notes,
        returnStatus: isRto,
        shippingDetails: {
            trackingNumber: awb,
            trackingStatus: trackingStatusForApi,
            trackingUrl,
            trackingCompany,
        },
    };
}

export async function updateShopifyOrderFromForm(
    base: ShopifyOrderApi,
    form: Order,
    resolveProductId?: (variantLabel: string) => string | undefined,
    products?: ProductApiItem[],
): Promise<ShopifyOrderApi> {
    const payload = buildShopifyOrderPayloadFromForm(base, form, resolveProductId, products);
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
    const platformLabel = (() => {
        const lower = (o.platform || '').toLowerCase();
        if (lower === 'shopify') return 'Shopify';
        if (lower === 'abandoned') return 'Abandoned';
        if (lower === 'whatsapp') return 'Whatsapp';
        if (lower === 'amazon') return 'Amazon';
        if (lower === 'flipkart') return 'Flipkart';
        if (lower === 'calling') return 'Calling';
        return (o.platform || '') as any;
    })();
    return {
        id: o._id,
        date: o.date,
        customer: getOrderCustomerName(o),
        customerPhone: getOrderCustomerPhone(o),
        customerAddress: getOrderAddress(o),
        items: (o.products || []).map((p) => ({
            variant: p.variantName,
            quantity: p.quantity,
            lineAmount: getShopifyProductLineAmount(p),
        })),
        amount: o.totalAmount,
        paymentStatus,
        fulfillmentStatus: mapFulfillmentStatus(o.fulfillmentStatus),
        deliveryStatus: mapDeliveryStatusFromTracking(
            o.shippingDetails?.trackingStatus,
            o.returnStatus,
        ),
        state: o.state,
        pincode: o.pincode,
        codCharges: o.codCharges,
        shippingCharges: o.shippingCharges,
        partialAmount: o.partialAmount ?? o.shippingCharges,
        discountAmount: o.discount,
        awbNumber: o.shippingDetails?.trackingNumber,
        notes: o.notes,
        platform: platformLabel,
        type: mapOrderType(o.type),
        shippingTrackingUrl:
            buildDefaultTrackingUrlFromCourier(
                o.shippingDetails?.trackingNumber ?? '',
                o.shippingDetails?.trackingCompany ?? '',
            ) || undefined,
        shippingTrackingCompany: o.shippingDetails?.trackingCompany,
        is_shipped: Boolean(o.is_shipped),
    };
}
