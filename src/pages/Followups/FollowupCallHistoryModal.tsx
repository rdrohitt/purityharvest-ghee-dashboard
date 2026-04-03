import React, { useState } from 'react';
import { Spinner } from '../../components/Spinner';
import type { Followup } from '../../utils/followups';
import { useAppSelector } from '../../store';
import { CALLER_OPTIONS, FEEDBACK_OPTIONS } from './followupsConstants';
import { DateInput } from './DateInput';
import { formatDate, getFeedbackEmoji, toInputDate } from './followupsFormat';

export function FollowupCallHistoryModal({
    followup,
    loadingHistory = false,
    onClose,
    onAppend,
}: {
    followup: Followup;
    loadingHistory?: boolean;
    onClose: () => void;
    onAppend: (payload: {
        calledOn: string;
        callerName: string;
        detail: string;
        callAgainDate: string | null;
        feedback: string | null;
    }) => Promise<void>;
}) {
    const currentUser = useAppSelector((state) => state.user.user);
    const loggedInCallerName = (currentUser?.name || currentUser?.username || '').trim();

    const [calledOn, setCalledOn] = useState<string | null>(() => new Date().toISOString());
    const [callerName, setCallerName] = useState(
        loggedInCallerName || followup.callerName || CALLER_OPTIONS[0] || '',
    );
    const [detail, setDetail] = useState('');
    const [feedback, setFeedback] = useState('');
    const [callAgainOn, setCallAgainOn] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const busy = loadingHistory || saving;

    const timeline = [...followup.callingHistory].sort(
        (a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime(),
    );
    const countToneClass =
        timeline.length === 0
            ? 'fu-hist-modal__count--zero'
            : timeline.length < 3
              ? 'fu-hist-modal__count--low'
              : timeline.length > 3
                ? 'fu-hist-modal__count--high'
                : 'fu-hist-modal__count--mid';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!detail.trim() || !callerName.trim() || !calledOn) return;
        setSaving(true);
        try {
            await onAppend({
                calledOn: toInputDate(calledOn),
                callerName,
                detail,
                callAgainDate: callAgainOn ? toInputDate(callAgainOn) : null,
                feedback: feedback.trim() ? feedback : null,
            });
            setDetail('');
            setCallAgainOn(null);
            setCalledOn(new Date().toISOString());
            setFeedback('');
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
                            {!loadingHistory ? (
                                <span
                                    className={`fu-hist-modal__count ${countToneClass}`}
                                    aria-label={`${timeline.length} history entries`}
                                >
                                    {timeline.length}
                                </span>
                            ) : null}
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

                <div className="fu-hist-list">
                    {busy ? (
                        <div className="fu-hist-loading">
                            <Spinner size="md" />
                            <p className="fu-hist-loading__msg">{saving ? 'Saving…' : 'Loading…'}</p>
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="fu-hist-empty">No calls logged yet. Use the form below to add the first call.</div>
                    ) : (
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
                                        className={`fu-hist-timeline__item${isLatest ? ' fu-hist-timeline__item--latest' : ''}`}
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
                                                        <span className="fu-hist-timeline__pill fu-hist-timeline__pill--latest">
                                                            Latest call
                                                        </span>
                                                    ) : null}
                                                    <span className="fu-hist-timeline__pill fu-hist-timeline__pill--caller">
                                                        {entry.callerName || '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="fu-hist-timeline__notes">{entry.detail || '—'}</p>
                                            <div className="fu-hist-timeline__followup">
                                                <span className="fu-hist-timeline__followup-icon" aria-hidden>
                                                    {entry.feedback ? getFeedbackEmoji(entry.feedback) : '—'}
                                                </span>
                                                <span className="fu-hist-timeline__followup-label">Feedback</span>
                                                <span className="fu-hist-timeline__followup-val">
                                                    {entry.feedback ? entry.feedback : 'Not set'}
                                                </span>
                                                <span className="fu-hist-timeline__followup-spacer" aria-hidden />
                                                <span className="fu-hist-timeline__followup-icon" aria-hidden>
                                                    ⏱️
                                                </span>
                                                <span className="fu-hist-timeline__followup-label">Call back</span>
                                                <span className="fu-hist-timeline__followup-val">
                                                    {entry.callAgainDate ? formatDate(entry.callAgainDate) : 'Not set'}
                                                </span>
                                            </div>
                                        </article>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>

                <form className="fu-hist-form" onSubmit={handleSubmit}>
                    <h3 className="fu-hist-form__title">Log a new call</h3>
                    <div className="fu-hist-form__grid">
                        <label className="fu-hist-field">
                            <span className="fu-hist-field__lab">Called on</span>
                            <DateInput value={calledOn} onChange={setCalledOn} />
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
                                {loggedInCallerName ? (
                                    <option value={loggedInCallerName}>{loggedInCallerName} (you)</option>
                                ) : null}
                                {CALLER_OPTIONS.filter((opt) => opt !== loggedInCallerName).map((opt) => (
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
                            <span className="fu-hist-field__lab">Feedback</span>
                            <select
                                className="fu-hist-field__input"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                            >
                                <option value="">{feedback ? 'Clear feedback' : 'Select feedback'}</option>
                                {FEEDBACK_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {getFeedbackEmoji(opt)} {opt}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="fu-hist-field">
                            <span className="fu-hist-field__lab">Call again (optional)</span>
                            <DateInput
                                value={callAgainOn}
                                onChange={setCallAgainOn}
                                minDate={new Date().toISOString()}
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
