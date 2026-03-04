import { useMemo, useState } from 'react';
import type { UserRecord } from '../../utils/users';
import './Users.scss';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error';
};

const ROLE_OPTIONS = ['Admin', 'Manager', 'Agent'];

const MODULES = [
    { key: 'orders', label: 'Orders' },
    { key: 'products', label: 'Products' },
    { key: 'marts', label: 'Marts' },
    { key: 'reports', label: 'Reports' },
    { key: 'users', label: 'Users & Roles' },
] as const;

const ACTIONS = [
    { key: 'view', label: 'View' },
    { key: 'add', label: 'Add' },
    { key: 'modify', label: 'Modify' },
] as const;

const INITIAL_USERS: UserRecord[] = [
    {
        id: 'U-001',
        name: 'Rohit Dahiya',
        mobile: '9876543210',
        username: 'rohit',
        password: 'admin123',
        role: 'Admin',
        permissions: [
            'orders:view',
            'orders:add',
            'orders:modify',
            'products:view',
            'products:add',
            'products:modify',
            'marts:view',
            'marts:add',
            'marts:modify',
            'reports:view',
            'users:view',
            'users:add',
            'users:modify',
        ],
    },
    {
        id: 'U-002',
        name: 'Operations Manager',
        mobile: '9999999999',
        username: 'ops_manager',
        password: 'manager123',
        role: 'Manager',
        permissions: [
            'orders:view',
            'orders:modify',
            'products:view',
            'products:modify',
            'marts:view',
            'marts:modify',
            'reports:view',
        ],
    },
    {
        id: 'U-003',
        name: 'Support Agent',
        mobile: '8888888888',
        username: 'agent',
        password: 'agent123',
        role: 'Agent',
        permissions: ['orders:view', 'reports:view'],
    },
];

