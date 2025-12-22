export type Followup = {
    id: string;
    customerName: string;
    customerPhone: string;
    lastOrder: string; // ISO date
    totalOrders: number;
    lastOrderDetail: string;
    feedback: string;
    callingDate: string | null; // ISO date or null
    callerName: string;
    callingDetail: string;
    callAgainDate: string | null; // ISO date or null
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
};

/**
 * Load followups data from the backend API, which reads from followups.json on disk.
 */
export async function loadFollowupsData(): Promise<FollowupData[]> {
    const response = await fetch('/api/followups');
    if (!response.ok) {
        throw new Error('Failed to load followups from API');
    }
    return (await response.json()) as FollowupData[];
}

/**
 * Save followup data via the backend API so it is saved to followups.json on disk.
 */
export async function saveFollowupData(followupData: FollowupData): Promise<FollowupData> {
    const response = await fetch('/api/followups', {
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
    const response = await fetch(`/api/followups/${encodeURIComponent(customerPhone)}`, {
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
            customerName: name,
            customerPhone: phone,
            lastOrder: lastOrderDate.toISOString(),
            totalOrders,
            lastOrderDetail: orderDetails[Math.floor(rand(seed + 8) * orderDetails.length)],
            feedback: feedbacks[Math.floor(rand(seed + 9) * feedbacks.length)],
            callingDate: callingDate?.toISOString() || null,
            callerName: callers[Math.floor(rand(seed + 10) * callers.length)],
            callingDetail: rand(seed + 11) > 0.5 ? 'Customer requested callback' : 'Follow up on previous order',
            callAgainDate: callAgainDate?.toISOString() || null,
        });
    }
    
    return followups.sort((a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime());
}

