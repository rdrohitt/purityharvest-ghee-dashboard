import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../api';
import type { ShopifyOrderApi, ShopifyOrderCustomer } from '../../../types/shopify';
import type { Order } from '../../../utils/orders';
import type { Platform } from '../../../utils/orders';
import type { SpendRecord } from '../../../utils/marketing-spend';
import { updateRtoOrderFields } from '../../../utils/rto-orders';
import {
    formatShipmozoDateDdMmmYyyy,
    pushOrderToShipmozo,
    trackShipmozoOrder,
} from '../../../utils/shipmozo';
import { DeleteConfirmModal } from '../../../components/DeleteConfirmModal/DeleteConfirmModal';
import { BulkUpdateOrdersModal } from './BulkUpdateOrdersModal';
import { openPickupSummaryPdf } from './pickupSummaryPdf';
import {
    shopifyOrderToOrder,
    getOrderAddress,
    getOrderCustomerName,
    getOrderCustomerPhone,
    mapDeliveryStatusFromTracking,
    mapOrderType,
    getShopifyProductUnitPrice,
    getShopifyProductLineAmount,
    buildDefaultTrackingUrlFromCourier,
} from '../../../utils/shopify-orders';
import { Spinner } from '../../../components/Spinner';
import {
    formatCurrency,
    generateWhatsAppSummary,
    type WhatsAppSummaryCategoryTab,
    ModernSelect,
    type ModernSelectOption,
    Th,
    Td,
    StatusTag,
    PlatformTag,
    TypeTag,
} from './ShopifyShared';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function ConditionOptionIcon({ children }: { children: React.ReactNode }) {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            {children}
        </svg>
    );
}

export type GroupedOrdersByDate = {
    label: string;
    items: ShopifyOrderApi[];
    metaSpent: number;
    totalAmount: number;
    shopifyAmount: number;
    totalShipping: number;
    codCount: number;
    paidCount: number;
    rtoCount: number;
    shopifyOrderCount: number;
};

/** Below this many rows, render the full table at once (no progressive pass). */
const PROGRESSIVE_ROW_THRESHOLD = 45;
const PROGRESSIVE_INITIAL_ROWS = 25;
const PROGRESSIVE_CHUNK_ROWS = 55;

type FlatOrderRow = {
    group: GroupedOrdersByDate;
    order: ShopifyOrderApi;
};

function flattenGroupedOrders(groups: GroupedOrdersByDate[]): FlatOrderRow[] {
    const out: FlatOrderRow[] = [];
    for (const g of groups) {
        for (const order of g.items) {
            out.push({ group: g, order });
        }
    }
    return out;
}

/** Rebuild date groups for a prefix of flattened rows (badges reflect visible rows only). */
function buildDisplayGroupsFromFlatSlice(slice: FlatOrderRow[]): GroupedOrdersByDate[] {
    if (slice.length === 0) return [];
    const result: GroupedOrdersByDate[] = [];
    for (const fr of slice) {
        const label = fr.group.label;
        const last = result[result.length - 1];
        if (last && last.label === label) {
            last.items.push(fr.order);
        } else {
            result.push({
                ...fr.group,
                items: [fr.order],
                totalAmount: 0,
                shopifyAmount: 0,
                totalShipping: 0,
                codCount: 0,
                paidCount: 0,
                rtoCount: 0,
                shopifyOrderCount: 0,
                metaSpent: 0,
            });
        }
    }
    for (const g of result) {
        let totalAmount = 0;
        let shopifyAmount = 0;
        let totalShipping = 0;
        let codCount = 0;
        let paidCount = 0;
        let rtoCount = 0;
        let shopifyOrderCount = 0;
        for (const it of g.items) {
            totalAmount += it.totalAmount;
            totalShipping += it.shippingCharges ?? 0;
            if ((it.platform ?? '').toLowerCase() === 'shopify') {
                shopifyOrderCount += 1;
                shopifyAmount += it.totalAmount;
            }
            if (it.paymentMode === 'PAID') {
                paidCount += 1;
            } else {
                // Keep badge counts consistent with payment tags: any non-PAID mode is shown as COD.
                codCount += 1;
            }
            const delivery = mapDeliveryStatusFromTracking(it.shippingDetails?.trackingStatus, it.returnStatus);
            if (delivery === 'rto') rtoCount += 1;
        }
        g.totalAmount = totalAmount;
        g.shopifyAmount = shopifyAmount;
        g.totalShipping = totalShipping;
        g.codCount = codCount;
        g.paidCount = paidCount;
        g.rtoCount = rtoCount;
        g.shopifyOrderCount = shopifyOrderCount;
    }
    return result;
}

