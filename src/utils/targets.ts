import { apiFetch } from '../api';
import type { CreateTargetPayload, TargetApiItem, TargetsListResponse, UpdateTargetPayload } from '../types/targets';

/** First day of month at UTC midnight, e.g. 2026-08-01T00:00:00.000Z */
export function toTargetMonthIso(month: string, year: string): string {
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toISOString();
}

/** Parse target month ISO into month/year select values. */
export function parseTargetMonthIso(iso: string): { month: string; year: string } {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        const now = new Date();
        return {
            month: String(now.getUTCMonth() + 1).padStart(2, '0'),
            year: String(now.getUTCFullYear()),
        };
    }
    return {
        month: String(d.getUTCMonth() + 1).padStart(2, '0'),
        year: String(d.getUTCFullYear()),
    };
}

function parseTargetsListResponse(json: unknown): TargetsListResponse {
    if (json && typeof json === 'object') {
        const o = json as Record<string, unknown>;
        const items = Array.isArray(o.items)
            ? (o.items as TargetApiItem[])
            : Array.isArray(o.targets)
              ? (o.targets as TargetApiItem[])
              : Array.isArray(json)
                ? (json as TargetApiItem[])
                : [];
        const totalRaw = o.total ?? o.count;
        const totalNum = Number(totalRaw);
        const total = Number.isFinite(totalNum) && totalNum >= 0 ? totalNum : items.length;
        const page = typeof o.page === 'number' ? o.page : 1;
        const limit = typeof o.limit === 'number' ? o.limit : items.length || 10;
        const totalPages =
            typeof o.totalPages === 'number' && o.totalPages >= 1
                ? o.totalPages
                : Math.max(1, Math.ceil(total / limit));
        return { items, total, page, limit, totalPages };
    }
    return { items: [], total: 0, page: 1, limit: 10, totalPages: 1 };
}

/** GET /api/targets/ */
export async function fetchTargets(): Promise<TargetsListResponse> {
    const res = await apiFetch('/api/targets/');
    if (!res.ok) {
        throw new Error('Failed to load targets');
    }
    const json: unknown = await res.json();
    return parseTargetsListResponse(json);
}

/** POST /api/targets/ */
export async function createTarget(payload: CreateTargetPayload): Promise<TargetApiItem> {
    const res = await apiFetch('/api/targets/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error('Failed to save target');
    }
    return (await res.json()) as TargetApiItem;
}

/** PUT /api/targets/ */
export async function updateTarget(payload: UpdateTargetPayload): Promise<TargetApiItem> {
    const res = await apiFetch('/api/targets/', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error('Failed to update target');
    }
    return (await res.json()) as TargetApiItem;
}
