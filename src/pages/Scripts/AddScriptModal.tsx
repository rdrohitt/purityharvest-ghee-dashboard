import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Spinner } from '../../components/Spinner';
import { createAdScript, fetchAdScriptById, updateAdScript } from '../../utils/ad-scripts';
import type { AdScriptApi, AdScriptCreatePayload } from '../../types/ad-scripts';
import { DatePicker } from '../sales/Shopify/DatePicker';
import { ModernSelect, type ModernSelectOption } from '../sales/Shopify/ShopifyShared';
import '../Modules/Modules.scss';
import '../sales/Shopify/Shopify.scss';
import { ScriptDescriptionRichText, isRichTextEmpty } from './ScriptDescriptionRichText';
import './Scripts.scss';

const STATUS_OPTIONS = ['draft', 'published', 'approved', 'archived'] as const;

export type ScriptProductCategory = 'Ghee' | 'Milk' | 'Oil' | 'Meta Ads';

function CategoryIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            className="shopify-modern-select__ms-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            {children}
        </svg>
    );
}

function scriptCategoryIcon(cat: ScriptProductCategory): ReactNode {
    if (cat === 'Ghee') {
        return (
            <CategoryIcon>
                <path d="M10 2v2" />
                <path d="M14 2v2" />
                <path d="M8 6h8v12a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V6z" />
                <path d="M8 10h8" />
            </CategoryIcon>
        );
    }
    if (cat === 'Milk') {
        return (
            <CategoryIcon>
                <path d="M7 4h10l1 3v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7z" />
                <path d="M8 11h8" />
                <path d="M8 15h5" />
            </CategoryIcon>
        );
    }
    if (cat === 'Meta Ads') {
        return (
            <CategoryIcon>
                <path d="M4 11v4h3l5 3V8L7 11H4z" />
                <path d="M16 8.5a4 4 0 010 7" />
                <path d="M18 6a7 7 0 010 12" />
            </CategoryIcon>
        );
    }
    return (
        <CategoryIcon>
            <path d="M12 2.7l5.5 5.5a7.5 7.5 0 1 1-10.6 0L12 2.7z" />
            <path d="M12 12v6" />
        </CategoryIcon>
    );
}

const SCRIPT_CATEGORY_OPTIONS: ModernSelectOption<ScriptProductCategory>[] = (
    ['Ghee', 'Milk', 'Oil', 'Meta Ads'] as const
).map((c) => ({
    value: c,
    label: c,
    icon: scriptCategoryIcon(c),
}));

function toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dateInputToIsoUtcMidnight(dateStr: string): string {
    const parts = dateStr.split('-').map((x) => parseInt(x, 10));
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) return new Date().toISOString();
    return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function apiDateToPickerValue(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return toInputDate(new Date());
    return toInputDate(d);
}

function normalizeCategory(raw: unknown): ScriptProductCategory {
    const c = String(raw ?? '').trim();
    if (c === 'Ghee' || c === 'Milk' || c === 'Oil' || c === 'Meta Ads') return c;
    return 'Ghee';
}

export type AddScriptModalProps = {
    onClose: () => void;
    defaultAuthor: string;
    /** When set, modal loads this script via GET /api/ad-scripts/:id and saves with PUT. */
    editScriptId: string | null;
    onSaved: (doc: AdScriptApi, isNew: boolean) => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
};

