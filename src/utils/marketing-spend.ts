import { apiFetch } from '../api';
import type { MarketingSpendApiItem } from '../types/marketing-spend';

export type SpendRecord = { id: string; date: string; amount: number; note?: string };
export type MiscRecord = { id: string; date: string; amount: number; where: string; note?: string };

export interface CreateMarketingSpendPayload {
    platform: string;
    date: string;
    amount: number;
    note?: string;
}

/**
 * Load all marketing spend records from the backend API.
 * Single GET `/api/marketing` that returns an array of MarketingSpendApiItem.
 */
export async function loadAllMarketingSpend(): Promise<MarketingSpendApiItem[]> {
    const response = await apiFetch(`/api/marketing`);
    if (!response.ok) {
        throw new Error('Failed to load marketing spend data from API');
    }

    return (await response.json()) as MarketingSpendApiItem[];
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

