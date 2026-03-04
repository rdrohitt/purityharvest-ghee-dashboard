import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import Products from './pages/Products/index';
import GurugramMarts from './pages/Marts/GurugramMarts/index';
import DelhiMarts from './pages/Marts/DelhiMarts/index';
import Modules from './pages/Modules/index';
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
					<Route path="users-and-roles" element={<Users />} />
					<Route path="modules" element={<Modules />} />
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


