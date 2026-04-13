import { apiFetch } from '../api';
import type { AnalyticsOverviewResponse } from '../types/analytics-overview';

/** GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function fetchAnalyticsOverview(from: string, to: string): Promise<AnalyticsOverviewResponse> {
    const params = new URLSearchParams({ from, to });
    const res = await apiFetch(`/api/analytics/overview?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to load analytics overview');
    }
    return (await res.json()) as AnalyticsOverviewResponse;
}
