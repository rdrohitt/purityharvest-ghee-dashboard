import type { ShopifyOrderApi, ShopifyOrderCustomer, ShopifyOrderProduct } from '../types/shopify';
import {
    getOrderAddress,
    getOrderCustomerName,
    getOrderCustomerPhone,
    getOrderPincode,
    getShopifyProductUnitPrice,
} from './shopify-orders';

const PUSH_ORDER_URL = 'https://shipping-api.com/app/api/v1/push-order';
const TRACK_ORDER_URL = 'https://shipping-api.com/app/api/v1/track-order';

const publicKey = String(import.meta.env.VITE_SHIPMOZO_PUBLIC_KEY ?? '').trim();
const privateKey = String(import.meta.env.VITE_SHIPMOZO_PRIVATE_KEY ?? '').trim();

const DEFAULT_UNIT_WEIGHT_GRAMS = 200;
const DEFAULT_DIMENSIONS_CM = { length: 10, width: 20, height: 15 };

export type ShipmozoProductDetail = {
    name: string;
    sku_number: string;
    quantity: number;
    discount: string;
    hsn: string;
    unit_price: number;
    product_category: string;
};

export type ShipmozoPushOrderPayload = {
    order_id: string;
    order_date: string;
    consignee_name: string;
    consignee_phone: number | '';
    consignee_email: string;
    consignee_address_line_one: string;
    consignee_address_line_two: string;
    consignee_pin_code: number | '';
    product_detail: ShipmozoProductDetail[];
    payment_type: 'PREPAID' | 'COD';
    cod_amount: number | '';
    shipping_charges: number | '';
    weight: number;
    length: number;
    width: number;
    height: number;
    warehouse_id: string;
    gst_ewaybill_number: string;
    gstin_number: string;
};

function toYmd(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value ?? '').slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toNumberOrEmpty(digits: string): number | '' {
    const n = Number(digits);
    return digits && Number.isFinite(n) ? n : '';
}

function productDisplayName(p: ShopifyOrderProduct): string {
    const base =
        p.productId && typeof p.productId === 'object' && 'name' in p.productId
            ? String(p.productId.name ?? '').split('|')[0].trim()
            : '';
    const variant = String(p.variantName ?? '').trim();
    if (base && variant) return `${base} - ${variant}`;
    return base || variant || 'Product';
}

/** Parses pack size from variant names like "1 Ltr", "500 ml", "5 L", "1 kg", "250 g" into grams. */
function variantWeightGrams(variantName: string): number | null {
    const m = String(variantName ?? '')
        .toLowerCase()
        .match(/(\d+(?:\.\d+)?)\s*(ltr|litre|liter|l|ml|kg|g|gm|gms)\b/);
    if (!m) return null;
    const qty = Number(m[1]);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const unit = m[2];
    if (unit === 'ml' || unit === 'g' || unit === 'gm' || unit === 'gms') return qty;
    return qty * 1000;
}

/** Splits a single-line address at the comma nearest its middle so both lines stay short. */
function splitAddress(address: string): [string, string] {
    const clean = address.replace(/\s+/g, ' ').trim();
    if (clean.length <= 60) return [clean, ''];
    const parts = clean.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return [clean, ''];
    let lineOne = '';
    let i = 0;
    while (i < parts.length - 1 && (lineOne + parts[i]).length < clean.length / 2) {
        lineOne = lineOne ? `${lineOne}, ${parts[i]}` : parts[i];
        i += 1;
    }
    if (!lineOne) {
        lineOne = parts[0];
        i = 1;
    }
    return [lineOne, parts.slice(i).join(', ')];
}

