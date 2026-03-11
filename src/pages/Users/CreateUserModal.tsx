import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import type { CreateUserPayload, UserRecord } from '../../types/users';
import { useAppDispatch, useAppSelector, setModules as setModulesInStore, setModulesLoading } from '../../store';
import type { ModuleApiItem, ModuleRecord } from '../../types/modules';
import './Users.scss';

const ACTIONS = [
    { key: 'view', label: 'View' },
    { key: 'add', label: 'Add' },
    { key: 'modify', label: 'Modify' },
] as const;

type Props = {
    mode: 'create' | 'edit';
    initialUser: UserRecord | null;
    roles: string[];
    onClose: () => void;
    onSubmit: (payload: CreateUserPayload) => void;
    onSuccess?: () => void;
};

export function CreateUserModal({ mode, initialUser, roles, onClose, onSubmit, onSuccess }: Props) {
    const dispatch = useAppDispatch();
    const modules = useAppSelector((state) => state.modules.modules);

    const [name, setName] = useState(initialUser?.name ?? '');
    const [phoneNumber, setPhoneNumber] = useState(
        initialUser?.mobile ?? ''
    );
    const [username, setUsername] = useState(initialUser?.username ?? '');
    const [password, setPassword] = useState(initialUser?.password ?? '');
    const [role, setRole] = useState(
        initialUser?.role ?? roles[0] ?? ''
    );
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
        initialUser?.permissions ?? []
    );
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (modules && modules.length > 0) {
            return;
        }
        dispatch(setModulesLoading(true));
        apiFetch('/api/modules')
            .then((res) => {
                if (cancelled) return;
                if (!res.ok) throw new Error(res.statusText || 'Failed to load modules');
                return res.json();
            })
            .then((data: unknown) => {
                if (cancelled) return;
                const list = (Array.isArray(data) ? data : []) as ModuleApiItem[];
                const normalized: ModuleRecord[] = list.map((item) => ({
                    id: item._id,
                    key: item.key,
                    name: item.label,
                    description: item.path || undefined,
                    order: item.order,
                    active: item.active,
                    icon: item.icon,
                }));
                dispatch(setModulesInStore(normalized));
            })
            .catch(() => {
                if (!cancelled) {
                    dispatch(setModulesInStore([]));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [dispatch, modules]);

    useEffect(() => {
        if (mode === 'create' && selectedPermissions.length === 0 && modules.length > 0) {
            const firstKey = modules[0].key || modules[0].name || 'orders';
            setSelectedPermissions([`${firstKey}:view`]);
        }
    }, [mode, modules, selectedPermissions.length]);

    function togglePermission(value: string) {
        setSelectedPermissions((prev) =>
            prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const isCreate = mode === 'create';
        if (!name.trim() || !username.trim()) return;
        if (isCreate && !password.trim()) return;
        const payload: CreateUserPayload = {
            name: name.trim(),
            username: username.trim(),
            password,
            phoneNumber: phoneNumber.trim(),
            role: role.trim().toLowerCase(),
            permissions: selectedPermissions.slice().sort(),
        };

        if (isCreate) {
            setSubmitting(true);
            try {
                const res = await apiFetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(errText || res.statusText || 'Failed to create user');
                }
                onSubmit(payload);
                onSuccess?.();
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create user');
            } finally {
                setSubmitting(false);
            }
        } else {
            if (!initialUser?.id) return;
            setSubmitting(true);
            try {
                const res = await apiFetch(`/api/users/${initialUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(errText || res.statusText || 'Failed to update user');
                }
                onSubmit(payload);
                onSuccess?.();
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update user');
            } finally {
                setSubmitting(false);
            }
        }
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
                    <h3 className="users-modal-title">
                        {mode === 'edit' ? 'Edit User' : 'Create User'}
                    </h3>
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="users-modal-body">
                    {error ? (
                        <div className="users-modal-error">{error}</div>
                    ) : null}
                    <div className="users-form-grid">
                        <div className="users-form-row users-form-row--2">
                            <div>
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
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, '');
                                        if (digits.length <= 10) setPhoneNumber(digits);
                                    }}
                                    placeholder="10-digit mobile"
                                    inputMode="numeric"
                                    maxLength={10}
                                />
                            </div>
                        </div>
                        <div className="users-form-row users-form-row--3">
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
                                    required={mode === 'create'}
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
                    </div>

                    <div>
                        <label className="label users-permissions-label">
                            Permissions
                        </label>
                        <div className="users-permissions-grid">
                            {modules.map((mod) => {
                                const anyMod = mod as any;
                                const moduleKey: string | undefined = anyMod.key || anyMod.name;
                                const moduleLabel: string = anyMod.label || anyMod.name || anyMod.key;
                                if (!moduleKey) return null;
                                return (
                                <div
                                    key={mod.id ?? moduleKey}
                                    className="users-permissions-module"
                                >
                                    <div className="users-permissions-module-name">
                                        {moduleLabel}
                                    </div>
                                    <div className="users-permissions-actions">
                                        {ACTIONS.map((action) => {
                                            const permKey = `${moduleKey}:${action.key}`;
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
                                );
                            })}
                        </div>
                    </div>

                    <div className="users-modal-footer">
                        <button
                            type="button"
                            className="icon-btn"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button users-modal-primary-btn"
                            disabled={submitting}
                        >
                            {submitting
                                ? 'Saving…'
                                : mode === 'edit'
                                    ? 'Save Changes'
                                    : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
