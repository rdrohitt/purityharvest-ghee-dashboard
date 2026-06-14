/**
 * GET /api/analytics/daily-sales-ranking?month=MM-YYYY
 */
export type DailySalesRankingDateEntry = {
    totalSales: number;
    orderCount: number;
    date: string;
};

export type DailySalesRankingAppliedDateRange = {
    $gte: string;
    $lte: string;
};

export type DailySalesRankingFilters = {
    month: string;
    appliedMonth: string;
    appliedDateRange: DailySalesRankingAppliedDateRange;
};

export type DailySalesRankingResponse = {
    filters: DailySalesRankingFilters;
    topSalesDates: DailySalesRankingDateEntry[];
    leastSalesDates: DailySalesRankingDateEntry[];
};
