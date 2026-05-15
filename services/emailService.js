/**
 * Email Service - ShopNest
 * Professional email templates with modern design
 */

var emailConfigured = false;
var sgMail = null;

function getTransporter() {
  if (process.env.SENDGRID_API_KEY) {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    emailConfigured = true;
    console.log('Email service: Using SendGrid');
    return sgMail;
  }
  
  console.log('Email service: No SENDGRID_API_KEY configured. Emails will be skipped.');
  emailConfigured = false;
  return null;
}

function getEmailTemplate(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  
  <!-- Outer Container -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6F9;padding:30px 0;">
    <tr>
      <td align="center">
        
        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0066FF 0%,#00C2FF 100%);padding:36px 40px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;text-align:center;line-height:48px;margin-bottom:12px;">
                      <span style="font-size:22px;">🛍️</span>
                    </div>
                    <h1 style="color:#FFFFFF;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">ShopNest</h1>
                    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0;">Your cozy curated marketplace</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <h2 style="color:#1A1A2E;font-size:20px;font-weight:700;margin:0;">${title}</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:24px 40px 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #EEF0F4;"></div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="color:#8B8FA3;font-size:12px;margin:0 0 8px;line-height:1.6;">
                Need help? Reply to this email or contact us at <a href="mailto:shopnest.management@gmail.com" style="color:#0066FF;text-decoration:none;">shopnest.management@gmail.com</a>
              </p>
              <p style="color:#B0B4C0;font-size:11px;margin:0;">
                &copy; 2026 ShopNest. All rights reserved.<br>
                Your cozy curated marketplace.
              </p>
              <div style="margin-top:16px;">
                <a href="#" style="display:inline-block;width:32px;height:32px;background:#F0F0F5;border-radius:50%;text-align:center;line-height:32px;margin:0 4px;text-decoration:none;color:#666;">f</a>
                <a href="#" style="display:inline-block;width:32px;height:32px;background:#F0F0F5;border-radius:50%;text-align:center;line-height:32px;margin:0 4px;text-decoration:none;color:#666;">𝕏</a>
                <a href="#" style="display:inline-block;width:32px;height:32px;background:#F0F0F5;border-radius:50%;text-align:center;line-height:32px;margin:0 4px;text-decoration:none;color:#666;">📷</a>
              </div>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;
}

function getOrderStatusBadge(status) {
  var colors = {
    processing: { bg: '#FFF7ED', text: '#EA580C', label: 'Processing' },
    shipped: { bg: '#EFF6FF', text: '#2563EB', label: 'Shipped' },
    delivered: { bg: '#F0FDF4', text: '#16A34A', label: 'Delivered' },
    cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' }
  };
  var c = colors[status] || colors.processing;
  return '<span style="display:inline-block;background:' + c.bg + ';color:' + c.text + ';padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:capitalize;">' + c.label + '</span>';
}

