import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../auth';
import { useEffect, useState } from 'react';
import { applyTheme, getInitialTheme, type Theme } from '../theme';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(getInitialTheme());

    useEffect(() => {
        // close drawer on route change (mobile)
        setDrawerOpen(false);
    }, [location.pathname]);

    function handleLogout() {
        logout();
        navigate('/login');
    }

    function toggleTheme() {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        applyTheme(next);
    }

    const layoutClass = collapsed ? 'layout collapsed' : 'layout';
    const sidebarClass = drawerOpen ? 'sidebar open' : 'sidebar';

    return (
        <div className={layoutClass}>
            {/* Mobile backdrop */}
            {drawerOpen ? <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} /> : null}

            <aside className={sidebarClass}>
                <div className="brand">🔷 <span>Purity Harvest</span></div>
                <nav className="menu">
                    <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">🏠</span>
                        <span className="mi-label">Dashboard</span>
                    </NavLink>
                    <NavLink to="/admin/shopify" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">🛍️</span>
                        <span className="mi-label">Orders</span>
                    </NavLink>
                    <NavLink to="/admin/wa-leads" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📱</span>
                        <span className="mi-label">Leads</span>
                    </NavLink>
                    <NavLink to="/admin/amazon" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">🅰️</span>
                        <span className="mi-label">Amazon</span>
                    </NavLink>
                    <NavLink to="/admin/flipkart" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📦</span>
                        <span className="mi-label">Flipkart</span>
                    </NavLink>
                    <NavLink to="/admin/marketing-spend" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">💳</span>
                        <span className="mi-label">Marketing Spend</span>
                    </NavLink>
                    <NavLink to="/admin/callers" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📞</span>
                        <span className="mi-label">Callers</span>
                    </NavLink>
                    <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📦</span>
                        <span className="mi-label">Products</span>
                    </NavLink>
                    <NavLink to="/admin/followups" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📋</span>
                        <span className="mi-label">Follow-ups</span>
                    </NavLink>
                    <NavLink to="/admin/gurugram-marts" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">🏬</span>
                        <span className="mi-label">Gurugram Marts</span>
                    </NavLink>
                    <NavLink to="/admin/delhi-marts" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">🏙️</span>
                        <span className="mi-label">Delhi Marts</span>
                    </NavLink>
                </nav>
                <div style={{ marginTop: 'auto' }}>
                    <button className="button" onClick={handleLogout}>Logout</button>
                </div>
            </aside>
            <main className="content">
                <div className="topbar">
                    <button className="icon-btn" onClick={() => setDrawerOpen((v) => !v)} aria-label="Toggle menu">☰</button>
                    <button className="icon-btn" onClick={() => setCollapsed((v) => !v)} aria-label="Collapse sidebar">⇔</button>
                    <div style={{ fontWeight: 700 }}>Admin</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input className="input" placeholder="Search" style={{ height: 36, width: 220 }} />
                        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? '🌙' : '🌞'}</button>
                        <div title="Account">🙂</div>
                    </div>
                </div>
                <div className="page">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}


