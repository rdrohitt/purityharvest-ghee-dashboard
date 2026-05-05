/**
 * GET /api/analytics/order-reporting?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export type AnalyticsOrderReportingAppliedDateRange = {
    $gte: string;
    $lte: string;
};

export type AnalyticsOrderReportingFilters = {
    from: string;
    to: string;
    appliedDateRange: AnalyticsOrderReportingAppliedDateRange;
};

export type AnalyticsOrderReportingStateCount = {
    count: number;
    revenue?: number;
    state: string;
};

export type AnalyticsOrderReportingPincodeCount = {
    count: number;
    revenue?: number;
    pincode: string;
};

export type AnalyticsOrderReportingResponse = {
    filters: AnalyticsOrderReportingFilters;
    totalOrders?: number;
    stateCounts: AnalyticsOrderReportingStateCount[];
    pincodeCounts: AnalyticsOrderReportingPincodeCount[];
};
