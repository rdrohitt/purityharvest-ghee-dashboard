import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ShopifyOrderApi, ShopifyOrderProduct } from '../../../types/shopify';
import { getOrderCustomerName } from '../../../utils/shopify-orders';

function amount(value: number): string {
    return Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function money(value: number): string {
    return `INR ${amount(value)}`;
}

function productDisplayName(p: ShopifyOrderProduct): string {
    return p.productId && typeof p.productId === 'object'
        ? String(p.productId.name ?? '').split('|')[0].trim()
        : '';
}

function productLineLabel(p: ShopifyOrderProduct): string {
    const productName = productDisplayName(p);
    const name = productName || p.variantName || 'Item';
    const variant = productName && p.variantName ? ` (${p.variantName})` : '';
    return `${name}${variant}`;
}

function orderItemsText(order: ShopifyOrderApi): string {
    const lines = (order.products ?? []).map((p) => `${productLineLabel(p)} x ${Number(p.quantity || 0)}`);
    return lines.length > 0 ? lines.join('\n') : '—';
}

type GheeType = 'gir' | 'desi' | 'buffalo';

function gheeTypeOf(p: ShopifyOrderProduct): GheeType | null {
    const name = productDisplayName(p).toLowerCase();
    const category = p.productId && typeof p.productId === 'object' ? (p.productId.category?.name ?? '') : '';
    if (!name.includes('ghee') && category.toLowerCase() !== 'ghee') return null;
    if (name.includes('gir')) return 'gir';
    if (name.includes('buffalo')) return 'buffalo';
    if (name.includes('desi')) return 'desi';
    return null;
}

/** Per-unit size parsed from variant names like "500 ML", "1 Ltr", "5 Ltr Dolchi", "500 Gram". */
function unitSizeOf(variantName: string): { litres: number; kg: number } | null {
    const m = (variantName || '').match(/(\d+(?:\.\d+)?)\s*(ml|ltr|litres?|liters?|l|kg|grams?|gm|g)\b/i);
    if (!m) return null;
    const value = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'ml') return { litres: value / 1000, kg: 0 };
    if (unit === 'kg') return { litres: 0, kg: value };
    if (unit.startsWith('g')) return { litres: 0, kg: value / 1000 };
    return { litres: value, kg: 0 };
}

function quantityText(n: number, unit: string): string {
    return `${Number(n.toFixed(2)).toLocaleString('en-IN')} ${unit}`;
}

type OtherItemRow = { name: string; variant: string; qty: number; litres: number; kg: number; amount: number };

