import type { ShopifyOrderApi, ShopifyOrderCustomer } from '../../../types/shopify';
import type { Order } from '../../../utils/orders';
import type { Platform } from '../../../utils/orders';
import type { SpendRecord } from '../../../utils/marketing-spend';
import { shopifyOrderToOrder, getOrderAddress, getOrderCustomerName, getOrderCustomerPhone, mapDeliveryStatusFromTracking, mapOrderType } from '../../../utils/shopify-orders';
import { Spinner } from '../../../components/Spinner';
import { formatCurrency, generateWhatsAppSummary, Th, Td, StatusTag, PlatformTag, TypeTag } from './ShopifyShared';

export type GroupedOrdersByDate = {
    label: string;
    items: ShopifyOrderApi[];
    metaSpent: number;
    totalAmount: number;
    totalShipping: number;
    codCount: number;
    paidCount: number;
};

function buildOrderWhatsAppMessage(o: ShopifyOrderApi): string {
    const name = getOrderCustomerName(o) || 'Customer';
    const awb = o.shippingDetails?.trackingNumber || '';
    const trackingUrl =
        o.shippingDetails?.trackingUrl ||
        (awb ? `https://www.delhivery.com/track-v2/package/${encodeURIComponent(awb)}` : '');

    const lines: string[] = [];
    lines.push(`Dear ${name},`, '');
    // Use Unicode escape sequences so emojis render correctly across environments
    lines.push('Your order has been shipped! \U+2764 U+FE0F'); // 🚚

    if (awb) {
        lines.push(`\uD83D\uDCE6 AWB No: ${awb}`); // 📦
    }
    if (trackingUrl) {
        lines.push(`\uD83D\uDD17 Track your order here: ${trackingUrl}`, ''); // 🔗
    }

    lines.push('Item Details');
    const products = o.products ?? [];
    if (products.length === 0) {
        lines.push('-');
    } else {
        products.forEach((p, idx) => {
            const productName =
                p.productId && typeof p.productId === 'object' && 'name' in p.productId
                    ? String((p.productId as { name?: string }).name ?? '')
                    : '';
            const baseName = productName ? productName.split('|')[0].trim() : '';
            const label = baseName ? `${baseName} - ${p.variantName}` : p.variantName;
            lines.push(`${idx + 1}. ${label} × ${p.quantity}`);
        });
    }

    lines.push('');

    if (o.paymentMode !== 'PAID') {
        const amountLine = `\uD83D\uDCB0 Total Amount Payable (Cash on Delivery): ${formatCurrency(o.totalAmount)}`; // 💰
        lines.push(amountLine);
        lines.push('\uD83D\uDC49 Kindly pay at the time of delivery.', ''); // 👉
    }

    lines.push('Your order will be with you very soon — thank you for trusting Purity Harvest....');

    return lines.join('\n');
}

