/**
 * GET /api/followups/dashboard — paginated follow-up / customer rows.
 */

export interface FollowupsDashboardCustomer {
    _id: string;
    name: string;
    phoneNumber: string;
    countryCode: string;
    phone: string;
    tag?: string;
}

/** Populated caller on a dashboard row (shape may vary when present). */
export interface FollowupsDashboardCaller {
    _id?: string;
    name?: string;
}

export interface FollowupsDashboardRow {
    customer: FollowupsDashboardCustomer;
    lastOrderDate: string;
    totalOrders: number;
    lastOrderSummary: string;
    lastOrderAmount: number;
    lastOrderQuantity: number;
    feedback: string | null;
    callingDate: string | null;
    callingDetail: string;
    callAgain: string | null;
    caller: FollowupsDashboardCaller | null;
    followupId: string | null;
}

export interface FollowupsDashboardResponse {
    /** Number of rows in this page */
    count: number;
    /** Total rows across all pages */
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    rows: FollowupsDashboardRow[];
}
