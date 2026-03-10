import { apiUrl } from './config';
import { getAuthToken } from './auth';

/**
 * Authenticated fetch: same as fetch(apiUrl(path), init) but adds
 * Authorization: Bearer <token> when the user is logged in.
 * Use this for all API calls that require auth.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	const url = apiUrl(path);
	const token = getAuthToken();
	const headers = new Headers(init?.headers);
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}
	return fetch(url, { ...init, headers });
}
