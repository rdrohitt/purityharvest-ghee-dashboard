import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import {
    type Followup,
    type CallingHistoryEntry,
    fetchFollowupsDashboard,
    dashboardRowToFollowup,
    isFollowupHistoryEntryDeletable,
} from '../../utils/followups';
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

/** Thrown after an error toast so callers (e.g. delete confirm) can keep the dialog open. */
const FOLLOWUP_DELETE_TOASTED = 'FOLLOWUP_DELETE_TOASTED';
const WHATSAPP_PRODUCT_LINKS = {
    gir500: {
        label: 'Gir Cow Ghee - 500ml',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607987585117',
    },
    gir1: {
        label: 'Gir Cow Ghee - 1 ltr',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607975428189',
    },
    gir2: {
        label: 'Gir Cow Ghee - 2 ltr',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607988207709',
    },
    gir5: {
        label: 'Gir Cow Ghee - 5 ltr',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607988797533',
    },
    buffalo500: {
        label: 'Buffalo Ghee - 500ml',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43429726421085',
    },
    buffalo1: {
        label: 'Buffalo Ghee - 1 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43416353898589',
    },
    buffalo2: {
        label: 'Buffalo Ghee - 2 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43429726453853',
    },
    buffalo5: {
        label: 'Buffalo Ghee - 5 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43429726486621',
    },
    desi500: {
        label: 'Desi Cow Ghee - 500ml',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43416440799325',
    },
    desi1: {
        label: 'Desi Cow Ghee - 1 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43413517860957',
    },
    desi2: {
        label: 'Desi Cow Ghee - 2 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43416440832093',
    },
    desi5: {
        label: 'Desi Cow Ghee - 5 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43428579737693',
    },
} as const;

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

