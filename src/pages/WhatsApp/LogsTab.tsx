import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { Th, Td } from '../sales/Shopify/ShopifyShared';
import { DatePicker } from '../sales/Shopify/DatePicker';
import '../sales/Shopify/Shopify.scss';
import {
    fetchWhatsAppLogs,
    logContentPreview,
    logDirectionLabel,
} from '../../utils/whatsapp-logs';
import type { Msg91WhatsAppLogEntry } from '../../types/whatsapp-logs';

const LIMIT_OPTIONS = [100, 250, 500, 1000, 2000] as const;
const DEFAULT_LIMIT = 1000;
const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'read', label: 'Read' },
    { value: 'failed', label: 'Failed' },
] as const;

function todayIso(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

function statusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'read' || s === 'delivered' || s === 'sent') return 'wa-status-tag wa-status-tag--approved';
    if (s === 'failed') return 'wa-status-tag wa-status-tag--rejected';
    if (s === 'pending' || s === 'submitted') return 'wa-status-tag wa-status-tag--pending';
    return 'wa-status-tag';
}

export default function LogsTab({ integratedNumber }: { integratedNumber: string }) {
    const [startDate, setStartDate] = useState(todayIso);
    const [endDate, setEndDate] = useState(todayIso);
    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('all');
    const [rows, setRows] = useState<Msg91WhatsAppLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (from: string, to: string, pageLimit: number) => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchWhatsAppLogs(from, to, pageLimit);
            const filtered = result.data.filter(
                (row) =>
                    row.integratedNumber === integratedNumber &&
                    row.messageType.toLowerCase() === 'template',
            );
            setRows(filtered);
        } catch (err) {
            setRows([]);
            setError(err instanceof Error ? err.message : 'Failed to load logs');
        } finally {
            setLoading(false);
        }
    }, [integratedNumber]);

    useEffect(() => {
        void load(startDate, endDate, limit);
    }, [load]);

    const visibleRows = useMemo(() => {
        if (statusFilter === 'all') return rows;
        return rows.filter((row) => row.status.toLowerCase() === statusFilter);
    }, [rows, statusFilter]);

    const summary = useMemo(() => {
        if (loading) return 'Loading logs…';
        if (error) return error;
        const count = visibleRows.length;
        if (statusFilter === 'all') {
            return `${count.toLocaleString()} log${count === 1 ? '' : 's'}`;
        }
        return `${count.toLocaleString()} ${statusFilter} log${count === 1 ? '' : 's'}`;
    }, [loading, error, visibleRows.length, statusFilter]);

    function handleFetch() {
        if (!startDate || !endDate) {
            setError('Select start and end date.');
            return;
        }
        if (startDate > endDate) {
            setError('Start date must be on or before end date.');
            return;
        }
        void load(startDate, endDate, limit);
    }

    return (
        <div className="wa-templates">
            <div className="wa-templates-bar wa-logs-bar">
                <span>{summary}</span>
                <div className="wa-logs-filters">
                    <label className="wa-logs-date">
                        <span>From</span>
                        <div className="wa-logs-datepicker">
                            <DatePicker
                                value={startDate}
                                onChange={setStartDate}
                                placeholder="Select start date"
                                disabled={loading}
                            />
                        </div>
                    </label>
                    <label className="wa-logs-date">
                        <span>To</span>
                        <div className="wa-logs-datepicker">
                            <DatePicker
                                value={endDate}
                                onChange={setEndDate}
                                placeholder="Select end date"
                                disabled={loading}
                            />
                        </div>
                    </label>
                    <label className="wa-logs-date">
                        <span>Limit</span>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            disabled={loading}
                            aria-label="Log limit"
                        >
                            {LIMIT_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option.toLocaleString()}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="wa-logs-date">
                        <span>Status</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number]['value'])}
                            disabled={loading}
                            aria-label="Log status"
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        className="button wa-logs-fetch"
                        onClick={handleFetch}
                        disabled={loading}
                    >
                        Fetch
                    </button>
                </div>
            </div>

            <div className={`table-scroll-wrapper wa-templates-scroll${loading ? ' wa-templates-scroll--loading' : ''}`}>
                {loading ? <Spinner overlay message="Loading logs…" /> : null}
                <table className="orders-table shopify-orders-table wa-templates-table wa-logs-table">
                    <thead>
                        <tr>
                            <Th>Time</Th>
                            <Th>Dir</Th>
                            <Th>Customer</Th>
                            <Th>Type</Th>
                            <Th>Message</Th>
                            <Th>Status</Th>
                            <Th>Template</Th>
                            <Th>Failure</Th>
                            <Th>Circle</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && error ? (
                            <tr>
                                <td colSpan={9} className="wa-templates-empty">
                                    Could not load logs. Check MSG91 authkey and try Fetch.
                                </td>
                            </tr>
                        ) : !loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="wa-templates-empty">
                                    No template logs for this number in the selected dates.
                                </td>
                            </tr>
                        ) : !loading && visibleRows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="wa-templates-empty">
                                    No logs with this status.
                                </td>
                            </tr>
                        ) : (
                            visibleRows.map((row) => {
                                const direction = logDirectionLabel(row.direction);
                                const preview = logContentPreview(row.content);
                                return (
                                    <tr key={row.uuid || `${row.requestedAt}-${row.customerNumber}`}>
                                        <Td>
                                            <div className="wa-logs-time">{row.requestedAt || '—'}</div>
                                        </Td>
                                        <Td>
                                            <span className={direction === 'In' ? 'wa-status-tag wa-logs-dir--in' : 'wa-status-tag wa-logs-dir--out'}>
                                                {direction}
                                            </span>
                                        </Td>
                                        <Td>{row.customerNumber || '—'}</Td>
                                        <Td>
                                            <span className="wa-status-tag">{row.messageType || '—'}</span>
                                        </Td>
                                        <Td>
                                            <div className="wa-templates-body" title={preview}>
                                                {preview}
                                            </div>
                                        </Td>
                                        <Td>
                                            <span className={statusClass(row.status)}>{row.status || '—'}</span>
                                        </Td>
                                        <Td>{row.templateName || '—'}</Td>
                                        <Td>
                                            <div className="wa-logs-fail" title={row.failureReason}>
                                                {row.failureReason || '—'}
                                            </div>
                                        </Td>
                                        <Td>{row.telecomCircle || '—'}</Td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