export default function Users() {
    const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [showCreate, setShowCreate] = useState(false);
    const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    function showToast(message: string, type: 'success' | 'error' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2500);
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            const matchesText =
                !q ||
                u.name.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                u.mobile.includes(q) ||
                u.role.toLowerCase().includes(q) ||
                u.permissions.some((p) => p.toLowerCase().includes(q));
            const matchesRole = !roleFilter || u.role === roleFilter;
            return matchesText && matchesRole;
        });
    }, [users, search, roleFilter]);

    function handleCreateUser(newUser: Omit<UserRecord, 'id'>) {
        const id = `U-${(users.length + 1).toString().padStart(3, '0')}`;
        setUsers((prev) => [{ id, ...newUser }, ...prev]);
        showToast('User created successfully', 'success');
        setShowCreate(false);
    }

    function handleUpdateUser(id: string, updated: Omit<UserRecord, 'id'>) {
        setUsers((prev) =>
            prev.map((u) => (u.id === id ? { id, ...updated } : u))
        );
        showToast('User updated successfully', 'success');
        setEditingUser(null);
        setShowCreate(false);
    }

    return (
        <section className="users-page">
            <ToastContainer toasts={toasts} />

            <div className="card users-header-card">
                <div className="users-header-title">Users &amp; Roles</div>
                <div className="users-header-row">
                    <div className="users-role-filter-group">
                        <div className="users-role-filter">
                            <label className="label users-role-filter-label">Role</label>
                            <select
                                className="input users-role-filter-select"
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                            >
                                <option value="">All</option>
                                {ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="users-header-spacer" />
                    <input
                        className="input users-search"
                        placeholder="Search by name, role or permission"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                        className="button users-create-btn"
                        onClick={() => {
                            setEditingUser(null);
                            setShowCreate(true);
                        }}
                    >
                        Create User
                    </button>
                </div>
            </div>

            <div className="card users-table-card">
                <div className="users-count-bar">
                    {`${filtered.length.toLocaleString()} user${filtered.length === 1 ? '' : 's'}`}
                </div>
                <div className="table-scroll-wrapper">
                    <table className="users-table">
                        <colgroup>
                            <col />
                            <col />
                            <col />
                            <col />
                        </colgroup>
                        <thead>
                            <tr className="users-row-header">
                                <Th>User</Th>
                                <Th>Role</Th>
                                <Th>Mobile</Th>
                                <Th>Permissions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((u) => (
                                <tr key={u.id} className="users-row">
                                    <Td className="users-td--strong">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingUser(u);
                                                setShowCreate(true);
                                            }}
                                            className="users-name-btn"
                                        >
                                            <span className="users-name">
                                                {u.name}
                                            </span>
                                            <span className="users-meta">
                                                @{u.username} · {u.id}
                                            </span>
                                        </button>
                                    </Td>
                                    <Td>{u.role}</Td>
                                    <Td>{u.mobile}</Td>
                                    <Td>
                                        <div className="users-permissions">
                                            {MODULES.flatMap((mod) => {
                                                const actions = ACTIONS.filter((a) =>
                                                    u.permissions.includes(`${mod.key}:${a.key}`)
                                                );
                                                if (actions.length === 0) return [];
                                                const label = `${mod.label}: ${actions
                                                    .map((a) => a.label)
                                                    .join(', ')}`;
                                                return (
                                                    <span key={mod.key} className="tag users-permission-tag">
                                                        {label}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </Td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="users-empty">
                                        No users found
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreate ? (
                <CreateUserModal
                    mode={editingUser ? 'edit' : 'create'}
                    initialUser={editingUser}
                    roles={ROLE_OPTIONS}
                    permissions={[]}
                    onClose={() => {
                        setShowCreate(false);
                        setEditingUser(null);
                    }}
                    onSubmit={(payload) => {
                        if (editingUser) {
                            handleUpdateUser(editingUser.id, payload);
                        } else {
                            handleCreateUser(payload);
                        }
                    }}
                />
            ) : null}
        </section>
    );
}

function Th({ children }: { children: string }) {
    return <th className="users-th">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
    const cls = className ? `users-td ${className}` : 'users-td';
    return <td className={cls}>{children}</td>;
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    if (toasts.length === 0) return null;
    return (
        <div className="users-toast-container">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast users-toast"
                    data-type={toast.type}
                >
                    <div className="users-toast-content">
                        <span className="users-toast-icon">
                            {toast.type === 'success' ? '✓' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function CreateUserModal({
    mode,
    initialUser,
    roles,
    permissions,
    onClose,
    onSubmit,
}: {
    mode: 'create' | 'edit';
    initialUser: UserRecord | null;
    roles: string[];
    permissions: string[];
    onClose: () => void;
    onSubmit: (user: Omit<UserRecord, 'id'>) => void;
}) {
    const [name, setName] = useState(initialUser?.name ?? '');
    const [mobile, setMobile] = useState(initialUser?.mobile ?? '');
    const [username, setUsername] = useState(initialUser?.username ?? '');
    const [password, setPassword] = useState(initialUser?.password ?? '');
    const [role, setRole] = useState(initialUser?.role ?? roles[0] ?? '');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
        initialUser?.permissions ?? ['orders:view']
    );

    function togglePermission(value: string) {
        setSelectedPermissions((prev) =>
            prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
        );
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !username.trim() || !password.trim()) return;
        onSubmit({
            name: name.trim(),
            mobile: mobile.trim(),
            username: username.trim(),
            password,
            role,
            permissions: selectedPermissions.slice().sort(),
        });
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="users-modal-backdrop"
        >
            <div
                className="card users-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="users-modal-header">
                    <h3 className="users-modal-title">{mode === 'edit' ? 'Edit User' : 'Create User'}</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
                <form
                    onSubmit={handleSubmit}
                    className="users-modal-body"
                >
                    <div className="users-form-grid">
                        <div className="users-form-full-row">
                            <label className="label">Full Name</label>
                            <input
                                className="input users-input--compact"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter user name"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Mobile Number</label>
                            <input
                                className="input users-input--compact"
                                value={mobile}
                                onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '');
                                    if (digits.length <= 10) setMobile(digits);
                                }}
                                placeholder="10-digit mobile"
                                inputMode="numeric"
                                maxLength={10}
                            />
                        </div>
                        <div>
                            <label className="label">Username</label>
                            <input
                                className="input users-input--compact"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Login username"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <input
                                className="input users-input--compact"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Set password"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Role</label>
                            <select
                                className="input users-input--compact"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                {roles.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="label users-permissions-label">
                            Permissions
                        </label>
                        <div
                            className="users-permissions-grid"
                        >
                            {MODULES.map((mod) => (
                                <div
                                    key={mod.key}
                                    className="users-permissions-module"
                                >
                                    <div
                                        className="users-permissions-module-name"
                                    >
                                        {mod.label}
                                    </div>
                                    <div className="users-permissions-actions">
                                        {ACTIONS.map((action) => {
                                            const permKey = `${mod.key}:${action.key}`;
                                            return (
                                                <label
                                                    key={permKey}
                                                    className="users-permissions-checkbox"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPermissions.includes(permKey)}
                                                        onChange={() => togglePermission(permKey)}
                                                    />
                                                    <span>{action.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        className="users-modal-footer"
                    >
                        <button type="button" className="icon-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button users-modal-primary-btn"
                        >
                            {mode === 'edit' ? 'Save Changes' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

