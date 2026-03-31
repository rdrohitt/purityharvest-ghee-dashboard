import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Spinner } from '../../components/Spinner';
import type { CreateUserPayload, UserRecord } from '../../types/users';
import { CreateUserModal } from './CreateUserModal';
import './Users.scss';
import {
    useAppDispatch,
    useAppSelector,
    setUsers as setUsersInStore,
    setUsersLoading,
    updateUserInStore,
    removeUserFromStore,
} from '../../store';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

const ROLE_OPTIONS = ['Admin', 'Manager', 'Agent'];

const ACTIONS = [
    { key: 'view', label: 'View' },
    { key: 'add', label: 'Add' },
    { key: 'modify', label: 'Modify' },
] as const;

export default function Users() {
    const dispatch = useAppDispatch();
    const users = useAppSelector((state) => state.usersTable.users);
    const loading = useAppSelector((state) => state.usersTable.loading);
    const modules = useAppSelector((state) => state.modules.modules);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [showCreate, setShowCreate] = useState(false);
    const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
    const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const normalizeUsers = useCallback((data: unknown): UserRecord[] => {
        const list = Array.isArray(data) ? data : [];
        return list.map((u: Record<string, unknown>) => ({
            id: (u.id as string) ?? (u._id as string) ?? '',
            name: (u.name as string) ?? '',
            username: (u.username as string) ?? '',
            mobile: (u.mobile as string) ?? (u.phoneNumber as string) ?? '',
            password: (u.password as string) ?? '',
            role: (u.role as string) ?? '',
            permissions: Array.isArray(u.permissions) ? (u.permissions as string[]) : [],
        }));
    }, []);

    // Load once when the list is empty. Do not depend on `users` (array identity) or the effect
    // re-runs after every failed load (setUsers([])) and spams /api/users.
    useEffect(() => {
        let cancelled = false;
        if (users.length > 0) {
            dispatch(setUsersLoading(false));
            return;
        }
        dispatch(setUsersLoading(true));
        setLoadError(null);
        apiFetch('/api/users')
            .then((res) => {
                if (cancelled) return;
                if (res.status === 403) {
                    setLoadError('You do not have permission to view this section.');
                    dispatch(setUsersInStore([]));
                    return;
                }
                if (!res.ok) throw new Error(res.statusText || 'Failed to load users');
                return res.json();
            })
            .then((data: unknown) => {
                if (cancelled) return;
                if (data === undefined) return;
                dispatch(setUsersInStore(normalizeUsers(data)));
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    setLoadError(err.message || 'Failed to load users');
                    dispatch(setUsersInStore([]));
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when empty vs non-empty
    }, [dispatch, normalizeUsers, users.length]);

    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2500);
    }

    const moduleLabelMap = useMemo(() => {
        const map: Record<string, string> = {};
        modules.forEach((m) => {
            map[m.key] = m.name || m.key;
        });
        return map;
    }, [modules]);

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

    const refetchUsers = useCallback(() => {
        dispatch(setUsersLoading(true));
        apiFetch('/api/users')
            .then((res) => (res.ok ? res.json() : []))
            .then((data: unknown) => dispatch(setUsersInStore(normalizeUsers(data))))
            .catch(() => dispatch(setUsersInStore([])));
    }, [dispatch, normalizeUsers]);

    function payloadToUserRecord(payload: CreateUserPayload): Omit<UserRecord, 'id'> {
        return {
            name: payload.name,
            mobile: payload.phoneNumber,
            username: payload.username,
            password: payload.password,
            role: payload.role,
            permissions: payload.permissions,
        };
    }

    function handleCreateSuccess() {
        refetchUsers();
        showToast('User created successfully', 'success');
    }

    function handleSubmitUser(payload: CreateUserPayload) {
        if (editingUser) {
            const updated = payloadToUserRecord(payload);
            dispatch(updateUserInStore({ id: editingUser.id, ...updated }));
            showToast('User updated successfully', 'success');
            setEditingUser(null);
            setShowCreate(false);
        }
    }

    async function handleDeleteUser() {
        if (!userToDelete) return;
        try {
            const res = await apiFetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(res.statusText || 'Failed to delete user');
            dispatch(removeUserFromStore(userToDelete.id));
            showToast('User deleted successfully!', 'delete');
            setUserToDelete(null);
        } catch (err) {
            console.error('Failed to delete user', err);
            showToast('Failed to delete user. Please try again.', 'error');
        }
    }

    return (
        <section className="users-page">
            <ToastContainer toasts={toasts} />

            <div className="card users-header-card">
                <div className="users-header-title">Users &amp; Roles</div>
                <div className="users-header-row">
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
                    <div className="users-search-row">
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
            </div>

            <div className="card users-table-card">
                <div className="users-count-bar">
                    {loading
                        ? 'Loading…'
                        : loadError
                            ? loadError
                            : `${filtered.length.toLocaleString()} user${filtered.length === 1 ? '' : 's'}`}
                </div>
                {loading ? (
                    <div className="users-table-loading">
                        <Spinner overlay message="Loading users…" />
                    </div>
                ) : !loadError ? (
                <div className="table-scroll-wrapper">
                    <table className="users-table">
                        <colgroup>
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                        </colgroup>
                        <thead>
                            <tr className="users-row-header">
                                <Th>Name</Th>
                                <Th>Username</Th>
                                <Th>Role</Th>
                                <Th>Mobile</Th>
                                <Th>Permissions</Th>
                                <Th>Actions</Th>
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
                                        </button>
                                    </Td>
                                    <Td>{u.username}</Td>
                                    <Td>{u.role}</Td>
                                    <Td>{u.mobile || '—'}</Td>
                                    <Td>
                                        <div className="users-permissions">
                                            {(() => {
                                                const byModule: Record<string, string[]> = {};
                                                for (const perm of u.permissions) {
                                                    const [modKey, actionKey] = perm.split(':');
                                                    if (!modKey || !actionKey) continue;
                                                    const action = ACTIONS.find((a) => a.key === actionKey);
                                                    const actionLabel = action ? action.label : actionKey;
                                                    if (!byModule[modKey]) byModule[modKey] = [];
                                                    if (!byModule[modKey].includes(actionLabel)) {
                                                        byModule[modKey].push(actionLabel);
                                                    }
                                                }
                                                const entries = Object.entries(byModule);
                                                if (entries.length === 0) {
                                                    return <span className="users-permissions-empty">—</span>;
                                                }
                                                return entries.map(([modKey, actionLabels]) => {
                                                    const label = `${moduleLabelMap[modKey] ?? modKey}: ${actionLabels.join(', ')}`;
                                                    return (
                                                        <span key={modKey} className="tag users-permission-tag">
                                                            {label}
                                                        </span>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </Td>
                                    <Td>
                                        <div className="users-row-actions">
                                            <button
                                                type="button"
                                                className="icon-btn icon-btn--danger"
                                                onClick={() => setUserToDelete(u)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </Td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="users-empty">
                                        No users found
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
                ) : null}
            </div>

            {showCreate ? (
                <CreateUserModal
                    mode={editingUser ? 'edit' : 'create'}
                    initialUser={editingUser}
                    roles={ROLE_OPTIONS}
                    onClose={() => {
                        setShowCreate(false);
                        setEditingUser(null);
                    }}
                    onSubmit={handleSubmitUser}
                    onSuccess={handleCreateSuccess}
                />
            ) : null}

            {userToDelete ? (
                <DeleteUserModal
                    user={userToDelete}
                    onConfirm={handleDeleteUser}
                    onCancel={() => setUserToDelete(null)}
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
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function DeleteUserModal({
    user,
    onConfirm,
    onCancel,
}: {
    user: UserRecord;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}) {
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    const handleConfirm = async () => {
        if (isDeleting) return;
        try {
            setIsDeleting(true);
            await onConfirm();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onCancel}
            className="users-delete-modal-backdrop"
        >
            <div
                className="card users-delete-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="users-delete-modal-inner">
                    <div className="users-delete-modal-icon-row">
                        <div className="users-delete-modal-icon-wrap">
                            <span className="users-delete-modal-icon" aria-hidden="true">
                                ⚠️
                            </span>
                        </div>
                    </div>
                    <h3 className="users-delete-modal-title">Delete user?</h3>
                    <p className="users-delete-modal-text">
                        Are you sure you want to delete this user? This action cannot be undone.
                    </p>
                    <div className="users-delete-modal-user-box">
                        <div className="users-delete-modal-user-label">User</div>
                        <div className="users-delete-modal-user-name">{user.name}</div>
                        <div className="users-delete-modal-user-meta">
                            @{user.username} · {user.role}
                        </div>
                    </div>
                    <div className="users-delete-modal-actions">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="users-delete-modal-cancel"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="users-delete-modal-confirm"
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting…' : 'Delete user'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
