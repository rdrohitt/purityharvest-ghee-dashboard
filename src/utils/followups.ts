import { apiFetch } from '../api';
import type { FollowupsDashboardResponse, FollowupsDashboardRow } from '../types/followups';

function parseFollowupsDashboardResponse(json: unknown): FollowupsDashboardResponse {
    if (!json || typeof json !== 'object') {
        throw new Error('Invalid followups dashboard response');
    }
    const o = json as Record<string, unknown>;
    if (
        typeof o.total !== 'number' ||
        typeof o.page !== 'number' ||
        typeof o.limit !== 'number' ||
        !Array.isArray(o.rows)
    ) {
        throw new Error('Invalid followups dashboard response');
    }
    const rows = o.rows as FollowupsDashboardRow[];
    const { total, page, limit } = o;
    const count = typeof o.count === 'number' ? o.count : rows.length;
    const totalPages =
        typeof o.totalPages === 'number' && o.totalPages >= 1
            ? o.totalPages
            : Math.max(1, Math.ceil(total / limit));
    return { count, total, page, limit, totalPages, rows };
}

/** One saved phone call / follow-up touchpoint (newest-first in UI). */
export type CallingHistoryEntry = {
    id: string;
    calledAt: string; // ISO
    callerName: string;
    callerId: string | null;
    detail: string;
    callAgainDate: string | null; // ISO or null
    feedback: string | null;
    createdAt: string; // ISO
    updatedAt: string; // ISO
    createdByName: string | null;
    updatedByName: string | null;
    createdById: string | null;
    updatedById: string | null;
    version: number | null; // `__v` from backend (if present)
};

export type Followup = {
    id: string;
    /** Customer document ID from /api/followups/dashboard */
    customerId: string;
    customerName: string;
    customerPhone: string;
    lastOrder: string; // ISO date
    totalOrders: number;
    lastOrderDetail: string;
    feedback: string;
    callingDate: string | null; // ISO date or null
    /** Caller user ID from /api/users/me (when available) */
    callerId?: string | null;
    callerName: string;
    callingDetail: string;
    callAgainDate: string | null; // ISO date or null
    callingHistory: CallingHistoryEntry[];
};

/**
 * Followup data stored in JSON (only followup-specific fields, not customer order data)
 */
export type FollowupData = {
    customerPhone: string; // Key to match with orders
    feedback: string;
    callingDate: string | null;
    callerName: string;
    callingDetail: string;
    callAgainDate: string | null;
    /** Append-only style list; UI shows newest first. */
    callingHistory?: CallingHistoryEntry[];
};

export type LoadFollowupsDashboardOptions = {
    /** 1-based page index (default 1) */
    page?: number;
    /** Page size (default 50) */
    limit?: number;
    /** Optional month filter (1-12) */
    month?: number;
    /** Optional year filter (e.g. 2026) */
    year?: number;
};

/** Normalize dashboard customer phone to 10-digit key used across the app. */
export function normalizeFollowupDashboardPhone(phoneNumber: string): string {
    return String(phoneNumber).replace(/\D/g, '').slice(-10);
}

export function dashboardRowToFollowupData(row: FollowupsDashboardRow): FollowupData {
    const customerPhone = normalizeFollowupDashboardPhone(row.customer.phoneNumber);
    return {
        customerPhone,
        feedback: row.feedback ?? '',
        callingDate: row.callingDate,
        callerName: row.caller?.name ?? '',
        callingDetail: row.callingDetail ?? '',
        callAgainDate: row.callAgain,
    };
}

export function dashboardRowToFollowup(row: FollowupsDashboardRow): Followup {
    const customerPhone = normalizeFollowupDashboardPhone(row.customer.phoneNumber);
    const id =
        row.followupId != null && String(row.followupId).trim() !== ''
            ? String(row.followupId)
            : `FU-${customerPhone}`;
    return {
        id,
        customerId: row.customer._id,
        customerName: row.customer.name,
        customerPhone,
        lastOrder: row.lastOrderDate,
        totalOrders: row.totalOrders,
        lastOrderDetail: row.lastOrderSummary,
        feedback: row.feedback ?? '',
        callingDate: row.callingDate,
        callerId: row.caller?._id ?? null,
        callerName: row.caller?.name ?? '',
        callingDetail: row.callingDetail ?? '',
        callAgainDate: row.callAgain,
        callingHistory: [],
    };
}

/**
 * Paginated dashboard: `/api/followups/dashboard?page=&limit=` (default limit 50).
 * Response shape: {@link FollowupsDashboardResponse}.
 */
