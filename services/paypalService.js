/**
 * PayPal Service - ShopNest
 * Handles PayPal payment processing
 */

var paypalConfigured = false;

function isConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function getBaseUrl() {
  if (process.env.PAYPAL_MODE === 'live') {
    return 'https://api-m.paypal.com';
  }
  return 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  if (!isConfigured()) {
    throw new Error('PayPal credentials not configured');
  }
  
  var baseUrl = getBaseUrl();
  var auth = Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');
  
  var response = await fetch(baseUrl + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + auth
    },
    body: 'grant_type=client_credentials'
  });
  
  var data = await response.json();
  
  if (!response.ok) {
    throw new Error('PayPal auth failed: ' + (data.error_description || 'Unknown error'));
  }
  
  return data.access_token;
}

async function createOrder(orderData) {
  var accessToken = await getAccessToken();
  var baseUrl = getBaseUrl();
  
  var items = orderData.items.map(function(item) {
    return {
      name: item.name,
      quantity: item.quantity.toString(),
      unit_amount: {
        currency_code: 'USD',
        value: item.price.toFixed(2)
      }
    };
  });
  
  var breakdown = {
    item_total: {
      currency_code: 'USD',
      value: orderData.subtotal.toFixed(2)
    },
    shipping: {
      currency_code: 'USD',
      value: orderData.shipping.toFixed(2)
    },
    tax_total: {
      currency_code: 'USD',
      value: orderData.tax.toFixed(2)
    }
  };
  
  if (orderData.discount > 0) {
    breakdown.discount = {
      currency_code: 'USD',
      value: orderData.discount.toFixed(2)
    };
  }
  
  var paypalOrder = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: orderData.total.toFixed(2),
        breakdown: breakdown
      },
      items: items,
      description: 'Order from ShopNest'
    }]
  };
  
  var response = await fetch(baseUrl + '/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    },
    body: JSON.stringify(paypalOrder)
  });
  
  var data = await response.json();
  
  if (!response.ok) {
    throw new Error('PayPal order creation failed: ' + (data.message || 'Unknown error'));
  }
  
  return data;
}

async function capturePayment(orderId) {
  var accessToken = await getAccessToken();
  var baseUrl = getBaseUrl();
  
  var response = await fetch(baseUrl + '/v2/checkout/orders/' + orderId + '/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    }
  });
  
  var data = await response.json();
  
  if (!response.ok) {
    throw new Error('PayPal capture failed: ' + (data.message || 'Unknown error'));
  }
  
  return {
    success: true,
    transactionId: data.purchase_units[0].payments.captures[0].id,
    status: 'completed',
    paypalOrderId: data.id,
    payerEmail: data.payer.email_address
  };
}

module.exports = { isConfigured, createOrder, capturePayment };