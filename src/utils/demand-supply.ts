import { apiFetch } from '../api';

export type DemandSupplyMetricApi = {
    count?: number | string;
    amount?: number | string;
};

export type DemandSupplyDayApi = {
    date: string;
    demand?: DemandSupplyMetricApi;
    supply?: DemandSupplyMetricApi;
    rto?: DemandSupplyMetricApi;
};

export type DemandSupplyResponse = {
    month?: number;
    year?: number;
    daily?: DemandSupplyDayApi[];
};

export type DemandSupplyDayRow = {
    dateKey: string;
    demandCount: string;
    demandAmount: string;
    supplyCount: string;
    supplyAmount: string;
    rtoCount: string;
    rtoAmount: string;
};

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function asText(value: unknown): string {
    if (value == null || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string') return value.trim();
    return '';
}

function metricCount(metric: DemandSupplyMetricApi | undefined): string {
    return asText(metric?.count);
}

function metricAmount(metric: DemandSupplyMetricApi | undefined): string {
    return asText(metric?.amount);
}

function emptyRow(dateKey: string): DemandSupplyDayRow {
    return {
        dateKey,
        demandCount: '',
        demandAmount: '',
        supplyCount: '',
        supplyAmount: '',
        rtoCount: '',
        rtoAmount: '',
    };
}

function normalizeApiDay(item: DemandSupplyDayApi): DemandSupplyDayRow | null {
    const ymd = String(item.date ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    return {
        dateKey: ymd,
        demandCount: metricCount(item.demand),
        demandAmount: metricAmount(item.demand),
        supplyCount: metricCount(item.supply),
        supplyAmount: metricAmount(item.supply),
        rtoCount: metricCount(item.rto),
        rtoAmount: metricAmount(item.rto),
    };
}

function extractDaily(json: unknown): DemandSupplyDayApi[] {
    if (Array.isArray(json)) return json as DemandSupplyDayApi[];
    if (!json || typeof json !== 'object') return [];
    const daily = (json as DemandSupplyResponse).daily;
    return Array.isArray(daily) ? daily : [];
}

/** Build a full-month calendar and merge API `daily` rows onto matching dates. */
export function buildMonthRows(
    year: number,
    month: number,
    apiDays: DemandSupplyDayApi[] = [],
): DemandSupplyDayRow[] {
    const totalDays = daysInMonth(year, month);
    const byDate = new Map<string, DemandSupplyDayRow>();
    for (const item of apiDays) {
        const row = normalizeApiDay(item);
        if (row) byDate.set(row.dateKey, row);
    }
    return Array.from({ length: totalDays }, (_, i) => {
        const key = `${year}-${pad2(month)}-${pad2(i + 1)}`;
        return byDate.get(key) ?? emptyRow(key);
    });
}

function toMetricNumber(value: string): number {
    const n = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
}

export type DemandSupplySavePayload = {
    date: string;
    demand: { count: number; amount: number };
    supply: { count: number; amount: number };
    rto: { count: number; amount: number };
};

export function rowToSavePayload(row: DemandSupplyDayRow): DemandSupplySavePayload {
    return {
        date: row.dateKey,
        demand: {
            count: toMetricNumber(row.demandCount),
            amount: toMetricNumber(row.demandAmount),
        },
        supply: {
            count: toMetricNumber(row.supplyCount),
            amount: toMetricNumber(row.supplyAmount),
        },
        rto: {
            count: toMetricNumber(row.rtoCount),
            amount: toMetricNumber(row.rtoAmount),
        },
    };
}

/**
 * GET /api/demandsupply?month=&year=
 * Response: `{ month, year, daily: [{ date, demand: { count, amount }, supply, rto }] }`
 */
export async function fetchDemandSupply(month: number, year: number): Promise<DemandSupplyDayRow[]> {
    const params = new URLSearchParams({
        month: String(Math.trunc(month)),
        year: String(Math.trunc(year)),
    });
    const response = await apiFetch(`/api/demandsupply?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Failed to load demand/supply (${response.status})`);
    }
    const json: unknown = await response.json();
    return buildMonthRows(year, month, extractDaily(json));
}

/** POST /api/demandsupply — save one day's demand / supply / rto. */
export async function saveDemandSupplyDay(row: DemandSupplyDayRow): Promise<void> {
    const payload = rowToSavePayload(row);
    const response = await apiFetch('/api/demandsupply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        let message = `Failed to save (${response.status})`;
        try {
            const body = (await response.json()) as { message?: string };
            if (body?.message) message = body.message;
        } catch {
            // keep default
        }
        throw new Error(message);
    }
}
