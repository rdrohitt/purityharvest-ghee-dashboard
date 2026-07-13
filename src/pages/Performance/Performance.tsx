import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { fetchDailySalesRanking, fetchPlatformSalesComparison } from '../../utils/analytics';
import { fetchTargets } from '../../utils/targets';
import type { DailySalesRankingDateEntry, DailySalesRankingResponse } from '../../types/analytics-daily-sales-ranking';
import type {
    PlatformSalesComparisonPeriod,
    PlatformSalesComparisonPeriodKey,
    PlatformSalesComparisonPlatformStats,
    PlatformSalesComparisonResponse,
} from '../../types/analytics-platform-sales-comparison';
import type { TargetApiItem, TargetsListResponse } from '../../types/targets';
import { DatePicker } from '../sales/Shopify/DatePicker';
import { ModernSelect, PlatformTag, toInputDate, type ModernSelectOption } from '../sales/Shopify/ShopifyShared';
import { AddTargetModal } from './AddTargetModal';
import '../sales/Shopify/Shopify.scss';
import '../Modules/Modules.scss';
import './Performance.scss';

type PerformanceViewTab = 'platform' | 'month' | 'targets';

const PERFORMANCE_VIEW_TABS: { id: PerformanceViewTab; label: string }[] = [
    { id: 'platform', label: 'Month Wise' },
    { id: 'month', label: 'Platform Wise' },
    { id: 'targets', label: 'Targets' },
];

const PERIOD_ORDER: PlatformSalesComparisonPeriodKey[] = ['currentMonth', 'lastMonth', 'twoMonthsAgo'];

const PERIOD_LABELS: Record<PlatformSalesComparisonPeriodKey, string> = {
    currentMonth: 'Current Month',
    lastMonth: 'Last Month',
    twoMonthsAgo: '2 Months Ago',
};

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

type DeltaDirection = 'up' | 'down' | 'flat';

type DeltaInfo = {
    text: string;
    direction: DeltaDirection;
};

