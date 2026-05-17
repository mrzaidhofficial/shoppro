var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
var Order = require('../models/Order');
var Coupon = require('../models/Coupon');
var emailService = require('../services/emailService');
var invoiceService = require('../services/invoiceService');
var paypalService = require('../services/paypalService');

function calculateShipping(cartItems, products) {
  var shipping = 0;
  for (var i = 0; i < cartItems.length; i++) {
    var product = products.find(function(p) { return p._id.toString() === cartItems[i].productId; });
    if (!product || !product.freeShipping) {
      shipping += 5.99;
    }
  }
  return shipping;
}

// View cart
router.get('/', function(req, res) {
    var cart = req.session.cart || [];
    var subtotal = 0;
    var cartItems = cart.map(function(item) {
        subtotal += item.price * item.quantity;
        return item;
    });
    var shipping = req.session.cartShipping || 0;
    var total = subtotal + shipping;
    
    var couponDiscount = 0;
    var appliedCoupon = null;
    if (req.session.coupon) {
        appliedCoupon = req.session.coupon;
        if (appliedCoupon.discountType === 'percentage') {
            couponDiscount = subtotal * (appliedCoupon.discountValue / 100);
            if (appliedCoupon.maxDiscount && couponDiscount > appliedCoupon.maxDiscount) {
                couponDiscount = appliedCoupon.maxDiscount;
            }
        } else {
            couponDiscount = appliedCoupon.discountValue;
        }
        if (couponDiscount > subtotal) couponDiscount = subtotal;
        total = subtotal + shipping - couponDiscount;
    }
    
    res.render('cart', {
        title: 'Shopping Cart',
        cartItems: cartItems,
        subtotal: subtotal.toFixed(2),
        shipping: shipping.toFixed(2),
        total: total.toFixed(2),
        couponDiscount: couponDiscount.toFixed(2),
        appliedCoupon: appliedCoupon
    });
});

// Apply coupon
router.post('/apply-coupon', async function(req, res) {
    try {
        var code = req.body.couponCode ? req.body.couponCode.trim().toUpperCase() : '';
        if (!code) { req.flash('error', 'Please enter a coupon code'); return res.redirect('/cart'); }
        var coupon = await Coupon.findOne({ code: code, isActive: true });
        if (!coupon) { req.flash('error', 'Invalid or expired coupon code'); return res.redirect('/cart'); }
        if (coupon.expiryDate && coupon.expiryDate < new Date()) { req.flash('error', 'This coupon has expired'); return res.redirect('/cart'); }
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) { req.flash('error', 'This coupon has reached its usage limit'); return res.redirect('/cart'); }
        var cart = req.session.cart || [];
        var subtotal = cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
        if (coupon.minPurchase && subtotal < coupon.minPurchase) { req.flash('error', 'Minimum purchase of $' + coupon.minPurchase.toFixed(2) + ' required'); return res.redirect('/cart'); }
        req.session.coupon = { _id: coupon._id, code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, maxDiscount: coupon.maxDiscount };
        req.flash('success', 'Coupon "' + coupon.code + '" applied!');
        req.session.save(function(err) { if (err) console.error('Session save error:', err); res.redirect('/cart'); });
    } catch (err) { req.flash('error', 'Error applying coupon'); res.redirect('/cart'); }
});

// Remove coupon
router.get('/remove-coupon', function(req, res) {
    req.session.coupon = null; req.flash('success', 'Coupon removed');
    req.session.save(function(err) { if (err) console.error('Session save error:', err); res.redirect('/cart'); });
});

