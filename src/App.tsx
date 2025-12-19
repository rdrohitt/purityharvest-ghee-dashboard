import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Shopify from './pages/Shopify';
import Amazon from './pages/Amazon';
import Flipkart from './pages/Flipkart';
import WALeads from './pages/WALeads';
import Followups from './pages/Followups';
import MarketingSpend from './pages/MarketingSpend';
import Products from './pages/Products';
import Callers from './pages/Callers';
import GurugramMarts from './pages/GurugramMarts';
import DelhiMarts from './pages/DelhiMarts';
import { isAuthenticated } from './auth';

function PrivateRoute({ children }: { children: ReactElement }) {
	const location = useLocation();
	if (!isAuthenticated()) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}
	return children;
}

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<Navigate to={isAuthenticated() ? '/admin' : '/login'} replace />} />
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
					<Route path="callers" element={<Callers />} />
					<Route path="products" element={<Products />} />
					<Route path="followups" element={<Followups />} />
					<Route path="marketing-spend" element={<MarketingSpend />} />
					<Route path="gurugram-marts" element={<GurugramMarts />} />
					<Route path="delhi-marts" element={<DelhiMarts />} />
					<Route path="users" element={<Users />} />
					<Route path="settings" element={<Settings />} />
				</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}


