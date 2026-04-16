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
    state: string;
};

export type AnalyticsOrderReportingPincodeCount = {
    count: number;
    pincode: string;
};

export type AnalyticsOrderReportingResponse = {
    filters: AnalyticsOrderReportingFilters;
    stateCounts: AnalyticsOrderReportingStateCount[];
    pincodeCounts: AnalyticsOrderReportingPincodeCount[];
};