// Add to cart
router.post('/add/:id', async function(req, res) {
    try {
        var product = await Product.findById(req.params.id);
        if (!product) { req.flash('error', 'Product not found'); return res.redirect('/products'); }
        if (!req.session.cart) req.session.cart = [];
        var existingItem = req.session.cart.find(function(item) { return item.productId === req.params.id; });
        if (existingItem) { existingItem.quantity += parseInt(req.body.quantity) || 1; }
        else { req.session.cart.push({ productId: product._id.toString(), name: product.name, price: product.price, image: product.images && product.images[0] ? product.images[0] : '/images/placeholder.jpg', quantity: parseInt(req.body.quantity) || 1 }); }
        
        var productIds = req.session.cart.map(function(item) { return item.productId; });
        var products = await Product.find({ _id: { $in: productIds } });
        req.session.cartShipping = calculateShipping(req.session.cart, products);
        
        if (!req.session.recentlyViewed) req.session.recentlyViewed = [];
        req.session.recentlyViewed = req.session.recentlyViewed.filter(function(id) { return id !== req.params.id; });
        req.session.recentlyViewed.unshift(req.params.id);
        if (req.session.recentlyViewed.length > 6) req.session.recentlyViewed = req.session.recentlyViewed.slice(0, 6);
        req.flash('success', product.name + ' added to cart');
        req.session.save(function(err) { if (err) console.error('Session save error:', err); res.redirect(req.get('referer') || '/products'); });
    } catch (err) { req.flash('error', 'Error adding to cart'); res.redirect('/products'); }
});

// Update quantity
router.post('/update/:id', async function(req, res) {
    var quantity = parseInt(req.body.quantity);
    var cartItem = req.session.cart.find(function(item) { return item.productId === req.params.id; });
    if (cartItem) {
        if (quantity <= 0) { req.session.cart = req.session.cart.filter(function(item) { return item.productId !== req.params.id; }); }
        else { cartItem.quantity = quantity; }
    }
    var productIds = req.session.cart.map(function(item) { return item.productId; });
    var products = await Product.find({ _id: { $in: productIds } });
    req.session.cartShipping = calculateShipping(req.session.cart, products);
    req.session.save(function(err) { if (err) console.error('Session save error:', err); res.redirect('/cart'); });
});

// Remove from cart
router.post('/remove/:id', async function(req, res) {
    req.session.cart = req.session.cart.filter(function(item) { return item.productId !== req.params.id; });
    var productIds = (req.session.cart || []).map(function(item) { return item.productId; });
    var products = await Product.find({ _id: { $in: productIds } });
    req.session.cartShipping = calculateShipping(req.session.cart || [], products);
    req.flash('success', 'Item removed from cart');
    req.session.save(function(err) { if (err) console.error('Session save error:', err); res.redirect('/cart'); });
});

// Cart count
router.get('/count', function(req, res) {
    var count = req.session.cart ? req.session.cart.length : 0;
    res.json({ count: count });
});

// Wishlist
router.get('/wishlist', async function(req, res) {
    if (!req.session.user) { req.flash('error', 'Please sign in'); return res.redirect('/auth/signin'); }
    try {
        var Wishlist = require('../models/Wishlist');
        var wishlist = await Wishlist.findOne({ user: req.session.user.id }).populate('products');
        res.render('wishlist', { title: 'My Wishlist', wishlistProducts: wishlist ? wishlist.products : [] });
    } catch (err) { res.render('wishlist', { title: 'My Wishlist', wishlistProducts: [] }); }
});

router.post('/wishlist/add/:id', async function(req, res) {
    if (!req.session.user) { req.flash('error', 'Please sign in'); return res.redirect('/auth/signin'); }
    try {
        var Wishlist = require('../models/Wishlist');
        var wishlist = await Wishlist.findOne({ user: req.session.user.id });
        if (!wishlist) wishlist = new Wishlist({ user: req.session.user.id, products: [] });
        if (!wishlist.products.find(function(p) { return p.toString() === req.params.id; })) {
            wishlist.products.push(req.params.id); await wishlist.save(); req.flash('success', 'Added to wishlist!');
        } else { req.flash('error', 'Already in your wishlist'); }
        res.redirect(req.get('referer') || '/products');
    } catch (err) { req.flash('error', 'Error adding to wishlist'); res.redirect('/products'); }
});

router.post('/wishlist/remove/:id', async function(req, res) {
    if (!req.session.user) return res.redirect('/auth/signin');
    try {
        var Wishlist = require('../models/Wishlist');
        var wishlist = await Wishlist.findOne({ user: req.session.user.id });
        if (wishlist) { wishlist.products = wishlist.products.filter(function(p) { return p.toString() !== req.params.id; }); await wishlist.save(); req.flash('success', 'Removed from wishlist'); }
        res.redirect('/cart/wishlist');
    } catch (err) { res.redirect('/cart/wishlist'); }
});

