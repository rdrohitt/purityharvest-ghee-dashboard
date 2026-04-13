import React from 'react';
import type { Followup } from '../../utils/followups';
import { PlatformTag } from '../sales/Shopify/ShopifyShared';
import { FEEDBACK_OPTIONS } from './followupsConstants';
import { formatDate, getCustomerType, getFeedbackEmoji, getFeedbackSelectClass } from './followupsFormat';
import { DateInput } from './DateInput';
import { Td } from './FollowupsTableCells';

type Props = {
    followup: Followup;
    onCustomerClick: (f: Followup) => void;
    onOpenHistory: (f: Followup) => void;
    onUpdate: (id: string, field: keyof Followup, value: string | null) => void;
};

export function FollowupTableRow({ followup: f, onCustomerClick, onOpenHistory, onUpdate }: Props) {
    const customerType = getCustomerType(f.totalOrders);

    const phoneDigits = String(f.customerPhone ?? '').replace(/\D/g, '');
    const canCall = phoneDigits.length > 0;

    return (
        <tr className="fu-table__body-row">
            <Td className="fu-td--middle fu-td--call">
                {canCall ? (
                    <a
                        className="fu-call-btn"
                        href={`tel:${f.customerPhone}`}
                        title={`Call ${f.customerName}`}
                        aria-label={`Call ${f.customerName} at ${f.customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <svg
                            className="fu-call-btn__icon"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </a>
                ) : (
                    <span
                        className="fu-call-btn fu-call-btn--disabled"
                        title="No phone number"
                        aria-label="No phone number to call"
                    >
                        <svg
                            className="fu-call-btn__icon"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </span>
                )}
            </Td>
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
                        {f.lastOrderReturnStatus === true ? (
                            <span className="fu-customer-badge fu-customer-badge--rto">RTO</span>
                        ) : null}
                        {f.lastOrderReturnStatus === false ? (
                            <span className="fu-customer-badge fu-customer-badge--delivered">Delivered</span>
                        ) : null}
                    </span>
                </div>
            </Td>
            <Td className="fu-td--middle">
                <div className="fu-last-order-cell">
                    <div className="fu-last-order-cell__main">
                        <span className="fu-last-order-cell__date">{formatDate(f.lastOrder)}</span>
                        {f.lastOrderPlatform ? (
                            <span className="fu-last-order-cell__platform">
                                <PlatformTag platform={f.lastOrderPlatform} />
                            </span>
                        ) : null}
                    </div>
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
