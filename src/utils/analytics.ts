import { apiFetch } from '../api';
import type { AnalyticsOrderReportingResponse } from '../types/analytics-order-reporting';
import type { AnalyticsOverviewResponse } from '../types/analytics-overview';
import type {
    TopPerformingCustomersResponse,
    TopPerformingCustomersType,
} from '../types/analytics-top-performing-customers';
import type { PlatformSalesComparisonResponse } from '../types/analytics-platform-sales-comparison';
import type { DailySalesRankingResponse } from '../types/analytics-daily-sales-ranking';

type AnalyticsOverviewFilters = {
    category?: string;
    paymentMode?: string;
    status?: string;
    platform?: string;
    type?: string;
};

/**
 * GET /api/analytics/overview
 * Always sends the required date range, and optionally forwards overview filters as query params so the
 * backend can scope analytics to the same view as the orders table.
 *
 * Examples:
 * - /api/analytics/overview?from=2024-01-01&to=2024-01-31&paymentMode=COD
 * - /api/analytics/overview?from=2024-01-01&to=2024-01-31&status=Delivered
 * - /api/analytics/overview?from=2024-01-01&to=2024-01-31&platform=Shopify
 * - /api/analytics/overview?from=2024-01-01&to=2024-01-31&type=New
 * - /api/analytics/overview?from=2024-01-01&to=2024-01-31&category=ghee
 */
export async function fetchAnalyticsOverview(
    from: string,
    to: string,
    filters?: AnalyticsOverviewFilters,
): Promise<AnalyticsOverviewResponse> {
    const params = new URLSearchParams({ from, to });

    if (filters?.category) params.set('category', filters.category);
    if (filters?.paymentMode) params.set('paymentMode', filters.paymentMode);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.platform) params.set('platform', filters.platform);
    if (filters?.type) params.set('type', filters.type);

    const res = await apiFetch(`/api/analytics/overview?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to load analytics overview');
    }
    return (await res.json()) as AnalyticsOverviewResponse;
}

/** GET /api/analytics/order-reporting?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function fetchAnalyticsOrderReporting(from: string, to: string): Promise<AnalyticsOrderReportingResponse> {
    const params = new URLSearchParams({ from, to });
    const res = await apiFetch(`/api/analytics/order-reporting?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to load order reporting');
    }
    return (await res.json()) as AnalyticsOrderReportingResponse;
}

/** Converts YYYY-MM-DD (date input) to DD-MM-YYYY (API query param). */
export function toPlatformSalesComparisonDateParam(inputDate: string): string {
    const [year, month, day] = inputDate.split('-');
    if (!year || !month || !day) return inputDate;
    return `${day}-${month}-${year}`;
}

/** GET /api/analytics/platform-sales-comparison?date=DD-MM-YYYY */
export async function fetchPlatformSalesComparison(inputDate: string): Promise<PlatformSalesComparisonResponse> {
    const date = toPlatformSalesComparisonDateParam(inputDate);
    const params = new URLSearchParams({ date });
    const res = await apiFetch(`/api/analytics/platform-sales-comparison?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to load platform sales comparison');
    }
    return (await res.json()) as PlatformSalesComparisonResponse;
}

/** Builds MM-YYYY query param for daily sales ranking. */
export function toDailySalesRankingMonthParam(month: string, year: string): string {
    return `${month.padStart(2, '0')}-${year}`;
}

/** GET /api/analytics/daily-sales-ranking?month=MM-YYYY */
export async function fetchDailySalesRanking(month: string, year: string): Promise<DailySalesRankingResponse> {
    const params = new URLSearchParams({ month: toDailySalesRankingMonthParam(month, year) });
    const res = await apiFetch(`/api/analytics/daily-sales-ranking?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to load daily sales ranking');
    }
    return (await res.json()) as DailySalesRankingResponse;
}

/** GET /api/analytics/top-performing-customers?from=YYYY-MM-DD&to=YYYY-MM-DD&type=order|amount */
export async function fetchTopPerformingCustomers(
    from: string,
    to: string,
    type: TopPerformingCustomersType,
): Promise<TopPerformingCustomersResponse> {
    const params = new URLSearchParams({ from, to, type });
    const res = await apiFetch(`/api/analytics/top-performing-customers?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to load top performing customers');
    }
    return (await res.json()) as TopPerformingCustomersResponse;
}
