/**
 * GET /api/analytics/monthly-order-customers?month=6&year=2026
 */
export type MonthlyOrderCustomer = {
    customerId: string;
    name: string;
    phoneNumber: string;
};

export type MonthlyOrderCustomersFilters = {
    month: number;
    year: number;
    appliedMonth: string;
    appliedDateRange: {
        $gte: string;
        $lte: string;
    };
};

export type MonthlyOrderCustomersResponse = {
    filters: MonthlyOrderCustomersFilters;
    count: number;
    customers: MonthlyOrderCustomer[];
};
