/**
 * Invoice Service - ShopNest
 * Professional PDF invoice generation
 */

var PDFDocument = require('pdfkit');
var path = require('path');
var fs = require('fs');

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
  var colors = { pending: COLORS.orange, processing: COLORS.orange, shipped: COLORS.blue, delivered: COLORS.green, cancelled: COLORS.red };
  return colors[status] || COLORS.orange;
}

function drawHeader(doc, order) {
  // Header background
  doc.rect(0, 0, 612, 140).fill(COLORS.dark);
  
  // Logo
  var logoPath = path.join(__dirname, '..', 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 25, { width: 50, height: 50 });
    doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.white).text('ShopNest', 110, 30);
  } else {
    doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.white).text('ShopNest', 50, 35);
  }
  
  // Motto
  doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
    .text('Shop Smarter. Discover Better.', 50, 70);
  
  // Email
  doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
    .text('shopnest.management@gmail.com', 50, 85);
  
  // Title
  doc.fontSize(11).font('Helvetica-Bold').fillColor('rgba(255,255,255,0.6)')
    .text('E-BILL', 400, 40, { align: 'right' });
  
  // Order-ID
  doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
    .text('Order-ID: ' + order.orderNumber, 400, 60, { align: 'right' });
  
  // Date
  doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
    .text(order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 400, 75, { align: 'right' });
}

function drawFooter(doc) {
  var y = 720;
  doc.rect(0, y, 612, 72).fill(COLORS.lightGray);
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.gray).text('Thank you for shopping with ShopNest!', 50, y + 20);
  doc.text('Shop Smarter. Discover Better. | shopnest.management@gmail.com', 50, y + 34);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark).text('www.shopnest.lk', 400, y + 20, { align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.gray).text('Page 1 of 1', 400, y + 34, { align: 'right' });
}

function generateInvoice(order, res) {
  var doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=e-Bill-' + order.orderNumber + '.pdf');
  doc.pipe(res);
  
  drawHeader(doc, order);
  
  var y = 170;
  
  // Customer Details - BILL TO
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('BILL TO', 50, y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark).text(order.user.firstName + ' ' + order.user.lastName, 50, y + 16);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray).text(order.user.email, 50, y + 30);
  
  // Shipping Address
  if (order.shippingAddress && order.shippingAddress.street) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray)
      .text(order.shippingAddress.street, 50, y + 46);
    doc.text(order.shippingAddress.city + ', ' + order.shippingAddress.state + ' ' + (order.shippingAddress.zipCode || ''), 50, y + 60);
  }
  
  // Order Details - Right Side
  var rightX = 320;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Order-ID', rightX, y);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(order.orderNumber, rightX, y + 12);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Order Date', rightX, y + 28);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX, y + 40);
  
  // Customer Email on right side too
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Customer Email', rightX, y + 56);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(order.user.email, rightX, y + 68);
  
  // Payment Method
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.gray).text('Payment Method', rightX, y + 84);
  var paymentDisplay = order.paymentMethod === 'cod' ? 'Cash on Delivery' : (order.paymentMethod === 'card_payment' ? 'Card Payment' : 'Bank Transfer');
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(paymentDisplay, rightX, y + 96);
  
  // Status Badge
  var statusColor = getStatusColor(order.status);
  doc.rect(rightX, y + 116, 100, 22).fill(statusColor).stroke(statusColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white).text(order.status.toUpperCase(), rightX + 10, y + 121);
  
  // Items Table
  var tableTop = 350;
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
    doc.text('Rs. ' + item.price.toFixed(2), 370, itemY, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLORS.dark).text('Rs. ' + item.subtotal.toFixed(2), 460, itemY, { width: 100, align: 'right' });
    itemY += 24;
  });
  
  doc.rect(50, itemY, 512, 1).fill(COLORS.border);
  itemY += 16;
  
  // Totals
  var totalsX = 370;
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray);
  doc.text('Subtotal', totalsX, itemY);
  doc.font('Helvetica-Bold').fillColor(COLORS.dark).text('Rs. ' + order.subtotal.toFixed(2), 460, itemY, { width: 100, align: 'right' });
  itemY += 20;
  
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray);
  doc.text('Shipping', totalsX, itemY);
  doc.font('Helvetica-Bold').fillColor(COLORS.dark).text(order.shippingCost === 0 ? 'FREE' : 'Rs. ' + order.shippingCost.toFixed(2), 460, itemY, { width: 100, align: 'right' });
  itemY += 20;
  
  if (order.couponDiscount && order.couponDiscount > 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.green);
    doc.text('Discount (' + order.couponCode + ')', totalsX, itemY);
    doc.font('Helvetica-Bold').fillColor(COLORS.green).text('-Rs. ' + order.couponDiscount.toFixed(2), 460, itemY, { width: 100, align: 'right' });
    itemY += 20;
  }
  
  doc.rect(totalsX, itemY, 192, 1).fill(COLORS.dark);
  itemY += 10;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.dark).text('Total', totalsX, itemY);
  doc.fontSize(14).fillColor(COLORS.primary).text('Rs. ' + order.total.toFixed(2), 460, itemY - 2, { width: 100, align: 'right' });
  itemY += 18;
  doc.fontSize(7).font('Helvetica').fillColor(COLORS.gray).text('Tax/VAT included', totalsX, itemY);
  
  drawFooter(doc);
  doc.end();
}

module.exports = { generateInvoice };