// Checkout page
router.get('/checkout', async function(req, res) {
    if (!req.session.user) { req.flash('error', 'Please sign in'); return res.redirect('/auth/signin'); }
    var cart = req.session.cart || [];
    if (cart.length === 0) { req.flash('error', 'Your cart is empty'); return res.redirect('/cart'); }
    var subtotal = 0;
    var cartItems = cart.map(function(item) { subtotal += item.price * item.quantity; return item; });
    var shipping = req.session.cartShipping || 0;
    var couponDiscount = 0; var appliedCoupon = null;
    if (req.session.coupon) {
        appliedCoupon = req.session.coupon;
        if (appliedCoupon.discountType === 'percentage') { couponDiscount = subtotal * (appliedCoupon.discountValue / 100); if (appliedCoupon.maxDiscount && couponDiscount > appliedCoupon.maxDiscount) couponDiscount = appliedCoupon.maxDiscount; }
        else { couponDiscount = appliedCoupon.discountValue; }
        if (couponDiscount > subtotal) couponDiscount = subtotal;
    }
    var total = subtotal + shipping - couponDiscount;
    res.render('checkout', { title: 'Checkout', cartItems: cartItems, subtotal: subtotal.toFixed(2), shipping: shipping.toFixed(2), total: total.toFixed(2), couponDiscount: couponDiscount.toFixed(2), appliedCoupon: appliedCoupon, paypalConfigured: paypalService.isConfigured() });
});

// PayPal Create Order
router.post('/paypal/create-order', async function(req, res) {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Please sign in' });
        var cart = req.session.cart || [];
        if (cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
        var subtotal = 0;
        var items = cart.map(function(item) { subtotal += item.price * item.quantity; return { name: item.name, quantity: item.quantity, price: item.price }; });
        var shipping = req.session.cartShipping || 0;
        var discount = 0;
        if (req.session.coupon) {
            var coupon = req.session.coupon;
            if (coupon.discountType === 'percentage') { discount = subtotal * (coupon.discountValue / 100); if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount; }
            else { discount = coupon.discountValue; }
            if (discount > subtotal) discount = subtotal;
        }
        var total = subtotal + shipping - discount; if (total < 0) total = 0;
        var paypalOrder = await paypalService.createOrder({ items: items, subtotal: subtotal, shipping: shipping, tax: 0, discount: discount, total: total });
        req.session.pendingOrder = { paypalOrderId: paypalOrder.id, subtotal: subtotal, shipping: shipping, tax: 0, discount: discount, total: total, items: items };
        req.session.save(function(err) { if (err) console.error('Session save error:', err); res.json({ id: paypalOrder.id }); });
    } catch (err) { console.error('PayPal create order error:', err.message); res.status(500).json({ error: 'Failed to create PayPal order' }); }
});

// PayPal Capture
router.post('/paypal/capture-payment', async function(req, res) {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Please sign in' });
        var pendingOrder = req.session.pendingOrder;
        if (!pendingOrder) return res.status(400).json({ error: 'No pending order found' });
        var captureResult = await paypalService.capturePayment(req.body.orderID);
        var cart = req.session.cart || []; var orderItems = [];
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i]; var product = await Product.findById(item.productId);
            if (product && product.stock >= item.quantity) { product.stock -= item.quantity; await product.save(); }
            if (product) orderItems.push({ product: product._id, name: item.name, price: item.price, quantity: item.quantity, subtotal: item.price * item.quantity });
        }
        var shippingAddress = req.body.shippingAddress || { street: 'N/A', city: 'N/A', state: 'N/A', zipCode: '00000', country: 'US' };
        var order = new Order({
            user: req.session.user.id, items: orderItems, shippingAddress: shippingAddress, billingAddress: shippingAddress,
            paymentInfo: { method: 'paypal', transactionId: captureResult.transactionId, status: 'completed', paypalOrderId: captureResult.paypalOrderId, payerEmail: captureResult.payerEmail },
            subtotal: pendingOrder.subtotal, shippingCost: pendingOrder.shipping, tax: 0, total: pendingOrder.total,
            couponCode: req.session.coupon ? req.session.coupon.code : null, couponDiscount: pendingOrder.discount, status: 'processing'
        });
        await order.save();
        if (req.session.coupon) await Coupon.findByIdAndUpdate(req.session.coupon._id, { $inc: { usedCount: 1 } });
        var User = require('../models/User');
        User.findById(req.session.user.id).then(function(customer) { if (customer && customer.email) emailService.sendOrderConfirmation(customer.email, customer.firstName, order).catch(function(err) { console.error('Email failed:', err.message); }); }).catch(function(err) { console.error('Customer lookup failed:', err.message); });
        req.session.cart = []; req.session.coupon = null; req.session.pendingOrder = null; req.session.cartShipping = 0;
        res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber });
    } catch (err) { console.error('PayPal capture error:', err.message); res.status(500).json({ error: 'Payment failed' }); }
});

