/**
 * Invoice Service - ShopNest
 * Professional PDF invoice generation
 */

var PDFDocument = require('pdfkit');

// Color scheme
var COLORS = {
  primary: '#0066FF',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  border: '#E5E7EB',
  white: '#FFFFFF',
  green: '#16A34A',
  orange: '#EA580C',
  blue: '#2563EB',
  red: '#DC2626'
};

function getStatusColor(status) {
  var colors = { processing: COLORS.orange, shipped: COLORS.blue, delivered: COLORS.green, cancelled: COLORS.red };
  return colors[status] || COLORS.orange;
}

function drawHeader(doc) {
  // Header background
  doc.rect(0, 0, 612, 140).fill(COLORS.dark);
  
  // ShopNest logo
  doc.fillColor(COLORS.white).fontSize(28).font('Helvetica-Bold').text('ShopNest', 50, 35);
  doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.7)').text('Your cozy curated marketplace', 50, 70);
  
  // Invoice label
  doc.fontSize(11).font('Helvetica-Bold').fillColor('rgba(255,255,255,0.6)').text('TAX INVOICE', 400, 40, { align: 'right' });
  
  // Contact info on right
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
    .text('shopnest.management@gmail.com', 400, 65, { align: 'right' });
}

function drawFooter(doc) {
  var y = 720;
  doc.rect(0, y, 612, 72).fill(COLORS.lightGray);
  
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.gray)
    .text('Thank you for shopping with ShopNest!', 50, y + 20);
  doc.text('ShopNest - Your cozy curated marketplace | shopnest.management@gmail.com', 50, y + 34);
  
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark)
    .text('www.shopnest.com', 400, y + 20, { align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.gray)
    .text('Page 1 of 1', 400, y + 34, { align: 'right' });
}

function generateInvoice(order, res) {
  var doc = new PDFDocument({ margin: 50, size: 'A4' });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Invoice-' + order.orderNumber + '.pdf');
  
  doc.pipe(res);
  
  // Header
  drawHeader(doc);
  
  // Invoice Info Section
  var y = 170;
  
  // Left column - Bill To
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('BILL TO', 50, y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark)
    .text(order.user.firstName + ' ' + order.user.lastName, 50, y + 16);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray)
    .text(order.user.email, 50, y + 30);
  
  // Right column - Invoice Details
  var rightX = 320;
  drawInvoiceDetail(doc, 'Invoice Number', '#' + order.orderNumber, rightX, y);
  drawInvoiceDetail(doc, 'Invoice Date', order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX, y + 24);
  drawInvoiceDetail(doc, 'Order Date', order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX, y + 48);
  drawInvoiceDetail(doc, 'Payment Method', order.paymentInfo.method.replace('_', ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }), rightX, y + 72);
  
  // Status badge
  var statusColor = getStatusColor(order.status);
  doc.rect(rightX, y + 100, 100, 22).fill(statusColor).stroke(statusColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white)
    .text(order.status.toUpperCase(), rightX + 10, y + 105);
  
  // Shipping Address
  if (order.shippingAddress && order.shippingAddress.street) {
    y += 20;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('SHIP TO', 50, y + 130);
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
      .text(order.shippingAddress.street, 50, y + 146);
    doc.text(order.shippingAddress.city + ', ' + order.shippingAddress.state + ' ' + order.shippingAddress.zipCode, 50, y + 160);
    doc.text(order.shippingAddress.country, 50, y + 174);
  }
  
  // Items Table
  var tableTop = 380;
  doc.rect(50, tableTop, 512, 1).fill(COLORS.border);
  
  // Table Header
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray);
  doc.text('ITEM', 50, tableTop + 14);
  doc.text('QTY', 300, tableTop + 14, { width: 60, align: 'center' });
  doc.text('PRICE', 370, tableTop + 14, { width: 80, align: 'right' });
  doc.text('TOTAL', 460, tableTop + 14, { width: 100, align: 'right' });
  
  doc.rect(50, tableTop + 28, 512, 1).fill(COLORS.border);
  
  // Table Rows
  var itemY = tableTop + 38;
  order.items.forEach(function(item) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark)
      .text(item.name, 50, itemY, { width: 240 });
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray)
      .text(item.quantity.toString(), 300, itemY, { width: 60, align: 'center' });
    doc.text('$' + item.price.toFixed(2), 370, itemY, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLORS.dark)
      .text('$' + item.subtotal.toFixed(2), 460, itemY, { width: 100, align: 'right' });
    itemY += 24;
  });
  
  doc.rect(50, itemY, 512, 1).fill(COLORS.border);
  itemY += 16;
  
  // Totals
  var totalsX = 370;
  drawTotalRow(doc, 'Subtotal', '$' + order.subtotal.toFixed(2), totalsX, itemY);
  itemY += 20;
  drawTotalRow(doc, 'Shipping', order.shippingCost === 0 ? 'FREE' : '$' + order.shippingCost.toFixed(2), totalsX, itemY);
  itemY += 20;
  drawTotalRow(doc, 'Tax (8%)', '$' + order.tax.toFixed(2), totalsX, itemY);
  itemY += 20;
  
  if (order.couponDiscount && order.couponDiscount > 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.green);
    doc.text('Discount (' + order.couponCode + ')', totalsX, itemY);
    doc.text('-$' + order.couponDiscount.toFixed(2), 460, itemY, { width: 100, align: 'right' });
    itemY += 20;
  }
  
  doc.rect(totalsX, itemY, 192, 1).fill(COLORS.dark);
  itemY += 10;
  
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.dark);
  doc.text('Total', totalsX, itemY);
  doc.fontSize(14).fillColor(COLORS.primary);
  doc.text('$' + order.total.toFixed(2), 460, itemY - 2, { width: 100, align: 'right' });
  
  // Footer
  drawFooter(doc);
  
  doc.end();
}

function drawInvoiceDetail(doc, label, value, x, y) {
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text(label, x, y);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(value, x, y + 12);
}

function drawTotalRow(doc, label, value, x, y) {
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray);
  doc.text(label, x, y);
  doc.font('Helvetica-Bold').fillColor(COLORS.dark);
  doc.text(value, 460, y, { width: 100, align: 'right' });
}

module.exports = { generateInvoice };