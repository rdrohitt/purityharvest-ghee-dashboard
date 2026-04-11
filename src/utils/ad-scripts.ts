import { apiFetch } from '../api';
import type { AdScriptApi, AdScriptCreatePayload, AdScriptUpdatePayload, AdScriptsListResponse } from '../types/ad-scripts';

function numOr(v: unknown, fallback: number): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalizes GET /api/ad-scripts JSON: paginated object, legacy `{ data }`, `{ scripts }`, or a bare array.
 */
export function normalizeAdScriptsListResponse(json: unknown, fallbackLimit: number): AdScriptsListResponse {
    if (Array.isArray(json)) {
        const rows = json as AdScriptApi[];
        const n = rows.length;
        return {
            count: n,
            total: n,
            page: 1,
            limit: n || fallbackLimit,
            totalPages: 1,
            rows,
        };
    }
    if (json && typeof json === 'object') {
        const o = json as Record<string, unknown>;
        if (Array.isArray(o.rows)) {
            const rows = o.rows as AdScriptApi[];
            const total = numOr(o.total, numOr(o.count, rows.length));
            const limit = Math.max(1, numOr(o.limit, fallbackLimit));
            const totalPages = Math.max(1, numOr(o.totalPages, Math.ceil(total / limit) || 1));
            const page = Math.max(1, Math.min(numOr(o.page, 1), totalPages));
            return {
                count: numOr(o.count, rows.length),
                total,
                page,
                limit,
                totalPages,
                rows,
            };
        }
        if (Array.isArray(o.data)) {
            return normalizeAdScriptsListResponse(o.data, fallbackLimit);
        }
        if (Array.isArray(o.scripts)) {
            return normalizeAdScriptsListResponse(o.scripts, fallbackLimit);
        }
    }
    return {
        count: 0,
        total: 0,
        page: 1,
        limit: fallbackLimit,
        totalPages: 1,
        rows: [],
    };
}

export type FetchAdScriptsParams = {
    page?: number;
    limit?: number;
    /** Exact category label, e.g. `Ghee` / `Milk` (omit for all). */
    category?: string;
};

/**
 * GET /api/ad-scripts — paginated list (supports `page`, `limit`, `category` query params).
 */
export async function fetchAdScriptsPaginated(params: FetchAdScriptsParams = {}): Promise<AdScriptsListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(500, Math.max(1, params.limit ?? 20));
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', String(limit));
    if (params.category?.trim()) q.set('category', params.category.trim());

    const response = await apiFetch(`/api/ad-scripts?${q}`);
    if (!response.ok) {
        throw new Error('Failed to load ad scripts');
    }
    const json = (await response.json()) as unknown;
    return normalizeAdScriptsListResponse(json, limit);
}

const FETCH_ALL_CHUNK = 500;

/**
 * Loads every ad script by paging GET /api/ad-scripts (no category filter). For client-side filters.
 */
export async function fetchAllAdScripts(): Promise<AdScriptApi[]> {
    const merged: AdScriptApi[] = [];
    let page = 1;
    let totalPages = 1;
    do {
        const res = await fetchAdScriptsPaginated({ page, limit: FETCH_ALL_CHUNK });
        merged.push(...res.rows);
        totalPages = Math.max(1, res.totalPages);
        if (res.rows.length === 0) break;
        page += 1;
    } while (page <= totalPages);
    return merged;
}

/**
 * POST /api/ad-scripts — create an ad script.
 */
export async function createAdScript(payload: AdScriptCreatePayload): Promise<AdScriptApi> {
    const response = await apiFetch('/api/ad-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error('Failed to save ad script');
    }
    return (await response.json()) as AdScriptApi;
}

/**
 * GET /api/ad-scripts/:id — single script for edit.
 */
export async function fetchAdScriptById(id: string): Promise<AdScriptApi> {
    const response = await apiFetch(`/api/ad-scripts/${encodeURIComponent(id)}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Script not found');
        }
        throw new Error('Failed to load script');
    }
    return (await response.json()) as AdScriptApi;
}

/**
 * PUT /api/ad-scripts/:id — merge partial fields into the existing script (omitted keys are unchanged).
 */
export async function updateAdScript(id: string, payload: AdScriptUpdatePayload): Promise<AdScriptApi> {
    const response = await apiFetch(`/api/ad-scripts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error('Failed to update script');
    }
    return (await response.json()) as AdScriptApi;
}

export function adScriptRowId(s: AdScriptApi): string {
    return String(s._id ?? s.id ?? `${s.title}-${s.date}`);
}