export function AddScriptModal({
    onClose,
    defaultAuthor,
    editScriptId,
    onSaved,
    showToast,
}: AddScriptModalProps) {
    const isEdit = Boolean(editScriptId);
    const [detailLoading, setDetailLoading] = useState(isEdit);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [dateStr, setDateStr] = useState(() => toInputDate(new Date()));
    const [author, setAuthor] = useState(() => defaultAuthor.trim() || '');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<string>('draft');
    const [category, setCategory] = useState<ScriptProductCategory>('Ghee');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!editScriptId) {
            setDetailLoading(false);
            setDetailError(null);
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        setDetailError(null);
        fetchAdScriptById(editScriptId)
            .then((doc) => {
                if (cancelled) return;
                setTitle(doc.title);
                setAuthor(doc.author);
                setDescription(doc.description || '');
                setStatus(doc.status || 'draft');
                setCategory(normalizeCategory(doc.category));
                setDateStr(apiDateToPickerValue(doc.date));
                setDetailLoading(false);
            })
            .catch((e) => {
                if (cancelled) return;
                setDetailError(e instanceof Error ? e.message : 'Failed to load script');
                setDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [editScriptId]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (saving || (isEdit && detailLoading)) return;
        setError(null);
        if (!title.trim() || !author.trim() || isRichTextEmpty(description)) {
            showToast('Please fill title, description, and author.', 'error');
            return;
        }
        const payload: AdScriptCreatePayload = {
            date: dateInputToIsoUtcMidnight(dateStr),
            author: author.trim(),
            title: title.trim(),
            description,
            status,
            category,
        };
        try {
            setSaving(true);
            if (isEdit && editScriptId) {
                const updated = await updateAdScript(editScriptId, payload);
                onSaved(updated, false);
                showToast('Script updated.', 'success');
            } else {
                const created = await createAdScript(payload);
                onSaved(created, true);
                showToast('Script saved successfully.', 'success');
            }
            onClose();
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : 'Failed to save script.';
            setError(msg);
            showToast(isEdit ? 'Failed to update script.' : 'Failed to save script.', 'error');
        } finally {
            setSaving(false);
        }
    }

    const formDisabled = saving || (isEdit && detailLoading);

    return (
        <div role="dialog" aria-modal="true" className="modules-modal-backdrop" onClick={onClose}>
            <div className="card modules-modal scripts-add-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modules-modal-header">
                    <h3 className="modules-modal-title">{isEdit ? 'Edit script' : 'Add script'}</h3>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
                        ✕
                    </button>
                </div>
                {isEdit && detailLoading ? (
                    <div className="scripts-modal-detail-loading" role="status" aria-live="polite">
                        <Spinner size="lg" />
                        <p className="scripts-modal-detail-loading__msg">Loading script…</p>
                    </div>
                ) : isEdit && detailError ? (
                    <div className="modules-modal-body">
                        <div className="modules-modal-error">{detailError}</div>
                        <div className="modules-modal-footer">
                            <button type="button" className="button modules-modal-primary-btn" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="modules-modal-body">
                            {error ? <div className="modules-modal-error">{error}</div> : null}
                            <div className="modules-form-grid">
                                <div className="modules-form-full-row scripts-add-modal__title-category-row">
                                    <div className="scripts-add-modal__title-field">
                                        <label className="label" htmlFor="script-modal-title">
                                            Title
                                        </label>
                                        <input
                                            id="script-modal-title"
                                            className="input modules-input"
                                            value={title}
                                            onChange={(ev) => setTitle(ev.target.value)}
                                            placeholder="e.g. Festive bilona purity hook"
                                            required
                                        />
                                    </div>
                                    <div className="scripts-add-modal__category-field">
                                        <div className="label" id="script-modal-category-label">
                                            Category
                                        </div>
                                        <ModernSelect<ScriptProductCategory>
                                            value={category}
                                            onChange={(v) => {
                                                if (
                                                    v === 'Ghee' ||
                                                    v === 'Milk' ||
                                                    v === 'Oil' ||
                                                    v === 'Meta Ads'
                                                ) {
                                                    setCategory(v);
                                                }
                                            }}
                                            options={SCRIPT_CATEGORY_OPTIONS}
                                            aria-label="Category"
                                        />
                                    </div>
                                </div>
                                <div className="scripts-add-modal__date-field">
                                    <div className="label" id="script-modal-date-label">
                                        Date
                                    </div>
                                    <DatePicker
                                        value={dateStr}
                                        onChange={setDateStr}
                                        placeholder="Select date"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label" htmlFor="script-modal-author">
                                        Author
                                    </label>
                                    <input
                                        id="script-modal-author"
                                        className="input modules-input"
                                        value={author}
                                        onChange={(ev) => setAuthor(ev.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label" htmlFor="script-modal-status">
                                        Status
                                    </label>
                                    <select
                                        id="script-modal-status"
                                        className="input modules-input"
                                        value={status}
                                        onChange={(ev) => setStatus(ev.target.value)}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="modules-form-full-row">
                                    <div className="label" id="script-modal-desc-label">
                                        Description
                                    </div>
                                    <ScriptDescriptionRichText
                                        key={editScriptId ?? 'new'}
                                        initialContent={description}
                                        onChange={setDescription}
                                        placeholder="Short ad copy focused on purity and bilona method."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modules-modal-footer">
                            <button type="button" className="icon-btn" onClick={onClose} disabled={saving}>
                                Cancel
                            </button>
                            <button type="submit" className="button modules-modal-primary-btn" disabled={formDisabled}>
                                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save script'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
