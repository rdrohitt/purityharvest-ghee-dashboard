/**
 * GET /api/analytics/platform-sales-comparison?date=DD-MM-YYYY
 */
export type PlatformSalesComparisonPeriodKey = 'currentMonth' | 'lastMonth' | 'twoMonthsAgo';

export type PlatformSalesComparisonFilters = {
    date: string;
    platforms: string[];
};

export type PlatformSalesComparisonPeriod = {
    key: PlatformSalesComparisonPeriodKey;
    month: string;
    from: string;
    to: string;
    platformSales: Record<string, number>;
    totalSales: number;
};

export type PlatformSalesComparisonResponse = {
    filters: PlatformSalesComparisonFilters;
    periods: PlatformSalesComparisonPeriod[];
};
