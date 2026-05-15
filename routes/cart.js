var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
var Order = require('../models/Order');
var Coupon = require('../models/Coupon');
var paymentService = require('../services/paymentService');
var emailService = require('../services/emailService');
var invoiceService = require('../services/invoiceService');

// View cart
router.get('/', function(req, res) {
    var cart = req.session.cart || [];
    var subtotal = 0;
    var cartItems = cart.map(function(item) {
        subtotal += item.price * item.quantity;
        return item;
    });
    var shipping = subtotal > 50 ? 0 : 5.99;
    var tax = subtotal * 0.08;
    var total = subtotal + shipping + tax;
    
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
        total = subtotal + shipping + tax - couponDiscount;
    }
    
    res.render('cart', {
        title: 'Shopping Cart',
        cartItems: cartItems,
        subtotal: subtotal.toFixed(2),
        shipping: shipping.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        couponDiscount: couponDiscount.toFixed(2),
        appliedCoupon: appliedCoupon
    });
});

// Apply coupon
router.post('/apply-coupon', async function(req, res) {
    try {
        var code = req.body.couponCode ? req.body.couponCode.trim().toUpperCase() : '';
        if (!code) {
            req.flash('error', 'Please enter a coupon code');
            return res.redirect('/cart');
        }
        
        var coupon = await Coupon.findOne({ code: code, isActive: true });
        if (!coupon) {
            req.flash('error', 'Invalid or expired coupon code');
            return res.redirect('/cart');
        }
        
        if (coupon.expiryDate && coupon.expiryDate < new Date()) {
            req.flash('error', 'This coupon has expired');
            return res.redirect('/cart');
        }
        
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            req.flash('error', 'This coupon has reached its usage limit');
            return res.redirect('/cart');
        }
        
        var cart = req.session.cart || [];
        var subtotal = cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
        
        if (coupon.minPurchase && subtotal < coupon.minPurchase) {
            req.flash('error', 'Minimum purchase of $' + coupon.minPurchase.toFixed(2) + ' required for this coupon');
            return res.redirect('/cart');
        }
        
        req.session.coupon = {
            _id: coupon._id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount
        };
        
        req.flash('success', 'Coupon "' + coupon.code + '" applied successfully!');
        
        req.session.save(function(err) {
            if (err) console.error('Session save error:', err);
            res.redirect('/cart');
        });
        
    } catch (err) {
        req.flash('error', 'Error applying coupon');
        res.redirect('/cart');
    }
});

// Remove coupon
router.get('/remove-coupon', function(req, res) {
    req.session.coupon = null;
    req.flash('success', 'Coupon removed');
    
    req.session.save(function(err) {
        if (err) console.error('Session save error:', err);
        res.redirect('/cart');
    });
});

// Add to cart
router.post('/add/:id', async function(req, res) {
    try {
        var product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/products');
        }
        if (!req.session.cart) req.session.cart = [];
        var existingItem = req.session.cart.find(function(item) {
            return item.productId === req.params.id;
        });
        if (existingItem) {
            existingItem.quantity += parseInt(req.body.quantity) || 1;
        } else {
            req.session.cart.push({
                productId: product._id.toString(),
                name: product.name,
                price: product.price,
                image: product.images && product.images[0] ? product.images[0] : '/images/placeholder.jpg',
                quantity: parseInt(req.body.quantity) || 1
            });
        }
        
        if (!req.session.recentlyViewed) req.session.recentlyViewed = [];
        req.session.recentlyViewed = req.session.recentlyViewed.filter(function(id) { return id !== req.params.id; });
        req.session.recentlyViewed.unshift(req.params.id);
        if (req.session.recentlyViewed.length > 6) req.session.recentlyViewed = req.session.recentlyViewed.slice(0, 6);
        
        req.flash('success', product.name + ' added to cart');
        
        req.session.save(function(err) {
            if (err) console.error('Session save error:', err);
            res.redirect(req.get('referer') || '/products');
        });
    } catch (err) {
        req.flash('error', 'Error adding to cart');
        res.redirect('/products');
    }
});

