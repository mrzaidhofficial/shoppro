/**
 * Email Service - ShopNest
 * Sends transactional emails using Nodemailer
 * Fails gracefully if email credentials are not configured
 */

var nodemailer = require('nodemailer');

var transporter = null;
var emailConfigured = false;

function setupTransporter() {
  if (transporter) return;
  
  var user = process.env.EMAIL_USER || '';
  var pass = process.env.EMAIL_PASS || '';
  
  if (!user || !pass) {
    console.log('Email service: No credentials configured. Emails will be skipped.');
    emailConfigured = false;
    return;
  }
  
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: user,
      pass: pass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
  
  emailConfigured = true;
  console.log('Email service: Transporter configured for ' + user);
}

async function sendOrderConfirmation(userEmail, userName, order) {
  setupTransporter();
  
  if (!emailConfigured) {
    console.log('Email skipped: No email credentials configured');
    return;
  }
  
  try {
    var itemsList = order.items.map(function(item) {
      return '<tr><td style="padding:8px;border-bottom:1px solid #eee;">' + item.name + ' x' + item.quantity + '</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$' + item.subtotal.toFixed(2) + '</td></tr>';
    }).join('');
    
    var html = `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
        <div style="background:#0066FF;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;">ShopNest</h1>
        </div>
        <div style="background:white;padding:24px;border:1px solid #eee;">
          <h2>Order Confirmed!</h2>
          <p>Thank you for your order, ${userName}!</p>
          <p><strong>Order #${order.orderNumber}</strong></p>
          <p>Date: ${order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            ${itemsList}
            <tr><td style="padding:8px;font-weight:bold;">Total</td><td style="padding:8px;text-align:right;font-weight:bold;">$${order.total.toFixed(2)}</td></tr>
          </table>
          <p>Your order is being processed and will be shipped soon.</p>
        </div>
        <div style="text-align:center;padding:16px;color:#888;font-size:12px;">
          <p>ShopNest - Your cozy curated marketplace</p>
        </div>
      </div>
    `;
    
    var info = await transporter.sendMail({
      from: '"ShopNest" <' + (process.env.EMAIL_USER || 'shopnest.management@gmail.com') + '>',
      to: userEmail,
      subject: 'Order Confirmed - #' + order.orderNumber,
      html: html
    });
    
    console.log('Order confirmation email sent to ' + userEmail + ' (ID: ' + info.messageId + ')');
  } catch (err) {
    console.error('Email send error (non-blocking):', err.message);
  }
}

async function sendOrderStatusUpdate(userEmail, userName, order) {
  setupTransporter();
  
  if (!emailConfigured) {
    console.log('Email skipped: No email credentials configured');
    return;
  }
  
  try {
    var statusMessages = {
      shipped: 'Your order has been shipped and is on its way!',
      delivered: 'Your order has been delivered. Enjoy!',
      cancelled: 'Your order has been cancelled.'
    };
    
    var html = `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
        <div style="background:#0066FF;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;">ShopNest</h1>
        </div>
        <div style="background:white;padding:24px;border:1px solid #eee;">
          <h2>Order Update</h2>
          <p>Hi ${userName},</p>
          <p><strong>Order #${order.orderNumber}</strong></p>
          <p>${statusMessages[order.status] || 'Your order status has been updated to: ' + order.status}</p>
        </div>
        <div style="text-align:center;padding:16px;color:#888;font-size:12px;">
          <p>ShopNest - Your cozy curated marketplace</p>
        </div>
      </div>
    `;
    
    var info = await transporter.sendMail({
      from: '"ShopNest" <' + (process.env.EMAIL_USER || 'shopnest.management@gmail.com') + '>',
      to: userEmail,
      subject: 'Order Update - #' + order.orderNumber,
      html: html
    });
    
    console.log('Status update email sent to ' + userEmail + ' (ID: ' + info.messageId + ')');
  } catch (err) {
    console.error('Email send error (non-blocking):', err.message);
  }
}

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate };