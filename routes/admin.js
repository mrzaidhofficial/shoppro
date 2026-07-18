const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const emailService = require('../services/emailService');

// Configure multer for memory storage (images stored as Base64 in MongoDB)
const productUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: function(req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype.startsWith('image/');
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
});

// Helper: Convert file buffer to Base64 data URL
function bufferToBase64(buffer, mimetype) {
    return 'data:' + mimetype + ';base64,' + buffer.toString('base64');
}

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Admin access required');
    res.redirect('/auth/login');
};

// Admin Dashboard with Analytics
router.get('/dashboard', isAdmin, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        
        const customerIds = await Order.distinct('user');
        const totalCustomers = customerIds.length;
        const totalRegisteredUsers = await User.countDocuments({ role: 'customer' });
        const conversionRate = totalRegisteredUsers > 0 ? ((totalCustomers / totalRegisteredUsers) * 100).toFixed(1) : 0;
        
        const salesResult = await Order.aggregate([
            { $match: { status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $group: { _id: null, totalSales: { $sum: '$total' } } }
        ]);
        var totalSales = salesResult.length > 0 ? salesResult[0].totalSales : 0;
        
        const profitResult = await Order.aggregate([
            { $match: { status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $unwind: '$items' },
            { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productData' } },
            { $unwind: { path: '$productData', preserveNullAndEmptyArrays: true } },
            { $group: { 
                _id: '$_id',
                orderTotal: { $first: '$total' },
                shippingCost: { $first: '$shippingCost' },
                totalProductCost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$productData.cost', 0] }] } }
            } },
            { $group: {
                _id: null,
                totalRevenue: { $sum: '$orderTotal' },
                totalShippingCost: { $sum: '$shippingCost' },
                totalProductCost: { $sum: '$totalProductCost' }
            } }
        ]);
        
        var totalRevenue = 0;
        var totalProductCost = 0;
        var totalShippingCost = 0;
        if (profitResult.length > 0) {
            totalRevenue = profitResult[0].totalRevenue || 0;
            totalProductCost = profitResult[0].totalProductCost || 0;
            totalShippingCost = profitResult[0].totalShippingCost || 0;
        }
        var netProfit = totalRevenue - totalProductCost - totalShippingCost;
        
        const shippingStats = await Order.aggregate([
            { $match: { shippingCost: { $gt: 0 }, status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $group: { _id: null, totalShipping: { $sum: '$shippingCost' }, orderCount: { $sum: 1 } } }
        ]);
        const totalShippingCollected = shippingStats.length > 0 ? shippingStats[0].totalShipping : 0;
        const paidShippingOrders = shippingStats.length > 0 ? shippingStats[0].orderCount : 0;
        
        const couponStats = await Order.aggregate([
            { $match: { couponDiscount: { $gt: 0 }, status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $group: { _id: null, totalCoupons: { $sum: '$couponDiscount' }, orderCount: { $sum: 1 } } }
        ]);
        const totalCouponsGiven = couponStats.length > 0 ? couponStats[0].totalCoupons : 0;
        const couponOrderCount = couponStats.length > 0 ? couponStats[0].orderCount : 0;
        
        const recentOrders = await Order.find().populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(10);
        
        var sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlySales = await Order.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        const topProducts = await Order.aggregate([
            { $match: { status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
            { $sort: { totalSold: -1 } }, { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
            { $project: { name: '$product.name', totalSold: 1, revenue: 1 } }
        ]);
        
        const ordersByStatus = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            totalProducts,
            totalOrders,
            totalCustomers,
            totalRegisteredUsers,
            conversionRate,
            totalSales,
            totalRevenue: netProfit,
            totalShippingCollected,
            paidShippingOrders,
            totalCouponsGiven,
            couponOrderCount,
            avgOrderValue: 0,
            recentOrders,
            monthlySales,
            topProducts,
            ordersByStatus
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
});

// Products CRUD
router.get('/products', isAdmin, async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 });
    res.render('admin/products', { title: 'Manage Products', products });
});

router.get('/products/add', isAdmin, (req, res) => {
    res.render('admin/add-product', { title: 'Add Product' });
});

router.post('/products/add', isAdmin, productUpload.array('productImages', 10), async (req, res) => {
    try {
        var images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(function(file) {
                var dataUrl = bufferToBase64(file.buffer, file.mimetype);
                images.push(dataUrl);
            });
        }
        const product = new Product({ 
            name: req.body.name, 
            shortDescription: req.body.shortDescription || '', 
            description: req.body.description, 
            price: req.body.price, 
            cost: req.body.cost || 0, 
            category: req.body.category, 
            stock: req.body.stock, 
            featured: req.body.featured === 'on', 
            freeShipping: req.body.freeShipping === 'on', 
            images: images 
        });
        await product.save();
        req.flash('success', 'Product added successfully');
        res.redirect('/admin/products');
    } catch (error) { 
        console.error('Error adding product:', error);
        req.flash('error', 'Error adding product'); 
        res.redirect('/admin/products/add'); 
    }
});

router.get('/products/edit/:id', isAdmin, async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.render('admin/edit-product', { title: 'Edit Product', product });
});

router.post('/products/edit/:id', isAdmin, productUpload.array('productImages', 10), async (req, res) => {
    try {
        var product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/admin/products');
        }
        
        var images = [];
        
        // Keep existing images that were not removed
        if (req.body.existingImages) {
            if (Array.isArray(req.body.existingImages)) {
                images = req.body.existingImages;
            } else {
                images = [req.body.existingImages];
            }
        }
        
        // Add newly uploaded images as Base64
        if (req.files && req.files.length > 0) {
            req.files.forEach(function(file) {
                var dataUrl = bufferToBase64(file.buffer, file.mimetype);
                images.push(dataUrl);
            });
        }
        
        product.name = req.body.name;
        product.shortDescription = req.body.shortDescription || '';
        product.description = req.body.description;
        product.price = req.body.price;
        product.cost = req.body.cost || 0;
        product.category = req.body.category;
        product.stock = req.body.stock;
        product.featured = req.body.featured === 'on';
        product.freeShipping = req.body.freeShipping === 'on';
        product.images = images;
        
        if (product.cost && product.price) { 
            product.profit = product.price - product.cost; 
        }
        
        await product.save();
        req.flash('success', 'Product updated successfully');
        res.redirect('/admin/products');
    } catch (error) { 
        console.error('Error updating product:', error);
        req.flash('error', 'Error updating product'); 
        res.redirect('/admin/products'); 
    }
});

router.post('/products/delete/:id', isAdmin, async (req, res) => {
    try { 
        await Product.findByIdAndDelete(req.params.id); 
        req.flash('success', 'Product deleted'); 
        res.redirect('/admin/products'); 
    }
    catch (error) { 
        req.flash('error', 'Error deleting product'); 
        res.redirect('/admin/products'); 
    }
});

// Orders
router.get('/orders', isAdmin, async (req, res) => {
    const orders = await Order.find().populate('user', 'firstName lastName email').sort({ createdAt: -1 });
    res.render('admin/orders', { title: 'Manage Orders', orders });
});

router.post('/orders/update-status/:id', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) { req.flash('error', 'Invalid status'); return res.redirect('/admin/orders'); }
        await Order.findByIdAndUpdate(req.params.id, { status: status, updatedAt: new Date() });
        Order.findById(req.params.id).populate('user', 'firstName lastName email').then(function(updatedOrder) {
            if (updatedOrder && updatedOrder.user && updatedOrder.user.email) {
                emailService.sendOrderStatusUpdate(updatedOrder.user.email, updatedOrder.user.firstName, updatedOrder).catch(function(err) { console.error('Email failed:', err.message); });
            }
        }).catch(function(err) { console.error('Order lookup failed:', err.message); });
        req.flash('success', 'Order status updated to ' + status);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating order status'); res.redirect('/admin/orders'); }
});

