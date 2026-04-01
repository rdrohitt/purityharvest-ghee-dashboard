import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import Login from './pages/Login/index';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard/index';
import Users from './pages/Users/index';
import Settings from './pages/Settings/index';
import Shopify from './pages/sales/Shopify/index';
import Amazon from './pages/sales/Amazon/index';
import Flipkart from './pages/sales/Flipkart/index';
import WALeads from './pages/WALeads/index';
import Followups from './pages/Followups/index';
import MarketingSpend from './pages/MarketingSpend/index';
import Customers from './pages/Customers/index';
import Products from './pages/Products/index';
import GurugramMarts from './pages/Marts/GurugramMarts/index';
import DelhiMarts from './pages/Marts/DelhiMarts/index';
import Modules from './pages/Modules/index';
import { isAuthenticated, hydrateUserFromToken } from './auth';
import { API_ACTIVITY_EVENT } from './api';
import { Spinner } from './components/Spinner';

function PrivateRoute({ children }: { children: ReactElement }) {
	const location = useLocation();
	if (!isAuthenticated()) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}
	return children;
}

/** Redirects root to /admin or /login once; avoids Navigate re-render loop */
function RootRedirect() {
	const navigate = useNavigate();
	const didRedirect = useRef(false);
	useEffect(() => {
		if (didRedirect.current) return;
		didRedirect.current = true;
		navigate(isAuthenticated() ? '/admin' : '/login', { replace: true });
	}, [navigate]);
	return null;
}

export default function App() {
	const [hydratingUser, setHydratingUser] = useState<boolean>(isAuthenticated());
	const [activeApiRequests, setActiveApiRequests] = useState(0);

	useEffect(() => {
		if (!isAuthenticated()) {
			setHydratingUser(false);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				await hydrateUserFromToken();
			} finally {
				if (!cancelled) {
					setHydratingUser(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const onApiActivity = (event: Event) => {
			const custom = event as CustomEvent<{ activeRequests?: number }>;
			setActiveApiRequests(custom.detail?.activeRequests ?? 0);
		};

		window.addEventListener(API_ACTIVITY_EVENT, onApiActivity as EventListener);
		return () => {
			window.removeEventListener(API_ACTIVITY_EVENT, onApiActivity as EventListener);
		};
	}, []);

	const showGlobalSpinner = hydratingUser || activeApiRequests > 0;
	const spinnerMessage = hydratingUser ? 'Loading dashboard…' : 'Loading…';

	return (
		<>
			{showGlobalSpinner && <Spinner overlay fixed message={spinnerMessage} />}
			<Routes>
				<Route path="/" element={<RootRedirect />} />
				<Route 
					path="/login" 
					element={
						isAuthenticated() ? <Navigate to="/admin" replace /> : <Login />
					} 
				/>
					<Route
						path="/admin"
						element={
							<PrivateRoute>
								<AdminLayout />
							</PrivateRoute>
						}
					>
						<Route index element={<Dashboard />} />
						<Route path="shopify" element={<Shopify />} />
						<Route path="wa-leads" element={<WALeads />} />
						<Route path="amazon" element={<Amazon />} />
						<Route path="flipkart" element={<Flipkart />} />
						<Route path="users-and-roles" element={<Users />} />
						<Route path="modules" element={<Modules />} />
						<Route path="products" element={<Products />} />
						<Route path="followups" element={<Followups />} />
						<Route path="marketing-spend" element={<MarketingSpend />} />
						<Route path="gurugram-marts" element={<GurugramMarts />} />
						<Route path="delhi-marts" element={<DelhiMarts />} />
						<Route path="customers" element={<Customers />} />
						<Route path="users" element={<Users />} />
						<Route path="settings" element={<Settings />} />
					</Route>
				<Route path="*" element={<Navigate to="/login" replace />} />
			</Routes>
		</>
	);
}


