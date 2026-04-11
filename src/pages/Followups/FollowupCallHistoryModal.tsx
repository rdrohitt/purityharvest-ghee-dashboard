import React, { useMemo, useState } from "react";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal/DeleteConfirmModal";
import { Spinner } from "../../components/Spinner";
import {
  type Followup,
  isFollowupHistoryEntryDeletable,
} from "../../utils/followups";
import { useAppSelector } from "../../store";
import {
  ModernSelect,
  type ModernSelectOption,
} from "../sales/Shopify/ShopifyShared";
import { CALLER_OPTIONS, FEEDBACK_OPTIONS } from "./followupsConstants";
import { DateInput } from "./DateInput";
import { formatDate, getFeedbackEmoji, toInputDate } from "./followupsFormat";

export function FollowupCallHistoryModal({
  followup,
  loadingHistory = false,
  onClose,
  onAppend,
  deletingHistoryEntryId = null,
  onDeleteHistoryEntry,
}: {
  followup: Followup;
  loadingHistory?: boolean;
  onClose: () => void;
  onAppend: (payload: {
    calledOn: string;
    callerName: string;
    detail: string;
    callAgainDate: string;
    feedback: string;
  }) => Promise<void>;
  deletingHistoryEntryId?: string | null;
  onDeleteHistoryEntry: (entryId: string) => void | Promise<void>;
}) {
  const currentUser = useAppSelector((state) => state.user.user);
  const loggedInCallerName = (
    currentUser?.name ||
    currentUser?.username ||
    ""
  ).trim();

  const [calledOn, setCalledOn] = useState<string | null>(() =>
    new Date().toISOString(),
  );
  const [callerName, setCallerName] = useState(
    loggedInCallerName || followup.callerName || CALLER_OPTIONS[0] || "",
  );
  const [detail, setDetail] = useState("-");
  const [feedback, setFeedback] = useState("");
  const [callAgainOn, setCallAgainOn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyEntryIdPendingDelete, setHistoryEntryIdPendingDelete] =
    useState<string | null>(null);

  const busy = loadingHistory || saving;

  const timeline = [...followup.callingHistory].sort(
    (a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime(),
  );

  const entryPendingDelete = useMemo(
    () =>
      historyEntryIdPendingDelete
        ? timeline.find((e) => e.id === historyEntryIdPendingDelete)
        : null,
    [historyEntryIdPendingDelete, timeline],
  );
  const countToneClass =
    timeline.length === 0
      ? "fu-hist-modal__count--zero"
      : timeline.length < 3
        ? "fu-hist-modal__count--low"
        : timeline.length > 3
          ? "fu-hist-modal__count--high"
          : "fu-hist-modal__count--mid";

  const feedbackSelectOptions = useMemo((): ModernSelectOption<string>[] => {
    return FEEDBACK_OPTIONS.map((opt) => ({
      value: opt,
      label: `${getFeedbackEmoji(opt)} ${opt}`,
    }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detail.trim() || !callerName.trim() || !calledOn) return;
    if (!feedback.trim()) return;
    setSaving(true);
    try {
      await onAppend({
        calledOn: toInputDate(calledOn),
        callerName,
        detail,
        callAgainDate: callAgainOn ? toInputDate(callAgainOn) : "",
        feedback: feedback.trim(),
      });
      setDetail("-");
      setCallAgainOn(null);
      setCalledOn(new Date().toISOString());
      setFeedback("");
    } catch {
      /* Parent shows toast and keeps modal open; form values unchanged. */
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
      <div className="fu-hist-overlay__slot">
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
                <span className="fu-hist-modal__phone">
                  {followup.customerPhone}
                </span>
              </p>
            </div>
            <button
              type="button"
              className="fu-hist-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="fu-hist-list">
            {busy ? (
              <div className="fu-hist-loading">
                <Spinner size="md" />
                <p className="fu-hist-loading__msg">
                  {saving ? "Saving…" : "Loading…"}
                </p>
              </div>
            ) : timeline.length === 0 ? (
              <div className="fu-hist-empty">
                No calls logged yet. Use the form below to add the first call.
              </div>
            ) : (
              <ol
                className="fu-hist-timeline"
                aria-label="Call history, newest first"
              >
                {timeline.map((entry, index) => {
                  const isLatest = index === 0;
                  const called = new Date(entry.calledAt);
                  const dateLine = called.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeLine = called.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const canDelete = isFollowupHistoryEntryDeletable(entry.id);
                  const rowDeleting = deletingHistoryEntryId === entry.id;
                  return (
                    <li
                      key={entry.id}
                      className={`fu-hist-timeline__item${isLatest ? " fu-hist-timeline__item--latest" : ""}`}
                    >
                      <div
                        className="fu-hist-timeline__rail"
                        aria-hidden="true"
                      >
                        <span className="fu-hist-timeline__dot" />
                      </div>
                      <article className="fu-hist-timeline__panel">
                        <div className="fu-hist-timeline__panel-head">
                          <div className="fu-hist-timeline__when">
                            <time
                              dateTime={entry.calledAt}
                              className="fu-hist-timeline__date"
                            >
                              {dateLine}
                            </time>
                            <span className="fu-hist-timeline__time">
                              {timeLine}
                            </span>
                          </div>
                          <div className="fu-hist-timeline__head-right">
                            <div className="fu-hist-timeline__chips">
                              {isLatest ? (
                                <span className="fu-hist-timeline__pill fu-hist-timeline__pill--latest">
                                  Latest call
                                </span>
                              ) : null}
                              <span className="fu-hist-timeline__pill fu-hist-timeline__pill--caller">
                                {entry.callerName || "—"}
                              </span>
                            </div>
                            {canDelete ? (
                              <button
                                type="button"
                                className="fu-hist-timeline__delete"
                                aria-label="Delete this call"
                                disabled={!!deletingHistoryEntryId}
                                onClick={() =>
                                  setHistoryEntryIdPendingDelete(entry.id)
                                }
                              >
                                {rowDeleting ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <svg
                                    className="fu-hist-timeline__delete-icon"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <p className="fu-hist-timeline__notes">
                          {entry.detail || "—"}
                        </p>
                        <div className="fu-hist-timeline__followup">
                          <span
                            className="fu-hist-timeline__followup-icon"
                            aria-hidden
                          >
                            {entry.feedback
                              ? getFeedbackEmoji(entry.feedback)
                              : "—"}
                          </span>
                          <span className="fu-hist-timeline__followup-label">
                            Feedback
                          </span>
                          <span className="fu-hist-timeline__followup-val">
                            {entry.feedback ? entry.feedback : "Not set"}
                          </span>
                          <span
                            className="fu-hist-timeline__followup-spacer"
                            aria-hidden
                          />
                          <span
                            className="fu-hist-timeline__followup-icon"
                            aria-hidden
                          >
                            ⏱️
                          </span>
                          <span className="fu-hist-timeline__followup-label">
                            Call back
                          </span>
                          <span className="fu-hist-timeline__followup-val">
                            {entry.callAgainDate
                              ? formatDate(entry.callAgainDate)
                              : "Not set"}
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
                  disabled
                >
                  <option value="">Select caller</option>
                  {loggedInCallerName ? (
                    <option value={loggedInCallerName}>
                      {loggedInCallerName} (you)
                    </option>
                  ) : null}
                  {CALLER_OPTIONS.filter(
                    (opt) => opt !== loggedInCallerName,
                  ).map((opt) => (
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
                <span className="fu-hist-field__lab">Feedback (required)</span>
                <ModernSelect<string>
                  className="fu-followups-modern-select fu-hist-form__modern-select"
                  variant="default"
                  value={feedback}
                  onChange={(v) => setFeedback(v)}
                  options={feedbackSelectOptions}
                  placeholder="Select feedback"
                  aria-label="Feedback"
                />
              </label>
              <label className="fu-hist-field">
                <span className="fu-hist-field__lab">
                  Call again (optional)
                </span>
                <DateInput
                  value={callAgainOn}
                  onChange={setCallAgainOn}
                  minDate={new Date().toISOString()}
                />
              </label>
            </div>
            <div className="fu-hist-form__actions">
              <button
                type="button"
                className="fu-hist-btn fu-hist-btn--ghost"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="submit"
                className="fu-hist-btn fu-hist-btn--primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save to history"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <DeleteConfirmModal
        open={!!entryPendingDelete}
        title="Delete call?"
        backdropClassName="fu-delete-modal--nested"
        description={
          <>
            Are you sure you want to remove this call from history?{" "}
            <strong>This cannot be undone.</strong>
          </>
        }
        details={
          entryPendingDelete ? (
            <>
              <div className="delete-modal-customer-label">Call</div>
              <div className="delete-modal-customer-name">
                {new Date(entryPendingDelete.calledAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {entryPendingDelete.callerName
                  ? ` · ${entryPendingDelete.callerName}`
                  : ""}
              </div>
              <div className="delete-modal-customer-amount">
                {entryPendingDelete.detail?.trim()
                  ? entryPendingDelete.detail.trim().length > 120
                    ? `${entryPendingDelete.detail.trim().slice(0, 120)}…`
                    : entryPendingDelete.detail.trim()
                  : "No notes"}
              </div>
            </>
          ) : null
        }
        confirmLabel="Delete call"
        busyConfirmLabel="Deleting…"
        onCancel={() => setHistoryEntryIdPendingDelete(null)}
        onConfirm={async () => {
          const id = historyEntryIdPendingDelete;
          if (!id) return;
          await onDeleteHistoryEntry(id);
          setHistoryEntryIdPendingDelete(null);
        }}
      />
    </div>
  );
}
