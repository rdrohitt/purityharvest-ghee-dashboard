import { apiFetch } from '../api';
import type { AdScriptApi, AdScriptCreatePayload, AdScriptUpdatePayload } from '../types/ad-scripts';

function parseList(json: unknown): AdScriptApi[] {
    if (Array.isArray(json)) {
        return json as AdScriptApi[];
    }
    if (json && typeof json === 'object') {
        const o = json as Record<string, unknown>;
        if (Array.isArray(o.data)) return o.data as AdScriptApi[];
        if (Array.isArray(o.scripts)) return o.scripts as AdScriptApi[];
    }
    return [];
}

/**
 * GET /api/ad-scripts — list ad scripts.
 */
export async function fetchAdScripts(): Promise<AdScriptApi[]> {
    const response = await apiFetch('/api/ad-scripts');
    if (!response.ok) {
        throw new Error('Failed to load ad scripts');
    }
    const json = (await response.json()) as unknown;
    return parseList(json);
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
 *
 * @example
 * await updateAdScript(scriptId, {
 *   title: 'Updated Instagram Hook Script',
 *   description: 'Updated copy with stronger CTA.',
 *   status: 'approved',
 *   category: 'Meta Ads',
 * });
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