// Update quantity
router.post('/update/:id', function(req, res) {
    var quantity = parseInt(req.body.quantity);
    var cartItem = req.session.cart.find(function(item) {
        return item.productId === req.params.id;
    });
    if (cartItem) {
        if (quantity <= 0) {
            req.session.cart = req.session.cart.filter(function(item) {
                return item.productId !== req.params.id;
            });
        } else {
            cartItem.quantity = quantity;
        }
    }
    
    req.session.save(function(err) {
        if (err) console.error('Session save error:', err);
        res.redirect('/cart');
    });
});

// Remove from cart
router.post('/remove/:id', function(req, res) {
    req.session.cart = req.session.cart.filter(function(item) {
        return item.productId !== req.params.id;
    });
    req.flash('success', 'Item removed from cart');
    
    req.session.save(function(err) {
        if (err) console.error('Session save error:', err);
        res.redirect('/cart');
    });
});

// Cart count
router.get('/count', function(req, res) {
    var count = req.session.cart ? req.session.cart.length : 0;
    res.json({ count: count });
});

// Wishlist
router.get('/wishlist', async function(req, res) {
    if (!req.session.user) {
        req.flash('error', 'Please sign in to view your wishlist');
        return res.redirect('/auth/signin');
    }
    try {
        var Wishlist = require('../models/Wishlist');
        var wishlist = await Wishlist.findOne({ user: req.session.user.id }).populate('products');
        var wishlistProducts = wishlist ? wishlist.products : [];
        res.render('wishlist', { title: 'My Wishlist', wishlistProducts: wishlistProducts });
    } catch (err) {
        res.render('wishlist', { title: 'My Wishlist', wishlistProducts: [] });
    }
});

// Add to wishlist
router.post('/wishlist/add/:id', async function(req, res) {
    if (!req.session.user) {
        req.flash('error', 'Please sign in to add to wishlist');
        return res.redirect('/auth/signin');
    }
    try {
        var Wishlist = require('../models/Wishlist');
        var wishlist = await Wishlist.findOne({ user: req.session.user.id });
        if (!wishlist) {
            wishlist = new Wishlist({ user: req.session.user.id, products: [] });
        }
        var productId = req.params.id;
        var exists = wishlist.products.find(function(p) { return p.toString() === productId; });
        if (!exists) {
            wishlist.products.push(productId);
            await wishlist.save();
            req.flash('success', 'Added to wishlist!');
        } else {
            req.flash('error', 'Already in your wishlist');
        }
        res.redirect(req.get('referer') || '/products');
    } catch (err) {
        req.flash('error', 'Error adding to wishlist');
        res.redirect('/products');
    }
});

// Remove from wishlist
router.post('/wishlist/remove/:id', async function(req, res) {
    if (!req.session.user) return res.redirect('/auth/signin');
    try {
        var Wishlist = require('../models/Wishlist');
        var wishlist = await Wishlist.findOne({ user: req.session.user.id });
        if (wishlist) {
            wishlist.products = wishlist.products.filter(function(p) { return p.toString() !== req.params.id; });
            await wishlist.save();
            req.flash('success', 'Removed from wishlist');
        }
        res.redirect('/cart/wishlist');
    } catch (err) {
        res.redirect('/cart/wishlist');
    }
});

// Checkout page
router.get('/checkout', function(req, res) {
    if (!req.session.user) {
        req.flash('error', 'Please sign in to checkout');
        return res.redirect('/auth/signin');
    }
    var cart = req.session.cart || [];
    if (cart.length === 0) {
        req.flash('error', 'Your cart is empty');
        return res.redirect('/cart');
    }
    var subtotal = 0;
    var cartItems = cart.map(function(item) {
        subtotal += item.price * item.quantity;
        return item;
    });
    var shipping = subtotal > 50 ? 0 : 5.99;
    var tax = subtotal * 0.08;
    
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
    }
    
    var total = subtotal + shipping + tax - couponDiscount;
    
    res.render('checkout', {
        title: 'Checkout',
        cartItems: cartItems,
        subtotal: subtotal.toFixed(2),
        shipping: shipping.toFixed(2),
        tax: tax.toFixed(2),
        couponDiscount: couponDiscount.toFixed(2),
        total: total.toFixed(2),
        appliedCoupon: appliedCoupon
    });
});

