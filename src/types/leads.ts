export interface LeadApiUserRef {
    _id: string;
    name: string;
}

/** Single lead row from GET /api/leads (paginated list). */
export interface LeadApiRow {
    _id: string;
    name: string;
    phoneNumber: string;
    countryCode: string;
    message: string;
    time: string | null;
    createdBy: LeadApiUserRef;
    updatedBy: LeadApiUserRef;
    createdAt: string;
    updatedAt: string;
    __v?: number;
}

/** Paginated body from GET /api/leads. */
export interface LeadsListResponse {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    rows: LeadApiRow[];
}

function normalizeUserRef(raw: unknown): LeadApiUserRef {
    if (!raw || typeof raw !== 'object') {
        return { _id: '', name: '—' };
    }
    const o = raw as Record<string, unknown>;
    return {
        _id: typeof o._id === 'string' ? o._id : String(o._id ?? ''),
        name: typeof o.name === 'string' ? o.name : String(o.name ?? '—'),
    };
}

/** Parse JSON from GET /api/leads; returns null if not a paginated envelope. */
export function parseLeadsListResponse(raw: unknown): LeadsListResponse | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (!Array.isArray(o.rows)) return null;

    const rows: LeadApiRow[] = [];
    for (const item of o.rows) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        rows.push({
            _id: String(r._id ?? r.id ?? ''),
            name: String(r.name ?? ''),
            phoneNumber: String(r.phoneNumber ?? ''),
            countryCode: String(r.countryCode ?? '+91'),
            message: typeof r.message === 'string' ? r.message : '',
            time: r.time == null || r.time === '' ? null : String(r.time),
            createdBy: normalizeUserRef(r.createdBy),
            updatedBy: normalizeUserRef(r.updatedBy),
            createdAt: String(r.createdAt ?? ''),
            updatedAt: String(r.updatedAt ?? ''),
            __v: typeof r.__v === 'number' ? r.__v : 0,
        });
    }

    const limitRaw = Number(o.limit);
    const totalRaw = Number(o.total);
    const pageRaw = Number(o.page);
    const countRaw = Number(o.count);
    const totalPagesRaw = Number(o.totalPages);

    const lim = Number.isFinite(limitRaw) && limitRaw >= 1 ? limitRaw : Math.max(rows.length, 1);
    const tot = Number.isFinite(totalRaw) ? totalRaw : rows.length;
    const tp =
        Number.isFinite(totalPagesRaw) && totalPagesRaw >= 1 ? totalPagesRaw : Math.max(1, Math.ceil(tot / lim));

    return {
        count: Number.isFinite(countRaw) ? countRaw : rows.length,
        total: tot,
        page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
        limit: lim,
        totalPages: tp,
        rows,
    };
}
