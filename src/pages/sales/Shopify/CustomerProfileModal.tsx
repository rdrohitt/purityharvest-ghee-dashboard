import { useEffect, useMemo, useState } from 'react';
import type { Order, OrderItem } from '../../../utils/orders';
import { formatCurrency, formatDate, Th, Td, StatusTag } from './ShopifyShared';

export function CustomerProfileModal({
    customerPhone,
    orders,
    onClose,
    onCopyPhone,
}: {
    customerPhone: string;
    orders: Order[];
    onClose: () => void;
    onCopyPhone?: (phone: string) => void;
}) {
    const customerOrders = useMemo(() => {
        return orders
            .filter((o) => o.customerPhone === customerPhone)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, customerPhone]);

    const customerProfile = useMemo(() => {
        if (customerOrders.length === 0) return null;
        const latestOrder = customerOrders[0];
        return {
            name: latestOrder.customer,
            phone: latestOrder.customerPhone,
            address: latestOrder.customerAddress,
            state: latestOrder.state,
            pincode: latestOrder.pincode || '—',
        };
    }, [customerOrders]);

    const totalOrders = customerOrders.length;
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.amount, 0);
    const deliveredCount = customerOrders.filter((o) => o.deliveryStatus === 'Delivered').length;
    const rtoCount = customerOrders.filter((o) => o.deliveryStatus === 'RTO').length;
    const inTransitCount = customerOrders.filter((o) => o.deliveryStatus === 'In Transit').length;

    const [activeTab, setActiveTab] = useState<'orders' | 'followups' | 'notes'>('orders');
    const [notes, setNotes] = useState<string>('');
    const [copyFeedback, setCopyFeedback] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleCopyPhoneClick = async () => {
        if (!customerProfile?.phone) return;
        if (onCopyPhone) {
            onCopyPhone(customerProfile.phone);
        } else {
            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(customerProfile.phone);
                }
            } catch (err) {
                console.error('Failed to copy phone number', err);
            }
        }
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 1800);
    };

    if (!customerProfile) {
        return null;
    }

    return (
        <div role="dialog" aria-modal="true" onClick={onClose} className="customer-modal-backdrop">
            <div className="card customer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="customer-modal-header">
                    <div className="customer-modal-header-left">
                        <div className="customer-avatar">
                            <span className="customer-avatar-initial">
                                {customerProfile.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </span>
                        </div>
                        <div className="customer-modal-header-text">
                            <h3 className="customer-modal-title">{customerProfile.name}</h3>
                            <div className="customer-modal-meta">
                                <span
                                    className="customer-modal-meta-item customer-modal-phone"
                                    onClick={handleCopyPhoneClick}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleCopyPhoneClick();
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    title="Copy number"
                                >
                                    <span className="customer-modal-meta-icon" aria-hidden>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                        </svg>
                                    </span>
                                    <span className="customer-modal-phone-value">{customerProfile.phone}</span>
                                    {copyFeedback && <span className="customer-copy-feedback">Copied!</span>}
                                </span>
                                <span className="customer-modal-meta-item">
                                    <span className="customer-modal-meta-icon" aria-hidden>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                    </span>
                                    <span>{customerProfile.state}</span>
                                </span>
                                <span className="customer-modal-meta-item">
                                    <span className="customer-modal-meta-icon" aria-hidden>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="4" width="20" height="16" rx="2" />
                                            <path d="M6 8h.01M10 8h.01M14 8h.01" />
                                        </svg>
                                    </span>
                                    <span>{customerProfile.pincode}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="customer-modal-header-actions">
                        <a href={`tel:${customerProfile.phone}`} className="customer-modal-action-btn customer-modal-call" aria-label="Call customer">
                            Call
                        </a>
                        <button type="button" className="customer-modal-action-btn customer-modal-copy" onClick={handleCopyPhoneClick} aria-label="Copy phone" title="Copy number">
                            {copyFeedback ? 'Copied!' : 'Copy'}
                        </button>
                        <button className="icon-btn customer-modal-close" onClick={onClose} aria-label="Close">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="customer-modal-content">
                    <div className="customer-info-card">
                        <div className="customer-info-grid">
                            <div className="customer-info-address">
                                <div className="customer-info-label">Address</div>
                                <div className="customer-info-value">{customerProfile.address}</div>
                            </div>
                        </div>
                        <div className="customer-stats-row">
                            {[
                                { label: 'Total orders', value: String(totalOrders), className: 'customer-stat--orders' },
                                { label: 'Total amount', value: formatCurrency(totalAmount), className: 'customer-stat--amount' },
                                { label: 'Delivered', value: String(deliveredCount), className: 'customer-stat--delivered' },
                                { label: 'RTO', value: String(rtoCount), className: 'customer-stat--rto' },
                                { label: 'In transit', value: String(inTransitCount), className: 'customer-stat--transit' },
                            ].map((stat) => (
                                <div key={stat.label} className={`customer-stat ${stat.className}`}>
                                    <div className="customer-stat-label">{stat.label}</div>
                                    <div className="customer-stat-value">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="customer-tabs">
                        <div className="customer-tabs-header">
                            {[
                                { id: 'orders', label: 'Order history' },
                                { id: 'followups', label: 'Followups' },
                                { id: 'notes', label: 'Notes' },
                            ].map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        className={`customer-tab ${isActive ? 'is-active' : ''}`}
                                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    >
                                        <span className="customer-tab-label">{tab.label}</span>
                                        {tab.id === 'orders' && <span className="customer-tab-pill">{totalOrders}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className={`customer-tabs-body is-${activeTab}`}>
                            {activeTab === 'orders' && (
                                <div className="table-scroll-wrapper customer-orders-wrapper">
                                    <table className="customer-orders-table">
                                        <thead>
                                            <tr className="customer-orders-header-row">
                                                <Th>Date</Th>
                                                <Th>Items</Th>
                                                <Th>Amount</Th>
                                                <Th>Payment</Th>
                                                <Th>Delivery</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customerOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="customer-orders-empty-cell">
                                                        No orders found
                                                    </td>
                                                </tr>
                                            ) : (
                                                customerOrders.map((order) => (
                                                    <tr key={order.id} className="customer-orders-row">
                                                        <Td>{formatDate(order.date)}</Td>
                                                        <Td>
                                                            <div className="customer-orders-items">
                                                                {(order.items ?? []).length === 0 ? <span>—</span> : null}
                                                                {(order.items ?? []).map((it: OrderItem, idx: number) => (
                                                                    <div key={idx} className="customer-orders-item-line">
                                                                        {it.variant} × {it.quantity}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </Td>
                                                        <td className="customer-orders-amount">{formatCurrency(order.amount)}</td>
                                                        <Td>
                                                            <StatusTag kind={order.paymentStatus} type="payment" />
                                                        </Td>
                                                        <Td>
                                                            <StatusTag kind={order.deliveryStatus} type="delivery" />
                                                        </Td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'followups' && (
                                <div className="customer-followups-card">
                                    <div className="customer-followups-header">
                                        <span className="customer-followups-title">Followups</span>
                                        <span className="customer-followups-pill">Coming soon</span>
                                    </div>
                                    <div className="customer-followups-text">
                                        Use the Followups page to schedule and record calls for this customer. This tab will show those records here in a future update.
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div className="customer-notes-card">
                                    <div className="customer-notes-header">
                                        <span className="customer-notes-title">Notes</span>
                                        <span className="customer-notes-subtitle">Session-only (not saved)</span>
                                    </div>
                                    <textarea
                                        className="input customer-notes-textarea"
                                        placeholder="Type quick notes about this customer…"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
