const THEME_KEY = 'app_theme_v1';
export type Theme = 'light' | 'dark';

export function getInitialTheme(): Theme {
	const saved = localStorage.getItem(THEME_KEY) as Theme | null;
	if (saved === 'light' || saved === 'dark') return saved;
	// default to light
	return 'light';
}

export function applyTheme(theme: Theme): void {
	document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
	localStorage.setItem(THEME_KEY, theme);
}


