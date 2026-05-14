/**
 * Payment Service - SHOPPRO
 * 
 * Currently uses a mock payment processor.
 * When PayPal launches in Sri Lanka, replace the logic inside
 * processPayment() with the PayPal API integration.
 * 
 * Expected PayPal flow:
 * 1. Get OAuth token from PayPal using Client ID & Secret
 * 2. Create PayPal order with cart details
 * 3. Customer approves payment on PayPal
 * 4. Capture the payment and return result
 */

const processPayment = async (orderData, paymentInfo) => {
    console.log('Processing payment for order:', orderData.orderId);
    console.log('Payment method:', paymentInfo.method);
    console.log('Amount:', orderData.amount);
    
    // Simulate payment processing delay (500ms)
    await new Promise(function(resolve) {
        setTimeout(resolve, 500);
    });
    
    // Return a successful mock transaction
    return {
        success: true,
        transactionId: 'TXN-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        status: 'completed',
        message: 'Payment processed successfully (mock)'
    };
};

/**
 * When PayPal is ready, add these functions:
 * 
 * const getPayPalAccessToken = async () => { ... };
 * const createPayPalOrder = async (token, orderData) => { ... };
 * const capturePayPalPayment = async (token, orderId) => { ... };
 * 
 * Store credentials in .env:
 * PAYPAL_CLIENT_ID=your_client_id
 * PAYPAL_CLIENT_SECRET=your_client_secret
 * PAYPAL_MODE=sandbox  (change to 'live' for real payments)
 */

module.exports = { processPayment };