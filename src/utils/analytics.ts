import { apiFetch } from '../api';
import type { AnalyticsOrderReportingResponse } from '../types/analytics-order-reporting';
import type { AnalyticsOverviewResponse } from '../types/analytics-overview';

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
