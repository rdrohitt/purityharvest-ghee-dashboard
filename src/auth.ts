export type AuthUser = { email: string };

const STORAGE_KEY = 'purity_harvest_auth_token';
const VALID_EMAIL = 'support@purityharvest.in';
const VALID_PASSWORD = 'Harvest@1234';

export function isAuthenticated(): boolean {
	return Boolean(localStorage.getItem(STORAGE_KEY));
}

export function loginWithEmailPassword(email: string, password: string): Promise<AuthUser> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			// Check for exact match of credentials
			if (email === VALID_EMAIL && password === VALID_PASSWORD) {
				// Store authentication token in localStorage to remember login
				localStorage.setItem(STORAGE_KEY, 'authenticated');
				// Also store email for reference
				localStorage.setItem(`${STORAGE_KEY}_email`, email);
				resolve({ email });
			} else {
				reject(new Error('Invalid email or password. Please check your credentials.'));
			}
		}, 300);
	});
}

export function logout(): void {
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(`${STORAGE_KEY}_email`);
}


