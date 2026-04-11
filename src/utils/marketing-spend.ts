import { apiFetch } from '../api';
import type { MarketingSpendApiItem } from '../types/marketing-spend';

export type SpendRecord = {
    id: string;
    date: string;
    amount: number;
    note?: string;
    createdByName?: string;
    updatedByName?: string;
};
export type MiscRecord = { id: string; date: string; amount: number; where: string; note?: string };

export interface CreateMarketingSpendPayload {
    platform: string;
    date: string;
    amount: number;
    note?: string;
}

export type LoadMarketingSpendOptions = {
    from?: string;
    to?: string;
};

function extractMarketingSpendArray(json: unknown): MarketingSpendApiItem[] {
    if (Array.isArray(json)) return json as MarketingSpendApiItem[];
    if (!json || typeof json !== 'object') return [];

    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as MarketingSpendApiItem[];
    if (Array.isArray(obj.data)) return obj.data as MarketingSpendApiItem[];
    if (Array.isArray(obj.records)) return obj.records as MarketingSpendApiItem[];
    if (Array.isArray(obj.result)) return obj.result as MarketingSpendApiItem[];
    if (Array.isArray(obj.list)) return obj.list as MarketingSpendApiItem[];
    if (Array.isArray(obj.items)) return obj.items as MarketingSpendApiItem[];
    if (Array.isArray(obj.marketingSpend)) return obj.marketingSpend as MarketingSpendApiItem[];

    const data = obj.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const nested = data as Record<string, unknown>;
        if (Array.isArray(nested.rows)) return nested.rows as MarketingSpendApiItem[];
        if (Array.isArray(nested.data)) return nested.data as MarketingSpendApiItem[];
        if (Array.isArray(nested.records)) return nested.records as MarketingSpendApiItem[];
        if (Array.isArray(nested.result)) return nested.result as MarketingSpendApiItem[];
        if (Array.isArray(nested.list)) return nested.list as MarketingSpendApiItem[];
        if (Array.isArray(nested.items)) return nested.items as MarketingSpendApiItem[];
        if (Array.isArray(nested.marketingSpend)) return nested.marketingSpend as MarketingSpendApiItem[];
    }

    return [];
}

/**
 * Load all marketing spend records from the backend API.
 * Single GET `/api/marketing` that returns an array of MarketingSpendApiItem.
 */
export async function loadAllMarketingSpend(options: LoadMarketingSpendOptions = {}): Promise<MarketingSpendApiItem[]> {
    const params = new URLSearchParams();
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    const query = params.toString();
    const response = await apiFetch(query ? `/api/marketing?${query}` : '/api/marketing');
    if (!response.ok) {
        throw new Error('Failed to load marketing spend data from API');
    }

    const raw = (await response.json()) as unknown;
    return extractMarketingSpendArray(raw);
}

/**
 * Create a new marketing spend record via the unified POST API.
 * POST /api/marketing
 */
export async function createMarketingSpend(payload: CreateMarketingSpendPayload): Promise<MarketingSpendApiItem> {
    const response = await apiFetch(`/api/marketing`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error('Failed to create marketing spend record');
    }

    return (await response.json()) as MarketingSpendApiItem;
}

/**
 * Add a new marketing spend record via the backend API.
 */
export async function addMarketingSpend(
    endpoint:
        | 'meta-spend'
        | 'amazon-spend'
        | 'amazon-shipping-spend'
        | 'flipkart-spend'
        | 'checkout-spend'
        | 'engage-spend'
        | 'dolchi-spend'
        | 'delhivery-spend'
        | 'misc-spend',
    record: SpendRecord | MiscRecord
): Promise<SpendRecord | MiscRecord> {
    const response = await apiFetch(`/api/marketing/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
    });

    if (!response.ok) {
        throw new Error(`Failed to save ${endpoint}`);
    }

    return (await response.json()) as SpendRecord | MiscRecord;
}

/**
 * Update an existing marketing spend record via the backend API.
 */
export async function updateMarketingSpend(
    endpoint:
        | 'meta-spend'
        | 'amazon-spend'
        | 'amazon-shipping-spend'
        | 'flipkart-spend'
        | 'checkout-spend'
        | 'engage-spend'
        | 'dolchi-spend'
        | 'delhivery-spend'
        | 'misc-spend',
    record: SpendRecord | MiscRecord
): Promise<SpendRecord | MiscRecord> {
    const response = await apiFetch(`/api/marketing/${record.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
    });

    if (!response.ok) {
        throw new Error(`Failed to update ${endpoint}`);
    }

    return (await response.json()) as SpendRecord | MiscRecord;
}

/**
 * Delete a marketing spend record via the backend API.
 */
export async function deleteMarketingSpend(
    endpoint:
        | 'meta-spend'
        | 'amazon-spend'
        | 'amazon-shipping-spend'
        | 'flipkart-spend'
        | 'checkout-spend'
        | 'engage-spend'
        | 'dolchi-spend'
        | 'delhivery-spend'
        | 'misc-spend',
    id: string
): Promise<void> {
    const response = await apiFetch(`/api/marketing/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete ${endpoint}`);
    }
}

