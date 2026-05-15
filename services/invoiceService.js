/**
 * Invoice Service - ShopNest
 * Generates downloadable PDF invoices
 */

var PDFDocument = require('pdfkit');

function generateInvoice(order, res) {
  var doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Invoice-' + order.orderNumber + '.pdf');
  
  doc.pipe(res);
  
  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('ShopNest', 50, 50);
  doc.fontSize(10).font('Helvetica').text('Your cozy curated marketplace', 50, 80);
  doc.text('Email: shopnest.management@gmail.com', 50, 95);
  
  // Invoice title
  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 50, 130);
  doc.fontSize(10).font('Helvetica').text('Invoice #: ' + order.orderNumber, 50, 155);
  doc.text('Date: ' + order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 50, 170);
  doc.text('Status: ' + order.status.charAt(0).toUpperCase() + order.status.slice(1), 50, 185);
  
  // Customer info
  doc.fontSize(10).font('Helvetica').text('Bill To:', 50, 215);
  doc.text(order.user.firstName + ' ' + order.user.lastName, 50, 230);
  doc.text(order.user.email, 50, 245);
  
  // Shipping address
  if (order.shippingAddress && order.shippingAddress.street) {
    doc.text('Ship To:', 300, 215);
    doc.text(order.shippingAddress.street, 300, 230);
    doc.text(order.shippingAddress.city + ', ' + order.shippingAddress.state + ' ' + order.shippingAddress.zipCode, 300, 245);
    doc.text(order.shippingAddress.country, 300, 260);
  }
  
  // Table header
  var tableTop = 290;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Item', 50, tableTop);
  doc.text('Qty', 300, tableTop, { width: 60, align: 'center' });
  doc.text('Price', 370, tableTop, { width: 80, align: 'right' });
  doc.text('Total', 460, tableTop, { width: 80, align: 'right' });
  
  // Line
  doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).stroke();
  
  // Items
  var y = tableTop + 25;
  doc.font('Helvetica');
  order.items.forEach(function(item) {
    doc.text(item.name, 50, y, { width: 240 });
    doc.text(item.quantity.toString(), 300, y, { width: 60, align: 'center' });
    doc.text('$' + item.price.toFixed(2), 370, y, { width: 80, align: 'right' });
    doc.text('$' + item.subtotal.toFixed(2), 460, y, { width: 80, align: 'right' });
    y += 20;
  });
  
  // Totals
  y += 10;
  doc.moveTo(370, y).lineTo(540, y).stroke();
  y += 15;
  doc.font('Helvetica').text('Subtotal:', 370, y, { width: 80 });
  doc.text('$' + order.subtotal.toFixed(2), 460, y, { width: 80, align: 'right' });
  y += 18;
  doc.text('Shipping:', 370, y, { width: 80 });
  doc.text(order.shippingCost === 0 ? 'FREE' : '$' + order.shippingCost.toFixed(2), 460, y, { width: 80, align: 'right' });
  y += 18;
  doc.text('Tax:', 370, y, { width: 80 });
  doc.text('$' + order.tax.toFixed(2), 460, y, { width: 80, align: 'right' });
  
  if (order.couponDiscount && order.couponDiscount > 0) {
    y += 18;
    doc.text('Discount:', 370, y, { width: 80 });
    doc.text('-$' + order.couponDiscount.toFixed(2), 460, y, { width: 80, align: 'right' });
  }
  
  y += 18;
  doc.moveTo(370, y).lineTo(540, y).stroke();
  y += 15;
  doc.font('Helvetica-Bold').text('Total:', 370, y, { width: 80 });
  doc.text('$' + order.total.toFixed(2), 460, y, { width: 80, align: 'right' });
  
  // Footer
  doc.fontSize(8).font('Helvetica').fillColor('#888');
  doc.text('Thank you for shopping with ShopNest!', 50, 680);
  doc.text('ShopNest - Your cozy curated marketplace', 50, 695);
  
  doc.end();
}

module.exports = { generateInvoice };