function formatCurrency(value: number): string {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatMonthLabel(month: string): string {
    const [year, monthNum] = month.split('-');
    if (!year || !monthNum) return month;
    const date = new Date(Number(year), Number(monthNum) - 1, 1);
    if (Number.isNaN(date.getTime())) return month;
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatShortDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatPeriodRange(from: string, to: string): string {
    return `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

function normalizePlatformKey(platform: string): string {
    return platform.toLowerCase() === 'callling' ? 'calling' : platform;
}

function isShopifyPlatform(platform: string): boolean {
    return platform.toLowerCase() === 'shopify';
}

function isCallingPlatform(platform: string): boolean {
    const key = platform.toLowerCase();
    return key === 'calling' || key === 'callling';
}

function sortPlatformsWithCallingLast(platforms: string[]): string[] {
    const others: string[] = [];
    let callingPlatform: string | null = null;

    platforms.forEach((platform) => {
        if (isCallingPlatform(platform)) {
            callingPlatform = platform;
        } else {
            others.push(platform);
        }
    });

    return callingPlatform ? [...others, callingPlatform] : platforms;
}

function formatDayLabel(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function getDelta(current: number, previous: number): DeltaInfo {
    if (previous === 0) {
        if (current === 0) return { text: '0%', direction: 'flat' };
        return { text: 'New', direction: 'up' };
    }
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.05) return { text: '0%', direction: 'flat' };
    const direction: DeltaDirection = pct > 0 ? 'up' : 'down';
    const sign = pct > 0 ? '+' : '';
    return { text: `${sign}${pct.toFixed(1)}%`, direction };
}

function getPeriodByKey(
    periods: PlatformSalesComparisonPeriod[],
    key: PlatformSalesComparisonPeriodKey,
): PlatformSalesComparisonPeriod | undefined {
    return periods.find((period) => period.key === key);
}

function getPlatformStats(
    period: PlatformSalesComparisonPeriod,
    platform: string,
): PlatformSalesComparisonPlatformStats {
    const fromStats = period.platformStats?.[platform];
    if (fromStats) return fromStats;
    return {
        sales: period.platformSales?.[platform] ?? 0,
        rtoOrderCount: 0,
        rtoAmount: 0,
    };
}

function formatTargetDisplayValue(raw: string): string {
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw || '—';
    if (value >= 1000) return formatCurrency(value);
    return value.toLocaleString('en-IN');
}

function formatTargetMonthLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function platformKeyForTargetTag(platform: string): string {
    const lower = platform.trim().toLowerCase();
    if (lower === 'meta') return 'meta';
    if (lower === 'shopify') return 'shopify';
    if (lower === 'abandoned') return 'abandoned';
    if (lower === 'whatsapp') return 'whatsapp';
    if (lower === 'calling' || lower === 'callling') return 'calling';
    return platform;
}

function getTargetsCount(data: TargetsListResponse | null | undefined): number {
    if (!data) return 0;
    const total = Number(data.total);
    if (Number.isFinite(total) && total >= 0) return total;
    return data.items?.length ?? 0;
}

function sortTargetsNewestFirst(targets: TargetApiItem[]): TargetApiItem[] {
    return [...targets].sort((a, b) => {
        const monthDiff = new Date(b.month).getTime() - new Date(a.month).getTime();
        if (monthDiff !== 0) return monthDiff;
        return a.platform.localeCompare(b.platform);
    });
}

type TargetsByMonthGroup = {
    month: string;
    monthLabel: string;
    entries: TargetApiItem[];
};

function groupTargetsByMonth(targets: TargetApiItem[]): TargetsByMonthGroup[] {
    const sorted = sortTargetsNewestFirst(targets);
    const byMonth = new Map<string, TargetApiItem[]>();

    sorted.forEach((item) => {
        const existing = byMonth.get(item.month);
        if (existing) {
            existing.push(item);
        } else {
            byMonth.set(item.month, [item]);
        }
    });

    const groups: TargetsByMonthGroup[] = [];
    const seen = new Set<string>();

    sorted.forEach((item) => {
        if (seen.has(item.month)) return;
        seen.add(item.month);
        const entries = [...(byMonth.get(item.month) ?? [])].sort((a, b) =>
            a.platform.localeCompare(b.platform),
        );
        groups.push({
            month: item.month,
            monthLabel: formatTargetMonthLabel(item.month),
            entries,
        });
    });

    return groups;
}

function formatMonthYearLabel(month: string, year: string): string {
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(date.getTime())) return `${month}-${year}`;
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatMonthYearFromApiMonth(monthParam: string): string {
    const [month, year] = monthParam.split('-');
    return formatMonthYearLabel(month ?? '', year ?? '');
}

function formatMonthYearFromAppliedMonth(appliedMonth: string): string {
    const [year, month] = appliedMonth.split('-');
    return formatMonthYearLabel(month ?? '', year ?? '');
}

function averageSales(entries: DailySalesRankingDateEntry[]): number {
    if (entries.length === 0) return 0;
    return entries.reduce((sum, entry) => sum + entry.totalSales, 0) / entries.length;
}

function DeltaBadge({ delta }: { delta: DeltaInfo }) {
    return (
        <span className={`performance-delta performance-delta--${delta.direction}`}>
            {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'} {delta.text}
        </span>
    );
}

function SalesDayRankList({
    title,
    subtitle,
    tone,
    items,
    emptyMessage,
}: {
    title: string;
    subtitle: string;
    tone: 'top' | 'least';
    items: DailySalesRankingDateEntry[];
    emptyMessage: string;
}) {
    const maxSales = useMemo(
        () => Math.max(...items.map((item) => item.totalSales), 1),
        [items],
    );

    return (
        <section className={`performance-sales-rank-panel performance-sales-rank-panel--${tone}`}>
            <header className="performance-sales-rank-panel__head">
                <div>
                    <h3 className="performance-sales-rank-panel__title">{title}</h3>
                    <p className="performance-sales-rank-panel__subtitle">{subtitle}</p>
                </div>
                <span className="performance-sales-rank-panel__count">{items.length} days</span>
            </header>

            {items.length === 0 ? (
                <div className="performance-sales-rank-panel__empty">{emptyMessage}</div>
            ) : (
                <ol className="performance-sales-rank-list">
                    {items.map((item, index) => {
                        const width = Math.max(6, (item.totalSales / maxSales) * 100);
                        return (
                            <li key={item.date} className="performance-sales-rank-item">
                                <span className={`performance-sales-rank-item__rank performance-sales-rank-item__rank--${index + 1}`}>
                                    #{index + 1}
                                </span>
                                <div className="performance-sales-rank-item__body">
                                    <div className="performance-sales-rank-item__top">
                                        <span className="performance-sales-rank-item__date">{formatDayLabel(item.date)}</span>
                                        <span className="performance-sales-rank-item__orders">
                                            {item.orderCount.toLocaleString('en-IN')} orders
                                        </span>
                                    </div>
                                    <div className="performance-sales-rank-item__sales">{formatCurrency(item.totalSales)}</div>
                                    <div className="performance-sales-rank-item__bar" aria-hidden>
                                        <span style={{ width: `${width}%` }} />
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

function PlatformWiseDailyRanking({
    data,
    loading,
    error,
}: {
    data: DailySalesRankingResponse | null;
    loading: boolean;
    error: string | null;
}) {
    const topDays = data?.topSalesDates ?? [];
    const leastDays = data?.leastSalesDates ?? [];

    const summary = useMemo(() => {
        const bestDay = topDays[0];
        const worstDay = leastDays[0];
        return {
            bestDay,
            worstDay,
            topAvg: averageSales(topDays),
            leastAvg: averageSales(leastDays),
        };
    }, [topDays, leastDays]);

    if (loading) return null;

    if (error) {
        return <div className="performance-month-empty">{error}</div>;
    }

    if (!data || (topDays.length === 0 && leastDays.length === 0)) {
        return (
            <div className="performance-month-empty">
                No daily sales ranking data for the selected month.
            </div>
        );
    }

    const monthLabel = data.filters.appliedMonth
        ? formatMonthYearFromAppliedMonth(data.filters.appliedMonth)
        : formatMonthYearFromApiMonth(data.filters.month);

    return (
        <div className="performance-platform-comparison">
            <div className="performance-day-summary-grid">
                <article className="performance-day-summary-card performance-day-summary-card--peak">
                    <span className="performance-day-summary-card__label">Peak day</span>
                    <strong className="performance-day-summary-card__value">
                        {summary.bestDay ? formatCurrency(summary.bestDay.totalSales) : '—'}
                    </strong>
                    <span className="performance-day-summary-card__meta">
                        {summary.bestDay ? formatDayLabel(summary.bestDay.date) : 'No data'}
                    </span>
                </article>
                <article className="performance-day-summary-card performance-day-summary-card--low">
                    <span className="performance-day-summary-card__label">Lowest day</span>
                    <strong className="performance-day-summary-card__value">
                        {summary.worstDay ? formatCurrency(summary.worstDay.totalSales) : '—'}
                    </strong>
                    <span className="performance-day-summary-card__meta">
                        {summary.worstDay ? formatDayLabel(summary.worstDay.date) : 'No data'}
                    </span>
                </article>
                <article className="performance-day-summary-card">
                    <span className="performance-day-summary-card__label">Top 5 average</span>
                    <strong className="performance-day-summary-card__value">{formatCurrency(summary.topAvg)}</strong>
                    <span className="performance-day-summary-card__meta">Best performing days</span>
                </article>
                <article className="performance-day-summary-card">
                    <span className="performance-day-summary-card__label">Bottom 5 average</span>
                    <strong className="performance-day-summary-card__value">{formatCurrency(summary.leastAvg)}</strong>
                    <span className="performance-day-summary-card__meta">Least performing days</span>
                </article>
            </div>

            <div className="performance-sales-rank-grid">
                <SalesDayRankList
                    title="Top 5 performing days"
                    subtitle={`Highest sales days in ${monthLabel}`}
                    tone="top"
                    items={topDays}
                    emptyMessage="No top performing days for this month."
                />
                <SalesDayRankList
                    title="Least 5 performing days"
                    subtitle={`Lowest sales days in ${monthLabel}`}
                    tone="least"
                    items={leastDays}
                    emptyMessage="No least performing days for this month."
                />
            </div>
        </div>
    );
}

function PeriodSummaryCard({
    period,
    previousPeriod,
}: {
    period: PlatformSalesComparisonPeriod;
    previousPeriod?: PlatformSalesComparisonPeriod;
}) {
    const delta = previousPeriod ? getDelta(period.totalSales, previousPeriod.totalSales) : null;

    return (
        <article className={`performance-period-card performance-period-card--${period.key}`}>
            <div className="performance-period-card__head">
                <span className="performance-period-card__eyebrow">{PERIOD_LABELS[period.key]}</span>
                <h3 className="performance-period-card__title">{formatMonthLabel(period.month)}</h3>
                <p className="performance-period-card__range">{formatPeriodRange(period.from, period.to)}</p>
            </div>
            <div className="performance-period-card__value">{formatCurrency(period.totalSales)}</div>
            <div className="performance-period-card__rto">
                <span>{(period.totalRtoOrderCount ?? 0).toLocaleString('en-IN')} RTO orders</span>
                <span>{formatCurrency(period.totalRtoAmount ?? 0)} RTO amount</span>
            </div>
            <div className="performance-period-card__footer">
                <span className="performance-period-card__label">Total sales</span>
                {delta ? <DeltaBadge delta={delta} /> : <span className="performance-period-card__baseline">Baseline</span>}
            </div>
        </article>
    );
}

function MonthWiseComparison({
    data,
    loading,
    error,
}: {
    data: PlatformSalesComparisonResponse | null;
    loading: boolean;
    error: string | null;
}) {
    const periods = useMemo(() => {
        if (!data?.periods?.length) return [];
        return PERIOD_ORDER.map((key) => getPeriodByKey(data.periods, key)).filter(
            (period): period is PlatformSalesComparisonPeriod => Boolean(period),
        );
    }, [data]);

    const platforms = useMemo(
        () => sortPlatformsWithCallingLast(data?.filters?.platforms ?? []),
        [data],
    );

    const currentPeriod = getPeriodByKey(periods, 'currentMonth');
    const lastPeriod = getPeriodByKey(periods, 'lastMonth');

    if (loading) return null;

    if (error) {
        return <div className="performance-month-empty">{error}</div>;
    }

    if (!data || periods.length === 0) {
        return (
            <div className="performance-month-empty">
                No month-wise performance data for the selected date.
            </div>
        );
    }

    return (
        <div className="performance-month-comparison">
            <div className="performance-period-grid">
                {periods.map((period, index) => (
                    <PeriodSummaryCard
                        key={period.key}
                        period={period}
                        previousPeriod={index > 0 ? periods[index - 1] : undefined}
                    />
                ))}
            </div>

            <div className="performance-comparison-panel">
                <div className="performance-comparison-panel__head">
                    <div>
                        <h3 className="performance-comparison-panel__title">Platform sales comparison</h3>
                        <p className="performance-comparison-panel__subtitle">
                            Same day-range across three months · as of {data.filters.date}
                        </p>
                    </div>
                </div>

                <div className="table-scroll-wrapper">
                    <table className="performance-comparison-table">
                        <thead>
                            <tr>
                                <th>Platform</th>
                                {periods.map((period) => (
                                    <th key={period.key}>
                                        <span className="performance-comparison-table__col-title">
                                            {formatMonthLabel(period.month)}
                                        </span>
                                        <span className="performance-comparison-table__col-range">
                                            {formatPeriodRange(period.from, period.to)}
                                        </span>
                                    </th>
                                ))}
                                <th>vs Last Month</th>
                            </tr>
                        </thead>
                        <tbody>
                            {platforms.map((platform) => {
                                const currentStats = currentPeriod ? getPlatformStats(currentPeriod, platform) : null;
                                const lastStats = lastPeriod ? getPlatformStats(lastPeriod, platform) : null;
                                const delta =
                                    currentStats && lastStats ? getDelta(currentStats.sales, lastStats.sales) : null;

                                return (
                                    <tr key={platform}>
                                        <td className="performance-comparison-table__platform">
                                            <PlatformTag platform={normalizePlatformKey(platform)} />
                                        </td>
                                        {periods.map((period) => {
                                            const stats = getPlatformStats(period, platform);
                                            const share =
                                                period.totalSales > 0 ? (stats.sales / period.totalSales) * 100 : 0;
                                            const marketingSpend = isShopifyPlatform(platform)
                                                ? period.platformMarketingSpend
                                                : undefined;
                                            return (
                                                <td key={`${platform}-${period.key}`}>
                                                    <div className="performance-comparison-table__amount">
                                                        {formatCurrency(stats.sales)}
                                                    </div>
                                                    {marketingSpend != null && marketingSpend > 0 ? (
                                                        <div className="performance-comparison-table__spend">
                                                            Meta Spend: {formatCurrency(marketingSpend)}
                                                        </div>
                                                    ) : null}
                                                    <div className="performance-comparison-table__rto">
                                                        {stats.rtoOrderCount.toLocaleString('en-IN')} RTO ·{' '}
                                                        {formatCurrency(stats.rtoAmount)}
                                                    </div>
                                                    <div className="performance-comparison-table__share">
                                                        {share.toFixed(1)}% of total
                                                    </div>
                                                    <div className="performance-comparison-table__bar" aria-hidden>
                                                        <span style={{ width: `${Math.min(share, 100)}%` }} />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td>
                                            {delta ? <DeltaBadge delta={delta} /> : <span>—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="performance-comparison-table__total-row">
                                <td className="performance-comparison-table__platform">Total</td>
                                {periods.map((period) => (
                                    <td key={`total-${period.key}`}>
                                        <div className="performance-comparison-table__amount performance-comparison-table__amount--total">
                                            {formatCurrency(period.totalSales)}
                                        </div>
                                        <div className="performance-comparison-table__rto performance-comparison-table__rto--total">
                                            {(period.totalRtoOrderCount ?? 0).toLocaleString('en-IN')} RTO orders ·{' '}
                                            {formatCurrency(period.totalRtoAmount ?? 0)}
                                        </div>
                                    </td>
                                ))}
                                <td>
                                    {currentPeriod && lastPeriod ? (
                                        <DeltaBadge delta={getDelta(currentPeriod.totalSales, lastPeriod.totalSales)} />
                                    ) : (
                                        <span>—</span>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function TargetsList({
    data,
    loading,
    error,
}: {
    data: TargetsListResponse | null;
    loading: boolean;
    error: string | null;
}) {
    const targets = useMemo(
        () => sortTargetsNewestFirst(data?.items ?? []),
        [data],
    );
    const groupedTargets = useMemo(() => groupTargetsByMonth(targets), [targets]);
    const targetsCount = getTargetsCount(data);

    if (loading) return null;

    if (error) {
        return <div className="performance-month-empty">{error}</div>;
    }

    if (!data || targets.length === 0) {
        return (
            <div className="performance-month-empty">
                No targets saved yet. Use Add Target to create one.
            </div>
        );
    }

    return (
        <div className="performance-month-comparison">
            <div className="performance-comparison-panel">
                <div className="performance-comparison-panel__head">
                    <div>
                        <h3 className="performance-comparison-panel__title">Saved targets</h3>
                        <p className="performance-comparison-panel__subtitle">
                            {targetsCount.toLocaleString('en-IN')} target{targetsCount === 1 ? '' : 's'} configured
                        </p>
                    </div>
                </div>

                <div className="table-scroll-wrapper">
                    <table className="performance-comparison-table performance-comparison-table--targets">
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Platform</th>
                                <th>Target</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedTargets.map((group) => (
                                <tr key={group.month}>
                                    <td>
                                        <div className="performance-comparison-table__amount">
                                            {group.monthLabel}
                                        </div>
                                    </td>
                                    <td className="performance-comparison-table__platform">
                                        <div className="performance-targets-cell-stack">
                                            {group.entries.map((item) => (
                                                <div
                                                    key={item._id}
                                                    className="performance-targets-cell-stack__item"
                                                >
                                                    <PlatformTag platform={platformKeyForTargetTag(item.platform)} />
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="performance-targets-cell-stack">
                                            {group.entries.map((item) => (
                                                <div
                                                    key={item._id}
                                                    className="performance-targets-cell-stack__item performance-comparison-table__amount"
                                                >
                                                    {formatTargetDisplayValue(item.target)}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function Performance() {
    const now = new Date();
    const [viewTab, setViewTab] = useState<PerformanceViewTab>('platform');
    const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
    const [selectedDate, setSelectedDate] = useState(() => toInputDate(now));
    const [platformData, setPlatformData] = useState<DailySalesRankingResponse | null>(null);
    const [platformLoading, setPlatformLoading] = useState(false);
    const [platformError, setPlatformError] = useState<string | null>(null);
    const [monthData, setMonthData] = useState<PlatformSalesComparisonResponse | null>(null);
    const [monthLoading, setMonthLoading] = useState(false);
    const [monthError, setMonthError] = useState<string | null>(null);
    const [targetsData, setTargetsData] = useState<TargetsListResponse | null>(null);
    const [targetsLoading, setTargetsLoading] = useState(false);
    const [targetsError, setTargetsError] = useState<string | null>(null);
    const [showAddTarget, setShowAddTarget] = useState(false);

    const yearOptions = useMemo(() => buildYearOptions(), []);

    const refreshTargets = useCallback(async () => {
        try {
            setTargetsLoading(true);
            setTargetsError(null);
            const data = await fetchTargets();
            setTargetsData(data);
        } catch (err) {
            console.error('Failed to load targets', err);
            setTargetsData(null);
            setTargetsError('Failed to load targets. Please try again.');
        } finally {
            setTargetsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (viewTab !== 'platform' || !selectedMonth || !selectedYear) return;

        let cancelled = false;
        (async () => {
            try {
                setPlatformLoading(true);
                setPlatformError(null);
                const data = await fetchDailySalesRanking(selectedMonth, selectedYear);
                if (!cancelled) {
                    setPlatformData(data);
                }
            } catch (err) {
                console.error('Failed to load daily sales ranking', err);
                if (!cancelled) {
                    setPlatformData(null);
                    setPlatformError('Failed to load platform-wise performance. Please try again.');
                }
            } finally {
                if (!cancelled) {
                    setPlatformLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [viewTab, selectedMonth, selectedYear]);

    useEffect(() => {
        if (viewTab !== 'month' || !selectedDate) return;

        let cancelled = false;
        (async () => {
            try {
                setMonthLoading(true);
                setMonthError(null);
                const data = await fetchPlatformSalesComparison(selectedDate);
                if (!cancelled) {
                    setMonthData(data);
                }
            } catch (err) {
                console.error('Failed to load platform sales comparison', err);
                if (!cancelled) {
                    setMonthData(null);
                    setMonthError('Failed to load month-wise performance. Please try again.');
                }
            } finally {
                if (!cancelled) {
                    setMonthLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [viewTab, selectedDate]);

    useEffect(() => {
        if (viewTab !== 'targets') return;

        let cancelled = false;
        (async () => {
            try {
                setTargetsLoading(true);
                setTargetsError(null);
                const data = await fetchTargets();
                if (!cancelled) {
                    setTargetsData(data);
                }
            } catch (err) {
                console.error('Failed to load targets', err);
                if (!cancelled) {
                    setTargetsData(null);
                    setTargetsError('Failed to load targets. Please try again.');
                }
            } finally {
                if (!cancelled) {
                    setTargetsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [viewTab]);

    const countBarLabel = useMemo(() => {
        if (viewTab === 'platform') {
            if (platformLoading) return 'Loading top and least performing days…';
            if (platformError) return platformError;
            if (!platformData) return `Daily sales ranking for ${formatMonthYearLabel(selectedMonth, selectedYear)}`;
            const monthLabel = platformData.filters.appliedMonth
                ? formatMonthYearFromAppliedMonth(platformData.filters.appliedMonth)
                : formatMonthYearFromApiMonth(platformData.filters.month);
            return `Top & least performing days · ${monthLabel}`;
        }
        if (viewTab === 'targets') {
            if (targetsLoading) return 'Loading targets…';
            if (targetsError) return targetsError;
            if (!targetsData) return 'Platform targets';
            return `${getTargetsCount(targetsData).toLocaleString('en-IN')} saved target${getTargetsCount(targetsData) === 1 ? '' : 's'}`;
        }
        if (monthLoading) return 'Loading 3-month platform comparison…';
        if (monthError) return monthError;
        if (!monthData?.periods?.length) {
            return `3-month comparison for ${selectedDate}`;
        }
        return `3-month platform sales comparison · as of ${monthData.filters.date}`;
    }, [
        viewTab,
        platformLoading,
        platformError,
        platformData,
        selectedMonth,
        selectedYear,
        monthLoading,
        monthError,
        monthData,
        selectedDate,
        targetsLoading,
        targetsError,
        targetsData,
    ]);

    return (
        <section className="modules-page">
            {viewTab === 'platform' && platformLoading ? (
                <Spinner overlay fixed message="Loading platform-wise performance…" />
            ) : null}
            {viewTab === 'month' && monthLoading ? (
                <Spinner overlay fixed message="Loading month-wise performance…" />
            ) : null}
            {viewTab === 'targets' && targetsLoading ? (
                <Spinner overlay fixed message="Loading targets…" />
            ) : null}

            <div className="card modules-header-card">
                <div className="modules-header-title">Performance</div>
                <div className="modules-header-row performance-page-header-row">
                    <div className="performance-view-tabs" role="tablist" aria-label="Performance view">
                        {PERFORMANCE_VIEW_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={viewTab === tab.id}
                                id={`performance-view-tab-${tab.id}`}
                                className={`performance-view-tab performance-view-tab--${tab.id}${
                                    viewTab === tab.id ? ' is-active' : ''
                                }`}
                                onClick={() => setViewTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {viewTab === 'platform' ? (
                        <div className="performance-period-filters">
                            <div className="performance-period-filter">
                                <label className="label performance-period-filter__label">Month</label>
                                <ModernSelect
                                    value={selectedMonth}
                                    onChange={(value) => value && setSelectedMonth(value)}
                                    options={MONTH_OPTIONS}
                                    aria-label="Select month"
                                />
                            </div>
                            <div className="performance-period-filter">
                                <label className="label performance-period-filter__label">Year</label>
                                <ModernSelect
                                    value={selectedYear}
                                    onChange={(value) => value && setSelectedYear(value)}
                                    options={yearOptions}
                                    aria-label="Select year"
                                />
                            </div>
                        </div>
                    ) : null}
                    {viewTab === 'month' ? (
                        <div className="performance-date-field">
                            <label className="label performance-date-field__label" htmlFor="performance-month-date">
                                Date
                            </label>
                            <DatePicker
                                value={selectedDate}
                                onChange={setSelectedDate}
                                placeholder="Select date"
                            />
                        </div>
                    ) : null}
                    {viewTab === 'targets' ? (
                        <div className="performance-targets-header-actions">
                            <button
                                type="button"
                                className="button performance-add-target-btn"
                                onClick={() => setShowAddTarget(true)}
                            >
                                + Add Target
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="performance-month-card">
                <div className="modules-count-bar">{countBarLabel}</div>
                {viewTab === 'platform' ? (
                    <PlatformWiseDailyRanking data={platformData} loading={platformLoading} error={platformError} />
                ) : viewTab === 'month' ? (
                    <MonthWiseComparison data={monthData} loading={monthLoading} error={monthError} />
                ) : (
                    <TargetsList data={targetsData} loading={targetsLoading} error={targetsError} />
                )}
            </div>

            {showAddTarget ? (
                <AddTargetModal
                    onClose={() => setShowAddTarget(false)}
                    onSaved={() => void refreshTargets()}
                />
            ) : null}
        </section>
    );
}
