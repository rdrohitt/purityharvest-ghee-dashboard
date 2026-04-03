import type { Followup, CallingHistoryEntry } from '../../utils/followups';

export const FEEDBACK_OPTIONS = [
    'Excellent ghee',
    'Average ghee',
    'Smell issue',
    'High price',
    'Packaging issue',
    'Delayed delivery',
    'Other feedback',
] as const;

export const CALLER_OPTIONS = ['Monia', 'Sarita'] as const;

export const FOLLOWUPS_PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;

export function dummyCallHistoryForPhone(phone: string): CallingHistoryEntry[] {
    // No dummy data in production – keep API stable but return empty history
    return [];
}

export function isDemoFollowupRow(f: Followup): boolean {
    return f.id.startsWith('FU-DEMO-');
}

const DUMMY_FOLLOWUP_TABLE_ROWS: Followup[] = (() => {
    const rows: Omit<
        Followup,
        'callingHistory' | 'callingDate' | 'callerName' | 'callingDetail' | 'callAgainDate' | 'callerId'
    >[] = [
        {
            id: 'FU-DEMO-1',
            customerId: 'DEMO-CUSTOMER-1',
            customerName: 'Priya Malhotra',
            customerPhone: '9100000001',
            lastOrder: '2026-03-26T10:00:00.000Z',
            totalOrders: 3,
            lastOrderDetail: '1L Gir cow ghee × 1, 500ml A2 × 2',
            feedback: 'Excellent ghee',
        },
        {
            id: 'FU-DEMO-2',
            customerId: 'DEMO-CUSTOMER-2',
            customerName: 'Arjun Mehta',
            customerPhone: '9100000002',
            lastOrder: '2026-03-22T14:30:00.000Z',
            totalOrders: 1,
            lastOrderDetail: '500ml Buffalo ghee × 2',
            feedback: 'Average ghee',
        },
        {
            id: 'FU-DEMO-3',
            customerId: 'DEMO-CUSTOMER-3',
            customerName: 'Neha Kapoor',
            customerPhone: '9100000003',
            lastOrder: '2026-03-18T09:15:00.000Z',
            totalOrders: 5,
            lastOrderDetail: '5L combo × 1',
            feedback: 'High price',
        },
        {
            id: 'FU-DEMO-4',
            customerId: 'DEMO-CUSTOMER-4',
            customerName: 'Rahul Verma',
            customerPhone: '9100000004',
            lastOrder: '2026-03-10T11:45:00.000Z',
            totalOrders: 2,
            lastOrderDetail: 'Organic honey 500g × 1, 1L Desi ghee × 1',
            feedback: '',
        },
    ];
    return rows.map((r) => {
        const hist = dummyCallHistoryForPhone(r.customerPhone);
        const latest = hist[0];
        if (!latest) {
            return {
                ...r,
                callingHistory: [],
                callingDate: null,
                callerId: null,
                callerName: '',
                callingDetail: '',
                callAgainDate: null,
            };
        }
        return {
            ...r,
            callingHistory: hist,
            callingDate: latest.calledAt,
            callerId: null,
            callerName: latest.callerName,
            callingDetail: latest.detail,
            callAgainDate: latest.callAgainDate,
        };
    });
})();

export function cloneDemoFollowups(): Followup[] {
    return DUMMY_FOLLOWUP_TABLE_ROWS.map((row) => ({
        ...row,
        callingHistory: row.callingHistory.map((h) => ({ ...h })),
    }));
}

export function applyDummyCallHistoryForUiPreview(rows: Followup[]): Followup[] {
    return rows.map((f) => {
        if (f.callingHistory.length > 0) return f;
        const hist = dummyCallHistoryForPhone(f.customerPhone);
        if (hist.length === 0) return f;
        const latest = hist[0];
        return {
            ...f,
            callingHistory: hist,
            callingDate: latest.calledAt,
            callerName: latest.callerName,
            callingDetail: latest.detail,
            callAgainDate: latest.callAgainDate,
        };
    });
}
