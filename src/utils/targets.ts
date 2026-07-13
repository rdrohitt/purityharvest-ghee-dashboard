import { apiFetch } from '../api';
import type { CreateTargetPayload, TargetApiItem } from '../types/targets';

/** First day of month at UTC midnight, e.g. 2026-08-01T00:00:00.000Z */
export function toTargetMonthIso(month: string, year: string): string {
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toISOString();
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
