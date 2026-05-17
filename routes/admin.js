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
        
        // Count only users who have placed at least one order
        const customerIds = await Order.distinct('user');
        const totalCustomers = customerIds.length;
        
        // Total registered users
        const totalRegisteredUsers = await User.countDocuments({ role: 'customer' });
        
        // Conversion Rate
        const conversionRate = totalRegisteredUsers > 0 
            ? ((totalCustomers / totalRegisteredUsers) * 100).toFixed(1) 
            : 0;
        
        // Total Sales = Cost + Profit + Shipping - Coupons (all orders)
        const salesResult = await Order.aggregate([
            { $unwind: '$items' },
            { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productData' } },
            { $unwind: { path: '$productData', preserveNullAndEmptyArrays: true } },
            { $group: {
                _id: null,
                totalCost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$productData.cost', 0] }] } },
                totalProfit: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$productData.profit', 0] }] } },
                totalShipping: { $sum: '$shippingCost' },
                totalCoupons: { $sum: { $ifNull: ['$couponDiscount', 0] } }
            } }
        ]);
        var totalSales = 0;
        if (salesResult.length > 0) {
            totalSales = (salesResult[0].totalCost || 0) + (salesResult[0].totalProfit || 0) + (salesResult[0].totalShipping || 0) - (salesResult[0].totalCoupons || 0);
        }
        
        // Total Revenue = Net Profit from paid orders (processing, shipped, delivered)
        const revenueResult = await Order.aggregate([
            { $match: { status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $unwind: '$items' },
            { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productData' } },
            { $unwind: { path: '$productData', preserveNullAndEmptyArrays: true } },
            { $group: { 
                _id: null, 
                totalProfit: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$productData.profit', 0] }] } },
                avgOrder: { $avg: '$total' },
                count: { $sum: 1 }
            } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalProfit : 0;
        const avgOrderValue = revenueResult.length > 0 ? revenueResult[0].avgOrder : 0;
        
        const recentOrders = await Order.find().populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(10);
        
        var sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlySales = await Order.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        const topProducts = await Order.aggregate([
            { $match: { status: { $in: ['processing', 'shipped', 'delivered'] } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
            { $sort: { totalSold: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
            { $project: { name: '$product.name', totalSold: 1, revenue: 1 } }
        ]);
        
        const ordersByStatus = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            totalProducts,
            totalOrders,
            totalCustomers,
            totalRegisteredUsers,
            conversionRate,
            totalSales,
            totalRevenue,
            avgOrderValue,
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
        await Product.findByIdAndUpdate(req.params.id, {
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
        // Recalculate profit
        var updatedProduct = await Product.findById(req.params.id);
        if (updatedProduct.cost && updatedProduct.price) {
            updatedProduct.profit = updatedProduct.price - updatedProduct.cost;
            await updatedProduct.save();
        }
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
        if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            req.flash('error', 'Invalid status'); return res.redirect('/admin/orders');
        }
        await Order.findByIdAndUpdate(req.params.id, { status: status, updatedAt: new Date() });
        
        // Send status update email (non-blocking)
        Order.findById(req.params.id).populate('user', 'firstName lastName email').then(function(updatedOrder) {
            if (updatedOrder && updatedOrder.user && updatedOrder.user.email) {
                emailService.sendOrderStatusUpdate(updatedOrder.user.email, updatedOrder.user.firstName, updatedOrder).catch(function(err) {
                    console.error('Email failed (non-blocking):', err.message);
                });
            }
        }).catch(function(err) {
            console.error('Order lookup failed:', err.message);
        });
        
        req.flash('success', 'Order status updated to ' + status);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating order status'); res.redirect('/admin/orders'); }
});

router.post('/orders/bulk-update', isAdmin, async (req, res) => {
    try {
        const { orderIds, status } = req.body;
        if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            req.flash('error', 'Invalid status selected'); return res.redirect('/admin/orders');
        }
        if (!orderIds || orderIds.length === 0) { req.flash('error', 'No orders selected'); return res.redirect('/admin/orders'); }
        const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
        await Order.updateMany({ _id: { $in: ids } }, { status: status, updatedAt: new Date() });
        req.flash('success', ids.length + ' order(s) updated to ' + status);
        res.redirect('/admin/orders');
    } catch (error) { req.flash('error', 'Error updating orders'); res.redirect('/admin/orders'); }
});

// Coupons Management
router.get('/coupons', isAdmin, async (req, res) => {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render('admin/coupons', { title: 'Manage Coupons', coupons });
});

router.get('/coupons/add', isAdmin, (req, res) => {
    res.render('admin/add-coupon', { title: 'Add Coupon' });
});

router.post('/coupons/add', isAdmin, async (req, res) => {
    try {
        var coupon = new Coupon({
            code: req.body.code.trim().toUpperCase(),
            description: req.body.description || '',
            discountType: req.body.discountType,
            discountValue: req.body.discountValue,
            minPurchase: req.body.minPurchase || 0,
            maxDiscount: req.body.maxDiscount || null,
            usageLimit: req.body.usageLimit || null,
            expiryDate: req.body.expiryDate || null
        });
        await coupon.save();
        req.flash('success', 'Coupon created successfully');
        res.redirect('/admin/coupons');
    } catch (error) {
        req.flash('error', 'Error creating coupon. Code may already exist.');
        res.redirect('/admin/coupons/add');
    }
});

router.post('/coupons/delete/:id', isAdmin, async (req, res) => {
    try { await Coupon.findByIdAndDelete(req.params.id); req.flash('success', 'Coupon deleted'); }
    catch (error) { req.flash('error', 'Error deleting coupon'); }
    res.redirect('/admin/coupons');
});

router.post('/coupons/toggle/:id', isAdmin, async (req, res) => {
    try {
        var coupon = await Coupon.findById(req.params.id);
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        req.flash('success', 'Coupon ' + (coupon.isActive ? 'activated' : 'deactivated'));
    } catch (error) { req.flash('error', 'Error toggling coupon'); }
    res.redirect('/admin/coupons');
});

module.exports = router;