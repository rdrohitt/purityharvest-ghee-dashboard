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
    onOpenWhatsAppPicker: (f: Followup) => void;
    onUpdate: (id: string, field: keyof Followup, value: string | null) => void;
};

export function FollowupTableRow({
    followup: f,
    onCustomerClick,
    onOpenHistory,
    onOpenWhatsAppPicker,
    onUpdate,
}: Props) {
    const customerType = getCustomerType(f.totalOrders);

    const phoneDigits = String(f.customerPhone ?? '').replace(/\D/g, '');
    const canCall = phoneDigits.length > 0;
    const waPhoneDigits = phoneDigits;
    const canWhatsApp = waPhoneDigits.length > 0;

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
            <Td className="fu-td--middle">
                <div className="fu-total-orders-cell">
                    <span>{f.totalOrders}</span>
                    {canWhatsApp ? (
                        <button
                            type="button"
                            className="fu-whatsapp-btn"
                            title={`Choose product link for ${f.customerName}`}
                            aria-label={`Choose product link for ${f.customerName}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenWhatsAppPicker(f);
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                        </button>
                    ) : (
                        <span className="fu-whatsapp-btn fu-whatsapp-btn--disabled" aria-label="No phone number for WhatsApp">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                        </span>
                    )}
                </div>
            </Td>
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
