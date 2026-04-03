import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import {
    type Followup,
    type FollowupData,
    type CallingHistoryEntry,
    fetchFollowupsDashboard,
    dashboardRowToFollowup,
    updateFollowupData,
} from '../../utils/followups';
import { loadOrders, type Order } from '../../utils/orders';
import { CustomerProfileModal } from './CustomerProfileModal';
import { FollowupCallHistoryModal } from './FollowupCallHistoryModal';
import {
    applyDummyCallHistoryForUiPreview,
    cloneDemoFollowups,
    isDemoFollowupRow,
} from './followupsConstants';
import type { FollowupsToast } from './followupsTypes';
import { filterFollowups } from './filterFollowups';
import { FollowupsFiltersSection } from './FollowupsFiltersSection';
import { FollowupsHeader } from './FollowupsHeader';
import { FollowupsPagination } from './FollowupsPagination';
import { FollowupsTable } from './FollowupsTable';
import { ToastContainer } from './ToastContainer';
import './Followups.scss';

export default function Followups() {
    const [callerFilter, setCallerFilter] = useState('');
    const [feedbackFilter, setFeedbackFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [callingDateFilter, setCallingDateFilter] = useState('');
    const [upcomingFilter, setUpcomingFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [followups, setFollowups] = useState<Followup[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersByCustomer, setOrdersByCustomer] = useState<Map<string, Order[]>>(new Map());
    const [showCustomerProfile, setShowCustomerProfile] = useState(false);
    const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
    const [historyModalFollowup, setHistoryModalFollowup] = useState<Followup | null>(null);
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
                const raw = await loadOrders();
                if (cancelled) return;
                const ordersSafe = Array.isArray(raw) ? raw : [];
                const map = new Map<string, Order[]>();
                ordersSafe.forEach((order) => {
                    const phone = order.customerPhone;
                    if (!map.has(phone)) map.set(phone, []);
                    map.get(phone)!.push(order);
                });
                setOrders(ordersSafe);
                setOrdersByCustomer(map);
            } catch (error) {
                console.error('Error loading orders for followups:', error);
                if (!cancelled) {
                    setOrders([]);
                    setOrdersByCustomer(new Map());
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const dashboard = await fetchFollowupsDashboard({ page, limit: pageSize });
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
                const fromDashboard =
                    dashboard.rows.length > 0 ? dashboard.rows.map(dashboardRowToFollowup) : cloneDemoFollowups();
                setFollowups(applyDummyCallHistoryForUiPreview(fromDashboard));
            } catch (error) {
                console.error('Error loading followups dashboard:', error);
                if (!cancelled) {
                    setDashboardMeta(null);
                    setFollowups(applyDummyCallHistoryForUiPreview(cloneDemoFollowups()));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [page, pageSize]);

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

    const showingDemoFollowupsOnly = useMemo(
        () => followups.length > 0 && followups.every(isDemoFollowupRow),
        [followups],
    );

    const { monthOptions, yearOptions } = useMemo(() => {
        const months = new Set<number>();
        const years = new Set<number>();
        baseFollowups.forEach((f) => {
            const date = new Date(f.lastOrder);
            months.add(date.getMonth() + 1);
            years.add(date.getFullYear());
        });
        const mo = Array.from(months)
            .sort((a, b) => b - a)
            .map((m) => ({
                value: m.toString(),
                label: new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
            }));
        const yo = Array.from(years)
            .sort((a, b) => b - a)
            .map((y) => ({ value: y.toString(), label: y.toString() }));
        return { monthOptions: mo, yearOptions: yo };
    }, [baseFollowups]);

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
        setMonthFilter('');
        setYearFilter('');
        setCallingDateFilter('');
        setUpcomingFilter('');
    }, []);

    const updateFollowup = useCallback(
        async (id: string, field: keyof Followup, value: string | null) => {
            const followup = followups.find((f) => f.id === id);
            if (!followup) return;

            const updatedFollowup = { ...followup, [field]: value };
            setFollowups((prev) => prev.map((f) => (f.id === id ? updatedFollowup : f)));

            if (isDemoFollowupRow(followup)) {
                showToast('Sample row — changes stay on this page only.', 'success');
                return;
            }

            try {
                const followupData: Partial<FollowupData> = {
                    customerPhone: followup.customerPhone,
                    feedback: updatedFollowup.feedback,
                    callingDate: updatedFollowup.callingDate,
                    callerName: updatedFollowup.callerName,
                    callingDetail: updatedFollowup.callingDetail,
                    callAgainDate: updatedFollowup.callAgainDate,
                    callingHistory: updatedFollowup.callingHistory,
                };
                await updateFollowupData(followup.customerPhone, followupData);
                showToast('Followup updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating followup:', error);
                showToast('Failed to save followup. Please try again.', 'error');
                setFollowups((prev) => prev.map((f) => (f.id === id ? followup : f)));
            }
        },
        [followups, showToast],
    );

    const appendCallLog = useCallback(
        async (
            followupId: string,
            payload: { calledOn: string; callerName: string; detail: string; callAgainDate: string | null },
        ) => {
            const followup = followups.find((f) => f.id === followupId);
            if (!followup) return;

            const calledAt = new Date(`${payload.calledOn}T12:00:00`).toISOString();
            const newEntry: CallingHistoryEntry = {
                id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                calledAt,
                callerName: payload.callerName.trim(),
                detail: payload.detail.trim(),
                callAgainDate: payload.callAgainDate
                    ? new Date(`${payload.callAgainDate}T12:00:00`).toISOString()
                    : null,
            };

            const nextHistory = [newEntry, ...followup.callingHistory];
            const updatedFollowup: Followup = {
                ...followup,
                callingDate: newEntry.calledAt,
                callingDetail: newEntry.detail,
                callerName: newEntry.callerName,
                callAgainDate: newEntry.callAgainDate,
                callingHistory: nextHistory,
            };

            setFollowups((prev) => prev.map((f) => (f.id === followupId ? updatedFollowup : f)));
            setHistoryModalFollowup((cur) => (cur?.id === followupId ? updatedFollowup : cur));

            if (isDemoFollowupRow(followup)) {
                showToast('Sample row — call saved in this session only.', 'success');
                return;
            }

            try {
                await updateFollowupData(followup.customerPhone, {
                    customerPhone: followup.customerPhone,
                    feedback: updatedFollowup.feedback,
                    callingDate: updatedFollowup.callingDate,
                    callerName: updatedFollowup.callerName,
                    callingDetail: updatedFollowup.callingDetail,
                    callAgainDate: updatedFollowup.callAgainDate,
                    callingHistory: nextHistory,
                });
                showToast('Call added to history', 'success');
            } catch (error) {
                console.error('Error saving call history:', error);
                showToast('Failed to save call. Please try again.', 'error');
                setFollowups((prev) => prev.map((f) => (f.id === followupId ? followup : f)));
                setHistoryModalFollowup((cur) => (cur?.id === followupId ? followup : cur));
            }
        },
        [followups, showToast],
    );

    const onCustomerClick = useCallback(
        (f: Followup) => {
            if (isDemoFollowupRow(f)) {
                showToast('Sample customer — open a real order to use the profile.', 'delete');
                return;
            }
            setSelectedCustomerPhone(f.customerPhone);
            setShowCustomerProfile(true);
        },
        [showToast],
    );

    return (
        <section className="followups-page">
            {loading ? <Spinner overlay fixed message="Loading followups…" /> : null}
            <div className="card fu-shell">
                <FollowupsHeader
                    loading={loading}
                    visibleCount={filtered.length}
                    dashboardMeta={dashboardMeta}
                    totalRecords={totalRecords}
                    showingDemoFollowupsOnly={showingDemoFollowupsOnly}
                />
                <FollowupsFiltersSection
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    callerFilter={callerFilter}
                    setCallerFilter={setCallerFilter}
                    feedbackFilter={feedbackFilter}
                    setFeedbackFilter={setFeedbackFilter}
                    monthFilter={monthFilter}
                    setMonthFilter={setMonthFilter}
                    yearFilter={yearFilter}
                    setYearFilter={setYearFilter}
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
                    ordersByCustomer={ordersByCustomer}
                    onCustomerClick={onCustomerClick}
                    onOpenHistory={setHistoryModalFollowup}
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

            {showCustomerProfile && selectedCustomerPhone ? (
                <CustomerProfileModal
                    customerPhone={selectedCustomerPhone}
                    orders={orders}
                    ordersByCustomer={ordersByCustomer}
                    onClose={() => {
                        setShowCustomerProfile(false);
                        setSelectedCustomerPhone(null);
                    }}
                />
            ) : null}
            {historyModalFollowup ? (
                <FollowupCallHistoryModal
                    key={historyModalFollowup.id}
                    followup={historyModalFollowup}
                    onClose={() => setHistoryModalFollowup(null)}
                    onAppend={(payload) => appendCallLog(historyModalFollowup.id, payload)}
                />
            ) : null}
            <ToastContainer toasts={toasts} />
        </section>
    );
}
