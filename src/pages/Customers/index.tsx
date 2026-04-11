import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import type { CustomerApi, CustomersDashboardResponse } from '../../types/shopify';
import { searchCustomersByPhone } from '../../utils/customers';
import { Spinner } from '../../components/Spinner';
import { CustomerProfileModal } from '../sales/Shopify/CustomerProfileModal';
import '../sales/Shopify/Shopify.scss';

const MIN_PHONE_SEARCH_DIGITS = 10;

function formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function Customers() {
    const [customers, setCustomers] = useState<CustomerApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dashboardMeta, setDashboardMeta] = useState<{
        total: number;
        totalPages: number;
        count: number;
        page: number;
        limit: number;
    } | null>(null);
    const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
    const [activeCustomerPhone, setActiveCustomerPhone] = useState<string | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const phoneDigits = useMemo(() => search.replace(/\D/g, ''), [search]);
    const isPhoneSearch = phoneDigits.length >= MIN_PHONE_SEARCH_DIGITS;

    useEffect(() => {
        if (isPhoneSearch) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await apiFetch(`/api/customers?page=${page}&limit=${pageSize}`);
                if (!res.ok) {
                    throw new Error(`Failed to load customers (${res.status})`);
                }
                const json = (await res.json()) as unknown;
                if (!json || typeof json !== 'object') {
                    throw new Error('Invalid customers response');
                }
                const data = json as Partial<CustomersDashboardResponse>;
                const rows = Array.isArray(data.rows)
                    ? data.rows
                    : Array.isArray((json as { data?: unknown }).data)
                    ? ((json as { data: CustomerApi[] }).data ?? [])
                    : Array.isArray(json)
                    ? (json as CustomerApi[])
                    : [];
                if (!cancelled) {
                    const total = typeof data.total === 'number' ? data.total : rows.length;
                    const totalPages = typeof data.totalPages === 'number' ? data.totalPages : 1;
                    const count = typeof data.count === 'number' ? data.count : rows.length;
                    const safePage = typeof data.page === 'number' ? data.page : page;
                    const safeLimit = typeof data.limit === 'number' ? data.limit : pageSize;
                    setCustomers(rows);
                    setDashboardMeta({
                        total,
                        totalPages,
                        count,
                        page: safePage,
                        limit: safeLimit,
                    });
                    if (safePage !== page) setPage(safePage);
                }
            } catch (err) {
                console.error('Failed to load customers', err);
                if (!cancelled) {
                    setError('Failed to load customers. Please try again.');
                    setCustomers([]);
                    setDashboardMeta(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [page, pageSize, isPhoneSearch]);

    useEffect(() => {
        if (!isPhoneSearch) return;
        let cancelled = false;
        const t = window.setTimeout(() => {
            (async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const rows = await searchCustomersByPhone(phoneDigits);
                    if (cancelled) return;
                    setCustomers(rows as CustomerApi[]);
                    const n = rows.length;
                    setDashboardMeta({
                        total: n,
                        totalPages: 1,
                        count: n,
                        page: 1,
                        limit: Math.max(n, 1),
                    });
                } catch (err) {
                    console.error('Failed to search customers', err);
                    if (!cancelled) {
                        setError('Failed to search customers. Please try again.');
                        setCustomers([]);
                        setDashboardMeta(null);
                    }
                } finally {
                    if (!cancelled) setLoading(false);
                }
            })();
        }, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [phoneDigits, isPhoneSearch]);

    const total = dashboardMeta?.total ?? customers.length;

    return (
        <section className="shopify-page">
            {loading && <Spinner overlay fixed message="Loading customers…" />}
            <div className="card modules-header-card">
                <div className="modules-header-title">Customers</div>
                <div className="modules-header-row">
                    <div className="modules-search-row">
                        <input
                            className="input modules-search"
                            type="search"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={MIN_PHONE_SEARCH_DIGITS}
                            placeholder={`Enter ${MIN_PHONE_SEARCH_DIGITS} phone digits to search (e.g. 9876543210)`}
                            aria-label={`Phone search; enter ${MIN_PHONE_SEARCH_DIGITS} digits`}
                            value={search}
                            onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, MIN_PHONE_SEARCH_DIGITS);
                                setSearch(digits);
                            }}
                        />
                        <button
                            className="button modules-create-btn"
                            type="button"
                            // Placeholder: wire to "Add Customer" flow when backend supports it
                            onClick={() => {
                                // eslint-disable-next-line no-alert
                                alert('Add Customer coming soon.');
                            }}
                        >
                            Add Customer
                        </button>
                    </div>
                </div>
            </div>

            <div className="card modules-table-card">
                <div className="modules-count-bar">
                    {loading
                        ? 'Loading…'
                        : error
                        ? error
                        : dashboardMeta
                        ? isPhoneSearch
                            ? `${dashboardMeta.count.toLocaleString()} match${dashboardMeta.count === 1 ? '' : 'es'}`
                            : `Showing ${dashboardMeta.count.toLocaleString()} of ${total.toLocaleString()} customer${total === 1 ? '' : 's'}`
                        : `${total.toLocaleString()} customer${total === 1 ? '' : 's'}`}
                </div>
                {loading ? null : (
                    <div className="table-scroll-wrapper">
                        <table className="orders-table shopify-orders-table">
                            <thead>
                                <tr className="shopify-orders-header-row">
                                    <th className="shopify-th">Name</th>
                                    <th className="shopify-th">Phone</th>
                                    <th className="shopify-th">Email</th>
                                    <th className="shopify-th">Address</th>
                                    <th className="shopify-th">State</th>
                                    <th className="shopify-th">Pincode</th>
                                    <th className="shopify-th">Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!error && customers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="shopify-orders-empty-cell">
                                            {isPhoneSearch
                                                ? 'No customers match this phone search.'
                                                : 'No customers found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map((c) => (
                                        <tr key={c._id} className="shopify-orders-row">
                                            <td className="shopify-td">
                                                <div className="shopify-customer-cell">
                                                    <span
                                                        className="shopify-customer-name"
                                                        onClick={() => {
                                                            setProfileLoading(true);
                                                            setActiveCustomerId(c._id);
                                                            setActiveCustomerPhone(c.phoneNumber || '');
                                                        }}
                                                    >
                                                        {c.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="shopify-td">
                                                {c.phoneNumber ? (
                                                    <a className="link shopify-customer-phone" href={`tel:${c.phoneNumber}`}>
                                                        {c.phoneNumber}
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="shopify-td">{c.email || '—'}</td>
                                            <td className="shopify-td">{c.address}</td>
                                            <td className="shopify-td">{c.state}</td>
                                            <td className="shopify-td">{c.pincode}</td>
                                            <td className="shopify-td">{formatDateTime(c.createdAt)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <footer className="shopify-pagination" aria-label="Customers pagination">
                    <div className="shopify-pagination__range">
                        {loading ? (
                            <span className="shopify-pagination__muted">Loading…</span>
                        ) : isPhoneSearch ? (
                            <span className="shopify-pagination__muted">Phone search — pagination disabled</span>
                        ) : dashboardMeta ? (
                            <>
                                Showing{' '}
                                <strong>
                                    {dashboardMeta.total === 0 ? 0 : (dashboardMeta.page - 1) * dashboardMeta.limit + 1}–
                                    {Math.min(dashboardMeta.page * dashboardMeta.limit, dashboardMeta.total)}
                                </strong>{' '}
                                of <strong>{dashboardMeta.total.toLocaleString()}</strong>
                            </>
                        ) : (
                            <span className="shopify-pagination__muted">Total unavailable</span>
                        )}
                    </div>
                    <label className="shopify-pagination__size">
                        <span className="shopify-pagination__size-lab">Rows per page</span>
                        <select
                            className="shopify-pagination__select"
                            value={pageSize}
                            disabled={loading || isPhoneSearch}
                            aria-label="Rows per page"
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            {[20, 50, 100, 250].map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="shopify-pagination__nav">
                        <button
                            type="button"
                            className="shopify-page-btn"
                            disabled={loading || isPhoneSearch || page <= 1}
                            onClick={() => setPage(1)}
                        >
                            First
                        </button>
                        <button
                            type="button"
                            className="shopify-page-btn"
                            disabled={loading || isPhoneSearch || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Prev
                        </button>
                        <span className="shopify-pagination__page-of">
                            Page <strong>{page}</strong> of <strong>{Math.max(1, dashboardMeta?.totalPages ?? 1)}</strong>
                        </span>
                        <button
                            type="button"
                            className="shopify-page-btn"
                            disabled={loading || isPhoneSearch || page >= Math.max(1, dashboardMeta?.totalPages ?? 1)}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </button>
                        <button
                            type="button"
                            className="shopify-page-btn"
                            disabled={loading || isPhoneSearch || page >= Math.max(1, dashboardMeta?.totalPages ?? 1)}
                            onClick={() => setPage(Math.max(1, dashboardMeta?.totalPages ?? 1))}
                        >
                            Last
                        </button>
                    </div>
                </footer>
            </div>

            {profileLoading && <Spinner overlay fixed message="Loading customer…" />}
            {activeCustomerId && activeCustomerPhone && (
                <CustomerProfileModal
                    customerId={activeCustomerId}
                    customerPhone={activeCustomerPhone}
                    onClose={() => {
                        setActiveCustomerId(null);
                        setActiveCustomerPhone(null);
                        setProfileLoading(false);
                    }}
                    onLoaded={() => setProfileLoading(false)}
                />
            )}
        </section>
    );
}