// Process checkout
router.post('/checkout', async function(req, res) {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Please sign in' });
        }

        var cart = req.session.cart || [];
        if (cart.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        var subtotal = 0;
        var orderItems = [];

        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            var product = await Product.findById(item.productId);

            if (!product) {
                return res.status(400).json({ error: 'Product "' + item.name + '" is no longer available' });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({ error: 'Insufficient stock for ' + item.name });
            }

            var itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                product: product._id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: itemTotal
            });

            product.stock -= item.quantity;
            await product.save();
        }

        var shipping = subtotal > 50 ? 0 : 5.99;
        var tax = subtotal * 0.08;
        
        var couponDiscount = 0;
        var appliedCouponId = null;
        if (req.session.coupon) {
            var coupon = req.session.coupon;
            if (coupon.discountType === 'percentage') {
                couponDiscount = subtotal * (coupon.discountValue / 100);
                if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                    couponDiscount = coupon.maxDiscount;
                }
            } else {
                couponDiscount = coupon.discountValue;
            }
            if (couponDiscount > subtotal) couponDiscount = subtotal;
            appliedCouponId = coupon._id;
        }
        
        var total = subtotal + shipping + tax - couponDiscount;
        if (total < 0) total = 0;

        var shippingAddress = {
            street: 'N/A', city: 'N/A', state: 'N/A', zipCode: '00000', country: 'US'
        };

        if (req.body.shippingAddress) {
            shippingAddress = {
                street: req.body.shippingAddress.street || 'N/A',
                city: req.body.shippingAddress.city || 'N/A',
                state: req.body.shippingAddress.state || 'N/A',
                zipCode: req.body.shippingAddress.zipCode || '00000',
                country: req.body.shippingAddress.country || 'US'
            };
        }

        var paymentMethod = req.body.paymentMethod || 'credit_card';

        var order = new Order({
            user: req.session.user.id,
            items: orderItems,
            shippingAddress: shippingAddress,
            billingAddress: shippingAddress,
            paymentInfo: { method: paymentMethod, transactionId: 'PENDING', status: 'pending' },
            subtotal: subtotal,
            shippingCost: shipping,
            tax: tax,
            total: total,
            couponCode: req.session.coupon ? req.session.coupon.code : null,
            couponDiscount: couponDiscount,
            status: 'processing'
        });

        var paymentResult = await paymentService.processPayment({ orderId: order._id, amount: total, currency: 'USD' }, { method: paymentMethod });

        order.paymentInfo = { method: paymentMethod, transactionId: paymentResult.transactionId, status: paymentResult.status };
        await order.save();

        if (appliedCouponId) {
            await Coupon.findByIdAndUpdate(appliedCouponId, { $inc: { usedCount: 1 } });
        }

        // Send order confirmation email (non-blocking — fire and forget)
        var User = require('../models/User');
        User.findById(req.session.user.id).then(function(customer) {
            if (customer && customer.email) {
                emailService.sendOrderConfirmation(customer.email, customer.firstName, order).catch(function(err) {
                    console.error('Email failed (non-blocking):', err.message);
                });
            }
        }).catch(function(err) {
            console.error('Customer lookup failed:', err.message);
        });

        req.session.cart = [];
        req.session.coupon = null;

        res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber, transactionId: paymentResult.transactionId });

    } catch (err) {
        console.error('Checkout error:', err.message);
        res.status(500).json({ error: 'Checkout failed. Please try again.' });
    }
});

// Order confirmation page
router.get('/order-confirmation/:id', async function(req, res) {
    try {
        if (!req.session.user) {
            req.flash('error', 'Please sign in');
            return res.redirect('/auth/signin');
        }

        var order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');

        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/');
        }

        res.render('order-confirmation', { title: 'Order Confirmed - #' + order.orderNumber, order: order });

    } catch (err) {
        console.error('Order confirmation error:', err);
        req.flash('error', 'Error loading order details');
        res.redirect('/');
    }
});

// Download invoice PDF
router.get('/invoice/:id', async function(req, res) {
    try {
        if (!req.session.user) {
            req.flash('error', 'Please sign in');
            return res.redirect('/auth/signin');
        }

        var order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');

        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/');
        }

        invoiceService.generateInvoice(order, res);

    } catch (err) {
        console.error('Invoice error:', err);
        req.flash('error', 'Error generating invoice');
        res.redirect('/');
    }
});

module.exports = router;