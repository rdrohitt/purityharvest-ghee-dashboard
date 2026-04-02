import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Spinner } from '../../components/Spinner';
import {
    type Followup,
    type FollowupData,
    type CallingHistoryEntry,
    fetchFollowupsDashboard,
    dashboardRowToFollowup,
    updateFollowupData,
} from '../../utils/followups';
import { loadOrders, type Order, type OrderItem } from '../../utils/orders';
import './Followups.scss';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toInputDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateWithMonth(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCustomerType(totalOrders: number): string {
    if (totalOrders === 1) return 'new';
    if (totalOrders >= 2 && totalOrders <= 4) return 'repeat';
    if (totalOrders >= 5) return 'loyal';
    return 'new';
}

function formatCurrency(n: number): string { 
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); 
}

const FEEDBACK_OPTIONS = [
    'Excellent ghee',
    'Average ghee',
    'Smell issue',
    'High price',
    'Packaging issue',
    'Delayed delivery',
    'Other feedback',
];
const CALLER_OPTIONS = ['Monia', 'Sarita'];

/** Page sizes for followups dashboard (API caps at 500). */
const FOLLOWUPS_PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;

function getFeedbackStyle(feedback: string): { background: string; border: string; color: string } {
    const value = (feedback || '').toLowerCase();
    if (!value) {
        return {
            background: 'var(--bg)',
            border: 'var(--border)',
            color: 'var(--muted)',
        };
    }
    if (value.includes('excellent')) {
        return {
            background: '#dbeafe',
            border: '#60a5fa',
            color: 'var(--primary-strong)',
        };
    }
    if (value.includes('average')) {
        return {
            background: '#e0f2fe',
            border: '#60a5fa',
            color: '#1d4ed8',
        };
    }
    if (value.includes('smell') || value.includes('issue') || value.includes('rancid')) {
        return {
            background: '#fee2e2',
            border: '#f97373',
            color: '#b91c1c',
        };
    }
    if (value.includes('price') || value.includes('high')) {
        return {
            background: '#fef3c7',
            border: '#facc15',
            color: '#92400e',
        };
    }
    if (value.includes('packaging')) {
        return {
            background: '#e0f2fe',
            border: '#38bdf8',
            color: '#0369a1',
        };
    }
    if (value.includes('delay') || value.includes('delivery')) {
        return {
            background: '#eff6ff',
            border: '#60a5fa',
            color: '#1d4ed8',
        };
    }
    return {
        background: '#f3f4f6',
        border: '#d1d5db',
        color: '#374151',
    };
}

function getFeedbackEmoji(feedback: string): string {
    const value = (feedback || '').toLowerCase();
    if (value.includes('excellent')) return '🌟';
    if (value.includes('average')) return '🙂';
    if (value.includes('smell')) return '👃';
    if (value.includes('price')) return '💸';
    if (value.includes('packaging')) return '📦';
    if (value.includes('delay')) return '⏱️';
    return '💬';
}

/**
 * Static dummy call logs (newest first). Used for empty-state modal preview and in-memory UI seeding.
 * Edit ISO dates / copy here only — no generator.
 */
const DUMMY_CALL_HISTORY_RECORDS: CallingHistoryEntry[] = [
    {
        id: 'dummy-log-1',
        calledAt: '2026-03-27T06:30:00.000Z',
        callerName: 'Monia',
        detail: 'Very happy with Gir cow ghee; asked for 5L jar pricing and delivery to Gurgaon.',
        callAgainDate: '2026-04-02T06:30:00.000Z',
    },
    {
        id: 'dummy-log-2',
        calledAt: '2026-03-18T06:30:00.000Z',
        callerName: 'Sarita',
        detail: 'Compared A2 vs buffalo — sent catalog PDF on WhatsApp. Will decide with family.',
        callAgainDate: null,
    },
    {
        id: 'dummy-log-3',
        calledAt: '2026-03-05T06:30:00.000Z',
        callerName: 'Monia',
        detail: 'Routine post-delivery check-in; no quality issues reported.',
        callAgainDate: '2026-03-20T06:30:00.000Z',
    },
    {
        id: 'dummy-log-4',
        calledAt: '2026-02-20T06:30:00.000Z',
        callerName: 'Sarita',
        detail: 'First purchase follow-up. Customer positive; interested in combo offers next time.',
        callAgainDate: '2026-02-28T06:30:00.000Z',
    },
];

