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

/** API / DB may use pincode, pinCode, postalCode, etc. */
const ORDER_PINCODE_KEYS = ['pincode', 'pinCode', 'postalCode', 'postcode', 'zip', 'ZIP'] as const;

function pincodeFromLooseRecord(r: Record<string, unknown> | null | undefined): string {
    if (!r) return '';
    for (const k of ORDER_PINCODE_KEYS) {
        const v = r[k];
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== '' && s !== 'undefined' && s !== 'null') return s;
    }
    return '';
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

/** State from populated customer or top-level field. */
export function getOrderState(o: ShopifyOrderApi): string {
    const c = o.customer;
    if (c && typeof c === 'object' && 'state' in c) return String((c as ShopifyOrderCustomer).state ?? '');
    return String(o.state ?? '');
}

/** Pincode from populated customer or order (supports pincode / pinCode / postalCode / zip aliases). */
export function getOrderPincode(o: ShopifyOrderApi): string {
    const c = o.customer;
    if (c && typeof c === 'object') {
        const fromCust = pincodeFromLooseRecord(c as unknown as Record<string, unknown>);
        if (fromCust) return fromCust;
    }
    const fromOrder = pincodeFromLooseRecord(o as unknown as Record<string, unknown>);
    if (fromOrder) return fromOrder;
    return '';
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
    const pincode = pincodeFromLooseRecord(cust) || pincodeFromLooseRecord(o) || '';
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
    const strShipField = (k: string, snake?: string): string | undefined => {
        const v = shippingDetailsRaw?.[k] ?? (snake ? shippingDetailsRaw?.[snake] : undefined);
        return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const rootLoose = o as unknown as Record<string, unknown>;
    const pickedUpDateRaw =
        strShipField('pickedUpDate', 'picked_up_date') ??
        strShipField('pickupDate', 'pickup_date') ??
        readLooseString(rootLoose, 'pickedUpDate', 'picked_up_date') ??
        readLooseString(rootLoose, 'pickupDate', 'pickup_date');
    const deliveredAtRaw =
        strShipField('deliveredAt', 'delivered_at') ?? readLooseString(rootLoose, 'deliveredAt', 'delivered_at');
    const returnedAtRaw =
        strShipField('returnedAt', 'returned_at') ?? readLooseString(rootLoose, 'returnedAt', 'returned_at');
    const pickedUpDate = pickedUpDateRaw ? apiDateStringToLocalYmd(pickedUpDateRaw) : undefined;
    const deliveredAt = deliveredAtRaw ? apiDateStringToLocalYmd(deliveredAtRaw) : undefined;
    const returnedAt = returnedAtRaw ? apiDateStringToLocalYmd(returnedAtRaw) : undefined;
    const hasShipping =
        trackingNumber ||
        trackingStatus ||
        trackingUrl ||
        trackingCompany ||
        pickedUpDate ||
        deliveredAt ||
        returnedAt;
    const shippingDetails = hasShipping
        ? {
              trackingNumber,
              trackingStatus,
              trackingUrl,
              trackingCompany,
              ...(pickedUpDate ? { pickedUpDate } : {}),
              ...(deliveredAt ? { deliveredAt } : {}),
              ...(returnedAt ? { returnedAt } : {}),
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
        ...shippingTimestampsFromApi(o),
    };
}

export type LoadOrdersOptions = {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    category?: string;
    type?: string;
    platform?: string;
    paymentMode?: string;
    trackingStatus?: string;
    /** When set, GET /api/orders includes shipped=true|false */
    shipped?: boolean;
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
    if (options?.category) params.set('category', options.category);
    if (options?.type) params.set('type', options.type);
    if (options?.platform) params.set('platform', options.platform);
    if (options?.paymentMode) params.set('paymentMode', options.paymentMode);
    if (options?.trackingStatus) params.set('trackingStatus', options.trackingStatus);
    if (typeof options?.shipped === 'boolean') {
        params.set('shipped', options.shipped ? 'true' : 'false');
    }
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

/**
 * GET /api/orders/search-by-phone — orders matching a 10-digit phone in the given date range (YYYY-MM-DD).
 */
export async function searchOrdersByPhone(
    phoneDigits10: string,
    from: string,
    to: string,
): Promise<ShopifyOrderApi[]> {
    const digits = String(phoneDigits10 || '').replace(/\D/g, '');
    if (digits.length !== 10) {
        return [];
    }
    const params = new URLSearchParams();
    params.set('phoneNumber', digits);
    params.set('from', from);
    params.set('to', to);
    const path = `/api/orders/search-by-phone?${params.toString()}`;
    let response = await apiFetch(path);
    if (response.status === 404) {
        response = await apiFetch(`/orders/search-by-phone?${params.toString()}`);
    }
    if (!response.ok) {
        throw new Error('Failed to search orders by phone');
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

/** API expects fulfilled | partial only (unfulfilled maps to fulfilled). */
export function toBackendFulfillmentStatus(status: FulfillmentStatus): 'fulfilled' | 'partial' {
    const lower = String(status).toLowerCase();
    if (lower === 'partial') return 'partial';
    return 'fulfilled';
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

/** API expects lowercase: new | repeat | reference */
export function toBackendOrderType(t?: OrderType): 'new' | 'repeat' | 'reference' | undefined {
    if (!t) return undefined;
    const lower = String(t).toLowerCase();
    if (lower === 'repeat') return 'repeat';
    if (lower === 'reference') return 'reference';
    return 'new';
}

function toBackendPaymentMode(p: PaymentStatus): string {
    if (p === 'PAID') return 'PAID';
    return 'COD';
}

/** Local calendar date as YYYY-MM-DD from an API ISO or date string (date-only in UI). */
function apiDateStringToLocalYmd(input?: string): string | undefined {
    if (!input || typeof input !== 'string' || !input.trim()) return undefined;
    const t = input.trim();
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
        const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : undefined;
    }
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
}

function readLooseString(obj: Record<string, unknown> | null | undefined, camel: string, snake: string): string | undefined {
    if (!obj) return undefined;
    const v = obj[camel] ?? obj[snake];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function shippingTimestampsFromApi(o: ShopifyOrderApi): {
    pickedUpDate?: string;
    deliveredAt?: string;
    returnedAt?: string;
} {
    const r =
        o.shippingDetails && typeof o.shippingDetails === 'object'
            ? (o.shippingDetails as Record<string, unknown>)
            : null;
    const root = o as unknown as Record<string, unknown>;
    const rawPickedUp =
        readLooseString(r, 'pickedUpDate', 'picked_up_date') ??
        readLooseString(r, 'pickupDate', 'pickup_date') ??
        readLooseString(root, 'pickedUpDate', 'picked_up_date') ??
        readLooseString(root, 'pickupDate', 'pickup_date');
    const rawDel =
        readLooseString(r, 'deliveredAt', 'delivered_at') ?? readLooseString(root, 'deliveredAt', 'delivered_at');
    const rawRet =
        readLooseString(r, 'returnedAt', 'returned_at') ?? readLooseString(root, 'returnedAt', 'returned_at');
    const ymd = (raw: string | undefined) => (raw ? apiDateStringToLocalYmd(raw) : undefined);
    return {
        pickedUpDate: ymd(rawPickedUp),
        deliveredAt: ymd(rawDel),
        returnedAt: ymd(rawRet),
    };
}

export function buildShopifyOrderPayloadFromForm(
    base: ShopifyOrderApi,
    form: Order,
    resolveProductId?: (variantLabel: string) => string | undefined,
    products?: ProductApiItem[],
): ShopifyOrderApi {
    const paymentMode = toBackendPaymentMode(form.paymentStatus);
    const isRto = form.deliveryStatus === 'rto';
    /** Backend: RTO is indicated by returnStatus; tracking stays "delivered". */
    const trackingStatusForApi = isRto
        ? 'delivered'
        : String(normalizeDeliveryStatus(String(form.deliveryStatus)));
    const awbFromForm =
        typeof form.awbNumber === 'string' ? form.awbNumber.trim() : undefined;
    const awb = awbFromForm !== undefined ? awbFromForm : (base.shippingDetails?.trackingNumber || '');
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

    const typeForApi =
        toBackendOrderType(form.type) ??
        toBackendOrderType(mapOrderType(String(base.type ?? ''))) ??
        'new';
    const fulfillmentForApi = toBackendFulfillmentStatus(
        form.fulfillmentStatus ?? mapFulfillmentStatus(String(base.fulfillmentStatus ?? '')),
    );

    const pickedUpDateYmd = form.pickedUpDate?.trim() ? form.pickedUpDate.trim().split('T')[0] : '';
    const deliveredAtYmd = form.deliveredAt?.trim() ? form.deliveredAt.trim().split('T')[0] : '';
    const returnedAtYmd = form.returnedAt?.trim() ? form.returnedAt.trim().split('T')[0] : '';

    return {
        ...base,
        customer: customerId || base.customer,
        customerName: form.customer,
        phoneNumber: form.customerPhone,
        address: form.customerAddress,
        date: form.date,
        state: form.state,
        pincode: form.pincode ?? '',
        type: typeForApi,
        products: updatedProducts,
        platform: platformBackend,
        paymentMode,
        fulfillmentStatus: fulfillmentForApi,
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
        pickedUpDate: pickedUpDateYmd,
        deliveredAt: deliveredAtYmd,
        returnedAt: returnedAtYmd,
        shippingDetails: {
            trackingNumber: awb,
            trackingStatus: trackingStatusForApi,
            trackingUrl,
            trackingCompany,
            pickedUpDate: pickedUpDateYmd,
            deliveredAt: deliveredAtYmd,
            returnedAt: returnedAtYmd,
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
        ...shippingTimestampsFromApi(o),
    };
}
