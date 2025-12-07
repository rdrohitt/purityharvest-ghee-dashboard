import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { applyTheme, getInitialTheme } from './theme';

const root = createRoot(document.getElementById('root') as HTMLElement);

// initialize theme
applyTheme(getInitialTheme());

root.render(
	<React.StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</React.StrictMode>
);