/** First N customers with empty `callingHistory` get copies of `DUMMY_CALL_HISTORY_RECORDS` (IDs scoped per phone). */
const UI_SEED_DUMMY_CALL_HISTORY_COUNT = 4;

function dummyCallHistoryForPhone(phone: string): CallingHistoryEntry[] {
    return DUMMY_CALL_HISTORY_RECORDS.map((e) => ({
        ...e,
        id: `${phone}-${e.id}`,
    }));
}

/** Shown when there are no customers from orders — table was empty. IDs prefixed FU-DEMO-; saves skip the API. */
function isDemoFollowupRow(f: Followup): boolean {
    return f.id.startsWith('FU-DEMO-');
}

const DUMMY_FOLLOWUP_TABLE_ROWS: Followup[] = (() => {
    const rows: Omit<Followup, 'callingHistory' | 'callingDate' | 'callerName' | 'callingDetail' | 'callAgainDate'>[] = [
        {
            id: 'FU-DEMO-1',
            customerName: 'Priya Malhotra',
            customerPhone: '9100000001',
            lastOrder: '2026-03-26T10:00:00.000Z',
            totalOrders: 3,
            lastOrderDetail: '1L Gir cow ghee × 1, 500ml A2 × 2',
            feedback: 'Excellent ghee',
        },
        {
            id: 'FU-DEMO-2',
            customerName: 'Arjun Mehta',
            customerPhone: '9100000002',
            lastOrder: '2026-03-22T14:30:00.000Z',
            totalOrders: 1,
            lastOrderDetail: '500ml Buffalo ghee × 2',
            feedback: 'Average ghee',
        },
        {
            id: 'FU-DEMO-3',
            customerName: 'Neha Kapoor',
            customerPhone: '9100000003',
            lastOrder: '2026-03-18T09:15:00.000Z',
            totalOrders: 5,
            lastOrderDetail: '5L combo × 1',
            feedback: 'High price',
        },
        {
            id: 'FU-DEMO-4',
            customerName: 'Rahul Verma',
            customerPhone: '9100000004',
            lastOrder: '2026-03-10T11:45:00.000Z',
            totalOrders: 2,
            lastOrderDetail: 'Organic honey 500g × 1, 1L Desi ghee × 1',
            feedback: '',
        },
    ];
    return rows.map((r) => {
        const hist = dummyCallHistoryForPhone(r.customerPhone);
        const latest = hist[0];
        return {
            ...r,
            callingHistory: hist,
            callingDate: latest.calledAt,
            callerName: latest.callerName,
            callingDetail: latest.detail,
            callAgainDate: latest.callAgainDate,
        };
    });
})();

/** Fresh copies for React state so edits never mutate module-level demo rows. */
function cloneDemoFollowups(): Followup[] {
    return DUMMY_FOLLOWUP_TABLE_ROWS.map((row) => ({
        ...row,
        callingHistory: row.callingHistory.map((h) => ({ ...h })),
    }));
}

function applyDummyCallHistoryForUiPreview(rows: Followup[]): Followup[] {
    let seeded = 0;
    return rows.map((f) => {
        if (f.callingHistory.length > 0) return f;
        if (seeded >= UI_SEED_DUMMY_CALL_HISTORY_COUNT) return f;
        seeded += 1;
        const hist = dummyCallHistoryForPhone(f.customerPhone);
        const latest = hist[0];
        return {
            ...f,
            callingHistory: hist,
            callingDate: latest.calledAt,
            callerName: latest.callerName,
            callingDetail: latest.detail,
            callAgainDate: latest.callAgainDate,
        };
    });
}

