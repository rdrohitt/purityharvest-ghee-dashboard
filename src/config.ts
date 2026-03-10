/**
 * API base URL from environment. Set in .env.production / .env.uat.
 * When empty, relative URLs are used (e.g. for same-origin or proxy).
 */
const base = import.meta.env.VITE_API_BASE_URL ?? '';

export const API_BASE = base;

/** Full URL for an API path (path should start with / e.g. /api/orders) */
export function apiUrl(path: string): string {
	return base ? `${base.replace(/\/$/, '')}${path}` : path;
}
