/**
 * GET /api/analytics/overview — dashboard aggregates for a date range.
 */

export interface AnalyticsOverviewAppliedDateRange {
    $gte: string;
    $lte: string;
}

export interface AnalyticsOverviewFilters {
    range: string | null;
    from: string;
    to: string;
    appliedDateRange: AnalyticsOverviewAppliedDateRange;
}

/** Per-platform marketing spend amounts (keys depend on backend). */
export type AnalyticsOverviewMarketingSpendByPlatform = Record<string, number>;

export interface AnalyticsOverviewSalesEbitaCosts {
    manufacturingDelivered: number;
    manufacturingExpected: number;
    marketingSpendTotal: number;
    marketingSpendByPlatform: AnalyticsOverviewMarketingSpendByPlatform;
}

export interface AnalyticsOverviewSalesEbita {
    costs: AnalyticsOverviewSalesEbitaCosts;
    /** Revenue in range — when provided by the overview API. */
    totalSales?: number;
    ebita?: number;
    expectedEbita?: number;
}

export interface AnalyticsOverviewLitresByType {
    girCow: number;
    desiCow: number;
    buffalo: number;
}

export interface AnalyticsOverviewQuantityBySizeBucket {
    ordered: number;
    delivered: number;
    rto: number;
    inTransit: number;
}

/** Keys e.g. 500ml, 1litre, 5litre — backend may add more. */
export type AnalyticsOverviewQuantityBySize = Record<string, AnalyticsOverviewQuantityBySizeBucket>;

export interface AnalyticsOverviewVolume {
    totalLitres: number;
    litresByType: AnalyticsOverviewLitresByType;
    quantityBySize: AnalyticsOverviewQuantityBySize;
}

export interface AnalyticsOverviewShippingStage {
    count: number;
    amount: number;
}

export interface AnalyticsOverviewShippingPipeline {
    delivered: AnalyticsOverviewShippingStage;
    rto: AnalyticsOverviewShippingStage;
    inTransit: AnalyticsOverviewShippingStage;
}

export interface AnalyticsOverviewPaymentChannel {
    count: number;
    percentage: number;
}

export interface AnalyticsOverviewPaymentSplit {
    totalOrders: number;
    prepaid: AnalyticsOverviewPaymentChannel;
    cod: AnalyticsOverviewPaymentChannel;
    unknown: AnalyticsOverviewPaymentChannel;
}

export interface AnalyticsOverviewResponse {
    filters: AnalyticsOverviewFilters;
    salesEbita: AnalyticsOverviewSalesEbita;
    volume: AnalyticsOverviewVolume;
    shippingPipeline: AnalyticsOverviewShippingPipeline;
    paymentSplit: AnalyticsOverviewPaymentSplit;
}
