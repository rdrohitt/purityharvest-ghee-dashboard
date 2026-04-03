import React from 'react';
import type { Followup } from '../../utils/followups';
import type { Order } from '../../utils/orders';
import { FEEDBACK_OPTIONS } from './followupsConstants';
import { formatDate, getCustomerType, getFeedbackEmoji, getFeedbackSelectClass } from './followupsFormat';
import { DateInput } from './DateInput';
import { Td } from './FollowupsTableCells';

type Props = {
    followup: Followup;
    ordersByCustomer: Map<string, Order[]>;
    onCustomerClick: (f: Followup) => void;
    onOpenHistory: (f: Followup) => void;
    onUpdate: (id: string, field: keyof Followup, value: string | null) => void;
};

export function FollowupTableRow({ followup: f, ordersByCustomer, onCustomerClick, onOpenHistory, onUpdate }: Props) {
    const customerOrders = ordersByCustomer.get(f.customerPhone) || [];
    const hasRto = customerOrders.some((o) => o.deliveryStatus === 'RTO');
    const customerType = getCustomerType(f.totalOrders);

    return (
        <tr className="fu-table__body-row">
            <Td>
                <div className="fu-customer-cell">
                    <span
                        className="fu-customer-name"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onCustomerClick(f);
                            }
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onCustomerClick(f);
                        }}
                    >
                        {f.customerName}
                    </span>
                    <a className="link fu-customer-tel" href={`tel:${f.customerPhone}`}>
                        {f.customerPhone}
                    </a>
                    <span className="fu-customer-badges">
                        <span className={`fu-customer-badge fu-customer-badge--${customerType}`}>{customerType}</span>
                        {hasRto ? <span className="fu-customer-badge fu-customer-badge--rto">RTO</span> : null}
                    </span>
                </div>
            </Td>
            <Td className="fu-td--middle">
                <div className="fu-last-order-cell">
                    <span className="fu-last-order-cell__date">{formatDate(f.lastOrder)}</span>
                    <button
                        type="button"
                        className={`fu-hist-icon-btn${f.callingHistory.length ? ' fu-hist-icon-btn--has' : ''}`}
                        title={`Call history${f.callingHistory.length ? ` (${f.callingHistory.length})` : ''}`}
                        aria-label={`Call history${f.callingHistory.length ? `, ${f.callingHistory.length} entries` : ''}`}
                        onClick={() => onOpenHistory(f)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </Td>
            <Td>{f.totalOrders}</Td>
            <Td>{f.lastOrderDetail}</Td>
            <Td>
                <select
                    className={`input fu-feedback-sel ${getFeedbackSelectClass(f.feedback)}${f.feedback ? ' fu-feedback-sel--filled' : ''}`}
                    value={f.feedback}
                    onChange={(e) => onUpdate(f.id, 'feedback', e.target.value)}
                >
                    <option value="">{f.feedback ? 'Clear feedback' : 'Select feedback'}</option>
                    {FEEDBACK_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                            {getFeedbackEmoji(opt)} {opt}
                        </option>
                    ))}
                </select>
            </Td>
            <Td>
                <DateInput value={f.callingDate} onChange={(value) => onUpdate(f.id, 'callingDate', value)} />
            </Td>
            <Td>
                <textarea
                    className="input fu-table-textarea"
                    value={f.callingDetail}
                    onChange={(e) => onUpdate(f.id, 'callingDetail', e.target.value)}
                    placeholder="Enter calling detail"
                />
            </Td>
            <Td>
                <DateInput value={f.callAgainDate} onChange={(value) => onUpdate(f.id, 'callAgainDate', value)} />
            </Td>
        </tr>
    );
}
