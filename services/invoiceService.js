/**
 * Invoice Service - ShopNest
 * Professional PDF invoice generation
 */

var PDFDocument = require('pdfkit');

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
  doc.rect(0, 0, 612, 140).fill(COLORS.dark);
  doc.fillColor(COLORS.white).fontSize(28).font('Helvetica-Bold').text('ShopNest', 50, 35);
  doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.7)').text('Your cozy curated marketplace', 50, 70);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('rgba(255,255,255,0.6)').text('TAX INVOICE', 400, 40, { align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.5)').text('shopnest.management@gmail.com', 400, 65, { align: 'right' });
}

function drawFooter(doc) {
  var y = 720;
  doc.rect(0, y, 612, 72).fill(COLORS.lightGray);
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.gray).text('Thank you for shopping with ShopNest!', 50, y + 20);
  doc.text('ShopNest - Your cozy curated marketplace | shopnest.management@gmail.com', 50, y + 34);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark).text('www.shopnest.com', 400, y + 20, { align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.gray).text('Page 1 of 1', 400, y + 34, { align: 'right' });
}

function generateInvoice(order, res) {
  var doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Invoice-' + order.orderNumber + '.pdf');
  doc.pipe(res);
  drawHeader(doc);
  
  var y = 170;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('BILL TO', 50, y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark).text(order.user.firstName + ' ' + order.user.lastName, 50, y + 16);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray).text(order.user.email, 50, y + 30);
  
  var rightX = 320;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Invoice Number', rightX, y);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text('#' + order.orderNumber, rightX, y + 12);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Order Date', rightX, y + 28);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX, y + 40);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Payment Method', rightX, y + 56);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(order.paymentInfo.method.replace('_', ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }), rightX, y + 68);
  
  var statusColor = getStatusColor(order.status);
  doc.rect(rightX, y + 88, 100, 22).fill(statusColor).stroke(statusColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white).text(order.status.toUpperCase(), rightX + 10, y + 93);
  
  if (order.shippingAddress && order.shippingAddress.street) {
    y += 10;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('SHIP TO', 50, y + 120);
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(order.shippingAddress.street, 50, y + 136);
    doc.text(order.shippingAddress.city + ', ' + order.shippingAddress.state + ' ' + order.shippingAddress.zipCode, 50, y + 150);
    doc.text(order.shippingAddress.country, 50, y + 164);
  }
  
  var tableTop = 380;
  doc.rect(50, tableTop, 512, 1).fill(COLORS.border);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray);
  doc.text('ITEM', 50, tableTop + 14);
  doc.text('QTY', 300, tableTop + 14, { width: 60, align: 'center' });
  doc.text('PRICE', 370, tableTop + 14, { width: 80, align: 'right' });
  doc.text('TOTAL', 460, tableTop + 14, { width: 100, align: 'right' });
  doc.rect(50, tableTop + 28, 512, 1).fill(COLORS.border);
  
  var itemY = tableTop + 38;
  order.items.forEach(function(item) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark).text(item.name, 50, itemY, { width: 240 });
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray).text(item.quantity.toString(), 300, itemY, { width: 60, align: 'center' });
    doc.text('$' + item.price.toFixed(2), 370, itemY, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLORS.dark).text('$' + item.subtotal.toFixed(2), 460, itemY, { width: 100, align: 'right' });
    itemY += 24;
  });
  
  doc.rect(50, itemY, 512, 1).fill(COLORS.border);
  itemY += 16;
  
  var totalsX = 370;
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray);
  doc.text('Subtotal', totalsX, itemY);
  doc.font('Helvetica-Bold').fillColor(COLORS.dark).text('$' + order.subtotal.toFixed(2), 460, itemY, { width: 100, align: 'right' });
  itemY += 20;
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray);
  doc.text('Shipping', totalsX, itemY);
  doc.font('Helvetica-Bold').fillColor(COLORS.dark).text(order.shippingCost === 0 ? 'FREE' : '$' + order.shippingCost.toFixed(2), 460, itemY, { width: 100, align: 'right' });
  itemY += 20;
  
  if (order.couponDiscount && order.couponDiscount > 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.green);
    doc.text('Discount (' + order.couponCode + ')', totalsX, itemY);
    doc.font('Helvetica-Bold').fillColor(COLORS.green).text('-$' + order.couponDiscount.toFixed(2), 460, itemY, { width: 100, align: 'right' });
    itemY += 20;
  }
  
  doc.rect(totalsX, itemY, 192, 1).fill(COLORS.dark);
  itemY += 10;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.dark).text('Total', totalsX, itemY);
  doc.fontSize(14).fillColor(COLORS.primary).text('$' + order.total.toFixed(2), 460, itemY - 2, { width: 100, align: 'right' });
  itemY += 18;
  doc.fontSize(7).font('Helvetica').fillColor(COLORS.gray).text('Tax/VAT included', totalsX, itemY);
  
  drawFooter(doc);
  doc.end();
}

module.exports = { generateInvoice };