/** Uses the order's reference number; falls back to a stable "PH-<order id>" so re-pushes reuse the same id. */
function shipmozoOrderId(o: ShopifyOrderApi): string {
    const ref = String(o.referenceNo ?? '').replace(/^#/, '').trim();
    if (ref) return ref;
    const base = String(o._id || o.shopifyOrderId || '').trim();
    return `PH-${base || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

export function buildShipmozoPushOrderPayload(o: ShopifyOrderApi): ShipmozoPushOrderPayload {
    const address = getOrderAddress(o);
    const [lineOne, lineTwo] = splitAddress(address);
    const customer = o.customer && typeof o.customer === 'object' ? (o.customer as ShopifyOrderCustomer) : null;
    const phoneDigits = getOrderCustomerPhone(o).replace(/\D/g, '').slice(-10);
    const pinDigits = getOrderPincode(o).replace(/\D/g, '').slice(0, 6);
    const isPrepaid = String(o.paymentMode ?? '').toUpperCase() === 'PAID';

    const products = o.products ?? [];
    const weight = products.reduce((sum, p) => {
        const qty = Number(p.quantity) || 1;
        return sum + qty * (variantWeightGrams(p.variantName) ?? DEFAULT_UNIT_WEIGHT_GRAMS);
    }, 0);

    return {
        order_id: shipmozoOrderId(o),
        order_date: toYmd(o.date),
        consignee_name: getOrderCustomerName(o).trim(),
        consignee_phone: toNumberOrEmpty(phoneDigits),
        consignee_email: String(customer?.email ?? '').trim(),
        consignee_address_line_one: lineOne,
        consignee_address_line_two: lineTwo,
        consignee_pin_code: toNumberOrEmpty(pinDigits),
        product_detail: products.map((p) => ({
            name: productDisplayName(p),
            sku_number: String(p.variantSku || p.variantId || ''),
            quantity: Number(p.quantity) || 1,
            discount: '',
            hsn: '',
            unit_price: getShopifyProductUnitPrice(p),
            product_category: 'Other',
        })),
        payment_type: isPrepaid ? 'PREPAID' : 'COD',
        cod_amount: isPrepaid ? '' : Number(o.totalAmount) || 0,
        shipping_charges: o.shippingCharges ? Number(o.shippingCharges) : '',
        weight: weight || DEFAULT_UNIT_WEIGHT_GRAMS,
        ...DEFAULT_DIMENSIONS_CM,
        warehouse_id: '',
        gst_ewaybill_number: '',
        gstin_number: '',
    };
}

export type ShipmozoPushResult = { ok: boolean; message: string; data?: unknown };

const MISSING_KEYS_MESSAGE =
    'Shipping API keys missing. Set VITE_SHIPMOZO_PUBLIC_KEY and VITE_SHIPMOZO_PRIVATE_KEY in .env.local';

export type ShipmozoTrackScan = { date: string; status: string; location: string };

export type ShipmozoTrackData = {
    order_id?: string;
    refrence_id?: string;
    awb_number?: string;
    rto_awb_number?: string;
    courier?: string;
    order_status?: string;
    expected_delivery_date?: string;
    current_status?: string;
    status_time?: string;
    scan_detail?: ShipmozoTrackScan[];
};

export type ShipmozoTrackResult = { ok: boolean; message: string; data?: ShipmozoTrackData };

export async function trackShipmozoOrder(awbNumber: string): Promise<ShipmozoTrackResult> {
    const awb = awbNumber.trim();
    if (!awb) return { ok: false, message: 'No AWB number' };
    if (!publicKey || !privateKey) return { ok: false, message: MISSING_KEYS_MESSAGE };
    try {
        const res = await fetch(`${TRACK_ORDER_URL}?awb_number=${encodeURIComponent(awb)}`, {
            method: 'GET',
            headers: {
                accept: '*/*',
                'public-key': publicKey,
                'private-key': privateKey,
            },
        });
        const json = (await res.json().catch(() => null)) as
            | { result?: string | number; message?: string; data?: ShipmozoTrackData }
            | null;
        const apiFailed = json?.result !== undefined && String(json.result) === '0';
        if (!res.ok || apiFailed || !json?.data) {
            return { ok: false, message: json?.message || `Tracking failed (${res.status})` };
        }
        return { ok: true, message: json.message || 'Success', data: json.data };
    } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Tracking failed' };
    }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-05 00:00:00" → "05-Oct-2026"; returns '' when unparseable. */
export function formatShipmozoDateDdMmmYyyy(value: string | undefined): string {
    const m = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    const month = MONTHS_SHORT[Number(m[2]) - 1];
    return month ? `${m[3]}-${month}-${m[1]}` : '';
}

export async function pushOrderToShipmozo(o: ShopifyOrderApi): Promise<ShipmozoPushResult> {
    if (!publicKey || !privateKey) return { ok: false, message: MISSING_KEYS_MESSAGE };
    const payload = buildShipmozoPushOrderPayload(o);
    try {
        const res = await fetch(PUSH_ORDER_URL, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'public-key': publicKey,
                'private-key': privateKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => null)) as
            | { result?: string | number; message?: string; data?: unknown }
            | null;
        const apiFailed = json?.result !== undefined && String(json.result) === '0';
        if (!res.ok || apiFailed) {
            return { ok: false, message: json?.message || `Push failed (${res.status})`, data: json?.data };
        }
        return { ok: true, message: json?.message || 'Order pushed', data: json?.data };
    } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Push failed' };
    }
}
