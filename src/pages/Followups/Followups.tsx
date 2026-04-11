import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { type Followup, type CallingHistoryEntry, fetchFollowupsDashboard, dashboardRowToFollowup } from '../../utils/followups';
import { apiFetch } from '../../api';
import { useAppSelector } from '../../store';
import type { FollowupsCustomerHistoryResponse } from '../../types/followups';
import { CustomerProfileModal } from '../sales/Shopify/CustomerProfileModal';
import { FollowupCallHistoryModal } from './FollowupCallHistoryModal';
import type { FollowupsToast } from './followupsTypes';
import { filterFollowups } from './filterFollowups';
import { FollowupsFiltersSection } from './FollowupsFiltersSection';
import { FollowupsHeader } from './FollowupsHeader';
import { FollowupsPagination } from './FollowupsPagination';
import { FollowupsTable } from './FollowupsTable';
import { ToastContainer } from './ToastContainer';
import '../sales/Shopify/Shopify.scss';
import './Followups.scss';

async function readFollowupApiErrorMessage(res: Response): Promise<string> {
    try {
        const text = await res.text();
        if (!text.trim()) {
            return res.statusText || `Request failed (${res.status})`;
        }
        try {
            const j = JSON.parse(text) as Record<string, unknown>;
            if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
            if (typeof j.error === 'string' && j.error.trim()) return j.error.trim();
        } catch {
            /* not JSON */
        }
        return text.length > 240 ? `${text.slice(0, 240)}…` : text;
    } catch {
        return res.statusText || `Request failed (${res.status})`;
    }
}