function followupFromCustomerHistoryResponse(
    base: Followup,
    data: FollowupsCustomerHistoryResponse,
): Followup {
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
    return {
        ...base,
        customerName: data.customer?.name ?? base.customerName,
        callingHistory: sortedHistory,
        callingDate: latest?.calledAt ?? base.callingDate,
        callerName: latest?.callerName ?? base.callerName,
        callingDetail: latest?.detail ?? base.callingDetail,
        callAgainDate: latest?.callAgainDate ?? base.callAgainDate,
        feedback: latest?.feedback ?? base.feedback,
    };
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
    const [deletingHistoryEntryId, setDeletingHistoryEntryId] = useState<string | null>(null);
    const [showWhatsAppProductModal, setShowWhatsAppProductModal] = useState(false);
    const [selectedWhatsAppPhone, setSelectedWhatsAppPhone] = useState<string>('');
    const [selectedWhatsAppCustomerName, setSelectedWhatsAppCustomerName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
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

    /** Remount table when a new dashboard page loads so progressive row state resets. */
    const followupsTableKey = useMemo(() => {
        if (followups.length === 0) return `p${page}-l${pageSize}-empty`;
        return `p${page}-l${pageSize}-n${followups.length}-${followups[0]?.id ?? ''}-${followups[followups.length - 1]?.id ?? ''}`;
    }, [followups, page, pageSize]);

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
                            const refreshedFollowup = followupFromCustomerHistoryResponse(followup, historyData);
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

    const removeCallLogEntry = useCallback(
        async (followupId: string, entryId: string) => {
            const followup = followups.find((f) => f.id === followupId);
            if (!followup?.customerId) {
                showToast('Customer ID is missing for this row.', 'error');
                throw new Error(FOLLOWUP_DELETE_TOASTED);
            }
            if (!isFollowupHistoryEntryDeletable(entryId)) {
                showToast('This call cannot be deleted yet.', 'error');
                throw new Error(FOLLOWUP_DELETE_TOASTED);
            }
            setDeletingHistoryEntryId(entryId);
            try {
                const res = await apiFetch(`/api/followups/history/${encodeURIComponent(entryId)}`, {
                    method: 'DELETE',
                });
                if (!res.ok) {
                    const msg = await readFollowupApiErrorMessage(res);
                    showToast(msg, 'error');
                    throw new Error(FOLLOWUP_DELETE_TOASTED);
                }

                const historyRes = await apiFetch(
                    `/api/followups/customer/${encodeURIComponent(followup.customerId)}`,
                );
                if (!historyRes.ok) {
                    showToast('Deleted, but failed to refresh history.', 'error');
                    throw new Error(FOLLOWUP_DELETE_TOASTED);
                }
                const historyJson: unknown = await historyRes.json();
                const historyData = historyJson as FollowupsCustomerHistoryResponse;
                if (
                    !historyData ||
                    typeof historyData !== 'object' ||
                    !Array.isArray(historyData.history) ||
                    !historyData.customer
                ) {
                    showToast('Deleted, but history response was invalid.', 'error');
                    throw new Error(FOLLOWUP_DELETE_TOASTED);
                }

                const refreshed = followupFromCustomerHistoryResponse(followup, historyData);
                const stillThere = refreshed.callingHistory.some((e) => e.id === entryId);
                if (stillThere) {
                    showToast('Could not remove this call (server still returned it).', 'error');
                    throw new Error(FOLLOWUP_DELETE_TOASTED);
                }

                setFollowups((prev) => prev.map((f) => (f.id === followupId ? refreshed : f)));
                setHistoryModalFollowup((cur) => (cur?.id === followupId ? refreshed : cur));
                showToast('Call deleted.', 'delete');
            } catch (e) {
                if (!(e instanceof Error && e.message === FOLLOWUP_DELETE_TOASTED)) {
                    console.error('Error deleting call history:', e);
                    showToast('Failed to delete call.', 'error');
                }
                throw e;
            } finally {
                setDeletingHistoryEntryId(null);
            }
        },
        [followups, showToast],
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

                const hydrated = followupFromCustomerHistoryResponse(f, data);

                setHistoryModalFollowup((cur) => {
                    // Avoid race conditions if user opens another customer before this request finishes.
                    if (!cur || cur.id !== f.id) return cur;
                    return hydrated;
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

    const onOpenWhatsAppPicker = useCallback(
        (f: Followup) => {
            const phoneDigits = String(f.customerPhone ?? '').replace(/\D/g, '');
            if (!phoneDigits) {
                showToast('No phone number for WhatsApp', 'error');
                return;
            }
            setSelectedWhatsAppPhone(phoneDigits);
            setSelectedWhatsAppCustomerName(f.customerName || 'Customer');
            setShowWhatsAppProductModal(true);
        },
        [showToast],
    );

    const sendWhatsAppProductLink = useCallback(
        (linkKey: keyof typeof WHATSAPP_PRODUCT_LINKS) => {
            if (!selectedWhatsAppPhone) return;
            const link = WHATSAPP_PRODUCT_LINKS[linkKey];
            const text = `Dear ${selectedWhatsAppCustomerName},\nhere is the product link for ${link.label}:\n${link.url}`;
            window.open(
                `https://wa.me/${selectedWhatsAppPhone}?text=${encodeURIComponent(text)}`,
                '_blank',
                'noopener,noreferrer',
            );
            setShowWhatsAppProductModal(false);
        },
        [selectedWhatsAppPhone, selectedWhatsAppCustomerName],
    );

    const sendWhatsAppWithoutProductLink = useCallback(() => {
        if (!selectedWhatsAppPhone) return;
        const text = `Hi ${selectedWhatsAppCustomerName}, thank you for your interest. Please let us know which product and size you want.`;
        window.open(
            `https://wa.me/${selectedWhatsAppPhone}?text=${encodeURIComponent(text)}`,
            '_blank',
            'noopener,noreferrer',
        );
        setShowWhatsAppProductModal(false);
    }, [selectedWhatsAppPhone, selectedWhatsAppCustomerName]);

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
                    key={followupsTableKey}
                    loading={loading}
                    filtered={filtered}
                    baseFollowups={baseFollowups}
                    onCustomerClick={onCustomerClick}
                    onOpenHistory={onOpenHistory}
                    onOpenWhatsAppPicker={onOpenWhatsAppPicker}
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
                        setDeletingHistoryEntryId(null);
                        setHistoryModalFollowup(null);
                    }}
                    onAppend={(payload) => appendCallLog(historyModalFollowup.id, payload)}
                    deletingHistoryEntryId={deletingHistoryEntryId}
                    onDeleteHistoryEntry={(entryId: string) => removeCallLogEntry(historyModalFollowup.id, entryId)}
                />
            ) : null}
            {showWhatsAppProductModal ? (
                <div
                    className="fu-wa-product-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="fu-wa-product-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowWhatsAppProductModal(false);
                    }}
                >
                    <div className="card fu-wa-product-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="fu-wa-product-modal__head">
                            <h3 id="fu-wa-product-title" className="fu-wa-product-modal__title">
                                Select product link to send
                            </h3>
                            <button
                                type="button"
                                className="fu-wa-product-modal__close"
                                aria-label="Close"
                                onClick={() => setShowWhatsAppProductModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <p className="fu-wa-product-modal__sub">Choose the link you want to send on WhatsApp.</p>
                        <div className="fu-wa-product-modal__group">
                            <div className="fu-wa-product-modal__group-title">Gir Cow Ghee</div>
                            <div className="fu-wa-product-modal__grid">
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir500')}>500ml</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir1')}>1 ltr</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir2')}>2 ltr</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir5')}>5 ltr</button>
                            </div>
                        </div>
                        <div className="fu-wa-product-modal__group">
                            <div className="fu-wa-product-modal__group-title">Buffalo Ghee</div>
                            <div className="fu-wa-product-modal__grid">
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo500')}>500ml</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo1')}>1 ltr</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo2')}>2 ltr</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo5')}>5 ltr</button>
                            </div>
                        </div>
                        <div className="fu-wa-product-modal__group">
                            <div className="fu-wa-product-modal__group-title">Desi Cow Ghee</div>
                            <div className="fu-wa-product-modal__grid">
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi500')}>500ml</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi1')}>1 ltr</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi2')}>2 ltr</button>
                                <button type="button" className="button fu-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi5')}>5 ltr</button>
                            </div>
                        </div>
                        <button type="button" className="button fu-wa-product-modal__btn fu-wa-product-modal__btn--no-link" onClick={sendWhatsAppWithoutProductLink}>
                            Without Product Link
                        </button>
                    </div>
                </div>
            ) : null}
            <ToastContainer toasts={toasts} />
        </section>
    );
}
