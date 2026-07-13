import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ModernSelect, type ModernSelectOption } from '../sales/Shopify/ShopifyShared';
import { createTarget, toTargetMonthIso } from '../../utils/targets';
import '../Modules/Modules.scss';
import './Performance.scss';

const TARGET_PLATFORM_OPTIONS: ModernSelectOption<string>[] = [
    { value: 'Meta', label: 'Meta' },
    { value: 'Abandoned', label: 'Abandoned' },
    { value: 'Whatsapp', label: 'Whatsapp' },
    { value: 'Calling', label: 'Calling' },
];

const MONTH_OPTIONS: ModernSelectOption<string>[] = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

function buildYearOptions(): ModernSelectOption<string>[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => {
        const year = String(currentYear - index);
        return { value: year, label: year };
    });
}

type Props = {
    onClose: () => void;
    onSaved: () => void;
};

export function AddTargetModal({ onClose, onSaved }: Props) {
    const now = new Date();
    const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [year, setYear] = useState(String(now.getFullYear()));
    const [platform, setPlatform] = useState('Meta');
    const [target, setTarget] = useState('250');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const yearOptions = useMemo(() => buildYearOptions(), []);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (submitting) return;

        const trimmedTarget = target.trim();
        if (!month || !year) {
            setError('Select month and year.');
            return;
        }
        if (!platform) {
            setError('Select a platform.');
            return;
        }
        if (!trimmedTarget) {
            setError('Enter a target value.');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await createTarget({
                month: toTargetMonthIso(month, year),
                target: trimmedTarget,
                platform,
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error('Failed to create target', err);
            setError('Failed to save target. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="performance-add-target-title"
            className="modules-modal-backdrop performance-add-target-modal-backdrop"
            onClick={onClose}
        >
            <div className="card modules-modal performance-add-target-modal" onClick={(e) => e.stopPropagation()}>
                <div className="performance-add-target-modal__header">
                    <div className="performance-add-target-modal__header-main">
                        <span className="performance-add-target-modal__eyebrow">Performance</span>
                        <h3 id="performance-add-target-title" className="performance-add-target-modal__title">
                            Add Target
                        </h3>
                        <p className="performance-add-target-modal__subtitle">
                            Set a monthly ROAS target for a marketing platform.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="icon-btn performance-add-target-modal__close"
                        onClick={onClose}
                        aria-label="Close"
                        disabled={submitting}
                    >
                        ✕
                    </button>
                </div>

                <form className="performance-add-target-modal__form" onSubmit={(e) => void handleSubmit(e)}>
                    <div className="performance-add-target-modal__body">
                        {error ? <div className="modules-modal-error">{error}</div> : null}

                        <section className="performance-add-target-modal__section">
                            <h4 className="performance-add-target-modal__section-title">Period</h4>
                            <div className="performance-add-target-modal__grid">
                                <div className="performance-add-target-modal__field">
                                    <label className="label" htmlFor="add-target-month">
                                        Month
                                    </label>
                                    <ModernSelect
                                        value={month}
                                        onChange={(value) => value && setMonth(value)}
                                        options={MONTH_OPTIONS}
                                        aria-label="Select month"
                                    />
                                </div>
                                <div className="performance-add-target-modal__field">
                                    <label className="label" htmlFor="add-target-year">
                                        Year
                                    </label>
                                    <ModernSelect
                                        value={year}
                                        onChange={(value) => value && setYear(value)}
                                        options={yearOptions}
                                        aria-label="Select year"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="performance-add-target-modal__section">
                            <h4 className="performance-add-target-modal__section-title">Target details</h4>
                            <div className="performance-add-target-modal__grid performance-add-target-modal__grid--stack">
                                <div className="performance-add-target-modal__field">
                                    <label className="label">Platform</label>
                                    <ModernSelect
                                        value={platform}
                                        onChange={(value) => value && setPlatform(value)}
                                        options={TARGET_PLATFORM_OPTIONS}
                                        aria-label="Select platform"
                                    />
                                </div>
                                <div className="performance-add-target-modal__field">
                                    <label className="label" htmlFor="add-target-value">
                                        Target ROAS
                                    </label>
                                    <input
                                        id="add-target-value"
                                        className="input modules-input performance-add-target-modal__input"
                                        type="text"
                                        inputMode="decimal"
                                        value={target}
                                        onChange={(e) => setTarget(e.target.value)}
                                        placeholder="e.g. 250"
                                        required
                                    />
                                    <span className="performance-add-target-modal__hint">
                                        Enter as ROAS × 100 (250 = 2.50 ROAS).
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="performance-add-target-modal__footer">
                        <button type="button" className="button performance-add-target-modal__cancel" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="button performance-add-target-modal__submit" disabled={submitting}>
                            {submitting ? 'Saving…' : 'Save Target'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
