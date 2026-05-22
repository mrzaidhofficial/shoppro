const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const emailService = require('../services/emailService');

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
            { $match: { shippingCost: { $gt: 0 } } },
            { $group: { _id: null, totalShipping: { $sum: '$shippingCost' }, orderCount: { $sum: 1 } } }
        ]);
        const totalShippingCollected = shippingStats.length > 0 ? shippingStats[0].totalShipping : 0;
        const paidShippingOrders = shippingStats.length > 0 ? shippingStats[0].orderCount : 0;
        
        const couponStats = await Order.aggregate([
            { $match: { couponDiscount: { $gt: 0 } } },
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

router.post('/products/add', isAdmin, async (req, res) => {
    try {
        var images = [];
        if (req.body.images) {
            if (Array.isArray(req.body.images)) images = req.body.images.filter(function(url) { return url.trim() !== ''; });
            else if (typeof req.body.images === 'string' && req.body.images.trim() !== '') images = [req.body.images.trim()];
        }
        const product = new Product({ name: req.body.name, shortDescription: req.body.shortDescription || '', description: req.body.description, price: req.body.price, cost: req.body.cost || 0, category: req.body.category, stock: req.body.stock, featured: req.body.featured === 'on', freeShipping: req.body.freeShipping === 'on', images: images });
        await product.save();
        req.flash('success', 'Product added successfully');
        res.redirect('/admin/products');
    } catch (error) { req.flash('error', 'Error adding product'); res.redirect('/admin/products/add'); }
});

router.get('/products/edit/:id', isAdmin, async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.render('admin/edit-product', { title: 'Edit Product', product });
});

router.post('/products/edit/:id', isAdmin, async (req, res) => {
    try {
        var images = [];
        if (req.body.images) {
            if (Array.isArray(req.body.images)) images = req.body.images.filter(function(url) { return url.trim() !== ''; });
            else if (typeof req.body.images === 'string' && req.body.images.trim() !== '') images = [req.body.images.trim()];
        }
        await Product.findByIdAndUpdate(req.params.id, { name: req.body.name, shortDescription: req.body.shortDescription || '', description: req.body.description, price: req.body.price, cost: req.body.cost || 0, category: req.body.category, stock: req.body.stock, featured: req.body.featured === 'on', freeShipping: req.body.freeShipping === 'on', images: images });
        var updatedProduct = await Product.findById(req.params.id);
        if (updatedProduct.cost && updatedProduct.price) { updatedProduct.profit = updatedProduct.price - updatedProduct.cost; await updatedProduct.save(); }
        req.flash('success', 'Product updated successfully');
        res.redirect('/admin/products');
    } catch (error) { req.flash('error', 'Error updating product'); res.redirect('/admin/products'); }
});

router.post('/products/delete/:id', isAdmin, async (req, res) => {
    try { await Product.findByIdAndDelete(req.params.id); req.flash('success', 'Product deleted'); res.redirect('/admin/products'); }
    catch (error) { req.flash('error', 'Error deleting product'); res.redirect('/admin/products'); }
});

// Orders
router.get('/orders', isAdmin, async (req, res) => {
    const orders = await Order.find().populate('user', 'firstName lastName email').sort({ createdAt: -1 });
    res.render('admin/orders', { title: 'Manage Orders', orders });
});

router.post('/orders/update-status/:id', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) { req.flash('error', 'Invalid status'); return res.redirect('/admin/orders'); }
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
        if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) { req.flash('error', 'Invalid status'); return res.redirect('/admin/orders'); }
        if (!orderIds || orderIds.length === 0) { req.flash('error', 'No orders selected'); return res.redirect('/admin/orders'); }
        const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
        await Order.updateMany({ _id: { $in: ids } }, { status: status, updatedAt: new Date() });
        req.flash('success', ids.length + ' order(s) updated to ' + status);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating orders'); res.redirect('/admin/orders'); }
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
        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();
        req.session.user.firstName = firstName;
        req.session.user.lastName = lastName;
        req.flash('success', 'Name updated successfully');
        res.redirect('/admin/settings');
    } catch (err) {
        req.flash('error', 'Error updating name');
        res.redirect('/admin/settings');
    }
});

router.post('/settings/update-email', isAdmin, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.session.user.id);
        const isMatch = await user.comparePassword(password);
        if (!isMatch) { req.flash('error', 'Current password is incorrect'); return res.redirect('/admin/settings'); }
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            req.flash('error', 'Email already in use');
            return res.redirect('/admin/settings');
        }
        user.email = newEmail;
        await user.save();
        req.session.user.email = newEmail;
        req.flash('success', 'Email updated successfully');
        res.redirect('/admin/settings');
    } catch (err) { req.flash('error', 'Error updating email'); res.redirect('/admin/settings'); }
});

router.post('/settings/update-password', isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user.id);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) { req.flash('error', 'Current password is incorrect'); return res.redirect('/admin/settings'); }
        if (newPassword !== confirmPassword) { req.flash('error', 'New passwords do not match'); return res.redirect('/admin/settings'); }
        if (newPassword.length < 6) { req.flash('error', 'Password must be at least 6 characters'); return res.redirect('/admin/settings'); }
        user.password = newPassword;
        await user.save();
        req.flash('success', 'Password updated successfully');
        res.redirect('/admin/settings');
    } catch (err) { req.flash('error', 'Error updating password'); res.redirect('/admin/settings'); }
});

module.exports = router;