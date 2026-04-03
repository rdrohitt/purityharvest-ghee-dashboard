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

export const DUMMY_CALL_HISTORY_RECORDS: CallingHistoryEntry[] = [
    {
        id: 'dummy-log-1',
        calledAt: '2026-03-27T06:30:00.000Z',
        callerName: 'Monia',
        detail: 'Very happy with Gir cow ghee; asked for 5L jar pricing and delivery to Gurgaon.',
        callAgainDate: '2026-04-02T06:30:00.000Z',
    },
    {
        id: 'dummy-log-2',
        calledAt: '2026-03-18T06:30:00.000Z',
        callerName: 'Sarita',
        detail: 'Compared A2 vs buffalo — sent catalog PDF on WhatsApp. Will decide with family.',
        callAgainDate: null,
    },
    {
        id: 'dummy-log-3',
        calledAt: '2026-03-05T06:30:00.000Z',
        callerName: 'Monia',
        detail: 'Routine post-delivery check-in; no quality issues reported.',
        callAgainDate: '2026-03-20T06:30:00.000Z',
    },
    {
        id: 'dummy-log-4',
        calledAt: '2026-02-20T06:30:00.000Z',
        callerName: 'Sarita',
        detail: 'First purchase follow-up. Customer positive; interested in combo offers next time.',
        callAgainDate: '2026-02-28T06:30:00.000Z',
    },
];

const UI_SEED_DUMMY_CALL_HISTORY_COUNT = 4;

export function dummyCallHistoryForPhone(phone: string): CallingHistoryEntry[] {
    return DUMMY_CALL_HISTORY_RECORDS.map((e) => ({
        ...e,
        id: `${phone}-${e.id}`,
    }));
}

export function isDemoFollowupRow(f: Followup): boolean {
    return f.id.startsWith('FU-DEMO-');
}

const DUMMY_FOLLOWUP_TABLE_ROWS: Followup[] = (() => {
    const rows: Omit<Followup, 'callingHistory' | 'callingDate' | 'callerName' | 'callingDetail' | 'callAgainDate'>[] = [
        {
            id: 'FU-DEMO-1',
            customerName: 'Priya Malhotra',
            customerPhone: '9100000001',
            lastOrder: '2026-03-26T10:00:00.000Z',
            totalOrders: 3,
            lastOrderDetail: '1L Gir cow ghee × 1, 500ml A2 × 2',
            feedback: 'Excellent ghee',
        },
        {
            id: 'FU-DEMO-2',
            customerName: 'Arjun Mehta',
            customerPhone: '9100000002',
            lastOrder: '2026-03-22T14:30:00.000Z',
            totalOrders: 1,
            lastOrderDetail: '500ml Buffalo ghee × 2',
            feedback: 'Average ghee',
        },
        {
            id: 'FU-DEMO-3',
            customerName: 'Neha Kapoor',
            customerPhone: '9100000003',
            lastOrder: '2026-03-18T09:15:00.000Z',
            totalOrders: 5,
            lastOrderDetail: '5L combo × 1',
            feedback: 'High price',
        },
        {
            id: 'FU-DEMO-4',
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
        return {
            ...r,
            callingHistory: hist,
            callingDate: latest.calledAt,
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
    let seeded = 0;
    return rows.map((f) => {
        if (f.callingHistory.length > 0) return f;
        if (seeded >= UI_SEED_DUMMY_CALL_HISTORY_COUNT) return f;
        seeded += 1;
        const hist = dummyCallHistoryForPhone(f.customerPhone);
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
