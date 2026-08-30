import { MSG91, msg91RequestHeaders } from '../config/msg91';
import type {
    Msg91TimestampValue,
    Msg91WhatsAppLogEntry,
    Msg91WhatsAppLogsResponse,
} from '../types/whatsapp-logs';

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function timestampValue(raw: unknown): string {
    if (raw == null) return '';
    if (typeof raw === 'string') return raw;
    const rec = asRecord(raw);
    return rec ? asString(rec.value) : '';
}

function parseLogEntry(raw: unknown): Msg91WhatsAppLogEntry | null {
    const o = asRecord(raw);
    if (!o) return null;
    return {
        uuid: asString(o.uuid),
        requestedAt: asString(o.requestedAt),
        status: asString(o.status),
        messageType: asString(o.messageType),
        direction: asNumber(o.direction),
        integratedNumber: asString(o.integratedNumber),
        customerNumber: asString(o.customerNumber),
        content: asString(o.content),
        templateName: asString(o.templateName),
        templateLanguage: asString(o.templateLanguage),
        failureReason: asString(o.failureReason),
        origin: asString(o.origin),
        telecomCircle: asString(o.telecomCircle),
        sentTime: timestampValue(o.sentTime as Msg91TimestampValue | string | null),
        deliveryTime: timestampValue(o.deliveryTime as Msg91TimestampValue | string | null),
        readTime: timestampValue(o.readTime as Msg91TimestampValue | string | null),
        statusUpdatedAt: asString(o.statusUpdatedAt),
        requestId: asString(o.requestId),
        metaErrorCode: asString(o.metaErrorCode),
    };
}

export function parseWhatsAppLogsResponse(raw: unknown): Msg91WhatsAppLogsResponse {
    const o = asRecord(raw);
    if (!o) {
        throw new Error('Invalid logs response');
    }
    const data = Array.isArray(o.data)
        ? o.data.map(parseLogEntry).filter((row): row is Msg91WhatsAppLogEntry => row != null)
        : [];
    const meta = asRecord(o.metadata);
    const total = typeof meta?.total === 'number' ? meta.total : data.length;
    return { data, total };
}

function buildLogsUrl(startDate: string, endDate: string, limit: number): string {
    const params = new URLSearchParams({
        startDate,
        endDate,
        limit: String(limit),
    });
    const path = `/api/v5/report/logs/wa?${params.toString()}`;
    if (import.meta.env.DEV) {
        return `/msg91${path}`;
    }
    return `${MSG91.controlBaseUrl}${path}`;
}

export async function fetchWhatsAppLogs(
    startDate: string,
    endDate: string,
    limit = 1000,
): Promise<Msg91WhatsAppLogsResponse> {
    const response = await fetch(buildLogsUrl(startDate, endDate, limit), {
        method: 'GET',
        headers: msg91RequestHeaders(),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const rec = asRecord(raw);
        const message =
            (typeof rec?.message === 'string' && rec.message) ||
            (typeof rec?.error === 'string' && rec.error) ||
            `Failed to load logs (${response.status})`;
        throw new Error(message);
    }
    return parseWhatsAppLogsResponse(raw);
}

export function logContentPreview(content: string): string {
    if (!content) return '—';
    try {
        const parsed = JSON.parse(content) as unknown;
        const rec = asRecord(parsed);
        if (!rec) return content;
        if (typeof rec.text === 'string' && rec.text.trim()) return rec.text;
        if (typeof rec.attachment_url === 'string' && rec.attachment_url) return rec.attachment_url;
        if (rec.revoke) return 'Message deleted';
        if (rec.latitude != null && rec.longitude != null) {
            return `Location ${asString(rec.latitude)}, ${asString(rec.longitude)}`;
        }
        const keys = Object.keys(rec);
        return keys.length > 0 ? keys.join(', ') : '—';
    } catch {
        return content;
    }
}

export function logDirectionLabel(direction: number): 'In' | 'Out' {
    return direction === 1 ? 'Out' : 'In';
}
