/**
 * Email Service - ShopNest
 * Uses Mailjet REST API (HTTPS) - works on Railway
 */

var https = require('https');

function getAuth() {
  return 'Basic ' + Buffer.from(
    process.env.MAILJET_API_KEY + ':' + process.env.MAILJET_SECRET_KEY
  ).toString('base64');
}

function getSenderEmail() {
  return process.env.ADMIN_EMAIL || 'shopnest.management@gmail.com';
}

function sendViaApi(emailData) {
  return new Promise(function(resolve) {
    var apiKey = process.env.MAILJET_API_KEY;
    var secretKey = process.env.MAILJET_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      console.log('Email skipped: Mailjet API keys not configured');
      return resolve(false);
    }

    var data = JSON.stringify({
      Messages: [{
        From: { Email: getSenderEmail(), Name: 'ShopNest' },
        To: [{ Email: emailData.to, Name: emailData.name || '' }],
        Subject: emailData.subject,
        HTMLPart: emailData.html
      }]
    });

    var options = {
      hostname: 'api.mailjet.com',
      port: 443,
      path: '/v3.1/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuth(),
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 15000
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        if (res.statusCode === 200) {
          var result = JSON.parse(body);
          console.log('Email sent to ' + emailData.to + ' - Status: ' + result.Messages[0].Status);
          resolve(true);
        } else {
          console.error('Mailjet API error:', res.statusCode, body);
          resolve(false);
        }
      });
    });

    req.on('error', function(err) {
      console.error('Email send error:', err.message);
      resolve(false);
    });

    req.on('timeout', function() {
      console.error('Email send timeout');
      req.destroy();
      resolve(false);
    });

    req.write(data);
    req.end();
  });
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
    '<tr><td style="padding:24px 40px 32px;text-align:center;color:#8B8FA3;font-size:12px;">Need help? Reply to this email or contact us at <a href="mailto:' + getSenderEmail() + '" style="color:#0066FF;">' + getSenderEmail() + '</a><br><br>&copy; 2026 ShopNest. All rights reserved.</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function getOrderStatusBadge(status) {
  var colors = {
    pending: { bg: '#F1F5F9', text: '#64748B', label: 'Pending' },
    processing: { bg: '#FFF7ED', text: '#EA580C', label: 'Processing' },
    shipped: { bg: '#EFF6FF', text: '#2563EB', label: 'Shipped' },
    delivered: { bg: '#F0FDF4', text: '#16A34A', label: 'Delivered' },
    cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' }
  };
  var c = colors[status] || colors.pending;
  return '<span style="display:inline-block;background:' + c.bg + ';color:' + c.text + ';padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">' + c.label + '</span>';
}

function getPaymentMethodDisplay(method) {
  if (method === 'cod') return 'Cash on Delivery';
  if (method === 'bank_transfer') return 'Bank Transfer';
  if (method === 'card_payment') return 'Card Payment (HNB Accept)';
  return method;
}

async function sendOrderConfirmation(userEmail, userName, order) {
  var itemsRows = order.items.map(function(item) {
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #F0F2F5;"><strong>' + item.name + '</strong><br><span style="color:#8B8FA3;font-size:12px;">Qty: ' + item.quantity + ' x LKR ' + item.price.toFixed(2) + '</span></td><td style="text-align:right;font-weight:600;">LKR ' + item.subtotal.toFixed(2) + '</td></tr>';
  }).join('');

  var paymentInfo = '';
  if (order.paymentMethod === 'card_payment') {
    paymentInfo = '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px 18px;margin-top:16px;">' +
      '<p style="margin:0;font-size:13px;color:#1E40AF;"><strong>💳 Card Payment</strong></p>' +
      '<p style="margin:6px 0 0;font-size:12px;color:#3B82F6;">A secure payment link will be sent to your Email, SMS, and WhatsApp shortly. No payment receipt upload is needed.</p></div>';
  } else if (order.paymentMethod === 'bank_transfer') {
    paymentInfo = '<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px 18px;margin-top:16px;">' +
      '<p style="margin:0;font-size:13px;color:#5B21B6;"><strong>🏦 Bank Transfer</strong></p>' +
      '<p style="margin:6px 0 0;font-size:12px;color:#7C3AED;">Your payment receipt has been uploaded. We will verify your payment within 1-2 business hours.</p></div>';
  }

  var content = '<p>Hi <strong>' + userName + '</strong>,</p><p>Thank you for your order! Your order has been confirmed.</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:20px;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">Order Number</td><td style="text-align:right;font-weight:600;font-size:14px;">#' + order.orderNumber + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Date</td><td style="text-align:right;font-weight:600;">' + new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Payment</td><td style="text-align:right;font-weight:600;">' + getPaymentMethodDisplay(order.paymentMethod) + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Status</td><td style="text-align:right;">' + getOrderStatusBadge(order.status) + '</td></tr></table></div>' +
    '<h3 style="font-size:15px;">Order Summary</h3><table width="100%" style="margin-bottom:20px;">' + itemsRows + '</table>' +
    '<div style="background:#F8FAFC;border-radius:10px;padding:16px 20px;">' +
    '<table width="100%"><tr><td>Subtotal</td><td style="text-align:right;">LKR ' + order.subtotal.toFixed(2) + '</td></tr>' +
    '<tr><td>Shipping</td><td style="text-align:right;">' + (order.shippingCost === 0 ? 'FREE' : 'LKR ' + order.shippingCost.toFixed(2)) + '</td></tr>' +
    (order.couponDiscount > 0 ? '<tr><td style="color:#16A34A;">Discount (' + order.couponCode + ')</td><td style="text-align:right;color:#16A34A;">-LKR ' + order.couponDiscount.toFixed(2) + '</td></tr>' : '') +
    '<tr><td colspan="2" style="border-top:2px solid #E8ECF1;padding-top:8px;"></td></tr>' +
    '<tr><td style="font-weight:700;font-size:16px;">Total</td><td style="text-align:right;font-weight:700;font-size:16px;color:#0066FF;">LKR ' + order.total.toFixed(2) + '</td></tr></table></div>' +
    paymentInfo;

  return sendViaApi({ to: userEmail, name: userName, subject: 'Order Confirmed - #' + order.orderNumber, html: getEmailTemplate('Order Confirmed! 🎉', content) });
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

  return sendViaApi({ to: userEmail, name: userName, subject: 'Order Update - #' + order.orderNumber, html: getEmailTemplate(sm.title, content) });
}

