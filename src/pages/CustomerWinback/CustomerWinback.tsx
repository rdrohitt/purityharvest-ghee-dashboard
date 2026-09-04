import { useMemo, useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { DatePicker } from '../sales/Shopify/DatePicker';
import { Td, Th, toInputDate } from '../sales/Shopify/ShopifyShared';
import { fetchCustomersNotOrderedSince } from '../../utils/analytics';
import type { CustomerNotOrderedSince } from '../../types/analytics-customers-not-ordered-since';
import '../sales/Shopify/Shopify.scss';
import '../Modules/Modules.scss';
import './CustomerWinback.scss';

function formatLastOrderDate(value?: string): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export default function CustomerWinback() {
    const [date, setDate] = useState(() => toInputDate(new Date()));
    const [customers, setCustomers] = useState<CustomerNotOrderedSince[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const showLastOrder = useMemo(
        () => customers.some((row) => Boolean(row.lastOrderDate)),
        [customers],
    );

    async function handleFetch() {
        if (!date) {
            setError('Select a date.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCustomersNotOrderedSince(date);
            setCustomers(data.customers);
            setCount(data.count);
            setHasFetched(true);
        } catch (err) {
            setCustomers([]);
            setCount(0);
            setHasFetched(true);
            setError(err instanceof Error ? err.message : 'Failed to load customers');
        } finally {
            setLoading(false);
        }
    }

    const summary = loading
        ? 'Loading…'
        : error
          ? error
          : !hasFetched
            ? 'Select a date and click Fetch.'
            : `${count.toLocaleString()} customer${count === 1 ? '' : 's'} have not ordered since this date`;

    return (
        <section className="modules-page cw-page">
            {loading ? <Spinner overlay fixed message="Fetching customers…" /> : null}

            <div className="card modules-header-card">
                <div className="modules-header-title">Customer Winback</div>
                <div className="cw-header-row">
                    <label className="cw-date-field">
                        <span>Date</span>
                        <div className="cw-datepicker">
                            <DatePicker
                                value={date}
                                onChange={setDate}
                                placeholder="Select date"
                                disabled={loading}
                            />
                        </div>
                    </label>
                    <button
                        type="button"
                        className="button cw-fetch-btn"
                        onClick={() => void handleFetch()}
                        disabled={loading}
                    >
                        {loading ? 'Fetching…' : 'Fetch'}
                    </button>
                </div>
            </div>

            <div className="card modules-table-card">
                <div className="modules-count-bar">{summary}</div>
                <div className={`table-scroll-wrapper${loading ? ' cw-table-loading' : ''}`}>
                    <table className="orders-table shopify-orders-table cw-customers-table">
                        <thead>
                            <tr className="shopify-orders-header-row">
                                <Th>Name</Th>
                                <Th>Phone</Th>
                                {showLastOrder ? <Th>Last order</Th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? null : error ? (
                                <tr>
                                    <td colSpan={showLastOrder ? 3 : 2} className="shopify-orders-empty-cell">
                                        Could not load customers. Check the date and try Fetch again.
                                    </td>
                                </tr>
                            ) : !hasFetched || customers.length === 0 ? (
                                <tr>
                                    <td colSpan={showLastOrder ? 3 : 2} className="shopify-orders-empty-cell">
                                        {!hasFetched
                                            ? 'No customers loaded yet.'
                                            : 'No customers found for this date.'}
                                    </td>
                                </tr>
                            ) : (
                                customers.map((row) => (
                                    <tr key={row.customerId} className="shopify-orders-row">
                                        <Td>{row.name}</Td>
                                        <Td>
                                            {row.phoneNumber ? (
                                                <a className="link shopify-customer-phone" href={`tel:${row.phoneNumber}`}>
                                                    {row.phoneNumber}
                                                </a>
                                            ) : (
                                                '—'
                                            )}
                                        </Td>
                                        {showLastOrder ? <Td>{formatLastOrderDate(row.lastOrderDate)}</Td> : null}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