export function ShopifyOrdersTable({
    groupedByDate,
    marketingSpend,
    loading,
    orderCount,
    onCustomerClick,
    onEdit,
    onDelete,
}: {
    groupedByDate: GroupedOrdersByDate[];
    marketingSpend: SpendRecord[];
    loading: boolean;
    orderCount: number;
    onCustomerClick: (customerId: string, phone: string) => void;
    onEdit: (order: Order) => void;
    onDelete: (order: Order) => void;
}) {
    console.log(groupedByDate, 'groupedByDate');
    return (
        <div className="card shopify-orders-card">
            <div className="shopify-orders-count-bar">
                {loading ? '—' : `${orderCount.toLocaleString()} order${orderCount === 1 ? '' : 's'}`}
            </div>
            {loading ? (
                <div className="shopify-orders-loading">
                    <Spinner overlay message="Loading orders…" />
                </div>
            ) : (
                <div className="table-scroll-wrapper">
                    <table className="orders-table shopify-orders-table">
                        <colgroup>
                            <col /><col /><col /><col /><col /><col /><col /><col /><col /><col />
                        </colgroup>
                        <thead>
                            <tr className="shopify-orders-header-row">
                                <Th>Date</Th>
                                <Th>Customer</Th>
                                <Th>Variant</Th>
                                <Th>Amount</Th>
                                <Th>Payment Mode</Th>
                                <Th>Platform</Th>
                                <Th>Shipping Status</Th>
                                <Th>Type</Th>
                                <Th>Updated by</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedByDate.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="shopify-orders-empty-cell">
                                        No orders found. Click "Add Order" to create your first order.
                                    </td>
                                </tr>
                            ) : (
                                groupedByDate.map((group) =>
                                    group.items.map((o, idx) => (
                                        <tr
                                            key={o._id}
                                            className={`shopify-orders-row${
                                                idx === 0 ? ' shopify-orders-row--group-start' : ''
                                            }`}
                                        >
                                            {idx === 0 ? (
                                                <td rowSpan={group.items.length} className="shopify-orders-date-cell">
                                                    <div className="shopify-orders-date-wrapper">
                                                        <div className="shopify-orders-date-header">
                                                            <span>{group.label}</span>
                                                            {group.items.length > 0 && (
                                                                <a
                                                                    href={`https://wa.me/918685045943?text=${encodeURIComponent(generateWhatsAppSummary(group.label, group.items.map(shopifyOrderToOrder), marketingSpend))}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="shopify-whatsapp-summary-link"
                                                                    title="Send summary on WhatsApp"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shopify-wa-svg">
                                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                    </svg>
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className="shopify-orders-date-badges">
                                                            <span className="shopify-badge shopify-badge--orders">{group.items.length} Orders</span>
                                                            <span className="shopify-badge shopify-badge--amount">{formatCurrency(group.totalAmount)}</span>
                                                            {group.totalShipping > 0 && (
                                                                <span className="shopify-badge shopify-badge--shipping">Shipping {formatCurrency(group.totalShipping)}</span>
                                                            )}
                                                            <span className="shopify-badge shopify-badge--cod">COD {group.codCount}</span>
                                                            <span className="shopify-badge shopify-badge--paid">Paid {group.paidCount}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            ) : null}
                                            <Td>
                                                <div className="shopify-customer-cell">
                                                    <span
                                                        title={getOrderAddress(o)}
                                                        className="shopify-customer-name"
                                                        onClick={() => {
                                                            const customer = o.customer;
                                                            let customerId = '';

                                                            if (typeof customer === 'string') {
                                                                customerId = customer;
                                                            } else if (customer && typeof customer === 'object' && '_id' in customer) {
                                                                customerId = String((customer as ShopifyOrderCustomer)._id ?? '');
                                                            }

                                                            onCustomerClick(customerId, getOrderCustomerPhone(o));
                                                        }}
                                                    >
                                                        {getOrderCustomerName(o)}
                                                    </span>
                                                    <a
                                                        className="link shopify-customer-phone"
                                                        href={`tel:${getOrderCustomerPhone(o)}`}
                                                    >
                                                        {getOrderCustomerPhone(o)}
                                                    </a>
                                                </div>
                                            </Td>
                                            <Td>
                                                <div className="shopify-items-cell">
                                                    {(o.products ?? []).length === 0 ? <span>—</span> : null}
                                                    {(o.products ?? []).map((p, i) => {
                                                        const productName =
                                                            p.productId &&
                                                            typeof p.productId === 'object' &&
                                                            'name' in p.productId
                                                                ? (p.productId as { name?: string }).name
                                                                : null;
                                                        const displayName = productName
                                                            ? String(productName).split('|')[0].trim()
                                                            : null;
                                                        return (
                                                            <div key={i}>
                                                                {displayName ? `${displayName} – ` : ''}
                                                                {p.variantName} × {p.quantity}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Td>
                                            <Td>
                                                <div className="shopify-amount-cell">
                                                    <span className="shopify-amount-main">{formatCurrency(o.totalAmount)}</span>
                                                    {o.codCharges ? (
                                                        <span className="shopify-amount-meta">COD: {formatCurrency(o.codCharges)}</span>
                                                    ) : null}
                                                    {o.shippingCharges ? (
                                                        <span className="shopify-amount-meta">Shipping: {formatCurrency(o.shippingCharges)}</span>
                                                    ) : null}
                                                    {o.discount ? (
                                                        <span className="shopify-amount-meta">Discount: {formatCurrency(o.discount)}</span>
                                                    ) : null}
                                                </div>
                                            </Td>
                                            <Td>
                                                <StatusTag kind={o.paymentMode === 'PAID' ? 'PAID' : 'COD'} type="payment" />
                                            </Td>
                                            <Td>
                                                <PlatformTag platform={(o.platform as Platform) || 'Shopify'} />
                                            </Td>
                                            <Td>
                                                <div className="shopify-shipping-status-cell">
                                                    <StatusTag
                                                        kind={
                                                            o.returnStatus
                                                                ? 'RTO'
                                                                : mapDeliveryStatusFromTracking(
                                                                      o.shippingDetails?.trackingStatus
                                                                  )
                                                        }
                                                        type="delivery"
                                                    />
                                                    {o.shippingDetails?.trackingUrl && (
                                                        <a
                                                            href={o.shippingDetails.trackingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="link shopify-shipping-track-link"
                                                        >
                                                            Track
                                                        </a>
                                                    )}
                                                </div>
                                            </Td>
                                            <Td>
                                                <TypeTag type={mapOrderType(o.type)} />
                                            </Td>
                                            <Td>
                                                <span className="tag info">
                                                    {o.updatedBy &&
                                                    typeof o.updatedBy === 'object' &&
                                                    'name' in o.updatedBy
                                                        ? (o.updatedBy as { name?: string }).name || 'Shopify'
                                                        : 'Shopify'}
                                                </span>
                                            </Td>
                                            <Td>
                                                <div className="shopify-row-actions">
                                                    <a
                                                        href={`https://wa.me/${getOrderCustomerPhone(o)}?text=${encodeURIComponent(
                                                            buildOrderWhatsAppMessage(o),
                                                        )}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="icon-btn"
                                                        title="Send WhatsApp message"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shopify-wa-svg">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                        </svg>
                                                    </a>
                                                    <button type="button" className="icon-btn" onClick={() => onEdit(shopifyOrderToOrder(o))}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => onDelete(shopifyOrderToOrder(o))}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </Td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
