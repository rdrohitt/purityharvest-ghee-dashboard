import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../auth';
import { useEffect, useState } from 'react';
import { applyTheme, getInitialTheme, type Theme } from '../theme';
import './AdminLayout.scss';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(getInitialTheme());
    const [salesOpen, setSalesOpen] = useState(true);
    const [martsOpen, setMartsOpen] = useState(false);

    useEffect(() => {
        // close drawer on route change (mobile)
        setDrawerOpen(false);

        // ensure sales group is expanded when a sales route is active
        if (
            location.pathname.startsWith('/admin/shopify') ||
            location.pathname.startsWith('/admin/amazon') ||
            location.pathname.startsWith('/admin/flipkart')
        ) {
            setSalesOpen(true);
        }

        // ensure marts group is expanded when a marts route is active
        if (
            location.pathname.startsWith('/admin/gurugram-marts') ||
            location.pathname.startsWith('/admin/delhi-marts')
        ) {
            setMartsOpen(true);
        }
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

                    <NavLink to="/admin/wa-leads" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📱</span>
                        <span className="mi-label">Leads</span>
                    </NavLink>

                    {/* Sales group */}
                    <div className="menu-group">
                        <button
                            type="button"
                            className="menu-group-label"
                            onClick={() => setSalesOpen((open) => !open)}
                            aria-expanded={salesOpen}
                        >
                            <span className="mi-icon">💹</span>
                            <span className="mi-label">Sales</span>
                            <span className={salesOpen ? 'menu-group-chevron open' : 'menu-group-chevron'}>
                                ▸
                            </span>
                        </button>
                        {salesOpen ? (
                            <div className="menu-group-items">
                                <NavLink to="/admin/shopify" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    <span className="mi-icon">•</span>
                                    <span className="mi-label">Shopify</span>
                                </NavLink>
                                <NavLink to="/admin/amazon" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    <span className="mi-icon">•</span>
                                    <span className="mi-label">Amazon</span>
                                </NavLink>
                                <NavLink to="/admin/flipkart" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    <span className="mi-icon">•</span>
                                    <span className="mi-label">Flipkart</span>
                                </NavLink>
                            </div>
                        ) : null}
                    </div>

                    <NavLink to="/admin/marketing-spend" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">💳</span>
                        <span className="mi-label">Marketing Spend</span>
                    </NavLink>
                    <NavLink to="/admin/users-and-roles" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">👤</span>
                        <span className="mi-label">Users &amp; Roles</span>
                    </NavLink>
                    <NavLink to="/admin/modules" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">🧩</span>
                        <span className="mi-label">Modules</span>
                    </NavLink>
                    <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📦</span>
                        <span className="mi-label">Products</span>
                    </NavLink>
                    <NavLink to="/admin/followups" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📋</span>
                        <span className="mi-label">Follow-ups</span>
                    </NavLink>

                    {/* Marts group */}
                    <div className="menu-group">
                        <button
                            type="button"
                            className="menu-group-label"
                            onClick={() => setMartsOpen((open) => !open)}
                            aria-expanded={martsOpen}
                        >
                            <span className="mi-icon">🏬</span>
                            <span className="mi-label">Marts</span>
                            <span className={martsOpen ? 'menu-group-chevron open' : 'menu-group-chevron'}>
                                ▸
                            </span>
                        </button>
                        {martsOpen ? (
                            <div className="menu-group-items">
                                <NavLink to="/admin/gurugram-marts" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    <span className="mi-icon">•</span>
                                    <span className="mi-label">Gurugram Marts</span>
                                </NavLink>
                                <NavLink to="/admin/delhi-marts" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    <span className="mi-icon">•</span>
                                    <span className="mi-label">Delhi Marts</span>
                                </NavLink>
                            </div>
                        ) : null}
                    </div>
                </nav>
                <div className="admin-sidebar-footer">
                    <button className="button" onClick={handleLogout}>Logout</button>
                </div>
            </aside>
            <main className="content">
                <div className="topbar">
                    <button className="icon-btn" onClick={() => setDrawerOpen((v) => !v)} aria-label="Toggle menu">☰</button>
                    <button className="icon-btn" onClick={() => setCollapsed((v) => !v)} aria-label="Collapse sidebar">⇔</button>
                    <div className="admin-topbar-title">Admin</div>
                    <div className="admin-topbar-right">
                        <input className="input admin-topbar-search" placeholder="Search" />
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