// Mock checkout
router.post('/checkout', async function(req, res) {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Please sign in' });
        var cart = req.session.cart || [];
        if (cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
        var subtotal = 0; var orderItems = [];
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i]; var product = await Product.findById(item.productId);
            if (!product) return res.status(400).json({ error: 'Product "' + item.name + '" is no longer available' });
            if (product.stock < item.quantity) return res.status(400).json({ error: 'Insufficient stock for ' + item.name });
            var itemTotal = item.price * item.quantity; subtotal += itemTotal;
            orderItems.push({ product: product._id, name: item.name, price: item.price, quantity: item.quantity, subtotal: itemTotal });
            product.stock -= item.quantity; await product.save();
        }
        var shipping = req.session.cartShipping || 0;
        var couponDiscount = 0; var appliedCouponId = null;
        if (req.session.coupon) {
            var coupon = req.session.coupon;
            if (coupon.discountType === 'percentage') { couponDiscount = subtotal * (coupon.discountValue / 100); if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) couponDiscount = coupon.maxDiscount; }
            else { couponDiscount = coupon.discountValue; }
            if (couponDiscount > subtotal) couponDiscount = subtotal; appliedCouponId = coupon._id;
        }
        var total = subtotal + shipping - couponDiscount; if (total < 0) total = 0;
        var shippingAddress = req.body.shippingAddress || { street: 'N/A', city: 'N/A', state: 'N/A', zipCode: '00000', country: 'US' };
        var order = new Order({
            user: req.session.user.id, items: orderItems, shippingAddress: shippingAddress, billingAddress: shippingAddress,
            paymentInfo: { method: req.body.paymentMethod || 'credit_card', transactionId: 'TXN-' + Date.now(), status: 'completed' },
            subtotal: subtotal, shippingCost: shipping, tax: 0, total: total,
            couponCode: req.session.coupon ? req.session.coupon.code : null, couponDiscount: couponDiscount, status: 'processing'
        });
        await order.save();
        if (appliedCouponId) await Coupon.findByIdAndUpdate(appliedCouponId, { $inc: { usedCount: 1 } });
        var User = require('../models/User');
        User.findById(req.session.user.id).then(function(customer) { if (customer && customer.email) emailService.sendOrderConfirmation(customer.email, customer.firstName, order).catch(function(err) { console.error('Email failed:', err.message); }); }).catch(function(err) { console.error('Customer lookup failed:', err.message); });
        req.session.cart = []; req.session.coupon = null; req.session.cartShipping = 0;
        res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber });
    } catch (err) { console.error('Checkout error:', err.message); res.status(500).json({ error: 'Checkout failed' }); }
});

// Order confirmation
router.get('/order-confirmation/:id', async function(req, res) {
    try {
        if (!req.session.user) { req.flash('error', 'Please sign in'); return res.redirect('/auth/signin'); }
        var order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/'); }
        res.render('order-confirmation', { title: 'Order Confirmed - #' + order.orderNumber, order: order });
    } catch (err) { console.error('Order confirmation error:', err); req.flash('error', 'Error loading order details'); res.redirect('/'); }
});

// Download invoice
router.get('/invoice/:id', async function(req, res) {
    try {
        if (!req.session.user) { req.flash('error', 'Please sign in'); return res.redirect('/auth/signin'); }
        var order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');
        if (!order) order = await Order.findOne({ orderNumber: req.params.id }).populate('user', 'firstName lastName email');
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/'); }
        invoiceService.generateInvoice(order, res);
    } catch (err) { console.error('Invoice error:', err); req.flash('error', 'Error generating invoice'); res.redirect('/'); }
});

module.exports = router;