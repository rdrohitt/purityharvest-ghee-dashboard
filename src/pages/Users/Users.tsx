import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Spinner } from '../../components/Spinner';
import type {
    CreateUserPayload,
    UserRecord,
    UsersListDashboardResponse,
    UsersListRowApi,
} from '../../types/users';
import { CreateUserModal } from './CreateUserModal';
import { FollowupsPagination } from '../Followups/FollowupsPagination';
import '../Followups/Followups.scss';
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

const ROLE_FILTER_OPTIONS = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'agent', label: 'Agent' },
] as const;

const USERS_PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;

const ACTIONS = [
    { key: 'view', label: 'View' },
    { key: 'add', label: 'Add' },
    { key: 'modify', label: 'Modify' },
    { key: 'delete', label: 'Delete' },
    { key: 'viewrto', label: 'RTO' },
] as const;

type UsersDashboardMeta = {
    total: number;
    totalPages: number;
    count: number;
    page: number;
    limit: number;
};

function normalizeUserRow(u: UsersListRowApi | Record<string, unknown>): UserRecord {
    const row = u as Record<string, unknown>;
    const createdBy = row.createdBy as UserRecord['createdBy'];
    const updatedBy = row.updatedBy as UserRecord['updatedBy'];
    return {
        id: (row.id as string) ?? (row._id as string) ?? '',
        name: (row.name as string) ?? '',
        username: (row.username as string) ?? '',
        mobile: (row.mobile as string) ?? (row.phoneNumber as string) ?? '',
        password: (row.password as string) ?? '',
        role: (row.role as string) ?? '',
        permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
        createdBy: createdBy && typeof createdBy === 'object' && '_id' in createdBy ? createdBy : undefined,
        updatedBy: updatedBy && typeof updatedBy === 'object' && '_id' in updatedBy ? updatedBy : undefined,
        __v: typeof row.__v === 'number' ? row.__v : undefined,
    };
}

function parseUsersListResponse(data: unknown): { users: UserRecord[]; meta: UsersDashboardMeta | null } {
    if (Array.isArray(data)) {
        return {
            users: data.map((u) => normalizeUserRow(u as Record<string, unknown>)),
            meta: null,
        };
    }
    if (
        data &&
        typeof data === 'object' &&
        Array.isArray((data as UsersListDashboardResponse).rows)
    ) {
        const d = data as UsersListDashboardResponse;
        return {
            users: d.rows.map((r) => normalizeUserRow(r)),
            meta: {
                total: d.total,
                totalPages: d.totalPages,
                count: d.count,
                page: d.page,
                limit: d.limit,
            },
        };
    }
    return { users: [], meta: null };
}

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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dashboardMeta, setDashboardMeta] = useState<UsersDashboardMeta | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            dispatch(setUsersLoading(true));
            setLoadError(null);
            try {
                const qs = new URLSearchParams({
                    page: String(page),
                    limit: String(pageSize),
                });
                const res = await apiFetch(`/api/users?${qs}`);
                if (cancelled) return;
                if (res.status === 403) {
                    setLoadError('You do not have permission to view this section.');
                    dispatch(setUsersInStore([]));
                    setDashboardMeta(null);
                    return;
                }
                if (!res.ok) throw new Error(res.statusText || 'Failed to load users');
                const data: unknown = await res.json();
                const { users: next, meta } = parseUsersListResponse(data);
                if (meta && meta.page !== page) {
                    setPage(meta.page);
                }
                dispatch(setUsersInStore(next));
                setDashboardMeta(meta);
            } catch (err) {
                if (!cancelled) {
                    setLoadError(err instanceof Error ? err.message : 'Failed to load users');
                    dispatch(setUsersInStore([]));
                    setDashboardMeta(null);
                }
            } finally {
                if (!cancelled) dispatch(setUsersLoading(false));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [dispatch, page, pageSize]);

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
            const matchesRole =
                !roleFilter || u.role.toLowerCase() === roleFilter.toLowerCase();
            return matchesText && matchesRole;
        });
    }, [users, search, roleFilter]);

    const paginationMeta = useMemo((): UsersDashboardMeta | null => {
        if (dashboardMeta) return dashboardMeta;
        if (users.length === 0) return null;
        return {
            total: users.length,
            totalPages: 1,
            count: users.length,
            page: 1,
            limit: users.length,
        };
    }, [dashboardMeta, users.length]);

    const totalRecords = paginationMeta?.total ?? 0;
    const totalPages = Math.max(1, paginationMeta?.totalPages ?? 1);
    const rangeStart =
        !paginationMeta || totalRecords === 0 || paginationMeta.count === 0
            ? 0
            : (paginationMeta.page - 1) * paginationMeta.limit + 1;
    const rangeEnd =
        !paginationMeta || totalRecords === 0 || paginationMeta.count === 0
            ? 0
            : Math.min(
                  (paginationMeta.page - 1) * paginationMeta.limit + paginationMeta.count,
                  totalRecords,
              );

    const refetchUsers = useCallback(() => {
        const qs = new URLSearchParams({
            page: String(page),
            limit: String(pageSize),
        });
        dispatch(setUsersLoading(true));
        apiFetch(`/api/users?${qs}`)
            .then((res) => {
                if (res.status === 403) {
                    setLoadError('You do not have permission to view this section.');
                    return null;
                }
                if (!res.ok) throw new Error(res.statusText || 'Failed to load users');
                return res.json();
            })
            .then((data: unknown) => {
                if (data === null) {
                    dispatch(setUsersInStore([]));
                    setDashboardMeta(null);
                    return;
                }
                const { users: next, meta } = parseUsersListResponse(data);
                dispatch(setUsersInStore(next));
                setDashboardMeta(meta);
            })
            .catch(() => {
                dispatch(setUsersInStore([]));
                setDashboardMeta(null);
            })
            .finally(() => dispatch(setUsersLoading(false)));
    }, [dispatch, page, pageSize]);

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
        showToast('User created successfully', 'success');
        if (page !== 1) setPage(1);
        else refetchUsers();
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
            refetchUsers();
        } catch (err) {
            console.error('Failed to delete user', err);
            showToast('Failed to delete user. Please try again.', 'error');
        }
    }

    return (
        <section className="users-page">
            {loading ? <Spinner overlay fixed message="Loading users…" /> : null}
            <ToastContainer toasts={toasts} />

            <div className="card users-header-card">
                <div className="users-header-title">Users &amp; Roles</div>
                <div className="users-header-row">
                    <div className="users-role-filter">
                        <label className="label users-role-filter-label">Role</label>
                        <select
                            className="input users-role-filter-select"
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All</option>
                            {ROLE_FILTER_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
                                </option>
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
                          : dashboardMeta
                            ? `${filtered.length.toLocaleString()} on this page · ${totalRecords.toLocaleString()} total`
                            : `${filtered.length.toLocaleString()} user${filtered.length === 1 ? '' : 's'}`}
                </div>
                {loading ? null : !loadError ? (
                <>
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
                <FollowupsPagination
                    loading={loading}
                    dashboardMeta={paginationMeta}
                    totalRecords={totalRecords}
                    totalPages={totalPages}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    page={page}
                    pageSize={pageSize}
                    setPage={setPage}
                    setPageSize={setPageSize}
                    pageSizeOptions={USERS_PAGE_SIZE_OPTIONS}
                    ariaLabel="Users pagination"
                />
                </>
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