export default function Followups() {
    const currentYear = String(new Date().getFullYear());
    const currentMonth = String(new Date().getMonth() + 1);
    const [callerFilter, setCallerFilter] = useState('');
    const [feedbackFilter, setFeedbackFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState(currentMonth);
    const [yearFilter, setYearFilter] = useState(currentYear);
    const [monthDraft, setMonthDraft] = useState(currentMonth);
    const [yearDraft, setYearDraft] = useState(currentYear);
    const [callingDateFilter, setCallingDateFilter] = useState('');
    const [upcomingFilter, setUpcomingFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [followups, setFollowups] = useState<Followup[]>([]);
    const [showCustomerProfile, setShowCustomerProfile] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
    const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
    const [historyModalFollowup, setHistoryModalFollowup] = useState<Followup | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [dashboardMeta, setDashboardMeta] = useState<{
        total: number;
        totalPages: number;
        count: number;
        page: number;
        limit: number;
    } | null>(null);
    const [toasts, setToasts] = useState<FollowupsToast[]>([]);
    const currentUser = useAppSelector((state) => state.user.user);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'delete' = 'success') => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const dashboard = await fetchFollowupsDashboard({
                    page,
                    limit: pageSize,
                    month: Number(monthFilter || currentMonth),
                    year: yearFilter ? Number(yearFilter) : undefined,
                });
                if (cancelled) return;
                setDashboardMeta({
                    total: dashboard.total,
                    totalPages: dashboard.totalPages,
                    count: dashboard.count,
                    page: dashboard.page,
                    limit: dashboard.limit,
                });
                if (dashboard.page !== page) {
                    setPage(dashboard.page);
                }
                setFollowups(dashboard.rows.map(dashboardRowToFollowup));
            } catch (error) {
                console.error('Error loading followups dashboard:', error);
                if (!cancelled) {
                    setDashboardMeta(null);
                    setFollowups([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [page, pageSize, monthFilter, yearFilter, currentMonth]);

    const totalRecords = dashboardMeta?.total ?? 0;
    const totalPages = Math.max(1, dashboardMeta?.totalPages ?? 1);
    const rangeStart =
        !dashboardMeta || totalRecords === 0 || dashboardMeta.count === 0
            ? 0
            : (dashboardMeta.page - 1) * dashboardMeta.limit + 1;
    const rangeEnd =
        !dashboardMeta || totalRecords === 0 || dashboardMeta.count === 0
            ? 0
            : Math.min((dashboardMeta.page - 1) * dashboardMeta.limit + dashboardMeta.count, totalRecords);

    const baseFollowups = followups;

    const { monthOptions, yearOptions } = useMemo(() => {
        const mo = Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            return {
                value: month.toString(),
                label: new Date(2000, index, 1).toLocaleDateString('en-US', { month: 'long' }),
            };
        });
        const yo = ['2024', '2025', '2026'].map((year) => ({
            value: year,
            label: year,
        }));
        return { monthOptions: mo, yearOptions: yo };
    }, []);

    const filtered = useMemo(
        () =>
            filterFollowups(baseFollowups, {
                searchQuery,
                callerFilter,
                feedbackFilter,
                monthFilter,
                yearFilter,
                callingDateFilter,
                upcomingFilter,
            }),
        [baseFollowups, searchQuery, callerFilter, feedbackFilter, monthFilter, yearFilter, callingDateFilter, upcomingFilter],
    );

    const clearAllFilters = useCallback(() => {
        setSearchQuery('');
        setCallerFilter('');
        setFeedbackFilter('');
        setMonthFilter(currentMonth);
        setYearFilter(currentYear);
        setMonthDraft(currentMonth);
        setYearDraft(currentYear);
        setCallingDateFilter('');
        setUpcomingFilter('');
        setPage(1);
    }, [currentYear, currentMonth]);

    const applyMonthYearFilters = useCallback(() => {
        setMonthFilter(monthDraft);
        setYearFilter(yearDraft);
        setPage(1);
    }, [monthDraft, yearDraft]);

    const monthYearApplyDisabled = monthDraft === monthFilter && yearDraft === yearFilter;

    const updateFollowup = useCallback(
        async (id: string, field: keyof Followup, value: string | null) => {
            const followup = followups.find((f) => f.id === id);
            if (!followup) return;

            const updatedFollowup = { ...followup, [field]: value };
            setFollowups((prev) => prev.map((f) => (f.id === id ? updatedFollowup : f)));

        },
        [followups],
    );

    const appendCallLog = useCallback(
        async (
            followupId: string,
            payload: {
                calledOn: string;
                callerName: string;
                detail: string;
                callAgainDate: string;
                feedback: string;
            },
        ) => {
            const followup = followups.find((f) => f.id === followupId);
            if (!followup) return;

            const callerId = currentUser?._id ?? null;
            const customerId = followup.customerId;

            if (!customerId || !callerId) {
                showToast(
                    !customerId
                        ? 'Cannot save call: customer is missing for this row.'
                        : 'Cannot save call: you must be logged in as a caller.',
                    'error',
                );
                throw new Error('BLOCKED');
            }

            if (!payload.feedback.trim()) {
                showToast('Please select feedback before saving.', 'error');
                return;
            }

            const calledAt = new Date(`${payload.calledOn}T12:00:00`).toISOString();
            const actorName = (currentUser?.name || currentUser?.username || '').trim() || null;
            const newEntry: CallingHistoryEntry = {
                id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                calledAt,
                callerName: payload.callerName.trim(),
                callerId: null,
                detail: payload.detail.trim(),
                callAgainDate: payload.callAgainDate.trim()
                    ? new Date(`${payload.callAgainDate}T12:00:00`).toISOString()
                    : null,
                feedback: payload.feedback.trim(),
                createdAt: calledAt,
                updatedAt: calledAt,
                createdByName: actorName,
                updatedByName: actorName,
                createdById: currentUser?._id ?? null,
                updatedById: currentUser?._id ?? null,
                version: null,
            };

            const nextHistory = [newEntry, ...followup.callingHistory];
            const updatedFollowup: Followup = {
                ...followup,
                callingDate: newEntry.calledAt,
                callingDetail: newEntry.detail,
                callerName: newEntry.callerName,
                callAgainDate: newEntry.callAgainDate,
                feedback: payload.feedback.trim(),
                callingHistory: nextHistory,
            };

            setFollowups((prev) => prev.map((f) => (f.id === followupId ? updatedFollowup : f)));
            setHistoryModalFollowup((cur) => (cur?.id === followupId ? updatedFollowup : cur));

            const revert = () => {
                setFollowups((prev) => prev.map((f) => (f.id === followupId ? followup : f)));
                setHistoryModalFollowup((cur) => (cur?.id === followupId ? followup : cur));
            };

            let postSucceeded = false;

            try {
                const calledOnIso = `${payload.calledOn}T00:00:00.000Z`;
                const callAgainIso = payload.callAgainDate.trim()
                    ? `${payload.callAgainDate}T00:00:00.000Z`
                    : '';

                const res = await apiFetch('/api/followups', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        customer: customerId,
                        calledOn: calledOnIso,
                        caller: callerId,
                        feedback: payload.feedback.trim(),
                        notes: newEntry.detail.trim(),
                        callAgain: callAgainIso,
                    }),
                });

                if (!res.ok) {
                    const msg = await readFollowupApiErrorMessage(res);
                    revert();
                    showToast(msg || `Could not save call (${res.status})`, 'error');
                    const err = new Error(msg) as Error & { __followupSaveErrorToasted?: boolean };
                    err.__followupSaveErrorToasted = true;
                    throw err;
                }

                postSucceeded = true;

                try {
                    const historyRes = await apiFetch(
                        `/api/followups/customer/${encodeURIComponent(customerId)}`,
                    );
                    if (historyRes.ok) {
                        const historyJson: unknown = await historyRes.json();
                        const historyData = historyJson as FollowupsCustomerHistoryResponse;
                        if (
                            historyData &&
                            typeof historyData === 'object' &&
                            Array.isArray(historyData.history) &&
                            historyData.customer
                        ) {
                            const mappedHistory: CallingHistoryEntry[] = historyData.history.map((h) => ({
                                id: h._id,
                                calledAt: h.calledOn,
                                callerName: h.caller?.name ?? '',
                                callerId: h.caller?._id ?? null,
                                detail: h.notes ?? '',
                                callAgainDate: h.callAgain ?? null,
                                feedback: h.feedback ?? null,
                                createdAt: h.createdAt,
                                updatedAt: h.updatedAt,
                                createdByName: h.createdBy?.name ?? null,
                                updatedByName: h.updatedBy?.name ?? null,
                                createdById: h.createdBy?._id ?? null,
                                updatedById: h.updatedBy?._id ?? null,
                                version: typeof h.__v === 'number' ? h.__v : null,
                            }));
                            const sortedHistory = [...mappedHistory].sort(
                                (a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime(),
                            );
                            const latestFromApi = sortedHistory[0];
                            const refreshedFollowup: Followup = {
                                ...followup,
                                customerName: historyData.customer?.name ?? followup.customerName,
                                callingHistory: sortedHistory,
                                callingDate: latestFromApi?.calledAt ?? followup.callingDate,
                                callerName: latestFromApi?.callerName ?? followup.callerName,
                                callingDetail: latestFromApi?.detail ?? followup.callingDetail,
                                callAgainDate: latestFromApi?.callAgainDate ?? followup.callAgainDate,
                                feedback: latestFromApi?.feedback ?? followup.feedback,
                            };
                            setFollowups((prev) => prev.map((f) => (f.id === followupId ? refreshedFollowup : f)));
                            setHistoryModalFollowup((cur) =>
                                cur?.id === followupId ? refreshedFollowup : cur,
                            );
                        }
                    }
                } catch {
                    /* POST succeeded; keep optimistic UI if history refresh fails */
                }

                showToast('Call saved successfully.', 'success');
            } catch (error: unknown) {
                console.error('Error saving call history:', error);
                if (!postSucceeded) {
                    revert();
                    const toasted =
                        error &&
                        typeof error === 'object' &&
                        (error as { __followupSaveErrorToasted?: boolean }).__followupSaveErrorToasted;
                    if (!toasted) {
                        if (error instanceof Error && error.message === 'BLOCKED') {
                            /* toast already shown */
                        } else {
                            showToast('Failed to save call. Please try again.', 'error');
                        }
                    }
                }
                throw error;
            }
        },
        [followups, showToast, currentUser],
    );

    const onCustomerClick = useCallback(
        (f: Followup) => {
            const cid = (f.customerId || '').trim();
            if (!cid) {
                showToast('Customer ID is missing for this row.', 'error');
                return;
            }
            setCustomerProfileLoading(true);
            setSelectedCustomerId(cid);
            setSelectedCustomerPhone(f.customerPhone);
            setShowCustomerProfile(true);
        },
        [showToast],
    );

    const onOpenHistory = useCallback(
        async (f: Followup) => {
            // Open immediately for better UX, then hydrate timeline with the API response.
            setHistoryModalFollowup(f);
            setHistoryLoading(true);

            if (!f.customerId) {
                setHistoryLoading(false);
                return;
            }
            try {
                const res = await apiFetch(`/api/followups/customer/${encodeURIComponent(f.customerId)}`);
                if (!res.ok) {
                    throw new Error(`Failed to load followup history (HTTP ${res.status})`);
                }

                const json: unknown = await res.json();
                const data = json as FollowupsCustomerHistoryResponse;
                if (!data || typeof data !== 'object' || !Array.isArray(data.history) || !data.customer) {
                    throw new Error('Invalid followup history response shape');
                }

                const mappedHistory: CallingHistoryEntry[] = data.history.map((h) => ({
                    id: h._id,
                    calledAt: h.calledOn,
                    callerName: h.caller?.name ?? '',
                    callerId: h.caller?._id ?? null,
                    detail: h.notes ?? '',
                    callAgainDate: h.callAgain ?? null,
                    feedback: h.feedback ?? null,
                    createdAt: h.createdAt,
                    updatedAt: h.updatedAt,
                    createdByName: h.createdBy?.name ?? null,
                    updatedByName: h.updatedBy?.name ?? null,
                    createdById: h.createdBy?._id ?? null,
                    updatedById: h.updatedBy?._id ?? null,
                    version: typeof h.__v === 'number' ? h.__v : null,
                }));

                const sortedHistory = [...mappedHistory].sort(
                    (a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime(),
                );
                const latest = sortedHistory[0];

                setHistoryModalFollowup((cur) => {
                    // Avoid race conditions if user opens another customer before this request finishes.
                    if (!cur || cur.id !== f.id) return cur;
                    return {
                        ...f,
                        customerName: data.customer?.name ?? f.customerName,
                        callingHistory: sortedHistory,
                        callingDate: latest?.calledAt ?? f.callingDate,
                        callerName: latest?.callerName ?? f.callerName,
                        callingDetail: latest?.detail ?? f.callingDetail,
                        callAgainDate: latest?.callAgainDate ?? f.callAgainDate,
                        // Keep `feedback` from the dashboard row; feedback is shown per-history-entry below.
                    };
                });
            } catch (error) {
                console.error('Error loading call history:', error);
                showToast('Failed to load call history. Please try again.', 'error');
            } finally {
                setHistoryLoading(false);
            }
        },
        [showToast],
    );

    return (
        <section className="followups-page">
            {loading ? <Spinner overlay fixed message="Loading followups…" /> : null}
            {customerProfileLoading ? <Spinner overlay fixed message="Loading customer…" /> : null}
            <div className="card fu-shell">
                <FollowupsHeader
                    loading={loading}
                    visibleCount={filtered.length}
                    dashboardMeta={dashboardMeta}
                    totalRecords={totalRecords}
                />
                <FollowupsFiltersSection
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    callerFilter={callerFilter}
                    setCallerFilter={setCallerFilter}
                    feedbackFilter={feedbackFilter}
                    setFeedbackFilter={setFeedbackFilter}
                    monthFilter={monthFilter}
                    yearFilter={yearFilter}
                    monthDraft={monthDraft}
                    setMonthDraft={setMonthDraft}
                    yearDraft={yearDraft}
                    setYearDraft={setYearDraft}
                    onApplyMonthYear={applyMonthYearFilters}
                    monthYearApplyDisabled={monthYearApplyDisabled}
                    hasPendingMonthYear={monthDraft !== monthFilter || yearDraft !== yearFilter}
                    callingDateFilter={callingDateFilter}
                    setCallingDateFilter={setCallingDateFilter}
                    upcomingFilter={upcomingFilter}
                    setUpcomingFilter={setUpcomingFilter}
                    monthOptions={monthOptions}
                    yearOptions={yearOptions}
                    onClearAll={clearAllFilters}
                />
            </div>

            <div className="card fu-table-card">
                <FollowupsTable
                    loading={loading}
                    filtered={filtered}
                    baseFollowups={baseFollowups}
                    onCustomerClick={onCustomerClick}
                    onOpenHistory={onOpenHistory}
                    onUpdate={updateFollowup}
                />
                <FollowupsPagination
                    loading={loading}
                    dashboardMeta={dashboardMeta}
                    totalRecords={totalRecords}
                    totalPages={totalPages}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    page={page}
                    pageSize={pageSize}
                    setPage={setPage}
                    setPageSize={setPageSize}
                />
            </div>

            {showCustomerProfile && selectedCustomerPhone && selectedCustomerId ? (
                <CustomerProfileModal
                    customerId={selectedCustomerId}
                    customerPhone={selectedCustomerPhone}
                    onClose={() => {
                        setShowCustomerProfile(false);
                        setSelectedCustomerId(null);
                        setSelectedCustomerPhone(null);
                        setCustomerProfileLoading(false);
                    }}
                    onLoaded={() => setCustomerProfileLoading(false)}
                />
            ) : null}
            {historyModalFollowup ? (
                <FollowupCallHistoryModal
                    key={historyModalFollowup.id}
                    followup={historyModalFollowup}
                    loadingHistory={historyLoading}
                    onClose={() => {
                        setHistoryLoading(false);
                        setHistoryModalFollowup(null);
                    }}
                    onAppend={(payload) => appendCallLog(historyModalFollowup.id, payload)}
                />
            ) : null}
            <ToastContainer toasts={toasts} />
        </section>
    );
}