function ShopifyOrdersEmptyIcon() {
    const svgProps = {
        width: 44,
        height: 44,
        viewBox: '0 0 24 24',
        fill: 'none' as const,
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true as const,
    };
    return (
        <svg {...svgProps}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
            <polyline points="7.5 19.79 7.5 14.6 3 12" />
            <polyline points="21 12 16.5 14.6 16.5 19.79" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    );
}

function buildOrderWhatsAppMessage(o: ShopifyOrderApi): string {
    const name = getOrderCustomerName(o) || 'Customer';
    const awb = o.shippingDetails?.trackingNumber || '';
    const courier = o.shippingDetails?.trackingCompany || '';
    const trackingUrl =
        o.shippingDetails?.trackingUrl || buildDefaultTrackingUrlFromCourier(awb, courier);

    const lines: string[] = [];
    lines.push(`Dear ${name},`, '');
    // Use Unicode escape sequences so emojis render correctly across environments
    lines.push('Your order has been shipped!'); // 🚚

    if (courier) {
        const isAmazon = courier.toLowerCase().includes('amazon');
        const courierLabel =
            isAmazon && !/\bshipping\b/i.test(courier)
                ? `${courier.trim()} Shipping`
                : courier;
        lines.push(`\uD83D\uDCE6 Courier Partner: ${courierLabel}`); // 📦
    }
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

async function copyTextToClipboard(text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(trimmed);
            return true;
        }
    } catch {
        /* fall through */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = trimmed;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
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

function formatOrderTimelineDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
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

    const itemsSubtotal = (order.products ?? []).reduce(
        (sum, p) => sum + getShopifyProductLineAmount(p),
        0,
    );
    const codCharges = Number(order.codCharges || 0);
    const shippingCharges = Number(order.shippingCharges || 0);
    const subtotal = itemsSubtotal + codCharges + shippingCharges;
    const taxPercent = 0;
    const taxAmount = 0;
    const grandTotal = Number(order.totalAmount || 0);
    const discount = Math.max(0, subtotal - grandTotal);

    doc.setTextColor(...textDark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Thanks for your business.', leftX, totalY + 3);

    const totalsLabelX = rightX - 35;
    const totalsValueX = rightX;

    doc.text('Sub Total', totalsLabelX, totalY + 3, { align: 'right' });
    doc.text(formatMoneyForPdf(subtotal), totalsValueX, totalY + 3, { align: 'right' });
    totalY += 8;

    if (discount > 0) {
        doc.text('Discount', totalsLabelX, totalY + 3, { align: 'right' });
        doc.text(`- ${formatMoneyForPdf(discount)}`, totalsValueX, totalY + 3, { align: 'right' });
        totalY += 8;
    }

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

export type OrdersTableColumn =
    | 'refNo'
    | 'platform'
    | 'shipped'
    | 'type'
    | 'updatedBy'
    | 'expectedDelivery'
    | 'actions';

const NO_HIDDEN_COLUMNS: readonly OrdersTableColumn[] = [];
const NON_RTO_ONLY_COLUMNS: readonly OrdersTableColumn[] = ['platform', 'shipped', 'type', 'actions'];

export function ShopifyOrdersTable({
    groupedByDate,
    marketingSpend,
    loading,
    loadingMessage = 'Loading Orders',
    orderCount,
    summaryCategoryTab = 'ghee',
    onCustomerClick,
    onEdit,
    onDelete,
    onOrdersRefresh,
    onWaybillSyncError,
    onPushResult,
    viewMode = 'default',
    hiddenColumns = NO_HIDDEN_COLUMNS,
    allowEdit = true,
    selectable = false,
    onBulkUpdateResult,
    showPickupSummaryPdf = false,
}: {
    groupedByDate: GroupedOrdersByDate[];
    marketingSpend: SpendRecord[];
    loading: boolean;
    /** Shown under the spinner when `loading` (e.g. phone search vs initial load). */
    loadingMessage?: string;
    orderCount: number;
    /** Matches header product tab — WhatsApp day summary title uses Milk vs Ghee vs Oils. */
    summaryCategoryTab?: WhatsAppSummaryCategoryTab;
    onCustomerClick: (customerId: string, phone: string) => void;
    onEdit: (order: Order) => void;
    onDelete: (order: Order) => void;
    onOrdersRefresh?: () => Promise<void> | void;
    onWaybillSyncError?: () => void;
    onPushResult?: (message: string, type: 'success' | 'error') => void;
    viewMode?: 'default' | 'rto';
    hiddenColumns?: readonly OrdersTableColumn[];
    /** Show the edit (pencil) button next to the customer name. */
    allowEdit?: boolean;
    /** Show a checkbox column (after Date) for selecting rows. */
    selectable?: boolean;
    onBulkUpdateResult?: (message: string, type: 'success' | 'error') => void;
    /** Show a PDF button in each date cell that opens a pickup summary for that group. */
    showPickupSummaryPdf?: boolean;
}) {
    const isRtoView = viewMode === 'rto';
    const showCol = (col: OrdersTableColumn) =>
        !hiddenColumns.includes(col) && !(isRtoView && NON_RTO_ONLY_COLUMNS.includes(col));
    const columnCount =
        (isRtoView ? 14 : 16) +
        (selectable ? 1 : 0) -
        hiddenColumns.filter((col) => !(isRtoView && NON_RTO_ONLY_COLUMNS.includes(col))).length;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
    const rtoConditionOptions = useMemo<ModernSelectOption<string>[]>(
        () => [
            {
                value: '',
                label: 'Select condition',
                tone: 'placeholder',
                icon: (
                    <ConditionOptionIcon>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </ConditionOptionIcon>
                ),
            },
            {
                value: 'Different Item Received',
                label: 'Different Item Received',
                tone: 'different',
                icon: (
                    <ConditionOptionIcon>
                        <path d="M4 7h9" />
                        <path d="M4 12h6" />
                        <path d="M4 17h8" />
                        <path d="m15 9 2 2 4-4" />
                    </ConditionOptionIcon>
                ),
            },
            {
                value: 'Less Quantity Received',
                label: 'Less Quantity Received',
                tone: 'less',
                icon: (
                    <ConditionOptionIcon>
                        <path d="M4 12h9" />
                        <rect x="15" y="7" width="5" height="10" rx="1" />
                    </ConditionOptionIcon>
                ),
            },
            {
                value: 'Empty Package Received',
                label: 'Empty Package Received',
                tone: 'empty',
                icon: (
                    <ConditionOptionIcon>
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </ConditionOptionIcon>
                ),
            },
            {
                value: 'Damaged / Leaked',
                label: 'Damaged / Leaked',
                tone: 'damaged',
                icon: (
                    <ConditionOptionIcon>
                        <path d="M12 2 6 8v5c0 3.31 2.69 6 6 6s6-2.69 6-6V8z" />
                        <path d="M9 13h6" />
                    </ConditionOptionIcon>
                ),
            },
            {
                value: 'Original Return',
                label: 'Original Return',
                tone: 'original',
                icon: (
                    <ConditionOptionIcon>
                        <path d="M7 7h10v10H7z" />
                        <path d="M7 11h10" />
                    </ConditionOptionIcon>
                ),
            },
        ],
        []
    );
    const flatRows = useMemo(() => flattenGroupedOrders(groupedByDate), [groupedByDate]);
    const totalFlatRows = flatRows.length;
    const useProgressive = totalFlatRows > PROGRESSIVE_ROW_THRESHOLD;

    const [visibleRowCap, setVisibleRowCap] = useState(PROGRESSIVE_INITIAL_ROWS);

    useLayoutEffect(() => {
        if (!useProgressive) {
            setVisibleRowCap(totalFlatRows);
            return;
        }
        const initial = Math.min(PROGRESSIVE_INITIAL_ROWS, totalFlatRows);
        setVisibleRowCap(initial);
        if (initial >= totalFlatRows) return;

        let cancelled = false;
        let cap = initial;
        let idleId = 0;
        let rafId = 0;

        const bump = () => {
            if (cancelled) return;
            cap = Math.min(totalFlatRows, cap + PROGRESSIVE_CHUNK_ROWS);
            setVisibleRowCap(cap);
            if (cap < totalFlatRows) scheduleNext();
        };

        const scheduleNext = () => {
            if (cancelled) return;
            if (typeof requestIdleCallback !== 'undefined') {
                idleId = requestIdleCallback(bump, { timeout: 200 });
            } else {
                rafId = requestAnimationFrame(bump);
            }
        };

        scheduleNext();

        return () => {
            cancelled = true;
            if (idleId !== 0) cancelIdleCallback(idleId);
            if (rafId !== 0) cancelAnimationFrame(rafId);
        };
    }, [groupedByDate, totalFlatRows, useProgressive]);

    const displayGroups = useMemo(() => {
        if (!useProgressive || visibleRowCap >= totalFlatRows) {
            return groupedByDate;
        }
        return buildDisplayGroupsFromFlatSlice(flatRows.slice(0, visibleRowCap));
    }, [flatRows, groupedByDate, totalFlatRows, useProgressive, visibleRowCap]);

    const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [rtoDraftById, setRtoDraftById] = useState<
        Record<string, { condition: string; remarks: string }>
    >({});
    const [savingRtoById, setSavingRtoById] = useState<Record<string, boolean>>({});
    const [syncingWaybillById, setSyncingWaybillById] = useState<Record<string, boolean>>({});
    const [pushingById, setPushingById] = useState<Record<string, boolean>>({});
    const [orderToPush, setOrderToPush] = useState<ShopifyOrderApi | null>(null);
    const [expectedDeliveryById, setExpectedDeliveryById] = useState<
        Record<string, { loading?: boolean; date?: string; error?: string }>
    >({});

    const loadExpectedDelivery = useCallback(async (orderId: string, awb: string) => {
        setExpectedDeliveryById((prev) => ({ ...prev, [orderId]: { loading: true } }));
        const result = await trackShipmozoOrder(awb);
        const date = result.ok ? formatShipmozoDateDdMmmYyyy(result.data?.expected_delivery_date) : '';
        if (!result.ok) console.error('Track order failed', result);
        setExpectedDeliveryById((prev) => ({
            ...prev,
            [orderId]: date
                ? { date }
                : { error: result.ok ? 'Expected delivery date not available' : result.message },
        }));
    }, []);

    const confirmPushOrder = useCallback(async () => {
        const o = orderToPush;
        if (!o) return;
        const ref = o.referenceNo || o._id;
        setPushingById((prev) => ({ ...prev, [o._id]: true }));
        try {
            const result = await pushOrderToShipmozo(o);
            if (!result.ok) console.error('Push order failed', result);
            onPushResult?.(`${ref}: ${result.message}`, result.ok ? 'success' : 'error');
        } finally {
            setPushingById((prev) => ({ ...prev, [o._id]: false }));
            setOrderToPush(null);
        }
    }, [orderToPush, onPushResult]);

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        };
    }, []);

    const flashCopied = useCallback((orderId: string) => {
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        setCopiedOrderId(orderId);
        copiedTimerRef.current = setTimeout(() => {
            setCopiedOrderId(null);
            copiedTimerRef.current = null;
        }, 2000);
    }, []);

    useEffect(() => {
        if (!isRtoView) return;
        setRtoDraftById((prev) => {
            const next: Record<string, { condition: string; remarks: string }> = {};
            for (const g of displayGroups) {
                for (const o of g.items) {
                    next[o._id] = prev[o._id] ?? {
                        condition: o.condition ?? '',
                        remarks: o.remarks ?? '',
                    };
                }
            }
            return next;
        });
    }, [displayGroups, isRtoView]);

    const visibleOrderIds = useMemo(
        () => displayGroups.flatMap((g) => g.items.map((o) => o._id)),
        [displayGroups],
    );

    useEffect(() => {
        if (!selectable) return;
        setSelectedIds((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(visibleOrderIds);
            const next = new Set([...prev].filter((id) => visible.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [selectable, visibleOrderIds]);

    const selectedCount = selectable ? selectedIds.size : 0;
    const allVisibleSelected =
        visibleOrderIds.length > 0 && visibleOrderIds.every((id) => selectedIds.has(id));

    const toggleOrderSelected = useCallback((orderId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    }, []);

    const toggleAllVisibleSelected = () => {
        setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleOrderIds));
    };

    return (
        <div className="card shopify-orders-card">
            <div className="shopify-orders-count-bar">
                {loading ? (
                    '—'
                ) : (
                    <>
                        <span>
                            {orderCount.toLocaleString()} order{orderCount === 1 ? '' : 's'}
                        </span>
                        {selectedCount > 0 ? (
                            <>
                                <span className="shopify-orders-count-bar__selected">
                                    {' '}
                                    · {selectedCount.toLocaleString()} selected
                                </span>
                                <span className="shopify-bulk-actions">
                                    <button
                                        type="button"
                                        className="shopify-bulk-actions__update"
                                        onClick={() => setBulkUpdateOpen(true)}
                                    >
                                        Update selected
                                    </button>
                                    <button
                                        type="button"
                                        className="shopify-bulk-actions__clear"
                                        onClick={() => setSelectedIds(new Set())}
                                    >
                                        Clear selection
                                    </button>
                                </span>
                            </>
                        ) : null}
                        {useProgressive && visibleRowCap < totalFlatRows ? (
                            <span className="shopify-orders-count-bar__progressive">
                                {' '}
                                · Showing {Math.min(visibleRowCap, totalFlatRows).toLocaleString()} of{' '}
                                {totalFlatRows.toLocaleString()} rows…
                            </span>
                        ) : null}
                    </>
                )}
            </div>
            {loading ? (
                <div className="shopify-orders-loading">
                    <Spinner overlay message={loadingMessage} />
                </div>
            ) : (
                <div className="table-scroll-wrapper">
                    <table
                        className={`orders-table shopify-orders-table${
                            hiddenColumns.length > 0 ? ' shopify-orders-table--reduced' : ''
                        }`}
                    >
                        <colgroup>
                            {Array.from({ length: columnCount }).map((_, idx) => (
                                <col key={idx} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr className="shopify-orders-header-row">
                                <Th>Date</Th>
                                {selectable ? (
                                    <th className="shopify-th shopify-th--center shopify-select-cell">
                                        <input
                                            type="checkbox"
                                            className="shopify-row-checkbox"
                                            aria-label="Select all orders"
                                            checked={allVisibleSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = selectedCount > 0 && !allVisibleSelected;
                                            }}
                                            disabled={visibleOrderIds.length === 0}
                                            onChange={toggleAllVisibleSelected}
                                        />
                                    </th>
                                ) : null}
                                {showCol('refNo') ? <Th>Ref No</Th> : null}
                                <Th>Customer</Th>
                                <Th>Variant</Th>
                                <Th>Amount</Th>
                                <Th>Payment Mode</Th>
                                {isRtoView ? <Th>Condition</Th> : null}
                                {isRtoView ? <Th>Remarks</Th> : null}
                                {showCol('platform') ? <Th>Platform</Th> : null}
                                <Th>Shipping Status</Th>
                                {showCol('shipped') ? <Th>Shipped</Th> : null}
                                {showCol('type') ? <Th>Type</Th> : null}
                                {showCol('updatedBy') ? <Th>Updated by</Th> : null}
                                <Th>Pickup Date</Th>
                                {!isRtoView ? <Th>Delivered On</Th> : null}
                                <Th>Returned On</Th>
                                {showCol('expectedDelivery') ? <Th>Expected Delivery</Th> : null}
                                {isRtoView ? <Th>Action</Th> : null}
                                {showCol('actions') ? <Th>Actions</Th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {displayGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={columnCount} className="shopify-orders-empty-cell shopify-orders-empty-cell--panel">
                                        <div className="shopify-orders-empty-panel">
                                            <div className="shopify-orders-empty-panel__icon-wrap">
                                                <ShopifyOrdersEmptyIcon />
                                            </div>
                                            <h3 className="shopify-orders-empty-panel__title">No Record Found</h3>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayGroups.map((group) =>
                                    group.items.map((o, idx) => {
                                        const customerPhone = getOrderCustomerPhone(o);
                                        const rtoConditionValue = (
                                            rtoDraftById[o._id]?.condition ??
                                            o.condition ??
                                            ''
                                        ).trim();
                                        const isRtoMissingCondition =
                                            isRtoView && rtoConditionValue.length === 0;
                                        return (
                                            <tr
                                            key={o._id}
                                            className={`shopify-orders-row${
                                                idx === 0 ? ' shopify-orders-row--group-start' : ''
                                            }${selectable && selectedIds.has(o._id) ? ' shopify-orders-row--selected' : ''}`}
                                            >
                                            {idx === 0 ? (
                                                <td rowSpan={group.items.length} className="shopify-orders-date-cell">
                                                    {isRtoView ? (
                                                        <span className="shopify-orders-date-title">{group.label}</span>
                                                    ) : (
                                                        <div className="shopify-orders-date-wrapper">
                                                            <div className="shopify-orders-date-header">
                                                                {group.items.length > 0 && (
                                                                    <a
                                                                        href={`https://wa.me/918685045943?text=${encodeURIComponent(
                                                                            generateWhatsAppSummary(
                                                                                group.label,
                                                                                group.items.map(shopifyOrderToOrder),
                                                                                marketingSpend,
                                                                                summaryCategoryTab,
                                                                            ),
                                                                        )}`}
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
                                                                {showPickupSummaryPdf && group.items.length > 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="shopify-pickup-summary-btn"
                                                                        title={`Pickup summary PDF – ${group.label}`}
                                                                        aria-label={`Open pickup summary PDF for ${group.label}`}
                                                                        onClick={() => openPickupSummaryPdf(group.label, group.items)}
                                                                    >
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 2.5L18.5 9H14zM8 13h8v1.5H8zm0 3h8v1.5H8zm0-6h4v1.5H8z" />
                                                                        </svg>
                                                                    </button>
                                                                ) : null}
                                                                <span className="shopify-orders-date-title">{group.label}</span>
                                                            </div>
                                                            <div className="shopify-orders-date-badges">
                                                                <span className="shopify-badge shopify-badge--amount">
                                                                    <span className="shopify-badge__key">Amount</span>
                                                                    <span className="shopify-badge__value">{formatCurrency(group.totalAmount)}</span>
                                                                </span>
                                                                <span className="shopify-badge shopify-badge--shopify-orders">
                                                                    <span className="shopify-badge__key">Shopify Orders</span>
                                                                    <span className="shopify-badge__value">{group.shopifyOrderCount}</span>
                                                                </span>
                                                                <span className="shopify-badge shopify-badge--shopify-amount">
                                                                    <span className="shopify-badge__key">Shopify Amount</span>
                                                                    <span className="shopify-badge__value">{formatCurrency(group.shopifyAmount)}</span>
                                                                </span>
                                                                <span className="shopify-badge shopify-badge--compact shopify-badge--orders">
                                                                    <span className="shopify-badge__key">Orders</span>
                                                                    <span className="shopify-badge__value">{group.items.length}</span>
                                                                </span>
                                                                <span className="shopify-badge shopify-badge--compact shopify-badge--cod">
                                                                    <span className="shopify-badge__key">COD</span>
                                                                    <span className="shopify-badge__value">{group.codCount}</span>
                                                                </span>
                                                                <span className="shopify-badge shopify-badge--compact shopify-badge--paid">
                                                                    <span className="shopify-badge__key">Paid</span>
                                                                    <span className="shopify-badge__value">{group.paidCount}</span>
                                                                </span>
                                                                <span className="shopify-badge shopify-badge--compact shopify-badge--rto">
                                                                    <span className="shopify-badge__key">RTO</span>
                                                                    <span className="shopify-badge__value">{group.rtoCount}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            ) : null}
                                            {selectable ? (
                                                <Td className="shopify-select-cell">
                                                    <input
                                                        type="checkbox"
                                                        className="shopify-row-checkbox"
                                                        aria-label={`Select order of ${getOrderCustomerName(o) || 'customer'}`}
                                                        checked={selectedIds.has(o._id)}
                                                        onChange={() => toggleOrderSelected(o._id)}
                                                    />
                                                </Td>
                                            ) : null}
                                            {showCol('refNo') ? (
                                                <Td>
                                                    <span className="shopify-ref-no">
                                                        {o.referenceNo?.trim() || '—'}
                                                    </span>
                                                </Td>
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

                                                                onCustomerClick(customerId, customerPhone);
                                                            }}
                                                        >
                                                            {getOrderCustomerName(o)}
                                                        </span>
                                                        {!isRtoView && allowEdit ? (
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
                                                        ) : null}
                                                    </div>
                                                    {customerPhone ? (
                                                        copiedOrderId === o._id ? (
                                                            <span
                                                                className="shopify-customer-phone-copied"
                                                                role="status"
                                                                aria-live="polite"
                                                            >
                                                                Copied
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="shopify-customer-phone shopify-customer-phone--copy"
                                                                title="Click to copy number"
                                                                aria-label={`Copy phone number ${customerPhone}`}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const ok = await copyTextToClipboard(
                                                                        customerPhone,
                                                                    );
                                                                    if (ok) flashCopied(o._id);
                                                                }}
                                                            >
                                                                {customerPhone}
                                                            </button>
                                                        )
                                                    ) : (
                                                        <span className="shopify-customer-phone shopify-customer-phone--empty">
                                                            —
                                                        </span>
                                                    )}
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
                                                    {o.partialAmount ? (
                                                        <span className="shopify-amount-meta">Partial: {formatCurrency(o.partialAmount)}</span>
                                                    ) : o.shippingCharges ? (
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
                                            {isRtoView ? (
                                                <Td>
                                                    <ModernSelect<string>
                                                        variant="default"
                                                        className={`shopify-rto-condition-select${
                                                            isRtoMissingCondition
                                                                ? ' shopify-rto-condition-select--missing'
                                                                : ''
                                                        }`}
                                                        value={rtoDraftById[o._id]?.condition ?? ''}
                                                        options={rtoConditionOptions}
                                                        placeholder="Select condition"
                                                        aria-label="Condition"
                                                        onChange={(e) => {
                                                            const value = e as string;
                                                            setRtoDraftById((prev) => ({
                                                                ...prev,
                                                                [o._id]: {
                                                                    condition: value,
                                                                    remarks: prev[o._id]?.remarks ?? o.remarks ?? '',
                                                                },
                                                            }));
                                                        }}
                                                    />
                                                </Td>
                                            ) : null}
                                            {isRtoView ? (
                                                <Td>
                                                    <input
                                                        className="input"
                                                        type="text"
                                                        placeholder="Enter remarks"
                                                        value={rtoDraftById[o._id]?.remarks ?? ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            setRtoDraftById((prev) => ({
                                                                ...prev,
                                                                [o._id]: {
                                                                    condition: prev[o._id]?.condition ?? o.condition ?? '',
                                                                    remarks: value,
                                                                },
                                                            }));
                                                        }}
                                                    />
                                                </Td>
                                            ) : null}
                                            {showCol('platform') ? (
                                                <Td>
                                                    <PlatformTag platform={(o.platform as Platform) || 'Shopify'} />
                                                </Td>
                                            ) : null}
                                            <Td>
                                                {(() => {
                                                    const sd = o.shippingDetails;
                                                    const awb = sd?.trackingNumber?.trim() || '';
                                                    const courier = sd?.trackingCompany?.trim() || '';
                                                    const rawStatus = sd?.trackingStatus?.trim() || '';
                                                    const href =
                                                        sd?.trackingUrl?.trim() ||
                                                        buildDefaultTrackingUrlFromCourier(awb, courier);
                                                    return (
                                                        <div className="shopify-shipping-details-cell">
                                                            <div className="shopify-shipping-status-cell">
                                                                <StatusTag
                                                                    kind={mapDeliveryStatusFromTracking(
                                                                        rawStatus,
                                                                        o.returnStatus,
                                                                    )}
                                                                    type="delivery"
                                                                />
                                                                {href ? (
                                                                    <a
                                                                        href={href}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="link shopify-shipping-track-link"
                                                                    >
                                                                        Track
                                                                    </a>
                                                                ) : null}
                                                            </div>
                                                            {courier ? (
                                                                <span className="shopify-shipping-meta shopify-shipping-courier-row">
                                                                    <span className="shopify-shipping-meta__key">Courier:</span>{' '}
                                                                    <span className="shopify-shipping-courier-name">{courier}</span>
                                                                    {href ? (
                                                                        copiedOrderId === `track:${o._id}` ? (
                                                                            <span
                                                                                className="shopify-shipping-copy-done"
                                                                                role="status"
                                                                                aria-live="polite"
                                                                            >
                                                                                Copied
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                className="shopify-shipping-copy-btn"
                                                                                title="Copy tracking URL"
                                                                                aria-label="Copy tracking URL"
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    const ok = await copyTextToClipboard(href);
                                                                                    if (ok) flashCopied(`track:${o._id}`);
                                                                                }}
                                                                            >
                                                                                <svg
                                                                                    width="12"
                                                                                    height="12"
                                                                                    viewBox="0 0 24 24"
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    strokeWidth="2"
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    aria-hidden
                                                                                >
                                                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                                                </svg>
                                                                            </button>
                                                                        )
                                                                    ) : null}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })()}
                                            </Td>
                                            {showCol('shipped') ? (
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
                                            ) : null}
                                            {showCol('type') ? (
                                                <Td>
                                                    <TypeTag type={mapOrderType(o.type)} />
                                                </Td>
                                            ) : null}
                                            {showCol('updatedBy') ? (
                                                <Td>
                                                    <span className="shopify-updated-by">
                                                        {o.updatedBy &&
                                                        typeof o.updatedBy === 'object' &&
                                                        'name' in o.updatedBy
                                                            ? (o.updatedBy as { name?: string }).name || 'Shopify'
                                                            : 'Shopify'}
                                                    </span>
                                                </Td>
                                            ) : null}
                                            <Td>
                                                <span className="shopify-order-timeline-date shopify-order-timeline-date--pickup">
                                                    {formatOrderTimelineDate(o.shippingDetails?.pickedUpDate || o.pickedUpDate)}
                                                </span>
                                            </Td>
                                            {!isRtoView ? (
                                                <Td>
                                                    <span className="shopify-order-timeline-date shopify-order-timeline-date--delivered">
                                                        {formatOrderTimelineDate(o.shippingDetails?.deliveredAt || o.deliveredAt)}
                                                    </span>
                                                </Td>
                                            ) : null}
                                            <Td>
                                                <span className="shopify-order-timeline-date shopify-order-timeline-date--returned">
                                                    {formatOrderTimelineDate(o.shippingDetails?.returnedAt || o.returnedAt)}
                                                </span>
                                            </Td>
                                            {showCol('expectedDelivery') ? (
                                            <Td>
                                                {(() => {
                                                    const awb = (o.shippingDetails?.trackingNumber || '').trim();
                                                    const state = expectedDeliveryById[o._id];
                                                    if (state?.date) {
                                                        return (
                                                            <span className="shopify-expected-delivery-date">{state.date}</span>
                                                        );
                                                    }
                                                    if (state?.error) {
                                                        return (
                                                            <span className="shopify-expected-delivery-error" title={state.error}>
                                                                Not Found
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <button
                                                            type="button"
                                                            className="shopify-expected-delivery-btn"
                                                            title={awb ? 'View expected delivery' : 'No AWB number'}
                                                            aria-label="View expected delivery"
                                                            disabled={!awb || Boolean(state?.loading)}
                                                            onClick={() => void loadExpectedDelivery(o._id, awb)}
                                                        >
                                                            {state?.loading ? (
                                                                <span className="shopify-expected-delivery-loading">…</span>
                                                            ) : (
                                                                <svg
                                                                    width="16"
                                                                    height="16"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    aria-hidden
                                                                >
                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                    <circle cx="12" cy="12" r="3" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    );
                                                })()}
                                            </Td>
                                            ) : null}
                                            {isRtoView ? (
                                                <Td>
                                                    <button
                                                        type="button"
                                                        className="button"
                                                        disabled={savingRtoById[o._id]}
                                                        onClick={async () => {
                                                            const draft = rtoDraftById[o._id] ?? {
                                                                condition: o.condition ?? '',
                                                                remarks: o.remarks ?? '',
                                                            };
                                                            try {
                                                                setSavingRtoById((prev) => ({ ...prev, [o._id]: true }));
                                                                await updateRtoOrderFields(
                                                                    o,
                                                                    draft.condition,
                                                                    draft.remarks,
                                                                );
                                                            } catch (err) {
                                                                console.error('Failed to update RTO fields', err);
                                                            } finally {
                                                                setSavingRtoById((prev) => ({
                                                                    ...prev,
                                                                    [o._id]: false,
                                                                }));
                                                            }
                                                        }}
                                                    >
                                                        {savingRtoById[o._id] ? 'Saving...' : 'Save'}
                                                    </button>
                                                </Td>
                                            ) : null}
                                            {showCol('actions') ? (
                                                <Td>
                                                    <div className="shopify-row-actions">
                                                        <button
                                                            type="button"
                                                            className="icon-btn"
                                                            title="Update waybill status"
                                                            aria-label="Update waybill status"
                                                            disabled={
                                                                syncingWaybillById[o._id] ||
                                                                !(o.shippingDetails?.trackingNumber || '').trim()
                                                            }
                                                            onClick={async () => {
                                                                const waybill = (o.shippingDetails?.trackingNumber || '').trim();
                                                                if (!waybill) return;
                                                                try {
                                                                    setSyncingWaybillById((prev) => ({ ...prev, [o._id]: true }));
                                                                    const response = await apiFetch('/api/orders/sync-delhivery-waybill', {
                                                                        method: 'POST',
                                                                        headers: {
                                                                            'Content-Type': 'application/json',
                                                                        },
                                                                        body: JSON.stringify({
                                                                            waybill,
                                                                        }),
                                                                    });
                                                                    if (!response.ok) {
                                                                        throw new Error('Failed to sync waybill');
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Failed to sync Delhivery waybill', err);
                                                                    onWaybillSyncError?.();
                                                                    return;
                                                                }
                                                                try {
                                                                    await onOrdersRefresh?.();
                                                                } catch (err) {
                                                                    console.error('Failed to refresh orders after Delhivery waybill sync', err);
                                                                } finally {
                                                                    setSyncingWaybillById((prev) => ({
                                                                        ...prev,
                                                                        [o._id]: false,
                                                                    }));
                                                                }
                                                            }}
                                                        >
                                                            <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                <path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 12 6z" />
                                                            </svg>
                                                        </button>
                                                        <a
                                                            href={`https://wa.me/${customerPhone}?text=${encodeURIComponent(
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
                                                        <button
                                                            type="button"
                                                            className="icon-btn shopify-push-btn"
                                                            title="Push order to shipping"
                                                            aria-label="Push order to shipping"
                                                            disabled={Boolean(pushingById[o._id])}
                                                            onClick={() => setOrderToPush(o)}
                                                        >
                                                            {pushingById[o._id] ? 'Pushing…' : 'Push'}
                                                        </button>
                                                    </div>
                                                </Td>
                                            ) : null}
                                        </tr>
                                        );
                                    }),
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {selectable ? (
                <BulkUpdateOrdersModal
                    open={bulkUpdateOpen}
                    orderIds={[...selectedIds]}
                    onClose={() => setBulkUpdateOpen(false)}
                    onUpdated={async (count) => {
                        setBulkUpdateOpen(false);
                        setSelectedIds(new Set());
                        onBulkUpdateResult?.(
                            `${count.toLocaleString()} order${count === 1 ? '' : 's'} updated`,
                            'success',
                        );
                        try {
                            await onOrdersRefresh?.();
                        } catch (err) {
                            console.error('Failed to refresh orders after bulk update', err);
                        }
                    }}
                    onError={(message) => onBulkUpdateResult?.(message, 'error')}
                />
            ) : null}
            <DeleteConfirmModal
                open={orderToPush !== null}
                icon="🚚"
                backdropClassName="push-confirm-backdrop"
                title="Push order to shipping?"
                description="This will create a shipment for this order with the shipping partner."
                details={
                    orderToPush ? (
                        <>
                            <div className="delete-modal-customer-label">
                                Order {orderToPush.referenceNo || '(no ref no)'}
                            </div>
                            <div className="delete-modal-customer-name">
                                {getOrderCustomerName(orderToPush) || 'Customer'}
                            </div>
                            <div className="delete-modal-customer-amount">
                                {formatCurrency(orderToPush.totalAmount)} ·{' '}
                                {orderToPush.paymentMode === 'PAID' ? 'Prepaid' : 'COD'}
                            </div>
                        </>
                    ) : null
                }
                confirmLabel="Push"
                busyConfirmLabel="Pushing…"
                onConfirm={confirmPushOrder}
                onCancel={() => setOrderToPush(null)}
            />
        </div>
    );
}