function summarizeQuantities(orders: ShopifyOrderApi[]) {
    const ghee: Record<GheeType, number> = { gir: 0, desi: 0, buffalo: 0 };
    const gheeAmount: Record<GheeType, number> = { gir: 0, desi: 0, buffalo: 0 };
    let totalLitres = 0;
    let totalLitresAmount = 0;
    const otherItems = new Map<string, OtherItemRow>();
    for (const o of orders) {
        for (const p of o.products ?? []) {
            const qty = Number(p.quantity || 0);
            const lineAmount = (Number(p.actualPrice) || 0) * qty;
            const size = unitSizeOf(p.variantName);
            const type = gheeTypeOf(p);
            if (size?.litres) {
                totalLitres += size.litres * qty;
                totalLitresAmount += lineAmount;
            }
            if (type && size?.litres) {
                ghee[type] += size.litres * qty;
                gheeAmount[type] += lineAmount;
                continue;
            }
            const name = productDisplayName(p) || p.variantName || 'Item';
            const variant = productDisplayName(p) ? p.variantName || '' : '';
            const key = `${name}|${variant}`;
            const row = otherItems.get(key) ?? { name, variant, qty: 0, litres: 0, kg: 0, amount: 0 };
            row.qty += qty;
            row.litres += (size?.litres ?? 0) * qty;
            row.kg += (size?.kg ?? 0) * qty;
            row.amount += lineAmount;
            otherItems.set(key, row);
        }
    }
    return {
        ghee,
        gheeAmount,
        totalLitres,
        totalLitresAmount,
        otherItems: Array.from(otherItems.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
}

function otherItemTotalText(row: OtherItemRow): string {
    if (row.litres > 0) return quantityText(row.litres, 'L');
    if (row.kg > 0) return quantityText(row.kg, 'kg');
    return quantityText(row.qty, row.qty === 1 ? 'pc' : 'pcs');
}

function orderActualPrice(order: ShopifyOrderApi): number | null {
    const priced = (order.products ?? []).filter((p) => p.actualPrice != null);
    if (priced.length === 0) return null;
    return priced.reduce((acc, p) => acc + (Number(p.actualPrice) || 0) * Number(p.quantity || 0), 0);
}

function orderActualPriceText(order: ShopifyOrderApi): string {
    const value = orderActualPrice(order);
    return value == null ? '—' : amount(value);
}

/** Opens an invoice-style PDF summarising all orders picked up on one date. */
export function openPickupSummaryPdf(dateLabel: string, orders: ShopifyOrderApi[]): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const leftX = margin;
    const rightX = pageWidth - margin;
    const contentW = pageWidth - margin * 2;

    const accent: [number, number, number] = [46, 125, 91];
    const accentDark: [number, number, number] = [30, 94, 68];
    const lightGray: [number, number, number] = [246, 248, 247];
    const borderGray: [number, number, number] = [210, 220, 214];
    const textDark: [number, number, number] = [36, 47, 42];
    const gold: [number, number, number] = [176, 122, 38];

    const isPaid = (o: ShopifyOrderApi) => o.paymentMode === 'PAID';
    const codOrders = orders.filter((o) => !isPaid(o));
    const paidOrders = orders.filter(isPaid);
    const sum = (list: ShopifyOrderApi[]) => list.reduce((acc, o) => acc + (orderActualPrice(o) ?? 0), 0);
    const codAmount = sum(codOrders);
    const paidAmount = sum(paidOrders);
    const grandTotal = codAmount + paidAmount;

    let y = 14;

    doc.setFillColor(241, 248, 244);
    doc.roundedRect(leftX, y, contentW, 32, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(leftX, y, contentW, 32, 2, 2, 'S');
    doc.setFillColor(...accent);
    doc.roundedRect(leftX + 2, y + 2, 4, 28, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...accentDark);
    doc.text('PICKUP SUMMARY', leftX + 12, y + 10.5);

    const pickupText = `Pickup Date: ${dateLabel}`;
    doc.setFontSize(13);
    const pillW = doc.getTextWidth(pickupText) + 7;
    doc.setFillColor(...accentDark);
    doc.roundedRect(leftX + 12, y + 13.5, pillW, 8.5, 1.8, 1.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(pickupText, leftX + 15.5, y + 19.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 86, 77);
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, leftX + 12, y + 27.5);

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

    const metaRowH = 16;
    const metaColW = contentW / 4;
    const drawStrip = (
        cells: Array<{ key: string; value: string; suffix?: string; highlight?: boolean }>,
        headerFill: [number, number, number],
    ) => {
        doc.setFillColor(250, 252, 251);
        doc.roundedRect(leftX, y, contentW, metaRowH, 2, 2, 'F');
        cells.forEach(({ key, value, suffix, highlight }, idx) => {
            const colX = leftX + idx * metaColW;
            if (highlight) {
                doc.setFillColor(...accentDark);
                doc.rect(colX, y, metaColW, metaRowH, 'F');
            } else {
                doc.setFillColor(...headerFill);
                doc.rect(colX, y, metaColW, 6, 'F');
            }
            doc.setDrawColor(...borderGray);
            doc.rect(colX, y, metaColW, metaRowH);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.7);
            doc.text(key, colX + 2.5, y + 4.2);
            if (highlight) {
                doc.setTextColor(255, 255, 255);
            } else {
                doc.setTextColor(...textDark);
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            const valueText: string = doc.splitTextToSize(value, metaColW - 5)[0] ?? '';
            doc.text(valueText, colX + 2.5, y + 12);
            if (suffix) {
                const valueW = doc.getTextWidth(valueText);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                const suffixText: string = doc.splitTextToSize(` ${suffix}`, metaColW - 5 - valueW)[0] ?? '';
                doc.text(suffixText, colX + 2.5 + valueW, y + 12);
            }
        });
        y += metaRowH;
    };

    drawStrip(
        [
            { key: 'Total Orders', value: String(orders.length) },
            { key: `COD (${codOrders.length})`, value: money(codAmount) },
            { key: `Prepaid (${paidOrders.length})`, value: money(paidAmount) },
            { key: 'Grand Total', value: money(grandTotal), highlight: true },
        ],
        accent,
    );

    const qty = summarizeQuantities(orders);
    y += 3;
    drawStrip(
        [
            { key: 'Gir Cow Ghee', value: quantityText(qty.ghee.gir, 'L'), suffix: `(${money(qty.gheeAmount.gir)})` },
            { key: 'Desi Cow Ghee', value: quantityText(qty.ghee.desi, 'L'), suffix: `(${money(qty.gheeAmount.desi)})` },
            {
                key: 'Buffalo Ghee',
                value: quantityText(qty.ghee.buffalo, 'L'),
                suffix: `(${money(qty.gheeAmount.buffalo)})`,
            },
            {
                key: 'Total Litres',
                value: quantityText(qty.totalLitres, 'L'),
                suffix: `(${money(qty.totalLitresAmount)})`,
                highlight: true,
            },
        ],
        gold,
    );

    y += 8;

    if (qty.otherItems.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...accentDark);
        doc.text('Other Items Summary', leftX, y);
        y += 2.5;
        const otherQty = qty.otherItems.reduce((acc, r) => acc + r.qty, 0);
        const otherAmount = qty.otherItems.reduce((acc, r) => acc + r.amount, 0);
        autoTable(doc, {
            startY: y,
            head: [['#', 'Item', 'Variant', 'Qty', 'Total Quantity', 'Actual Price']],
            body: qty.otherItems.map((r, idx) => [
                String(idx + 1),
                r.name,
                r.variant || '—',
                String(r.qty),
                otherItemTotalText(r),
                amount(r.amount),
            ]),
            foot: [[
                '',
                'Total',
                '',
                { content: String(otherQty), styles: { halign: 'center' } },
                '',
                { content: amount(otherAmount), styles: { halign: 'right' } },
            ]],
            theme: 'grid',
            headStyles: { fillColor: gold, textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
            bodyStyles: { fillColor: [255, 255, 255], textColor: textDark, fontSize: 8.8, valign: 'top' },
            footStyles: { fillColor: [251, 243, 228], textColor: textDark, fontStyle: 'bold', fontSize: 9.2 },
            alternateRowStyles: { fillColor: [253, 250, 244] },
            styles: { cellPadding: 2.4, lineColor: borderGray, lineWidth: 0.2, overflow: 'linebreak' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { cellWidth: 62 },
                2: { cellWidth: 38 },
                3: { halign: 'center', cellWidth: 16 },
                4: { halign: 'right', cellWidth: 30 },
                5: { halign: 'right', cellWidth: 32 },
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    const body = orders.map((o, idx) => [
        String(idx + 1),
        getOrderCustomerName(o) || 'Customer',
        o.shippingDetails?.trackingNumber?.trim() || '—',
        orderItemsText(o),
        isPaid(o) ? 'Prepaid' : 'COD',
        orderActualPriceText(o),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['#', 'Customer', 'AWB', 'Items', 'Payment', 'Actual Price']],
        body: body.length > 0 ? body : [['', 'No orders', '', '', '', '—']],
        theme: 'grid',
        headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
        bodyStyles: { fillColor: [255, 255, 255], textColor: textDark, fontSize: 8.8, valign: 'top' },
        alternateRowStyles: { fillColor: lightGray },
        styles: { cellPadding: 2.4, lineColor: borderGray, lineWidth: 0.2, overflow: 'linebreak' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { cellWidth: 40 },
            2: { cellWidth: 34 },
            3: { cellWidth: 50 },
            4: { cellWidth: 22 },
            5: { halign: 'right', cellWidth: 32 },
        },
        margin: { left: margin, right: margin },
    });

    const fileName = `${dateLabel.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'pickup-summary'}.pdf`;
    doc.setProperties({ title: `Pickup Summary ${dateLabel}` });
    openPdfPreview(doc, fileName, `Pickup Summary · ${dateLabel}`);
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/**
 * Browser PDF viewers name blob-URL saves with a random id, so the preview tab gets its own
 * download button that saves under `fileName`.
 */
function openPdfPreview(doc: jsPDF, fileName: string, title: string): void {
    const pdfUrl = URL.createObjectURL(doc.output('blob'));
    const win = window.open('', '_blank');
    if (!win) {
        URL.revokeObjectURL(pdfUrl);
        doc.save(fileName);
        return;
    }
    const safeTitle = escapeHtml(title);
    const safeName = escapeHtml(fileName);
    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  html, body { margin: 0; height: 100%; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  body { display: flex; flex-direction: column; background: #525659; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #1e5e44; color: #fff; }
  .bar h1 { margin: 0; font-size: 15px; font-weight: 600; }
  .bar a { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; background: #e5792f; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; }
  .bar a:hover { background: #cf6a24; }
  iframe { flex: 1; width: 100%; border: 0; }
</style></head>
<body>
  <div class="bar">
    <h1>${safeTitle}</h1>
    <a href="${pdfUrl}" download="${safeName}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
      Download PDF
    </a>
  </div>
  <iframe src="${pdfUrl}" title="${safeTitle}"></iframe>
</body></html>`);
    win.document.close();
    win.addEventListener('beforeunload', () => URL.revokeObjectURL(pdfUrl));
}