router.post('/orders/bulk-update', isAdmin, async (req, res) => {
    try {
        const { orderIds, status } = req.body;
        if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) { req.flash('error', 'Invalid status'); return res.redirect('/admin/orders'); }
        if (!orderIds || orderIds.length === 0) { req.flash('error', 'No orders selected'); return res.redirect('/admin/orders'); }
        const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
        await Order.updateMany({ _id: { $in: ids } }, { status: status, updatedAt: new Date() });
        req.flash('success', ids.length + ' order(s) updated to ' + status);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating orders'); res.redirect('/admin/orders'); }
});

// Verify payment for bank transfer orders
router.post('/orders/verify-payment/:id', isAdmin, async (req, res) => {
    try {
        var order = await Order.findById(req.params.id);
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
        order.paymentVerified = true;
        order.updatedAt = new Date();
        await order.save();
        req.flash('success', 'Payment verified for Order #' + order.orderNumber + '. Change order status to Processing manually.');
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error verifying payment'); res.redirect('/admin/orders'); }
});

// Change payment verification status (for bank transfer)
router.post('/orders/payment-status/:id', isAdmin, async (req, res) => {
    try {
        var order = await Order.findById(req.params.id);
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
        var newStatus = req.body.paymentStatus;
        if (newStatus === 'verified') {
            order.paymentVerified = true;
        } else if (newStatus === 'unverified') {
            order.paymentVerified = false;
        }
        order.updatedAt = new Date();
        await order.save();
        req.flash('success', 'Payment status updated for Order #' + order.orderNumber);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating payment status'); res.redirect('/admin/orders'); }
});

// Card Payment Status Management (single dropdown + apply button)
router.post('/orders/card-payment-status/:id', isAdmin, async (req, res) => {
    try {
        var order = await Order.findById(req.params.id);
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
        
        var newStatus = req.body.cardPaymentStatus;
        
        if (newStatus === 'awaiting_link') {
            order.paymentLinkSent = false;
            order.paymentVerified = false;
        } else if (newStatus === 'link_sent') {
            order.paymentLinkSent = true;
            order.paymentVerified = false;
        } else if (newStatus === 'verified') {
            order.paymentLinkSent = true;
            order.paymentVerified = true;
        }
        
        order.updatedAt = new Date();
        await order.save();
        
        var statusLabel = newStatus === 'verified' ? 'Payment Verified' : (newStatus === 'link_sent' ? 'Link Sent' : 'Awaiting Link');
        req.flash('success', 'Card payment status updated to: ' + statusLabel + ' for Order #' + order.orderNumber);
        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error updating card payment status:', error);
        req.flash('error', 'Error updating card payment status');
        res.redirect('/admin/orders');
    }
});

// Mark payment link as sent (for card payments) - kept for backward compatibility
router.post('/orders/payment-link-sent/:id', isAdmin, async (req, res) => {
    try {
        var order = await Order.findById(req.params.id);
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
        order.paymentLinkSent = true;
        order.updatedAt = new Date();
        await order.save();
        req.flash('success', 'Payment link marked as sent for Order #' + order.orderNumber);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating payment link status'); res.redirect('/admin/orders'); }
});

// Bank Details Settings
router.get('/bank-details', isAdmin, async (req, res) => {
    try {
        var BankDetails = require('../models/BankDetails');
        var bankDetails = await BankDetails.findOne();
        if (!bankDetails) {
            bankDetails = new BankDetails();
            await bankDetails.save();
        }
        res.render('admin/bank-details', { title: 'Bank Details', bankDetails: bankDetails });
    } catch (error) {
        req.flash('error', 'Error loading bank details');
        res.redirect('/admin/dashboard');
    }
});

router.post('/bank-details', isAdmin, async (req, res) => {
    try {
        var BankDetails = require('../models/BankDetails');
        var bankDetails = await BankDetails.findOne();
        if (!bankDetails) {
            bankDetails = new BankDetails();
        }
        bankDetails.bankName = req.body.bankName || 'Sample Bank';
        bankDetails.bankBranch = req.body.bankBranch || 'Colombo';
        bankDetails.bankAccountName = req.body.bankAccountName || 'ShopNest (Pvt) Ltd';
        bankDetails.bankAccountNumber = req.body.bankAccountNumber || '1234567890';
        bankDetails.updatedAt = new Date();
        await bankDetails.save();
        req.flash('success', 'Bank details updated successfully');
        res.redirect('/admin/bank-details');
    } catch (err) {
        req.flash('error', 'Error updating bank details');
        res.redirect('/admin/bank-details');
    }
});

// Coupons
router.get('/coupons', isAdmin, async (req, res) => {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render('admin/coupons', { title: 'Manage Coupons', coupons });
});

router.get('/coupons/add', isAdmin, (req, res) => { res.render('admin/add-coupon', { title: 'Add Coupon' }); });

router.post('/coupons/add', isAdmin, async (req, res) => {
    try {
        var coupon = new Coupon({ code: req.body.code.trim().toUpperCase(), description: req.body.description || '', discountType: req.body.discountType, discountValue: req.body.discountValue, minPurchase: req.body.minPurchase || 0, maxDiscount: req.body.maxDiscount || null, usageLimit: req.body.usageLimit || null, expiryDate: req.body.expiryDate || null });
        await coupon.save();
        req.flash('success', 'Coupon created successfully');
        res.redirect('/admin/coupons');
    } catch (error) { req.flash('error', 'Error creating coupon'); res.redirect('/admin/coupons/add'); }
});

router.post('/coupons/delete/:id', isAdmin, async (req, res) => {
    try { await Coupon.findByIdAndDelete(req.params.id); req.flash('success', 'Coupon deleted'); }
    catch (error) { req.flash('error', 'Error deleting coupon'); }
    res.redirect('/admin/coupons');
});

router.post('/coupons/toggle/:id', isAdmin, async (req, res) => {
    try {
        var coupon = await Coupon.findById(req.params.id);
        coupon.isActive = !coupon.isActive; await coupon.save();
        req.flash('success', 'Coupon ' + (coupon.isActive ? 'activated' : 'deactivated'));
    } catch (error) { req.flash('error', 'Error toggling coupon'); }
    res.redirect('/admin/coupons');
});

// Admin Profile Settings
router.get('/settings', isAdmin, async (req, res) => {
    res.render('admin/settings', { title: 'Admin Settings' });
});

router.post('/settings/update-name', isAdmin, async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const user = await User.findById(req.session.user.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/settings');
        }
        user.firstName = firstName.trim();
        user.lastName = lastName.trim();
        await user.save();
        req.session.user.firstName = firstName.trim();
        req.session.user.lastName = lastName.trim();
        req.flash('success', 'Name updated successfully');
        res.redirect('/admin/settings');
    } catch (err) {
        console.error('Update name error:', err);
        req.flash('error', 'Error updating name');
        res.redirect('/admin/settings');
    }
});

router.post('/settings/update-email', isAdmin, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.session.user.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/settings');
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) { 
            req.flash('error', 'Current password is incorrect'); 
            return res.redirect('/admin/settings'); 
        }
        const existingUser = await User.findOne({ email: newEmail.trim().toLowerCase() });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            req.flash('error', 'Email already in use');
            return res.redirect('/admin/settings');
        }
        user.email = newEmail.trim().toLowerCase();
        await user.save();
        req.session.user.email = newEmail.trim().toLowerCase();
        req.flash('success', 'Email updated successfully');
        res.redirect('/admin/settings');
    } catch (err) { 
        console.error('Update email error:', err);
        req.flash('error', 'Error updating email'); 
        res.redirect('/admin/settings'); 
    }
});

router.post('/settings/update-password', isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/settings');
        }
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) { 
            req.flash('error', 'Current password is incorrect'); 
            return res.redirect('/admin/settings'); 
        }
        if (newPassword !== confirmPassword) { 
            req.flash('error', 'New passwords do not match'); 
            return res.redirect('/admin/settings'); 
        }
        if (newPassword.length < 6) { 
            req.flash('error', 'Password must be at least 6 characters'); 
            return res.redirect('/admin/settings'); 
        }
        user.password = newPassword;
        await user.save();
        req.flash('success', 'Password updated successfully');
        res.redirect('/admin/settings');
    } catch (err) { 
        console.error('Update password error:', err);
        req.flash('error', 'Error updating password'); 
        res.redirect('/admin/settings'); 
    }
});

module.exports = router;