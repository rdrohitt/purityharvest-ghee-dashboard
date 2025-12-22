import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SalesEntry, Mart } from './marts';

// Company details - you can customize these
const COMPANY_DETAILS = {
    name: 'Sarti Agri and Dairy Farms',
    address: 'Kosli Market Kosli-172 Bhakali H.No.607, Mohalla Todian',
    city: 'Kosli',
    state: 'Haryana',
    pincode: '123302',
    phone: '+91 1234567890',
    email: 'support@purityharvest.in',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
};

export function generateInvoicePDF(sale: SalesEntry, mart: Mart): void {
    const doc = new jsPDF();
    
    // Page dimensions and margins
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10; // Reduced left and right margins
    const leftX = margin;
    const rightX = pageWidth - margin;
    const centerX = pageWidth / 2;
    
    // Colors
    const textColor = [0, 0, 0]; // Black
    const lightGray = [245, 245, 245];
    const darkGray = [60, 60, 60];
    const accentColor = [70, 70, 70];
    
    let yPos = 20;
    
    // Header: Tax Invoice title (large, bold)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Tax Invoice', leftX, yPos);
    
    yPos += 8;
    
    // Invoice Number (directly below title, left aligned, smaller regular font)
    const invoiceDate = new Date(sale.date);
    const dateStr = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}-${String(invoiceDate.getDate()).padStart(2, '0')} ${String(invoiceDate.getHours()).padStart(2, '0')}:${String(invoiceDate.getMinutes()).padStart(2, '0')}:${String(invoiceDate.getSeconds()).padStart(2, '0')}`;
    const invoiceNumber = `INV-${sale.id.replace('SAL-', '')}`;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(`Invoice No: ${invoiceNumber}`, leftX, yPos);
    
    yPos += 5;
    
    // Date (directly below invoice number, left aligned, same smaller regular font)
    doc.text(`Date: ${dateStr}`, leftX, yPos);
    
    yPos += 10;
    
    // BILL FROM section header (bold, slightly larger than invoice details but smaller than title)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('BILL FROM', leftX, yPos);
    
    yPos += 6;
    
    // Company details (all regular font, left aligned)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(COMPANY_DETAILS.name, leftX, yPos);
    yPos += 5;
    doc.text(`${COMPANY_DETAILS.address}`, leftX, yPos);
    yPos += 5;
    doc.text(`${COMPANY_DETAILS.city}: ${COMPANY_DETAILS.pincode}, ${COMPANY_DETAILS.state}, IN`, leftX, yPos);
    yPos += 5;
    doc.text(`Email: ${COMPANY_DETAILS.email}`, leftX, yPos);
    
    yPos += 8;
    
    // Draw a thin horizontal line separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(leftX, yPos, rightX, yPos);
    yPos += 8;
    
    // SHIPPING ADDRESS and BILLING ADDRESS side by side
    const addressStartY = yPos;
    
    // SHIPPING ADDRESS (Left side) - mart name, address, sector, and mobile
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('SHIPPING ADDRESS', leftX, addressStartY);
    
    let currentY = addressStartY + 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(mart.name, leftX, currentY);
    currentY += 5;
    doc.text(mart.address, leftX, currentY);
    currentY += 5;
    doc.text(mart.sector, leftX, currentY);
    currentY += 5;
    doc.text(`Mobile: ${mart.mobile}`, leftX, currentY);
    
    // BILLING ADDRESS (Right side) - right aligned, mart name, address, sector, and mobile
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('BILLING ADDRESS', rightX, addressStartY, { align: 'right' });
    
    currentY = addressStartY + 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(mart.name, rightX, currentY, { align: 'right' });
    currentY += 5;
    doc.text(mart.address, rightX, currentY, { align: 'right' });
    currentY += 5;
    doc.text(mart.sector, rightX, currentY, { align: 'right' });
    currentY += 5;
    doc.text(`Mobile: ${mart.mobile}`, rightX, currentY, { align: 'right' });
    
    yPos = currentY + 10;
    
    // ORDER DETAILS section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('ORDER DETAILS', leftX, yPos);
    
    yPos += 6;
    
    // Left side: Sales Number and Sale Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    const salesNumberLabel = 'Sales Number: ';
    const salesNumberValue = `O-${sale.id.replace('SAL-', '')}`;
    // Calculate x position for value (right after label with no space)
    const labelWidth = doc.getTextWidth(salesNumberLabel);
    doc.text(salesNumberLabel, leftX, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(salesNumberValue, leftX + labelWidth, yPos);
    
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Sale Date: ${dateStr}`, leftX, yPos);
    
    // Right side: Payment Type (aligned with Sales Number line)
    const paymentType = sale.status === 'Paid' ? 'Prepaid' : sale.status === 'Partial Paid' ? 'Partial' : 'Pending';
    const paymentY = yPos - 5; // Same Y as Sales Number line
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Payment Type', rightX, paymentY, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.text(paymentType, rightX, paymentY + 5, { align: 'right' });
    
    yPos += 8;
    
    // Products Table - removed Disc and Taxable columns
    const products = [
        { key: 'gir500', label: 'Gir Cow Ghee', size: '500ml', price: mart.prices?.gir500 || 900 },
        { key: 'gir1', label: 'Gir Cow Ghee', size: '1 ltr', price: mart.prices?.gir1 || 1720 },
        { key: 'desi500', label: 'Desi Cow Ghee', size: '500ml', price: mart.prices?.desi500 || 710 },
        { key: 'desi1', label: 'Desi Cow Ghee', size: '1 ltr', price: mart.prices?.desi1 || 1350 },
        { key: 'buffalo500', label: 'Buffalo Ghee', size: '500ml', price: mart.prices?.buffalo500 || 650 },
        { key: 'buffalo1', label: 'Buffalo Ghee', size: '1 ltr', price: mart.prices?.buffalo1 || 1250 },
    ];
    
    const tableData: any[] = [];
    let totalAmount = 0;
    
    products.forEach(product => {
        const qty = sale.quantities[product.key as keyof typeof sale.quantities] || 0;
        if (qty > 0) {
            const rate = product.price;
            const total = qty * rate;
            
            totalAmount += total;
            
            tableData.push([
                `${product.label} (${product.size})`,
                qty,
                `INR ${rate.toFixed(2)}`,
                `INR 0.00`, // Tax
                `INR ${total.toFixed(2)}` // Total
            ]);
        }
    });
    
    // Products Table with improved styling - full width aligned with content above
    const tableWidth = pageWidth - (margin * 2); // Full width from margin to margin (190mm)
    
    autoTable(doc, {
        startY: yPos,
        head: [['Item Description', 'Qty', 'Rate', 'Tax', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: accentColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 2,
        },
        bodyStyles: {
            textColor: textColor,
            fontSize: 9,
            cellPadding: 2,
        },
        alternateRowStyles: {
            fillColor: lightGray,
        },
        styles: {
            cellPadding: 2,
            lineWidth: 0.1,
            lineColor: [220, 220, 220],
        },
        columnStyles: {
            0: { cellWidth: tableWidth * 0.45, halign: 'left' }, // Item Description - takes more space
            1: { cellWidth: tableWidth * 0.10, halign: 'center' }, // Qty
            2: { cellWidth: tableWidth * 0.15, halign: 'right' }, // Rate
            3: { cellWidth: tableWidth * 0.15, halign: 'right' }, // Tax
            4: { cellWidth: tableWidth * 0.15, halign: 'right' }, // Total
        },
        margin: { left: margin, right: margin },
        tableWidth: tableWidth,
    });
    
    // Get final Y position after table
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
    yPos = finalY + 12;
    
    // Summary section - labels and values right-aligned
    const grandTotal = sale.totalAmount;
    const totalDiscount = 0;
    
    // Position for right-aligned labels and values
    const valueX = rightX; // Right edge for values
    const labelX = rightX - 50; // Position for labels (left of values)
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    
    // Subtotal - label and value right-aligned
    doc.text('Subtotal:', labelX, yPos, { align: 'right' });
    doc.text(`INR ${totalAmount.toFixed(2)}`, valueX, yPos, { align: 'right' });
    
    yPos += 7;
    
    // Discount - label and value right-aligned
    doc.text('Discount:', labelX, yPos, { align: 'right' });
    doc.text(`INR ${totalDiscount.toFixed(2)}`, valueX, yPos, { align: 'right' });
    
    yPos += 10;
    
    // Grand Total - bold, larger, label and value right-aligned (no line above)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text('Grand Total:', labelX, yPos, { align: 'right' });
    doc.text(`INR ${grandTotal.toFixed(2)}`, valueX, yPos, { align: 'right' });
    
    // Position footer at the bottom of the page
    const footerBottomMargin = 15; // Space from bottom of page
    const footerY = pageHeight - footerBottomMargin;
    
    // Draw a line separator before footer
    const lineY = footerY - 20; // Line above footer text
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(leftX, lineY, rightX, lineY);
    
    // Professional Footer - positioned at bottom
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('This is a computer-generated invoice and does not require a signature.', centerX, footerY - 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...accentColor);
    doc.text('Thank you for your business!', centerX, footerY, { align: 'center' });
    
    // Open PDF in new tab instead of downloading
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    
    // Clean up the URL after a delay
    setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
    }, 100);
}