function FollowupCallHistoryModal({
    followup,
    onClose,
    onAppend,
}: {
    followup: Followup;
    onClose: () => void;
    onAppend: (payload: { calledOn: string; callerName: string; detail: string; callAgainDate: string | null }) => Promise<void>;
}) {
    const [calledOn, setCalledOn] = useState(() => toInputDate(new Date().toISOString()));
    const [callerName, setCallerName] = useState(followup.callerName || CALLER_OPTIONS[0] || '');
    const [detail, setDetail] = useState('');
    const [callAgainOn, setCallAgainOn] = useState('');
    const [saving, setSaving] = useState(false);

    const hasReal = followup.callingHistory.length > 0;
    const timeline = hasReal
        ? [...followup.callingHistory].sort(
              (a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime(),
          )
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

export default function Followups() {
    const [callerFilter, setCallerFilter] = useState<string>('');
    const [feedbackFilter, setFeedbackFilter] = useState<string>('');
    const [monthFilter, setMonthFilter] = useState<string>('');
    const [yearFilter, setYearFilter] = useState<string>('');
    const [callingDateFilter, setCallingDateFilter] = useState<string>('');
    const [upcomingFilter, setUpcomingFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
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
    
    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([]);
    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }

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
                    dashboard.rows.length > 0
                        ? dashboard.rows.map(dashboardRowToFollowup)
                        : cloneDemoFollowups();
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
            : Math.min(
                  (dashboardMeta.page - 1) * dashboardMeta.limit + dashboardMeta.count,
                  totalRecords,
              );

    const baseFollowups = followups;

    const showingDemoFollowupsOnly = useMemo(
        () => followups.length > 0 && followups.every(isDemoFollowupRow),
        [followups],
    );

    // Generate month and year options from followups data
    const { monthOptions, yearOptions } = useMemo(() => {
        const months = new Set<number>();
        const years = new Set<number>();
        
        baseFollowups.forEach(f => {
            const date = new Date(f.lastOrder);
            months.add(date.getMonth() + 1);
            years.add(date.getFullYear());
        });
        
        const monthOptions = Array.from(months).sort((a, b) => b - a).map(m => ({
            value: m.toString(),
            label: new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
        }));
        
        const yearOptions = Array.from(years).sort((a, b) => b - a).map(y => ({
            value: y.toString(),
            label: y.toString()
        }));
        
        return { monthOptions, yearOptions };
    }, [baseFollowups]);

    const filtered = useMemo(() => {
        const now = new Date();
        return baseFollowups.filter(f => {
            // Search filter (by name and mobile number)
            const matchesSearch = !searchQuery || 
                f.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.customerPhone.includes(searchQuery);
            
            const matchesCaller = !callerFilter || f.callerName === callerFilter;
            const matchesFeedback = !feedbackFilter || f.feedback === feedbackFilter;
            
            // Month and year filter (last order date)
            let matchesDate = true;
            if (monthFilter || yearFilter) {
                const lastOrderDate = new Date(f.lastOrder);
                const orderMonth = lastOrderDate.getMonth() + 1; // 1-12
                const orderYear = lastOrderDate.getFullYear();
                
                if (monthFilter) {
                    const filterMonth = parseInt(monthFilter);
                    if (orderMonth !== filterMonth) {
                        matchesDate = false;
                    }
                }
                
                if (yearFilter && matchesDate) {
                    const filterYear = parseInt(yearFilter);
                    if (orderYear !== filterYear) {
                        matchesDate = false;
                    }
                }
            }
            
            // Calling date filter
            let matchesCallingDate = true;
            if (callingDateFilter) {
                if (callingDateFilter === 'no-calling-date') {
                    matchesCallingDate = !f.callingDate;
                } else {
                    if (!f.callingDate) {
                        matchesCallingDate = false;
                    } else {
                        const callingDate = new Date(f.callingDate);
                        const daysDiff = Math.floor((now.getTime() - callingDate.getTime()) / (1000 * 60 * 60 * 24));
                        const threshold = parseInt(callingDateFilter.replace('more-than-', '').replace('-days', ''));
                        matchesCallingDate = daysDiff > threshold;
                    }
                }
            }
            
            // Upcoming followups filter (based on call again date)
            let matchesUpcoming = true;
            if (upcomingFilter) {
                if (!f.callAgainDate) {
                    matchesUpcoming = false;
                } else {
                    const callAgainDate = new Date(f.callAgainDate);
                    const today = new Date(now);
                    today.setHours(0, 0, 0, 0);
                    callAgainDate.setHours(0, 0, 0, 0);
                    
                    const daysFromNow = Math.floor((callAgainDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (upcomingFilter === 'today') {
                        matchesUpcoming = daysFromNow === 0;
                    } else if (upcomingFilter === 'next-2-days') {
                        matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 2;
                    } else if (upcomingFilter === 'next-7-days') {
                        matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 7;
                    } else if (upcomingFilter === 'next-15-days') {
                        matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 15;
                    }
                }
            }
            
            return matchesSearch && matchesCaller && matchesFeedback && matchesDate && matchesCallingDate && matchesUpcoming;
        });
    }, [baseFollowups, searchQuery, callerFilter, feedbackFilter, monthFilter, yearFilter, callingDateFilter, upcomingFilter]);

    async function updateFollowup(id: string, field: keyof Followup, value: string | null) {
        const followup = followups.find(f => f.id === id);
        if (!followup) return;

        // Update local state immediately for responsive UI
        const updatedFollowup = { ...followup, [field]: value };
        setFollowups(prev => prev.map(f => {
            if (f.id === id) {
                return updatedFollowup;
            }
            return f;
        }));

        if (isDemoFollowupRow(followup)) {
            showToast('Sample row — changes stay on this page only.', 'success');
            return;
        }

        // Save to backend - only save followup-specific fields (not order-derived fields)
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
            // Revert on error
            setFollowups(prev => prev.map(f => {
                if (f.id === id) {
                    return followup;
                }
                return f;
            }));
        }
    }

    async function appendCallLog(
        followupId: string,
        payload: { calledOn: string; callerName: string; detail: string; callAgainDate: string | null },
    ) {
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
    }

    return (
        <section className="followups-page">
            {loading ? <Spinner overlay fixed message="Loading followups…" /> : null}
            <div className="card fu-shell">
                <header className="fu-top">
                    <div className="fu-top__lead">
                        <h1 className="fu-title">Followups</h1>
                        <p className="fu-sub">Customer call queue and follow-up dates</p>
                        {showingDemoFollowupsOnly ? (
                            <p className="fu-demo-hint">
                                No order customers loaded — showing sample rows below. Your real followups appear once orders are available from the server.
                            </p>
                        ) : null}
                    </div>
                    <div className="fu-top__meta">
                        <span className="fu-count-pill" title={loading ? undefined : 'Rows on this page after filters'}>
                            <span className="fu-count-pill__n">{loading ? '—' : filtered.length}</span>
                            <span className="fu-count-pill__lbl">{loading ? 'Loading…' : 'visible'}</span>
                        </span>
                        <span
                            className="fu-count-pill fu-count-pill--total"
                            title={loading || dashboardMeta == null ? undefined : 'Total followup records from server'}
                        >
                            <span className="fu-count-pill__n">
                                {loading || dashboardMeta == null ? '—' : totalRecords.toLocaleString()}
                            </span>
                            <span className="fu-count-pill__lbl">{loading ? '…' : 'total'}</span>
                        </span>
                    </div>
                </header>
                <div className="fu-body">
                    <div className="fu-panel">
                        <div className="fu-panel__head">
                            <span className="fu-panel__title">Filters</span>
                            {(searchQuery || callerFilter || feedbackFilter || monthFilter || yearFilter || callingDateFilter || upcomingFilter) ? (
                                <button
                                    type="button"
                                    className="fu-btn-clear"
                                    onClick={() => { setSearchQuery(''); setCallerFilter(''); setFeedbackFilter(''); setMonthFilter(''); setYearFilter(''); setCallingDateFilter(''); setUpcomingFilter(''); }}
                                >
                                    Clear all
                                </button>
                            ) : null}
                        </div>
                        <div className="fu-panel__grid">
                            <div className="fu-search-wrap">
                                <label className="fu-flt__lab" htmlFor="followups-search">Search</label>
                                <div className="fu-search">
                                    <svg className="fu-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                                        <circle cx="11" cy="11" r="7" />
                                        <path d="M21 21l-4.3-4.3" />
                                    </svg>
                                    <input
                                        id="followups-search"
                                        className="fu-search__input"
                                        type="search"
                                        placeholder="Name or phone number"
                                        aria-label="Search by name or mobile"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <StatusFilter
                                label="Caller"
                                value={callerFilter}
                                onChange={setCallerFilter}
                                options={CALLER_OPTIONS}
                            />
                            <StatusFilter
                                label="Feedback"
                                value={feedbackFilter}
                                onChange={setFeedbackFilter}
                                options={FEEDBACK_OPTIONS}
                            />
                            <StatusFilter
                                label="Month"
                                value={monthFilter}
                                onChange={setMonthFilter}
                                options={monthOptions.map(m => m.label)}
                                optionValues={monthOptions.map(m => m.value)}
                            />
                            <StatusFilter
                                label="Year"
                                value={yearFilter}
                                onChange={setYearFilter}
                                options={yearOptions.map(y => y.label)}
                                optionValues={yearOptions.map(y => y.value)}
                            />
                        </div>
                    </div>
                    <div className="fu-quick">
                        <div className="fu-quick__block">
                            <span className="fu-quick__label">Last calling date</span>
                            <div className="fu-pill-group" role="group" aria-label="Calling date filters">
                                <CallingDateFilterButton
                                    active={callingDateFilter === 'no-calling-date'}
                                    onClick={() => setCallingDateFilter(callingDateFilter === 'no-calling-date' ? '' : 'no-calling-date')}
                                >
                                    No date
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={callingDateFilter === 'more-than-15-days'}
                                    onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-15-days' ? '' : 'more-than-15-days')}
                                >
                                    &gt; 15 days
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={callingDateFilter === 'more-than-30-days'}
                                    onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-30-days' ? '' : 'more-than-30-days')}
                                >
                                    &gt; 30 days
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={callingDateFilter === 'more-than-45-days'}
                                    onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-45-days' ? '' : 'more-than-45-days')}
                                >
                                    &gt; 45 days
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={callingDateFilter === 'more-than-60-days'}
                                    onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-60-days' ? '' : 'more-than-60-days')}
                                >
                                    &gt; 60 days
                                </CallingDateFilterButton>
                            </div>
                        </div>
                        <div className="fu-quick__block">
                            <span className="fu-quick__label">Call again</span>
                            <div className="fu-pill-group" role="group" aria-label="Upcoming followup filters">
                                <CallingDateFilterButton
                                    active={upcomingFilter === 'today'}
                                    onClick={() => setUpcomingFilter(upcomingFilter === 'today' ? '' : 'today')}
                                >
                                    Today
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={upcomingFilter === 'next-2-days'}
                                    onClick={() => setUpcomingFilter(upcomingFilter === 'next-2-days' ? '' : 'next-2-days')}
                                >
                                    Next 2 days
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={upcomingFilter === 'next-7-days'}
                                    onClick={() => setUpcomingFilter(upcomingFilter === 'next-7-days' ? '' : 'next-7-days')}
                                >
                                    Next 7 days
                                </CallingDateFilterButton>
                                <CallingDateFilterButton
                                    active={upcomingFilter === 'next-15-days'}
                                    onClick={() => setUpcomingFilter(upcomingFilter === 'next-15-days' ? '' : 'next-15-days')}
                                >
                                    Next 15 days
                                </CallingDateFilterButton>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1408, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '148px', minWidth: '148px' }} />
                            <col style={{ width: '100px', minWidth: '100px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: 'auto', minWidth: '140px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Customer</Th>
                                <Th>Last Order</Th>
                                <Th>Total Orders</Th>
                                <Th>Last Order</Th>
                                <Th>Feedback</Th>
                                <Th>Calling Date</Th>
                                <Th>Calling Detail</Th>
                                <Th>Call Again Date</Th>
                                <Th>Caller Name</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading
                                ? filtered.map((f) => (
                                <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <Td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span 
                                                style={{ 
                                                    fontWeight: 600, 
                                                    cursor: 'pointer',
                                                    color: 'var(--text)',
                                                    transition: 'color 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.color = 'var(--primary)';
                                                    e.currentTarget.style.textDecoration = 'underline';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.color = 'var(--text)';
                                                    e.currentTarget.style.textDecoration = 'none';
                                                }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (isDemoFollowupRow(f)) {
                                                        showToast('Sample customer — open a real order to use the profile.', 'delete');
                                                        return;
                                                    }
                                                    setSelectedCustomerPhone(f.customerPhone);
                                                    setShowCustomerProfile(true);
                                                }}
                                            >
                                                {f.customerName}
                                            </span>
                                            <a className="link" href={`tel:${f.customerPhone}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
                                                {f.customerPhone}
                                            </a>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                width: 'fit-content',
                                            }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    backgroundColor: getCustomerType(f.totalOrders) === 'new' ? '#dbeafe' : 
                                                                   getCustomerType(f.totalOrders) === 'repeat' ? '#dbeafe' : '#fef3c7',
                                                    color: getCustomerType(f.totalOrders) === 'new' ? '#1e40af' : 
                                                           getCustomerType(f.totalOrders) === 'repeat' ? 'var(--primary-strong)' : '#92400e',
                                                }}>
                                                    {getCustomerType(f.totalOrders)}
                                                </span>
                                                {(() => {
                                                    const customerOrders = ordersByCustomer.get(f.customerPhone) || [];
                                                    const hasRto = customerOrders.some(o => o.deliveryStatus === 'RTO');
                                                    if (!hasRto) return null;
                                                    return (
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                fontSize: 10,
                                                                fontWeight: 700,
                                                                textTransform: 'uppercase',
                                                                padding: '2px 6px',
                                                                borderRadius: 999,
                                                                backgroundColor: '#fee2e2',
                                                                color: '#b91c1c',
                                                                border: '1px solid #fecaca',
                                                            }}
                                                        >
                                                            RTO
                                                        </span>
                                                    );
                                                })()}
                                            </span>
                                        </div>
                                    </Td>
                                    <Td style={{ verticalAlign: 'middle' }}>
                                        <div className="fu-last-order-cell">
                                            <span className="fu-last-order-cell__date">{formatDate(f.lastOrder)}</span>
                                            <button
                                                type="button"
                                                className={`fu-hist-icon-btn${f.callingHistory.length ? ' fu-hist-icon-btn--has' : ''}`}
                                                title={`Call history${f.callingHistory.length ? ` (${f.callingHistory.length})` : ''}`}
                                                aria-label={`Call history${f.callingHistory.length ? `, ${f.callingHistory.length} entries` : ''}`}
                                                onClick={() => setHistoryModalFollowup(f)}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </button>
                                        </div>
                                    </Td>
                                    <Td>{f.totalOrders}</Td>
                                    <Td>{f.lastOrderDetail}</Td>
                                    <Td>
                                        {(() => {
                                            const style = getFeedbackStyle(f.feedback);
                                            return (
                                                <select
                                                    className="input"
                                                    value={f.feedback}
                                                    onChange={(e) => updateFollowup(f.id, 'feedback', e.target.value)}
                                                    style={{
                                                        width: 'auto',
                                                        minWidth: '160px',
                                                        height: 32,
                                                        fontSize: 13,
                                                        padding: '4px 8px',
                                                        backgroundColor: style.background,
                                                        borderColor: style.border,
                                                        color: style.color,
                                                        fontWeight: f.feedback ? 600 : 400,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <option value="">
                                                        {f.feedback ? 'Clear feedback' : 'Select feedback'}
                                                    </option>
                                                    {FEEDBACK_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {getFeedbackEmoji(opt)} {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            );
                                        })()}
                                    </Td>
                                    <Td>
                                        <DateInput
                                            value={f.callingDate}
                                            onChange={(value) => updateFollowup(f.id, 'callingDate', value)}
                                        />
                                    </Td>
                                    <Td>
                                        <textarea
                                            className="input"
                                            value={f.callingDetail}
                                            onChange={(e) => updateFollowup(f.id, 'callingDetail', e.target.value)}
                                            placeholder="Enter calling detail"
                                            style={{ width: '100%', height: 60, fontSize: 13, padding: '4px 8px', resize: 'vertical', fontFamily: 'inherit' }}
                                        />
                                    </Td>
                                    <Td>
                                        <DateInput
                                            value={f.callAgainDate}
                                            onChange={(value) => updateFollowup(f.id, 'callAgainDate', value)}
                                        />
                                    </Td>
                                    <Td>
                                        <select
                                            className="input"
                                            value={f.callerName}
                                            onChange={(e) => updateFollowup(f.id, 'callerName', e.target.value)}
                                            style={{ width: '100%', height: 32, fontSize: 13, padding: '4px 8px' }}
                                        >
                                            <option value="">Select caller</option>
                                            {CALLER_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </Td>
                                </tr>
                            ))
                                : null}
                            {!loading && filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        {baseFollowups.length > 0
                                            ? 'No rows match your filters. Use Clear all in the Filters panel.'
                                            : 'No followups found'}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
                <footer className="fu-pagination" aria-label="Followups pagination">
                    <div className="fu-pagination__range">
                        {loading ? (
                            <span className="fu-pagination__muted">Loading…</span>
                        ) : dashboardMeta ? (
                            dashboardMeta.count === 0 && totalRecords > 0 ? (
                                <>
                                    No rows on this page ·{' '}
                                    <strong>{totalRecords.toLocaleString()}</strong> total
                                </>
                            ) : (
                                <>
                                    Showing{' '}
                                    <strong>
                                        {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                                    </strong>{' '}
                                    of <strong>{totalRecords.toLocaleString()}</strong>
                                </>
                            )
                        ) : (
                            <span className="fu-pagination__muted">Total unavailable</span>
                        )}
                    </div>
                    <label className="fu-pagination__size">
                        <span className="fu-pagination__size-lab">Rows per page</span>
                        <select
                            className="fu-pagination__select"
                            value={pageSize}
                            disabled={loading}
                            aria-label="Rows per page"
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            {FOLLOWUPS_PAGE_SIZE_OPTIONS.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="fu-pagination__nav">
                        <button
                            type="button"
                            className="fu-page-btn"
                            disabled={loading || page <= 1}
                            onClick={() => setPage(1)}
                        >
                            First
                        </button>
                        <button
                            type="button"
                            className="fu-page-btn"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Prev
                        </button>
                        <span className="fu-pagination__page-of">
                            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                        </span>
                        <button
                            type="button"
                            className="fu-page-btn"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </button>
                        <button
                            type="button"
                            className="fu-page-btn"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage(totalPages)}
                        >
                            Last
                        </button>
                    </div>
                </footer>
            </div>
            {showCustomerProfile && selectedCustomerPhone && (
                <CustomerProfileModal 
                    customerPhone={selectedCustomerPhone} 
                    orders={orders}
                    ordersByCustomer={ordersByCustomer}
                    onClose={() => {
                        setShowCustomerProfile(false);
                        setSelectedCustomerPhone(null);
                    }} 
                />
            )}
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

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td style={{ padding: '12px', ...style }}>{children}</td>;
}

function StatusFilter<T extends string>({ label, value, onChange, options, optionValues }: { label: string; value: T | ''; onChange: (val: T | '') => void; options: T[]; optionValues?: string[] }) {
    const id = `followups-filter-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
        <div className="fu-flt">
            <label className="fu-flt__lab" htmlFor={id}>{label}</label>
            <div className="fu-flt__box">
                <select
                    id={id}
                    className="fu-flt__sel"
                    value={value}
                    onChange={(e) => onChange(e.target.value as T | '')}
                >
                    <option value="">All</option>
                    {options.map((opt, index) => (
                        <option key={opt} value={optionValues ? optionValues[index] : opt}>{opt}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function CallingDateFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`fu-pill${active ? ' fu-pill--active' : ''}`}
        >
            {children}
        </button>
    );
}

function DateInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const date = value ? new Date(value) : new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1);
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value) : null;
    const displayValue = selectedDate 
        ? selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current && popupRef.current) {
            const inputRect = inputRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 350;
            const popupWidth = 300;
            
            let top = inputRect.bottom + window.scrollY + 4;
            let left = inputRect.left + window.scrollX;
            
            if (inputRect.bottom + popupHeight > window.innerHeight) {
                top = inputRect.top + window.scrollY - popupHeight - 4;
            }
            
            if (inputRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function handleDateSelect(day: number) {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(newDate.toISOString());
        setIsOpen(false);
    }

    function handlePrevMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }

    function handleNextMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }

    function handleToday() {
        const today = new Date();
        onChange(today.toISOString());
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setIsOpen(false);
    }

    function handleClear() {
        onChange(null);
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input"
                style={{
                    width: '100%',
                    height: 32,
                    fontSize: 13,
                    padding: '4px 8px',
                    paddingRight: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                }}
            >
                <span style={{ color: displayValue && displayValue !== '—' ? 'var(--text)' : 'var(--muted)' }}>
                    {displayValue}
                </span>
                <span style={{ fontSize: 14, color: 'var(--muted)', pointerEvents: 'none' }}>📅</span>
            </div>
            <input
                type="date"
                value={toInputDate(value)}
                onChange={(e) => {
                    const newValue = e.target.value ? new Date(e.target.value).toISOString() : null;
                    onChange(newValue);
                }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                tabIndex={-1}
            />
            {isOpen && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: 20,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 10000,
                        minWidth: 300,
                        maxWidth: 300,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Previous month"
                        >
                            ‹
                        </button>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Next month"
                        >
                            ›
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
                        {weekDays.map((day) => (
                            <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', padding: '8px 0' }}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {Array(firstDayOfMonth).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {days.map((day) => {
                            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                            const isSelected = selectedDate && 
                                date.getDate() === selectedDate.getDate() &&
                                date.getMonth() === selectedDate.getMonth() &&
                                date.getFullYear() === selectedDate.getFullYear();
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateSelect(day)}
                                    style={{
                                        padding: '10px 4px',
                                        border: 'none',
                                        background: isSelected ? '#2563eb' : isToday ? '#dbeafe' : 'transparent',
                                        color: isSelected ? '#ffffff' : isToday ? '#1d4ed8' : '#111827',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = '#f3f4f6';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = 'transparent';
                                        } else if (isToday && !isSelected) {
                                            e.currentTarget.style.background = '#dbeafe';
                                        }
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button
                            type="button"
                            onClick={handleToday}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#111827',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                                e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#111827',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                                e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'PAID') cls = 'tag success';
        else if (kind === 'COD') cls = 'tag warning';
        else cls = 'tag info';
    } else {
        if (kind === 'Delivered') cls = 'tag success';
        else if (kind === 'In Transit') cls = 'tag info';
        else if (kind === 'Pending Pickup') cls = 'tag warning';
        else if (kind === 'RTO') cls = 'tag danger';
    }
    return <span className={cls}>{kind}</span>;
}

function CustomerProfileModal({ customerPhone, orders, ordersByCustomer, onClose }: { customerPhone: string; orders: Order[]; ordersByCustomer: Map<string, Order[]>; onClose: () => void }) {
    // Get all orders for this customer using the pre-grouped map
    const customerOrders = useMemo(() => {
        // First try to get from the pre-grouped map (exact match)
        let customerOrdersList = ordersByCustomer.get(customerPhone) || [];
        
        // If no exact match, try normalized matching
        if (customerOrdersList.length === 0) {
            const normalizePhone = (phone: string) => {
                if (!phone) return '';
                return phone.replace(/\D/g, '').trim();
            };
            const normalizedCustomerPhone = normalizePhone(customerPhone);
            
            // Try to find matching phone in the map
            for (const [phone, orderList] of ordersByCustomer.entries()) {
                if (normalizePhone(phone) === normalizedCustomerPhone && normalizedCustomerPhone.length > 0) {
                    customerOrdersList = orderList;
                    break;
                }
            }
            
            // Fallback: filter from all orders if still not found
            if (customerOrdersList.length === 0 && normalizedCustomerPhone.length > 0) {
                customerOrdersList = orders.filter(o => {
                    const orderPhone = normalizePhone(o.customerPhone);
                    return orderPhone === normalizedCustomerPhone && orderPhone.length > 0;
                });
            }
        }
        
        return customerOrdersList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, ordersByCustomer, customerPhone]);

    // Get customer profile from the most recent order
    const customerProfile = useMemo(() => {
        if (customerOrders.length === 0) {
            // Return default profile if no orders found
            return {
                name: 'Unknown Customer',
                phone: customerPhone,
                address: '—',
                state: '—',
                pincode: '—',
            };
        }
        const latestOrder = customerOrders[0];
        return {
            name: latestOrder.customer,
            phone: latestOrder.customerPhone,
            address: latestOrder.customerAddress,
            state: latestOrder.state,
            pincode: latestOrder.pincode || '—',
        };
    }, [customerOrders, customerPhone]);

    const totalOrders = customerOrders.length;
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.amount, 0);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 60 }}
        >
            <div
                className="card"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 1200, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Customer Profile</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                
                <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
                    {/* Customer Information */}
                    <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-elev)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Customer Information</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* First Row: Name and Phone */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Name</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Phone</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                                        <a className="link" href={`tel:${customerProfile.phone}`} style={{ textDecoration: 'none' }}>{customerProfile.phone}</a>
                                    </div>
                                </div>
                            </div>
                            {/* Second Row: Address (full width) */}
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Address</div>
                                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.address}</div>
                            </div>
                            {/* Third Row: State and Pincode */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>State</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.state}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Pincode</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.pincode}</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 24 }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Orders</div>
                                <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 700 }}>{totalOrders}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Amount</div>
                                <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 700 }}>{formatCurrency(totalAmount)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Order History</h4>
                        <div className="table-scroll-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <Th>Date</Th>
                                        <Th>Items</Th>
                                        <Th>Amount</Th>
                                        <Th>Payment</Th>
                                        <Th>Delivery</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                                {orders.length === 0 ? 'No orders loaded' : 'No orders found for this customer'}
                                            </td>
                                        </tr>
                                    ) : (
                                        customerOrders.map((order) => (
                                            <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <Td>{formatDate(order.date)}</Td>
                                                <Td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {(order.items ?? []).length === 0 ? <span>—</span> : null}
                                                        {(order.items ?? []).map((it: OrderItem, idx: number) => (
                                                            <div key={idx} style={{ fontSize: 12 }}>{it.variant} × {it.quantity}</div>
                                                        ))}
                                                    </div>
                                                </Td>
                                                <Td style={{ fontWeight: 600 }}>{formatCurrency(order.amount)}</Td>
                                                <Td><StatusTag kind={order.paymentStatus} type="payment" /></Td>
                                                <Td><StatusTag kind={order.deliveryStatus} type="delivery" /></Td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast"
                    style={{
                        pointerEvents: 'auto',
                        animation: 'slideInRight 0.3s ease-out',
                    }}
                    data-type={toast.type}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

