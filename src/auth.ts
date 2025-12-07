export type AuthUser = { email: string };

const STORAGE_KEY = 'demo_auth_token_v1';

export function isAuthenticated(): boolean {
	return Boolean(localStorage.getItem(STORAGE_KEY));
}

export function loginWithEmailPassword(email: string, password: string): Promise<AuthUser> {
	// Simulate API call
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			if (email && password) {
				localStorage.setItem(STORAGE_KEY, 'dummy-token');
				resolve({ email });
			} else {
				reject(new Error('Invalid credentials'));
			}
		}, 600);
	});
}

export function logout(): void {
	localStorage.removeItem(STORAGE_KEY);
}


