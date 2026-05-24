/**
 * Email Service - ShopNest
 * Uses Nodemailer + Gmail SMTP
 */

var nodemailer = require('nodemailer');
var transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
  service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000
    });
    
    console.log('Email service: SMTP configured successfully');
    return transporter;
  }
  
  console.log('Email service: EMAIL_USER/EMAIL_PASS not configured. Emails disabled.');
  return null;
}

function getEmailTemplate(title, content) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background-color:#F4F6F9;font-family:Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6F9;padding:30px 0;"><tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">' +
    '<tr><td style="background:linear-gradient(135deg,#0066FF 0%,#00C2FF 100%);padding:36px 40px;text-align:center;">' +
    '<div style="font-size:22px;">🛍️</div><h1 style="color:#FFFFFF;font-size:24px;font-weight:700;margin:0;">ShopNest</h1>' +
    '<p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0;">Your cozy curated marketplace</p></td></tr>' +
    '<tr><td style="padding:32px 40px 0;text-align:center;"><h2 style="color:#1A1A2E;font-size:20px;font-weight:700;margin:0;">' + title + '</h2></td></tr>' +
    '<tr><td style="padding:24px 40px 32px;">' + content + '</td></tr>' +
    '<tr><td style="padding:0 40px;"><div style="border-top:1px solid #EEF0F4;"></div></td></tr>' +
    '<tr><td style="padding:24px 40px 32px;text-align:center;color:#8B8FA3;font-size:12px;">Need help? Reply to this email or contact us at <a href="mailto:shopnest.management@gmail.com" style="color:#0066FF;">shopnest.management@gmail.com</a><br><br>&copy; 2026 ShopNest. All rights reserved.</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function getOrderStatusBadge(status) {
  var colors = {
    processing: { bg: '#FFF7ED', text: '#EA580C', label: 'Processing' },
    shipped: { bg: '#EFF6FF', text: '#2563EB', label: 'Shipped' },
    delivered: { bg: '#F0FDF4', text: '#16A34A', label: 'Delivered' },
    cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' }
  };
  var c = colors[status] || colors.processing;
  return '<span style="display:inline-block;background:' + c.bg + ';color:' + c.text + ';padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">' + c.label + '</span>';
}

