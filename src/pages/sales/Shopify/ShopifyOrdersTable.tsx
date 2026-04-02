import type { ShopifyOrderApi, ShopifyOrderCustomer } from '../../../types/shopify';
import type { Order } from '../../../utils/orders';
import type { Platform } from '../../../utils/orders';
import type { SpendRecord } from '../../../utils/marketing-spend';
import {
    shopifyOrderToOrder,
    getOrderAddress,
    getOrderCustomerName,
    getOrderCustomerPhone,
    mapDeliveryStatusFromTracking,
    mapOrderType,
    getShopifyProductUnitPrice,
    getShopifyProductLineAmount,
} from '../../../utils/shopify-orders';
import { Spinner } from '../../../components/Spinner';
import { formatCurrency, generateWhatsAppSummary, Th, Td, StatusTag, PlatformTag, TypeTag } from './ShopifyShared';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    lines.push('Your order has been shipped!'); // 🚚

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

function formatInvoiceDate(iso?: string): string {
    if (!iso) return new Date().toLocaleString('en-IN');
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

function formatMoneyForPdf(value?: number): string {
    const amount = Number(value || 0);
    return `INR ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}

function generateOrderInvoicePDF(order: ShopifyOrderApi): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const leftX = margin;
    const rightX = pageWidth - margin;
    const centerX = pageWidth / 2;
    const customerName = getOrderCustomerName(order) || 'Customer';
    const customerPhone = getOrderCustomerPhone(order) || '—';
    const customerAddress = getOrderAddress(order) || '—';
    const orderDate = order.date ?? order.createdAt;
    const invoiceNo = `INV-${String(order._id || '').slice(-8).toUpperCase()}`;
    const orderNo = `ORD-${String(order._id || '').slice(-8).toUpperCase()}`;

    // Greenish palette to mirror the reference layout
    const accent: [number, number, number] = [46, 125, 91];
    const accentDark: [number, number, number] = [30, 94, 68];
    const lightGray: [number, number, number] = [246, 248, 247];
    const borderGray: [number, number, number] = [210, 220, 214];
    const textDark: [number, number, number] = [36, 47, 42];

    let y = 14;

    // Modern header panel with soft highlight
    doc.setFillColor(241, 248, 244);
    doc.roundedRect(leftX, y, pageWidth - margin * 2, 32, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(leftX, y, pageWidth - margin * 2, 32, 2, 2, 'S');

    // Accent stripe on the left
    doc.setFillColor(...accent);
    doc.roundedRect(leftX + 2, y + 2, 4, 28, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...accentDark);
    doc.text('DELIVERY INVOICE', centerX - 4, y + 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 86, 77);
    doc.text(`Order Ref: ${orderNo}`, centerX - 4, y + 22, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...accentDark);
    doc.text('Purity Harvest', rightX - 2, y + 9, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Kosli Market, Haryana 123302', rightX - 2, y + 14, { align: 'right' });
    doc.text('support@purityharvest.in', rightX - 2, y + 19, { align: 'right' });
    doc.text('+91 8168024581', rightX - 2, y + 24, { align: 'right' });

    y += 40;

    // Bill To and Ship To in one row
    const cardsY = y - 5;
    const cardGap = 6;
    const totalContentW = pageWidth - margin * 2;
    const partyCardW = (totalContentW - cardGap) / 2;
    const partyCardH = 52;
    const partyPadX = 4;
    const partyPadTop = 6;
    const leftBlockMaxWidth = partyCardW - partyPadX * 2;
    const nameLines = doc.splitTextToSize(customerName, leftBlockMaxWidth) as string[];
    const addressLines = doc.splitTextToSize(customerAddress, leftBlockMaxWidth) as string[];
    const phoneText = `Phone: ${customerPhone}`;
    const drawPartyCard = (x: number, title: string, includePhone: boolean) => {
        doc.setFillColor(250, 252, 251);
        doc.roundedRect(x, cardsY, partyCardW, partyCardH, 2.5, 2.5, 'F');
        doc.setDrawColor(...borderGray);
        doc.roundedRect(x, cardsY, partyCardW, partyCardH, 2.5, 2.5, 'S');

        const innerX = x + partyPadX;
        let lineY = cardsY + partyPadTop + 2;
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12.5);
        doc.text(title, innerX, lineY);
        lineY += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.2);
        doc.text(nameLines, innerX, lineY);
        lineY += nameLines.length * 5;
        doc.text(addressLines, innerX, lineY);
        lineY += addressLines.length * 5;
        if (includePhone) {
            lineY += 1;
            doc.text(phoneText, innerX, lineY);
        }
    };

    drawPartyCard(leftX, 'Bill To', true);
    drawPartyCard(leftX + partyCardW + cardGap, 'Ship To', false);

    // Other details below in a row
    const metaY = cardsY + partyCardH + 8;
    const metaW = totalContentW;
    const rowH = 16;
    const colW = metaW / 4;
    const metaRows: Array<[string, string]> = [
        ['Invoice#', invoiceNo],
        ['Invoice Date', formatInvoiceDate(orderDate)],
        ['Payment Mode', order.paymentMode === 'PAID' ? 'PAID' : 'COD'],
        ['Due Date', formatInvoiceDate(orderDate)],
    ];

    doc.setFillColor(250, 252, 251);
    doc.roundedRect(leftX, metaY - 2, metaW, rowH, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(leftX, metaY - 2, metaW, rowH, 2, 2, 'S');

    metaRows.forEach(([key, value], idx) => {
        const colX = leftX + idx * colW;
        // top label strip
        doc.setFillColor(...accent);
        doc.rect(colX, metaY - 2, colW, 6, 'F');
        // divider lines
        doc.setDrawColor(...borderGray);
        doc.rect(colX, metaY - 2, colW, rowH);

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.7);
        doc.text(key, colX + 2.5, metaY + 2);
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(value, colX + 2.5, metaY + 10);
    });

    y = metaY + rowH + 8;

    const rows = (order.products ?? []).map((p, idx) => {
        const productName =
            p.productId && typeof p.productId === 'object' && 'name' in p.productId
                ? String((p.productId as { name?: string }).name ?? '').split('|')[0].trim()
                : '';
        const itemName = productName || p.variantName || 'Item';
        const qty = Number(p.quantity || 0);
        const unitPrice = getShopifyProductUnitPrice(p);
        const lineTotal = getShopifyProductLineAmount(p);
        return [
            String(idx + 1),
            `${itemName}${p.variantName ? ` (${p.variantName})` : ''}`,
            String(qty),
            formatMoneyForPdf(unitPrice),
            formatMoneyForPdf(lineTotal),
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['#', 'Item', 'Qty', 'Rate', 'Amount']],
        body: rows.length > 0 ? rows : [['1', 'No items', '0', formatMoneyForPdf(0), formatMoneyForPdf(0)]],
        theme: 'grid',
        headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fillColor: [255, 255, 255], textColor: textDark, fontSize: 9.5 },
        alternateRowStyles: { fillColor: lightGray },
        styles: { fontSize: 9.5, cellPadding: 3, lineColor: borderGray, lineWidth: 0.2 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 104 },
            2: { halign: 'right', cellWidth: 18 },
            3: { halign: 'right', cellWidth: 24 },
            4: { halign: 'right', cellWidth: 30 },
        },
        margin: { left: margin, right: margin },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 50;
    let totalY = finalY + 8;

    const subtotal = Number(order.totalAmount || 0) + Number(order.discount || 0);
    const taxPercent = 0;
    const taxAmount = 0;
    const grandTotal = Number(order.totalAmount || 0);

    doc.setTextColor(...textDark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Thanks for your business.', leftX, totalY + 3);

    const totalsLabelX = rightX - 35;
    const totalsValueX = rightX;

    doc.text('Sub Total', totalsLabelX, totalY + 3, { align: 'right' });
    doc.text(formatMoneyForPdf(subtotal), totalsValueX, totalY + 3, { align: 'right' });
    totalY += 8;

    doc.text(`Sales tax (${taxPercent}%)`, totalsLabelX, totalY + 3, { align: 'right' });
    doc.text(formatMoneyForPdf(taxAmount), totalsValueX, totalY + 3, { align: 'right' });
    totalY += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Total', totalsLabelX, totalY + 5, { align: 'right' });
    doc.text(formatMoneyForPdf(grandTotal), totalsValueX, totalY + 5, { align: 'right' });
    totalY += 11;

    // Balance due green strip
    const isPaid = order.paymentMode === 'PAID';
    const stripW = 78;
    const stripX = rightX - stripW;

    if (!isPaid) {
        doc.setFillColor(...accentDark);
        doc.rect(stripX, totalY, stripW, 9, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10.5);
        doc.text('Balance Due', stripX + 18, totalY + 6, { align: 'center' });
        doc.text(formatMoneyForPdf(grandTotal), stripX + stripW - 3, totalY + 6, { align: 'right' });
    } else {
        doc.setDrawColor(...accentDark);
        doc.setFillColor(239, 248, 243);
        doc.rect(stripX, totalY, stripW, 9, 'FD');
        doc.setTextColor(...accentDark);
        doc.setFontSize(10.5);
        doc.text('Paid in Full', stripX + stripW / 2, totalY + 6, { align: 'center' });
    }

    // Footer
    doc.setTextColor(...textDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Terms & Conditions', leftX, pageHeight - 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
        'All payments must be made in full before the commencement of any work.',
        leftX,
        pageHeight - 18,
    );

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
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
    return (
        <div className="card shopify-orders-card">
            <div className="shopify-orders-count-bar">
                {loading ? '—' : `${orderCount.toLocaleString()} order${orderCount === 1 ? '' : 's'}`}
            </div>
            {loading ? (
                null
            ) : (
                <div className="table-scroll-wrapper">
                    <table className="orders-table shopify-orders-table">
                        <colgroup>
                            <col /><col /><col /><col /><col /><col /><col /><col /><col /><col /><col />
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
                                <Th>Shipped</Th>
                                <Th>Type</Th>
                                <Th>Updated by</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedByDate.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="shopify-orders-empty-cell">
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
                                                    <div className="shopify-customer-name-row">
                                                        <span
                                                            title={getOrderAddress(o)}
                                                            className="shopify-customer-name"
                                                            onClick={() => {
                                                                const customer = o.customer;
                                                                let customerId = '';

                                                                if (typeof customer === 'string') {
                                                                    customerId = customer;
                                                                } else if (
                                                                    customer &&
                                                                    typeof customer === 'object' &&
                                                                    '_id' in customer
                                                                ) {
                                                                    customerId = String(
                                                                        (customer as ShopifyOrderCustomer)._id ?? '',
                                                                    );
                                                                }

                                                                onCustomerClick(customerId, getOrderCustomerPhone(o));
                                                            }}
                                                        >
                                                            {getOrderCustomerName(o)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="icon-btn shopify-customer-edit-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEdit(shopifyOrderToOrder(o));
                                                            }}
                                                            title="Edit order"
                                                            aria-label="Edit order"
                                                        >
                                                            <svg
                                                                width="14"
                                                                height="14"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                aria-hidden
                                                            >
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                    </div>
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
                                                <span
                                                    className={
                                                        o.is_shipped
                                                            ? 'shopify-shipped-badge shopify-shipped-badge--yes'
                                                            : 'shopify-shipped-badge shopify-shipped-badge--no'
                                                    }
                                                >
                                                    {o.is_shipped ? '✓ Yes' : '— No'}
                                                </span>
                                            </Td>
                                            <Td>
                                                <TypeTag type={mapOrderType(o.type)} />
                                            </Td>
                                            <Td>
                                                <span className="shopify-updated-by">
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
                                                    <button
                                                        type="button"
                                                        className="icon-btn"
                                                        onClick={() => generateOrderInvoicePDF(o)}
                                                        title="Open invoice PDF"
                                                        aria-label="Open invoice PDF"
                                                        style={{ color: '#8b0000' }}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 2.5L18.5 9H14zM8 13h8v1.5H8zm0 3h8v1.5H8zm0-6h4v1.5H8z" />
                                                        </svg>
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
