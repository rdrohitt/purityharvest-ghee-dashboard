import React, { useState } from 'react';
import type { Followup } from '../../utils/followups';
import { CALLER_OPTIONS, DUMMY_CALL_HISTORY_RECORDS } from './followupsConstants';
import { formatDate, toInputDate } from './followupsFormat';

export function FollowupCallHistoryModal({
    followup,
    onClose,
    onAppend,
}: {
    followup: Followup;
    onClose: () => void;
    onAppend: (payload: {
        calledOn: string;
        callerName: string;
        detail: string;
        callAgainDate: string | null;
    }) => Promise<void>;
}) {
    const [calledOn, setCalledOn] = useState(() => toInputDate(new Date().toISOString()));
    const [callerName, setCallerName] = useState(followup.callerName || CALLER_OPTIONS[0] || '');
    const [detail, setDetail] = useState('');
    const [callAgainOn, setCallAgainOn] = useState('');
    const [saving, setSaving] = useState(false);

    const hasReal = followup.callingHistory.length > 0;
    const timeline = hasReal
        ? [...followup.callingHistory].sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime())
        : DUMMY_CALL_HISTORY_RECORDS;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!detail.trim() || !callerName.trim()) return;
        setSaving(true);
        try {
            await onAppend({
                calledOn,
                callerName,
                detail,
                callAgainDate: callAgainOn.trim() ? callAgainOn : null,
            });
            setDetail('');
            setCallAgainOn('');
            setCalledOn(toInputDate(new Date().toISOString()));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fu-hist-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fu-hist-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="fu-hist-modal" onClick={(e) => e.stopPropagation()}>
                <div className="fu-hist-modal__head">
                    <div>
                        <h2 id="fu-hist-title" className="fu-hist-modal__title">
                            Call history
                        </h2>
                        <p className="fu-hist-modal__sub">
                            {followup.customerName}
                            <span className="fu-hist-modal__phone">{followup.customerPhone}</span>
                        </p>
                    </div>
                    <button type="button" className="fu-hist-modal__close" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                {!hasReal ? (
                    <div className="fu-hist-demo-banner">
                        <strong>Sample entries</strong>
                        <span>Preview only — your saved calls will replace this list.</span>
                    </div>
                ) : null}

                <div className="fu-hist-list">
                    <ol className="fu-hist-timeline" aria-label="Call history, newest first">
                        {timeline.map((entry, index) => {
                            const isLatest = index === 0;
                            const called = new Date(entry.calledAt);
                            const dateLine = called.toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                            });
                            const timeLine = called.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                            });
                            return (
                                <li
                                    key={entry.id}
                                    className={`fu-hist-timeline__item${!hasReal ? ' fu-hist-timeline__item--demo' : ''}${isLatest ? ' fu-hist-timeline__item--latest' : ''}`}
                                >
                                    <div className="fu-hist-timeline__rail" aria-hidden="true">
                                        <span className="fu-hist-timeline__dot" />
                                    </div>
                                    <article className="fu-hist-timeline__panel">
                                        <div className="fu-hist-timeline__panel-head">
                                            <div className="fu-hist-timeline__when">
                                                <time dateTime={entry.calledAt} className="fu-hist-timeline__date">
                                                    {dateLine}
                                                </time>
                                                <span className="fu-hist-timeline__time">{timeLine}</span>
                                            </div>
                                            <div className="fu-hist-timeline__chips">
                                                {isLatest ? (
                                                    <span className="fu-hist-timeline__pill fu-hist-timeline__pill--latest">Latest call</span>
                                                ) : null}
                                                <span className="fu-hist-timeline__pill fu-hist-timeline__pill--caller">
                                                    {entry.callerName || '—'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="fu-hist-timeline__notes">{entry.detail || '—'}</p>
                                        <div className="fu-hist-timeline__followup">
                                            <span className="fu-hist-timeline__followup-icon" aria-hidden>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <path d="M16 2v4M8 2v4M3 10h18" />
                                                </svg>
                                            </span>
                                            <span className="fu-hist-timeline__followup-label">Follow up</span>
                                            <span className="fu-hist-timeline__followup-val">
                                                {entry.callAgainDate ? formatDate(entry.callAgainDate) : 'Not set'}
                                            </span>
                                        </div>
                                    </article>
                                </li>
                            );
                        })}
                    </ol>
                </div>

                <form className="fu-hist-form" onSubmit={handleSubmit}>
                    <h3 className="fu-hist-form__title">Log a new call</h3>
                    <div className="fu-hist-form__grid">
                        <label className="fu-hist-field">
                            <span className="fu-hist-field__lab">Called on</span>
                            <input
                                className="fu-hist-field__input"
                                type="date"
                                value={calledOn}
                                onChange={(e) => setCalledOn(e.target.value)}
                                required
                            />
                        </label>
                        <label className="fu-hist-field">
                            <span className="fu-hist-field__lab">Caller</span>
                            <select
                                className="fu-hist-field__input"
                                value={callerName}
                                onChange={(e) => setCallerName(e.target.value)}
                                required
                            >
                                <option value="">Select caller</option>
                                {CALLER_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="fu-hist-field fu-hist-field--full">
                            <span className="fu-hist-field__lab">Notes</span>
                            <textarea
                                className="fu-hist-field__textarea"
                                value={detail}
                                onChange={(e) => setDetail(e.target.value)}
                                placeholder="What was discussed, outcome, next step…"
                                rows={3}
                                required
                            />
                        </label>
                        <label className="fu-hist-field">
                            <span className="fu-hist-field__lab">Call again (optional)</span>
                            <input
                                className="fu-hist-field__input"
                                type="date"
                                value={callAgainOn}
                                onChange={(e) => setCallAgainOn(e.target.value)}
                            />
                        </label>
                    </div>
                    <div className="fu-hist-form__actions">
                        <button type="button" className="fu-hist-btn fu-hist-btn--ghost" onClick={onClose}>
                            Close
                        </button>
                        <button type="submit" className="fu-hist-btn fu-hist-btn--primary" disabled={saving}>
                            {saving ? 'Saving…' : 'Save to history'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
