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
    processing: { bg: '#FFF7ED', text: '#EA580C', label: 'Processing' },
    shipped: { bg: '#EFF6FF', text: '#2563EB', label: 'Shipped' },
    delivered: { bg: '#F0FDF4', text: '#16A34A', label: 'Delivered' },
    cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' }
  };
  var c = colors[status] || colors.processing;
  return '<span style="display:inline-block;background:' + c.bg + ';color:' + c.text + ';padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">' + c.label + '</span>';
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
  var content = '<p>New message from the contact form:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:20px;margin-bottom:16px;">' +
    '<table width="100%"><tr><td style="color:#8B8FA3;font-size:12px;">From</td><td style="text-align:right;font-weight:600;">' + name + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Email</td><td style="text-align:right;font-weight:600;color:#0066FF;">' + email + '</td></tr>' +
    '<tr><td style="color:#8B8FA3;font-size:12px;">Subject</td><td style="text-align:right;font-weight:600;">' + subject + '</td></tr></table></div>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:16px 20px;"><p style="color:#8B8FA3;font-size:12px;">Message:</p><p>' + message + '</p></div>' +
    '<div style="text-align:center;margin-top:20px;"><a href="mailto:' + email + '" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:25px;font-weight:600;">Reply to ' + name + '</a></div>';

  return sendViaApi({ to: getSenderEmail(), name: 'Admin', subject: 'New message from ' + name + ' - ' + subject, html: getEmailTemplate('📬 New Contact Message', content) });
}

async function sendNewsletterNotification(subscriberEmail) {
  var adminContent = '<p>A new user has subscribed to your newsletter:</p>' +
    '<div style="background:#F8FAFC;border:1px solid #E8ECF1;border-radius:12px;padding:24px;text-align:center;">' +
    '<div style="font-size:40px;">📧</div><p style="font-size:18px;font-weight:700;">' + subscriberEmail + '</p>' +
    '<p style="color:#8B8FA3;font-size:13px;">Subscribed on ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p></div>';

  await sendViaApi({ to: getSenderEmail(), name: 'Admin', subject: 'New Subscriber: ' + subscriberEmail, html: getEmailTemplate('📰 New Subscriber!', adminContent) });

  var welcomeContent = '<p>Welcome to the ShopNest family! 🎉</p><p>Thank you for subscribing to our newsletter. You will receive updates about new products, exclusive deals, and special offers straight to your inbox.</p>' +
    '<p>Stay tuned!</p>' +
    '<p style="text-align:center;margin-top:20px;"><a href="/products" style="display:inline-block;background:#0066FF;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:25px;font-weight:600;">Start Shopping</a></p>';

  await sendViaApi({ to: subscriberEmail, name: '', subject: 'Welcome to ShopNest!', html: getEmailTemplate('Welcome to ShopNest! 🎁', welcomeContent) });

  return true;
}

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate, sendContactNotification, sendNewsletterNotification };