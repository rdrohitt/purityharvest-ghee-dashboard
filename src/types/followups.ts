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

/**
 * Customer call history:
 * `GET /api/followups/customer/<customerId>`
 */
export interface FollowupsCustomerHistoryCustomer {
    _id: string;
    name: string;
    phoneNumber: string;
    countryCode: string;
    address: string;
    state: string;
    pincode: string;
    createdAt: string; // ISO
    updatedAt: string; // ISO
    __v: number;
}

export interface FollowupsCustomerHistoryUserRef {
    _id: string;
    name: string;
}

export interface FollowupsCustomerHistoryEntry {
    _id: string;
    calledOn: string; // ISO
    caller: FollowupsCustomerHistoryUserRef;
    feedback: string | null;
    notes: string;
    callAgain: string | null; // ISO or null
    createdBy: FollowupsCustomerHistoryUserRef;
    updatedBy: FollowupsCustomerHistoryUserRef;
    createdAt: string; // ISO
    updatedAt: string; // ISO
    __v: number;
}

export interface FollowupsCustomerHistoryResponse {
    customer: FollowupsCustomerHistoryCustomer;
    count: number;
    history: FollowupsCustomerHistoryEntry[];
}