async function sendEmail(to, subject, html) {
  var t = getTransporter();
  if (!t) {
    console.log('Email skipped: SMTP not configured');
    return false;
  }
  
  try {
    var info = await t.sendMail({
      from: '"ShopNest" <shopnest.management@gmail.com>',
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

async function sendOrderConfirmation(userEmail, userName, order) {
  var itemsRows = order.items.map(function(item) {
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #F0F2F5;"><strong>' + item.name + '</strong><br><span style="color:#8B8FA3;font-size:12px;">Qty: ' + item.quantity + ' x $' + item.price.toFixed(2) + '</span></td><td style="text-align:right;font-weight:600;">$' + item.subtotal.toFixed(2) + '</td></tr>';
  }).join('');

  var content = '<p>Hi <strong>' + userName + '</strong>,</p><p>Thank you for your order! Your order has been confirmed.</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:20px;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">Order Number</td><td style="text-align:right;font-weight:600;font-size:14px;">#' + order.orderNumber + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Date</td><td style="text-align:right;font-weight:600;">' + new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Status</td><td style="text-align:right;">' + getOrderStatusBadge(order.status) + '</td></tr></table></div>' +
    '<h3 style="font-size:15px;">Order Summary</h3><table width="100%" style="margin-bottom:20px;">' + itemsRows + '</table>' +
    '<div style="background:#F8FAFC;border-radius:10px;padding:16px 20px;">' +
    '<table width="100%"><tr><td>Subtotal</td><td style="text-align:right;">$' + order.subtotal.toFixed(2) + '</td></tr>' +
    '<tr><td>Shipping</td><td style="text-align:right;">' + (order.shippingCost === 0 ? 'FREE' : '$' + order.shippingCost.toFixed(2)) + '</td></tr>' +
    (order.couponDiscount > 0 ? '<tr><td style="color:#16A34A;">Discount (' + order.couponCode + ')</td><td style="text-align:right;color:#16A34A;">-$' + order.couponDiscount.toFixed(2) + '</td></tr>' : '') +
    '<tr><td colspan="2" style="border-top:2px solid #E8ECF1;padding-top:8px;"></td></tr>' +
    '<tr><td style="font-weight:700;font-size:16px;">Total</td><td style="text-align:right;font-weight:700;font-size:16px;color:#0066FF;">$' + order.total.toFixed(2) + '</td></tr></table></div>';

  return sendEmail(userEmail, 'Order Confirmed - #' + order.orderNumber, getEmailTemplate('Order Confirmed! 🎉', content));
}

async function sendOrderStatusUpdate(userEmail, userName, order) {
  var statusMessages = {
    shipped: { title: '🚀 Your Order is On the Way!', msg: 'Great news! Your order has been shipped.' },
    delivered: { title: '📦 Order Delivered!', msg: 'Your order has been delivered. We hope you love it!' },
    cancelled: { title: 'Order Cancelled', msg: 'Your order has been cancelled.' }
  };
  var sm = statusMessages[order.status] || { title: 'Order Update', msg: 'Status updated to: ' + order.status };

  var content = '<p>Hi <strong>' + userName + '</strong>,</p><p>' + sm.msg + '</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">Order Number</td><td style="text-align:right;font-weight:600;">#' + order.orderNumber + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Status</td><td style="text-align:right;">' + getOrderStatusBadge(order.status) + '</td></tr></table></div>';

  return sendEmail(userEmail, 'Order Update - #' + order.orderNumber, getEmailTemplate(sm.title, content));
}

async function sendContactNotification(name, email, subject, message) {
  var content = '<p>New message from the contact form:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:16px;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">From</td><td style="text-align:right;font-weight:600;">' + name + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Email</td><td style="text-align:right;font-weight:600;color:#0066FF;">' + email + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Subject</td><td style="text-align:right;font-weight:600;">' + subject + '</td></tr></table></div>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:16px 20px;"><p style="color:#8B8FA3;font-size:12px;">Message:</p><p>' + message + '</p></div>' +
    '<div style="text-align:center;margin-top:20px;"><a href="mailto:' + email + '" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:25px;font-weight:600;">Reply to ' + name + '</a></div>';

  return sendEmail('shopnest.management@gmail.com', 'New message from ' + name + ' - ' + subject, getEmailTemplate('📬 New Contact Message', content));
}

async function sendNewsletterNotification(subscriberEmail) {
  var adminContent = '<p>A new user has subscribed to your newsletter:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:24px;text-align:center;">' +
    '<div style="font-size:40px;">📧</div><p style="font-size:18px;font-weight:700;">' + subscriberEmail + '</p>' +
    '<p style="color:#8B8FA3;font-size:13px;">Subscribed on ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p></div>';

  await sendEmail('shopnest.management@gmail.com', 'New Newsletter Subscriber: ' + subscriberEmail, getEmailTemplate('📰 New Subscriber!', adminContent));

  var welcomeContent = '<p>Welcome to the ShopNest family! 🎉</p><p>Thank you for subscribing. Here is your exclusive welcome discount:</p>' +
    '<div style="background:linear-gradient(135deg,#0066FF 0%,#00C2FF 100%);border-radius:12px;padding:28px 20px;text-align:center;margin-bottom:20px;">' +
    '<p style="color:rgba(255,255,255,0.8);font-size:13px;">YOUR DISCOUNT CODE</p>' +
    '<p style="color:#FFFFFF;font-size:32px;font-weight:700;letter-spacing:4px;">WELCOME15</p>' +
    '<p style="color:rgba(255,255,255,0.8);font-size:14px;">15% off your first order</p></div>' +
    '<p style="text-align:center;"><a href="/products" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:25px;font-weight:600;">Start Shopping</a></p>';

  await sendEmail(subscriberEmail, 'Welcome to ShopNest - 15% Off!', getEmailTemplate('Welcome to ShopNest! 🎁', welcomeContent));

  return true;
}

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate, sendContactNotification, sendNewsletterNotification };