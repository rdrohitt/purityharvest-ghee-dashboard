import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import type { CustomerApi } from '../../types/shopify';
import { Spinner } from '../../components/Spinner';
import { CustomerProfileModal } from '../sales/Shopify/CustomerProfileModal';

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
    const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
    const [activeCustomerPhone, setActiveCustomerPhone] = useState<string | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await apiFetch('/api/customers');
                if (!res.ok) {
                    throw new Error(`Failed to load customers (${res.status})`);
                }
                const json = (await res.json()) as unknown;
                if (!Array.isArray(json)) {
                    throw new Error('Invalid customers response');
                }
                if (!cancelled) {
                    setCustomers(json as CustomerApi[]);
                }
            } catch (err) {
                console.error('Failed to load customers', err);
                if (!cancelled) {
                    setError('Failed to load customers. Please try again.');
                    setCustomers([]);
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
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter((c) =>
            [c.name, c.phoneNumber, c.email ?? '', c.state, c.pincode].some((v) =>
                String(v || '').toLowerCase().includes(q),
            ),
        );
    }, [customers, search]);

    const total = filtered.length;

    return (
        <section className="shopify-page">
            {loading && <Spinner overlay fixed message="Loading customers…" />}
            <div className="card modules-header-card">
                <div className="modules-header-title">Customers</div>
                <div className="modules-header-row">
                    <div className="modules-search-row">
                        <input
                            className="input modules-search"
                            placeholder="Search by name, phone, email, state or pincode"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
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
                                {!error && filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="shopify-orders-empty-cell">
                                            No customers found.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((c) => (
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