async function sendOrderConfirmation(userEmail, userName, order) {
  getTransporter();
  
  if (!emailConfigured) {
    console.log('Email skipped: SendGrid not configured');
    return;
  }
  
  try {
    var itemsRows = order.items.map(function(item) {
      return '<tr><td style="padding:10px 0;border-bottom:1px solid #F0F2F5;"><strong style="color:#1A1A2E;">' + item.name + '</strong><br><span style="color:#8B8FA3;font-size:12px;">Qty: ' + item.quantity + ' × $' + item.price.toFixed(2) + '</span></td><td style="padding:10px 0;border-bottom:1px solid #F0F2F5;text-align:right;font-weight:600;color:#1A1A2E;white-space:nowrap;">$' + item.subtotal.toFixed(2) + '</td></tr>';
    }).join('');
    
    var content = '<p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi <strong>' + userName + '</strong>,</p><p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 20px;">Thank you for your order! Your order has been confirmed and is being processed.</p>' +
      '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:20px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
      '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Order Number</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">#' + order.orderNumber + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Order Date</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">' + order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Status</td><td style="padding:6px 0;text-align:right;">' + getOrderStatusBadge(order.status) + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Payment</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;text-transform:capitalize;">' + order.paymentInfo.method.replace('_', ' ') + '</td></tr>' +
      '</table></div>' +
      '<h3 style="color:#1A1A2E;font-size:15px;margin:0 0 12px;">Order Summary</h3>' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">' + itemsRows + '</table>' +
      '<div style="background:#F8FAFC;border-radius:10px;padding:16px 20px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
      '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#1A1A2E;font-size:13px;">$' + order.subtotal.toFixed(2) + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Shipping</td><td style="padding:4px 0;text-align:right;color:#1A1A2E;font-size:13px;">' + (order.shippingCost === 0 ? 'FREE' : '$' + order.shippingCost.toFixed(2)) + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Tax</td><td style="padding:4px 0;text-align:right;color:#1A1A2E;font-size:13px;">$' + order.tax.toFixed(2) + '</td></tr>' +
      (order.couponDiscount && order.couponDiscount > 0 ? '<tr><td style="padding:4px 0;color:#16A34A;font-size:13px;">Discount (' + order.couponCode + ')</td><td style="padding:4px 0;text-align:right;color:#16A34A;font-size:13px;">-$' + order.couponDiscount.toFixed(2) + '</td></tr>' : '') +
      '<tr><td colspan="2" style="padding:8px 0 0;"><div style="border-top:2px solid #E8ECF1;"></div></td></tr>' +
      '<tr><td style="padding:8px 0 0;font-weight:700;color:#1A1A2E;font-size:16px;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:700;color:#0066FF;font-size:16px;">$' + order.total.toFixed(2) + '</td></tr>' +
      '</table></div>' +
      '<div style="text-align:center;margin-top:24px;">' +
      '<a href="https://shoppro-production.up.railway.app/cart/order-confirmation/' + order._id + '" style="display:inline-block;background:linear-gradient(135deg,#0066FF 0%,#00C2FF 100%);color:#FFFFFF;text-decoration:none;padding:14px 36px;border-radius:25px;font-weight:600;font-size:14px;">View Order Details</a>' +
      '</div>';
    
    var html = getEmailTemplate('Order Confirmed! 🎉', content);
    
    await sgMail.send({
      to: userEmail,
      from: 'shopnest.management@gmail.com',
      subject: 'Order Confirmed - #' + order.orderNumber,
      html: html
    });
    
    console.log('Order confirmation email sent to ' + userEmail);
  } catch (err) {
    console.error('Email send error (non-blocking):', err.message);
  }
}

async function sendOrderStatusUpdate(userEmail, userName, order) {
  getTransporter();
  
  if (!emailConfigured) {
    console.log('Email skipped: SendGrid not configured');
    return;
  }
  
  try {
    var statusMessages = {
      shipped: { title: '🚀 Your Order is On the Way!', msg: 'Great news! Your order has been shipped and is on its way to you.' },
      delivered: { title: '📦 Order Delivered!', msg: 'Your order has been delivered. We hope you love it!' },
      cancelled: { title: 'Order Cancelled', msg: 'Your order has been cancelled as requested.' }
    };
    var sm = statusMessages[order.status] || { title: 'Order Update', msg: 'Your order status has been updated to: ' + order.status };
    
    var content = '<p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi <strong>' + userName + '</strong>,</p><p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 20px;">' + sm.msg + '</p>' +
      '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:20px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
      '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Order Number</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">#' + order.orderNumber + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Status</td><td style="padding:6px 0;text-align:right;">' + getOrderStatusBadge(order.status) + '</td></tr>' +
      '</table></div>' +
      '<div style="text-align:center;margin-top:24px;">' +
      '<a href="https://shoppro-production.up.railway.app/cart/order-confirmation/' + order._id + '" style="display:inline-block;background:linear-gradient(135deg,#0066FF 0%,#00C2FF 100%);color:#FFFFFF;text-decoration:none;padding:14px 36px;border-radius:25px;font-weight:600;font-size:14px;">View Order Details</a>' +
      '</div>';
    
    var html = getEmailTemplate(sm.title, content);
    
    await sgMail.send({
      to: userEmail,
      from: 'shopnest.management@gmail.com',
      subject: 'Order Update - #' + order.orderNumber,
      html: html
    });
    
    console.log('Status update email sent to ' + userEmail);
  } catch (err) {
    console.error('Email send error (non-blocking):', err.message);
  }
}

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate };