import { apiUrl } from './config';
import { getAuthToken } from './auth';

const FORBIDDEN_COOLDOWN_MS = 30_000;
const forbiddenUntilByRequestKey = new Map<string, number>();
/** In-flight GET/HEAD dedupe: same key shares one network request (avoids Strict Mode double-fetch). */
const inflightByKey = new Map<string, Promise<Response>>();

export const API_FORBIDDEN_EVENT = 'ph:api-forbidden';
export const API_UNAUTHORIZED_EVENT = 'ph:api-unauthorized';
export const API_ACTIVITY_EVENT = 'ph:api-activity';
let activeApiRequests = 0;

function getRequestKey(path: string, init?: RequestInit): string {
	const method = (init?.method ?? 'GET').toUpperCase();
	return `${method} ${path}`;
}

function getForbiddenResponse(path: string): Response {
	return new Response(
		JSON.stringify({
			message: 'Access denied.',
			path,
			fromCache: true,
		}),
		{
			status: 403,
			statusText: 'Forbidden',
			headers: { 'Content-Type': 'application/json' },
		}
	);
}

function dispatchForbiddenEvent(path: string): void {
	if (typeof window === 'undefined') return;
	if (typeof document !== 'undefined') {
		document.body.classList.add('permission-blocked-active');
	}
	window.dispatchEvent(new CustomEvent(API_FORBIDDEN_EVENT, { detail: { path } }));
}

function dispatchUnauthorizedEvent(path: string): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(API_UNAUTHORIZED_EVENT, { detail: { path } }));
}

function dispatchApiActivityEvent(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent(API_ACTIVITY_EVENT, {
			detail: { activeRequests: activeApiRequests },
		})
	);
}

function beginApiActivity(): void {
	activeApiRequests += 1;
	dispatchApiActivityEvent();
}

function endApiActivity(): void {
	activeApiRequests = Math.max(0, activeApiRequests - 1);
	dispatchApiActivityEvent();
}

/**
 * Authenticated fetch: same as fetch(apiUrl(path), init) but adds
 * Authorization: Bearer <token> when the user is logged in.
 * Use this for all API calls that require auth.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	const url = apiUrl(path);
	const token = getAuthToken();
	const headers = new Headers(init?.headers);
	const requestKey = getRequestKey(path, init);
	const now = Date.now();
	const forbiddenUntil = forbiddenUntilByRequestKey.get(requestKey) ?? 0;

	const method = (init?.method ?? 'GET').toUpperCase();
	const canDedupe = (method === 'GET' || method === 'HEAD') && !init?.signal;

	// Prevent tight retry loops for forbidden modules/endpoints.
	if (forbiddenUntil > now) {
		dispatchForbiddenEvent(path);
		return getForbiddenResponse(path);
	}

	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	const runFetch = async (): Promise<Response> => {
		beginApiActivity();
		try {
			const response = await fetch(url, { ...init, headers });
			if (response.status === 401) {
				dispatchUnauthorizedEvent(path);
				return response;
			}
			if (response.status === 403) {
				forbiddenUntilByRequestKey.set(requestKey, Date.now() + FORBIDDEN_COOLDOWN_MS);
				dispatchForbiddenEvent(path);
				return response;
			}
			forbiddenUntilByRequestKey.delete(requestKey);
			return response;
		} finally {
			endApiActivity();
		}
	};

	if (canDedupe && inflightByKey.has(requestKey)) {
		return inflightByKey.get(requestKey)!.then((response) => response.clone());
	}

	const promise = runFetch();
	if (canDedupe) {
		inflightByKey.set(requestKey, promise);
		promise.finally(() => {
			inflightByKey.delete(requestKey);
		});
	}

	return canDedupe ? promise.then((response) => response.clone()) : promise;
}
