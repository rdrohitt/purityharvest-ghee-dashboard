import React, { useEffect, useMemo } from 'react';
import type { Order, OrderItem } from '../../utils/orders';
import { Th, Td } from './FollowupsTableCells';
import { StatusTag } from './StatusTag';
import { formatCurrency, formatDate } from './followupsFormat';

function normalizePhone(phone: string) {
    if (!phone) return '';
    return phone.replace(/\D/g, '').trim();
}

export function CustomerProfileModal({
    customerPhone,
    orders,
    ordersByCustomer,
    onClose,
}: {
    customerPhone: string;
    orders: Order[];
    ordersByCustomer: Map<string, Order[]>;
    onClose: () => void;
}) {
    const customerOrders = useMemo(() => {
        let customerOrdersList = ordersByCustomer.get(customerPhone) || [];

        if (customerOrdersList.length === 0) {
            const normalizedCustomerPhone = normalizePhone(customerPhone);

            for (const [phone, orderList] of ordersByCustomer.entries()) {
                if (normalizePhone(phone) === normalizedCustomerPhone && normalizedCustomerPhone.length > 0) {
                    customerOrdersList = orderList;
                    break;
                }
            }

            if (customerOrdersList.length === 0 && normalizedCustomerPhone.length > 0) {
                customerOrdersList = orders.filter((o) => {
                    const orderPhone = normalizePhone(o.customerPhone);
                    return orderPhone === normalizedCustomerPhone && orderPhone.length > 0;
                });
            }
        }

        return customerOrdersList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, ordersByCustomer, customerPhone]);

    const customerProfile = useMemo(() => {
        if (customerOrders.length === 0) {
            return {
                name: 'Unknown Customer',
                phone: customerPhone,
                address: '—',
                state: '—',
                pincode: '—',
            };
        }
        const latestOrder = customerOrders[0];
        return {
            name: latestOrder.customer,
            phone: latestOrder.customerPhone,
            address: latestOrder.customerAddress,
            state: latestOrder.state,
            pincode: latestOrder.pincode || '—',
        };
    }, [customerOrders, customerPhone]);

    const totalOrders = customerOrders.length;
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.amount, 0);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    return (
        <div role="dialog" aria-modal="true" className="fu-profile-overlay" onClick={onClose}>
            <div className="card fu-profile-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="fu-profile-dialog__head">
                    <h3 className="fu-profile-dialog__title">Customer Profile</h3>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="fu-profile-dialog__body">
                    <div className="fu-profile-info">
                        <h4 className="fu-profile-info__title">Customer Information</h4>
                        <div className="fu-profile-info__stack">
                            <div className="fu-profile-info__grid2">
                                <div>
                                    <div className="fu-profile-field__lab">Name</div>
                                    <div className="fu-profile-field__val">{customerProfile.name}</div>
                                </div>
                                <div>
                                    <div className="fu-profile-field__lab">Phone</div>
                                    <div className="fu-profile-field__val">
                                        <a className="link fu-profile-tel" href={`tel:${customerProfile.phone}`}>
                                            {customerProfile.phone}
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="fu-profile-field__lab">Address</div>
                                <div className="fu-profile-field__val">{customerProfile.address}</div>
                            </div>
                            <div className="fu-profile-info__grid2">
                                <div>
                                    <div className="fu-profile-field__lab">State</div>
                                    <div className="fu-profile-field__val">{customerProfile.state}</div>
                                </div>
                                <div>
                                    <div className="fu-profile-field__lab">Pincode</div>
                                    <div className="fu-profile-field__val">{customerProfile.pincode}</div>
                                </div>
                            </div>
                        </div>
                        <div className="fu-profile-stats">
                            <div>
                                <div className="fu-profile-field__lab">Total Orders</div>
                                <div className="fu-profile-stats__num">{totalOrders}</div>
                            </div>
                            <div>
                                <div className="fu-profile-field__lab">Total Amount</div>
                                <div className="fu-profile-stats__num">{formatCurrency(totalAmount)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="fu-profile-orders">
                        <h4 className="fu-profile-info__title">Order History</h4>
                        <div className="table-scroll-wrapper fu-profile-orders__scroll">
                            <table className="fu-table fu-table--orders">
                                <thead>
                                    <tr className="fu-table__head-row fu-table__head-row--sticky">
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
                                            <td colSpan={5} className="fu-table-empty">
                                                {orders.length === 0 ? 'No orders loaded' : 'No orders found for this customer'}
                                            </td>
                                        </tr>
                                    ) : (
                                        customerOrders.map((order) => (
                                            <tr key={order.id} className="fu-table__body-row">
                                                <Td>{formatDate(order.date)}</Td>
                                                <Td>
                                                    <div className="fu-order-items">
                                                        {(order.items ?? []).length === 0 ? <span>—</span> : null}
                                                        {(order.items ?? []).map((it: OrderItem, idx: number) => (
                                                            <div key={idx} className="fu-order-items__line">
                                                                {it.variant} × {it.quantity}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Td>
                                                <Td className="fu-td--strong">{formatCurrency(order.amount)}</Td>
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
                    </div>
                </div>
            </div>
        </div>
    );
}
