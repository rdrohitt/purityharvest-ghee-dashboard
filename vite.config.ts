import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['pwa-192.png', 'pwa-512.png'],
			manifest: {
				name: 'Purity Harvest Admin',
				short_name: 'PH Admin',
				description:
					'Purity Harvest admin dashboard for Shopify sales, marketing spend, and operations.',
				theme_color: '#2563eb',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: 'pwa-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: 'pwa-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
				navigateFallback: 'index.html',
				navigateFallbackDenylist: [/^\/api/, /^\/msg91/, /^\/msg91-api/],
			},
		}),
	],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:4000',
				changeOrigin: true,
			},
			'/msg91': {
				target: 'https://control.msg91.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/msg91/, ''),
			},
			'/msg91-api': {
				target: 'https://api.msg91.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/msg91-api/, ''),
			},
		},
	},
});


