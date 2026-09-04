/**
 * GET /api/analytics/customers-not-ordered-since?date=01-08-2026
 */
export type CustomerNotOrderedSince = {
    customerId: string;
    name: string;
    phoneNumber: string;
    lastOrderDate?: string;
};

export type CustomersNotOrderedSinceResponse = {
    filters?: {
        date?: string;
    };
    count: number;
    customers: CustomerNotOrderedSince[];
};