async function sendContactNotification(name, email, subject, message) {
  var adminContent = '<p>New message from the contact form:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:16px;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">From</td><td style="text-align:right;font-weight:600;">' + name + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Email</td><td style="text-align:right;font-weight:600;color:#0066FF;">' + email + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Subject</td><td style="text-align:right;font-weight:600;">' + subject + '</td></tr></table></div>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:16px 20px;"><p style="color:#8B8FA3;font-size:12px;">Message:</p><p>' + message + '</p></div>' +
    '<div style="text-align:center;margin-top:20px;"><a href="mailto:' + email + '" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:25px;font-weight:600;">Reply to ' + name + '</a></div>';

  await sendViaApi({ to: getSenderEmail(), name: 'Admin', subject: 'New message from ' + name + ' - ' + subject, html: getEmailTemplate('📬 New Contact Message', adminContent) });

  var customerContent = '<p>Hi <strong>' + name + '</strong>,</p>' +
    '<p>Thank you for reaching out to ShopNest! We have received your message and our team will get back to you within <strong>24-48 hours</strong>.</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin:16px 0;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">Subject</td><td style="text-align:right;font-weight:600;">' + subject + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Your Message</td><td style="text-align:right;font-weight:500;font-size:12px;color:#475569;">' + (message.length > 100 ? message.substring(0, 100) + '...' : message) + '</td></tr></table></div>' +
    '<p>If you have any urgent questions, feel free to reply to this email or contact us directly at <a href="mailto:' + getSenderEmail() + '" style="color:#0066FF;">' + getSenderEmail() + '</a>.</p>' +
    '<p>We appreciate your patience and look forward to assisting you!</p>';

  await sendViaApi({ to: email, name: name, subject: 'We received your message - ShopNest', html: getEmailTemplate('📬 Message Received!', customerContent) });

  return true;
}

async function sendNewsletterNotification(subscriberEmail) {
  var adminContent = '<p>A new user has subscribed to your newsletter:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:24px;text-align:center;">' +
    '<div style="font-size:40px;">📧</div><p style="font-size:18px;font-weight:700;">' + subscriberEmail + '</p>' +
    '<p style="color:#8B8FA3;font-size:13px;">Subscribed on ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p></div>';

  await sendViaApi({ to: getSenderEmail(), name: 'Admin', subject: 'New Subscriber: ' + subscriberEmail, html: getEmailTemplate('📰 New Subscriber!', adminContent) });

  var welcomeContent = '<p>Welcome to the ShopNest family! 🎉</p>' +
    '<p>Thank you for subscribing to our newsletter. You will receive updates about <strong>new products</strong>, <strong>exclusive deals</strong>, and <strong>special offers</strong> straight to your inbox.</p>' +
    '<p>Stay tuned — exciting things are coming your way!</p>' +
    '<div style="text-align:center;margin:24px 0;">' +
    '<a href="https://shopnest-production.up.railway.app" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:25px;font-weight:600;">Visit ShopNest</a></div>' +
    '<p style="font-size:12px;color:#8B8FA3;">You can unsubscribe anytime by replying to this email.</p>';

  await sendViaApi({ to: subscriberEmail, name: '', subject: 'Welcome to ShopNest! 🎁', html: getEmailTemplate('Welcome to ShopNest! 🎁', welcomeContent) });

  return true;
}

async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  var resetUrl = 'https://shopnest-production.up.railway.app/auth/reset-password/' + resetToken;
  
  var content = '<p>Hi <strong>' + userName + '</strong>,</p>' +
    '<p>You requested a password reset for your ShopNest account. Click the button below to reset your password:</p>' +
    '<div style="text-align:center;margin:28px 0;">' +
    '<a href="' + resetUrl + '" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:25px;font-weight:600;font-size:15px;">Reset Password</a></div>' +
    '<p>Or copy and paste this link into your browser:</p>' +
    '<p style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:8px;padding:12px;font-size:12px;word-break:break-all;color:#3B82F6;">' + resetUrl + '</p>' +
    '<p style="margin-top:20px;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>';

  return sendViaApi({ to: userEmail, name: userName, subject: 'Reset Your Password - ShopNest', html: getEmailTemplate('Password Reset 🔐', content) });
}

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate, sendContactNotification, sendNewsletterNotification, sendPasswordResetEmail };