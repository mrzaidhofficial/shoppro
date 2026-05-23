/**
 * Email Service - ShopNest
 * Uses Nodemailer + Gmail SMTP (Free Forever)
 */

var nodemailer = require('nodemailer');
var transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    console.log('Email service: Using Gmail SMTP');
    return transporter;
  }
  
  console.log('Email service: EMAIL_USER/EMAIL_PASS not configured. Emails disabled.');
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
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6F9;padding:30px 0;">
    <tr>
      <td align="center">
        
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
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
          
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <h2 style="color:#1A1A2E;font-size:20px;font-weight:700;margin:0;">${title}</h2>
            </td>
          </tr>
          
          <tr>
            <td style="padding:24px 40px 32px;">
              ${content}
            </td>
          </tr>
          
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #EEF0F4;"></div>
            </td>
          </tr>
          
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="color:#8B8FA3;font-size:12px;margin:0 0 8px;line-height:1.6;">
                Need help? Reply to this email or contact us at <a href="mailto:shopnest.management@gmail.com" style="color:#0066FF;text-decoration:none;">shopnest.management@gmail.com</a>
              </p>
              <p style="color:#B0B4C0;font-size:11px;margin:0;">
                &copy; 2026 ShopNest. All rights reserved.<br>
                Your cozy curated marketplace.
              </p>
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

async function sendEmail(to, subject, html) {
  var t = getTransporter();
  if (!t) {
    console.log('Email skipped: Gmail SMTP not configured');
    return false;
  }
  
  try {
    var info = await t.sendMail({
      from: '"ShopNest" <' + process.env.EMAIL_USER + '>',
      to: to,
      subject: subject,
      html: html
    });
    console.log('Email sent to ' + to + ' - Message ID: ' + info.messageId);
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

// Order Confirmation Email
async function sendOrderConfirmation(userEmail, userName, order) {
  var itemsRows = order.items.map(function(item) {
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #F0F2F5;"><strong style="color:#1A1A2E;">' + item.name + '</strong><br><span style="color:#8B8FA3;font-size:12px;">Qty: ' + item.quantity + ' × $' + item.price.toFixed(2) + '</span></td><td style="padding:10px 0;border-bottom:1px solid #F0F2F5;text-align:right;font-weight:600;color:#1A1A2E;white-space:nowrap;">$' + item.subtotal.toFixed(2) + '</td></tr>';
  }).join('');
  
  var content = '<p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi <strong>' + userName + '</strong>,</p><p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 20px;">Thank you for your order! Your order has been confirmed and is being processed.</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:20px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Order Number</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">#' + order.orderNumber + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Order Date</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">' + order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Status</td><td style="padding:6px 0;text-align:right;">' + getOrderStatusBadge(order.status) + '</td></tr>' +
    '</table></div>' +
    '<h3 style="color:#1A1A2E;font-size:15px;margin:0 0 12px;">Order Summary</h3>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">' + itemsRows + '</table>' +
    '<div style="background:#F8FAFC;border-radius:10px;padding:16px 20px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#1A1A2E;font-size:13px;">$' + order.subtotal.toFixed(2) + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Shipping</td><td style="padding:4px 0;text-align:right;color:#1A1A2E;font-size:13px;">' + (order.shippingCost === 0 ? 'FREE' : '$' + order.shippingCost.toFixed(2)) + '</td></tr>' +
    (order.couponDiscount && order.couponDiscount > 0 ? '<tr><td style="padding:4px 0;color:#16A34A;font-size:13px;">Discount (' + order.couponCode + ')</td><td style="padding:4px 0;text-align:right;color:#16A34A;font-size:13px;">-$' + order.couponDiscount.toFixed(2) + '</td></tr>' : '') +
    '<tr><td colspan="2" style="padding:8px 0 0;"><div style="border-top:2px solid #E8ECF1;"></div></td></tr>' +
    '<tr><td style="padding:8px 0 0;font-weight:700;color:#1A1A2E;font-size:16px;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:700;color:#0066FF;font-size:16px;">$' + order.total.toFixed(2) + '</td></tr>' +
    '</table></div>';
  
  var html = getEmailTemplate('Order Confirmed! 🎉', content);
  return sendEmail(userEmail, 'Order Confirmed - #' + order.orderNumber, html);
}

// Order Status Update Email
async function sendOrderStatusUpdate(userEmail, userName, order) {
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
    '</table></div>';
  
  var html = getEmailTemplate(sm.title, content);
  return sendEmail(userEmail, 'Order Update - #' + order.orderNumber, html);
}

// Contact Form Notification to Admin
async function sendContactNotification(name, email, subject, message) {
  var content = '<p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 16px;">You received a new message from the contact form:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:16px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">From</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">' + name + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Email</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0066FF;font-size:14px;">' + email + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#8B8FA3;font-size:12px;">Subject</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E;font-size:14px;">' + subject + '</td></tr>' +
    '</table></div>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:16px 20px;">' +
    '<p style="color:#8B8FA3;font-size:12px;margin:0 0 6px;">Message:</p>' +
    '<p style="color:#4A4D5E;font-size:14px;line-height:1.7;margin:0;">' + message + '</p></div>' +
    '<div style="text-align:center;margin-top:20px;">' +
    '<a href="mailto:' + email + '" style="display:inline-block;background:linear-gradient(135deg,#0066FF 0%,#00C2FF 100%);color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:25px;font-weight:600;font-size:14px;">Reply to ' + name + '</a></div>';
  
  var html = getEmailTemplate('📬 New Contact Message', content);
  return sendEmail(process.env.EMAIL_USER, 'New message from ' + name + ' - ' + subject, html);
}

// Newsletter Subscription Notification
async function sendNewsletterNotification(subscriberEmail) {
  var content = '<p style="color:#4A4D5E;font-size:14px;line-height:1.6;margin:0 0 16px;">A new user has subscribed to your newsletter:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:24px;text-align:center;">' +
    '<div style="font-size:40px;margin-bottom:10px;">📧</div>' +
    '<p style="color:#1A1A2E;font-size:18px;font-weight:700;margin:0;">' + subscriberEmail + '</p>' +
    '<p style="color:#8B8FA3;font-size:13px;margin:8px 0 0;">Subscribed on ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p></div>';
  
  var html = getEmailTemplate('📰 New Subscriber!', content);
  return sendEmail(process.env.EMAIL_USER, 'New Newsletter Subscriber: ' + subscriberEmail, html);
}

module.exports = { 
  sendOrderConfirmation, 
  sendOrderStatusUpdate, 
  sendContactNotification, 
  sendNewsletterNotification 
};