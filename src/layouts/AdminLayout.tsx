import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { logout } from '../auth';
import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../store';
import { applyTheme, getInitialTheme, type Theme } from '../theme';
import { API_FORBIDDEN_EVENT, API_UNAUTHORIZED_EVENT } from '../api';
import './AdminLayout.scss';

export default function AdminLayout() {
    const location = useLocation();
    const meUser = useAppSelector((state) => state.user.user);
    const menu = useAppSelector((state) => state.user.menu);
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(getInitialTheme());
    const [salesOpen, setSalesOpen] = useState(true);
    const [martsOpen, setMartsOpen] = useState(false);
    const [forbiddenSection, setForbiddenSection] = useState(false);
    const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);

    useEffect(() => {
        // close drawer on route change (mobile)
        setDrawerOpen(false);
        setForbiddenSection(false);

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

    useEffect(() => {
        const onForbidden = () => setForbiddenSection(true);
        window.addEventListener(API_FORBIDDEN_EVENT, onForbidden as EventListener);
        return () => {
            window.removeEventListener(API_FORBIDDEN_EVENT, onForbidden as EventListener);
        };
    }, []);

    useEffect(() => {
        const onUnauthorized = () => setShowSessionExpiredModal(true);
        window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized as EventListener);
        return () => {
            window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized as EventListener);
        };
    }, []);

    useEffect(() => {
        if (forbiddenSection) {
            document.body.classList.add('permission-blocked-active');
        } else {
            document.body.classList.remove('permission-blocked-active');
        }
        return () => {
            document.body.classList.remove('permission-blocked-active');
        };
    }, [forbiddenSection]);

    const enabledLabels = useMemo(() => {
        const set = new Set<string>();
        menu.forEach((m) => {
            if (m.label) set.add(m.label);
        });
        return set;
    }, [menu]);

    const hasMenuLabel = (label: string) => enabledLabels.has(label);

    const topbarGreeting = useMemo(() => {
        const name = meUser?.name?.trim();
        const username = meUser?.username?.trim();
        const displayName = name || username || 'Admin';

        const hourInIST = Number(
            new Intl.DateTimeFormat('en-IN', {
                hour: '2-digit',
                hour12: false,
                timeZone: 'Asia/Kolkata',
            }).format(new Date())
        );

        let greeting = 'Good Evening';
        if (hourInIST >= 5 && hourInIST < 12) {
            greeting = 'Good Morning';
        } else if (hourInIST >= 12 && hourInIST < 17) {
            greeting = 'Good Afternoon';
        }

        return `${greeting} ${displayName}`;
    }, [meUser]);

    function handleLogout() {
        logout();
        window.location.replace('/login');
    }

    function handleSignInAgain() {
        setShowSessionExpiredModal(false);
        logout();
        window.location.replace('/login');
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
            {showSessionExpiredModal ? (
                <div className="session-expired-modal-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
                    <div className="session-expired-modal-card">
                        <h3 className="session-expired-modal-title">Session Expired</h3>
                        <p className="session-expired-modal-text">
                            Your session is logged out. Please login again.
                        </p>
                        <button type="button" className="button session-expired-modal-btn" onClick={handleSignInAgain}>
                            Sign In
                        </button>
                    </div>
                </div>
            ) : null}

            <aside className={sidebarClass}>
                <div className="brand">🔷 <span>Purity Harvest</span></div>
                <nav className="menu">
                    {hasMenuLabel('Dashboard') && (
                        <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">🏠</span>
                            <span className="mi-label">Dashboard</span>
                        </NavLink>
                    )}

                    {hasMenuLabel('Leads') && (
                        <NavLink to="/admin/wa-leads" className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">📱</span>
                            <span className="mi-label">Leads</span>
                        </NavLink>
                    )}

                    {/* Sales group */}
                    {hasMenuLabel('Sales') && (
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
                    )}

                    {hasMenuLabel('Marketing Spend') && (
                        <NavLink to="/admin/marketing-spend" className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">💳</span>
                            <span className="mi-label">Marketing Spend</span>
                        </NavLink>
                    )}
                    <NavLink to="/admin/customers" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">👥</span>
                        <span className="mi-label">Customers</span>
                    </NavLink>
                    {hasMenuLabel('Users and Roles') && (
                        <NavLink to="/admin/users-and-roles" className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">👤</span>
                            <span className="mi-label">Users &amp; Roles</span>
                        </NavLink>
                    )}
                    {hasMenuLabel('Modules') && (
                        <NavLink to="/admin/modules" className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">🧩</span>
                            <span className="mi-label">Modules</span>
                        </NavLink>
                    )}
                    {hasMenuLabel('Products') && (
                        <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">📦</span>
                            <span className="mi-label">Products</span>
                        </NavLink>
                    )}
                    {hasMenuLabel('Follow-Ups') && (
                        <NavLink to="/admin/followups" className={({ isActive }) => (isActive ? 'active' : '')}>
                            <span className="mi-icon">📋</span>
                            <span className="mi-label">Follow-ups</span>
                        </NavLink>
                    )}
                    <NavLink to="/admin/scripts" className={({ isActive }) => (isActive ? 'active' : '')}>
                        <span className="mi-icon">📝</span>
                        <span className="mi-label">Scripts</span>
                    </NavLink>

                    {/* Marts group */}
                    {hasMenuLabel('Marts') && (
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
                    )}
                </nav>
                <div className="admin-sidebar-footer">
                    <button className="button" onClick={handleLogout}>Logout</button>
                </div>
            </aside>
            <main className="content">
                <div className="topbar">
                    <button className="icon-btn" onClick={() => setDrawerOpen((v) => !v)} aria-label="Toggle menu">☰</button>
                    <button className="icon-btn" onClick={() => setCollapsed((v) => !v)} aria-label="Collapse sidebar">⇔</button>
                    <div className="admin-topbar-title" title={topbarGreeting}>
                        {topbarGreeting}
                    </div>
                    <div className="admin-topbar-right">
                        <input className="input admin-topbar-search" placeholder="Search" />
                        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? '🌙' : '🌞'}</button>
                        <div title="Account">🙂</div>
                    </div>
                </div>
                <div className={forbiddenSection ? 'page permission-blocked' : 'page'}>
                    <Outlet />
                    {forbiddenSection ? (
                        <div className="permission-overlay" role="alert" aria-live="polite">
                            <div className="permission-overlay-card">
                                You do not have permission for this section.
                            </div>
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
}


