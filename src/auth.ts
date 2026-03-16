import { apiUrl } from './config';
import { store, setMe, clearMe } from './store';
import type { MeResponse } from './store';

export type AuthUser = { username: string };

const STORAGE_KEY = 'ph_auth_token';

// In-memory token to avoid reading localStorage on every request (security best practice)
let inMemoryToken: string | null = null;

function syncTokenFromStorage(): void {
	if (inMemoryToken === null && typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) inMemoryToken = stored;
	}
}

/** Returns the current auth token for API headers. Prefers memory, then localStorage. */
export function getAuthToken(): string | null {
	syncTokenFromStorage();
	return inMemoryToken;
}

function setToken(token: string | null): void {
	inMemoryToken = token;
	if (typeof localStorage === 'undefined') return;
	if (token) {
		localStorage.setItem(STORAGE_KEY, token);
	} else {
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(`${STORAGE_KEY}_username`);
	}
}

export function isAuthenticated(): boolean {
	return Boolean(getAuthToken());
}

export function loginWithUsernamePassword(username: string, password: string): Promise<AuthUser> {
	const url = apiUrl('/api/users/login');
	return fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	})
		.then(async (res) => {
			if (!res.ok) {
				const text = await res.text();
				let message = 'Invalid username or password. Please check your credentials.';
				try {
					const data = JSON.parse(text);
					if (data?.message) message = data.message;
				} catch {
					if (text) message = text;
				}
				throw new Error(message);
			}
			return res.json();
		})
		.then(async (data: { token?: string; user?: { username?: string }; username?: string }) => {
			const raw = data?.token;
			const token = typeof raw === 'string' && raw.trim() ? raw : null;
			if (!token) {
				throw new Error('Login did not return a valid token.');
			}
			setToken(token);

			// Immediately fetch current user
			const meRes = await fetch(apiUrl('/api/users/me'), {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!meRes.ok) {
				setToken(null);
				throw new Error(meRes.status === 401 ? 'Session invalid.' : 'Failed to load user.');
			}
			const me = (await meRes.json()) as MeResponse;
			if (!me?.user) {
				setToken(null);
				throw new Error('Invalid response from server.');
			}
			store.dispatch(setMe(me));
			const usernameStored = me.user.username ?? data?.user?.username ?? data?.username ?? username;
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(`${STORAGE_KEY}_username`, usernameStored);
			}
			return { username: usernameStored };
		});
}

export function logout(): void {
	setToken(null);
	store.dispatch(clearMe());
}

/** Fetch /me and update Redux store. Call when app loads with existing token (e.g. after refresh). */
export function hydrateUserFromToken(): Promise<void> {
	const token = getAuthToken();
	if (!token) return Promise.resolve();
	return fetch(apiUrl('/api/users/me'), {
		headers: { Authorization: `Bearer ${token}` },
	})
		.then(async (res) => {
			if (!res.ok) {
				setToken(null);
				store.dispatch(clearMe());
				return;
			}
			const me = (await res.json()) as MeResponse;
			if (me?.user) {
				store.dispatch(setMe(me));
			}
		})
		.catch(() => {
			setToken(null);
			store.dispatch(clearMe());
		});
}