export async function fetchFollowupsDashboard(
    options: LoadFollowupsDashboardOptions = {}
): Promise<FollowupsDashboardResponse> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(500, options.limit ?? 50));
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });
    if (typeof options.month === 'number' && Number.isFinite(options.month)) {
        params.set('month', String(Math.max(1, Math.min(12, Math.trunc(options.month)))));
    }
    if (typeof options.year === 'number' && Number.isFinite(options.year)) {
        params.set('year', String(Math.trunc(options.year)));
    }
    const response = await apiFetch(`/api/followups/dashboard?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to load followups from API');
    }
    const json: unknown = await response.json();
    return parseFollowupsDashboardResponse(json);
}

/** Maps dashboard `rows` to legacy {@link FollowupData} (e.g. for tooling). */
export async function loadFollowupsData(
    options: LoadFollowupsDashboardOptions = {}
): Promise<FollowupData[]> {
    const dash = await fetchFollowupsDashboard(options);
    return dash.rows.map(dashboardRowToFollowupData);
}

/**
 * Save followup data via the backend API so it is saved to followups.json on disk.
 */
export async function saveFollowupData(followupData: FollowupData): Promise<FollowupData> {
    const response = await apiFetch('/api/followups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(followupData),
    });

    if (!response.ok) {
        throw new Error('Failed to save followup data');
    }

    return (await response.json()) as FollowupData;
}

/**
 * Update existing followup data via the backend API (creates if doesn't exist).
 */
export async function updateFollowupData(customerPhone: string, followupData: Partial<FollowupData>): Promise<FollowupData> {
    const response = await apiFetch(`/api/followups/${encodeURIComponent(customerPhone)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(followupData),
    });

    if (!response.ok) {
        throw new Error('Failed to update followup data');
    }

    return (await response.json()) as FollowupData;
}
function rand(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

const customerNames = [
    'Aarav Sharma', 'Isha Gupta', 'Rohit Verma', 'Neha Singh', 'Karan Mehta',
    'Pooja Rao', 'Aarav Patel', 'Sana Khan', 'Vikram Joshi', 'Anita Desai',
    'Harsh Malhotra', 'Divya Nair', 'Ritika Kapoor', 'Aman Soni', 'Meera Jain'
];

const callers = ['Raj Kumar', 'Priya Sharma', 'Amit Singh', 'Sneha Patel', 'Vikash Mehta'];
const feedbacks = ['Satisfied', 'Very Satisfied', 'Needs Improvement', 'Complaint', 'No Feedback'];
const orderDetails = ['500ml Ghee × 2', '1L Ghee × 1', 'Combo Pack × 1', 'A2 Ghee 500ml × 3', 'Organic Honey 500g × 2'];

export function generateMockFollowups(limit = 50): Followup[] {
    const followups: Followup[] = [];
    const now = new Date();
    
    for (let i = 0; i < limit; i++) {
        const seed = i + 1;
        const name = customerNames[Math.floor(rand(seed) * customerNames.length)];
        const phone = `9${String(Math.floor(rand(seed + 1) * 1000000000)).padStart(9, '0')}`;
        const totalOrders = Math.floor(rand(seed + 2) * 10) + 1;
        
        // Last order date (within last 60 days)
        const lastOrderDaysAgo = Math.floor(rand(seed + 3) * 60);
        const lastOrderDate = new Date(now);
        lastOrderDate.setDate(now.getDate() - lastOrderDaysAgo);
        
        // Calling date (within last 30 days, or null)
        const hasCallingDate = rand(seed + 4) > 0.3; // 70% chance
        const callingDate = hasCallingDate ? (() => {
            const d = new Date(now);
            d.setDate(now.getDate() - Math.floor(rand(seed + 5) * 30));
            return d;
        })() : null;
        
        // Call again date (future date if calling date exists, or null)
        const callAgainDate = callingDate && rand(seed + 6) > 0.5 ? (() => {
            const d = new Date(callingDate);
            d.setDate(d.getDate() + Math.floor(rand(seed + 7) * 14) + 1);
            return d;
        })() : null;
        
        followups.push({
            id: `FU-${1000 + i}`,
            customerId: `CUST-${1000 + i}`,
            customerName: name,
            customerPhone: phone,
            lastOrder: lastOrderDate.toISOString(),
            totalOrders,
            lastOrderDetail: orderDetails[Math.floor(rand(seed + 8) * orderDetails.length)],
            feedback: feedbacks[Math.floor(rand(seed + 9) * feedbacks.length)],
            callingDate: callingDate?.toISOString() || null,
            callerId: null,
            callerName: callers[Math.floor(rand(seed + 10) * callers.length)],
            callingDetail: rand(seed + 11) > 0.5 ? 'Customer requested callback' : 'Follow up on previous order',
            callAgainDate: callAgainDate?.toISOString() || null,
            callingHistory: [],
        });
    }
    
    return followups.sort((a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime());
}


