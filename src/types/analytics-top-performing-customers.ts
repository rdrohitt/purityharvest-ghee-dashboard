/**
 * GET /api/analytics/top-performing-customers?from=YYYY-MM-DD&to=YYYY-MM-DD&type=order|amount
 */
export type TopPerformingCustomersType = 'order' | 'amount';

export type TopPerformingCustomersAppliedDateRange = {
    $gte: string;
    $lte: string;
};

export type TopPerformingCustomersFilters = {
    from: string;
    to: string;
    type: TopPerformingCustomersType;
    appliedDateRange: TopPerformingCustomersAppliedDateRange;
};

export type TopPerformingCustomerLastOrder = {
    id: string;
    date: string;
    totalAmount: number;
    platform: string;
    paymentMode: string;
    referenceNo: string | null;
    trackingStatus: string;
    trackingNumber: string;
    returnStatus: boolean;
};

export type TopPerformingCustomer = {
    customerId: string;
    name: string;
    phoneNumber: string;
    countryCode: string;
    orderCount: number;
    totalAmount: number;
    lastOrder: TopPerformingCustomerLastOrder;
};

export type TopPerformingCustomersResponse = {
    filters: TopPerformingCustomersFilters;
    count: number;
    customers: TopPerformingCustomer[];
};
