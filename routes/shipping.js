var express = require('express');
var router = express.Router();
var { ShippingSettings, OrderShipping } = require('../models/Shipping');
var Order = require('../models/Order');

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Admin access required');
    res.redirect('/auth/login');
}

async function getShippingSettings() {
    var settings = await ShippingSettings.findOne();
    if (!settings) {
        settings = new ShippingSettings({
            shippingEnabled: true,
            shippingType: 'flat_rate',
            flatRatePerItem: 5.99,
            flatRatePerOrder: 0,
            freeShippingEnabled: false,
            freeShippingMinAmount: 100,
            handlingFee: 0,
            estimatedDelivery: '7-21 business days',
            supplierInfo: ''
        });
        await settings.save();
    }
    return settings;
}

// Main shipping page with tabs
router.get('/settings', isAdmin, async function(req, res) {
    try {
        var settings = await getShippingSettings();
        
        var page = parseInt(req.query.page) || 1;
        var limit = 20;
        var skip = (page - 1) * limit;
        var filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        var ordersList = await Order.find(filter)
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        var totalOrders = await Order.countDocuments(filter);
        var totalPages = Math.ceil(totalOrders / limit);
        var orderIds = ordersList.map(function(o) { return o._id; });
        var shippingInfos = await OrderShipping.find({ order: { $in: orderIds } });
        var shippingMap = {};
        shippingInfos.forEach(function(si) { shippingMap[si.order.toString()] = si; });
        
        var bulkOrders = await Order.find({ status: { $in: ['processing', 'shipped'] } })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(100);
        var bulkOrderIds = bulkOrders.map(function(o) { return o._id; });
        var bulkShippingInfos = await OrderShipping.find({ order: { $in: bulkOrderIds } });
        var bulkShippingMap = {};
        bulkShippingInfos.forEach(function(si) { bulkShippingMap[si.order.toString()] = si; });
        
        res.render('admin/shipping/settings', {
            title: 'Shipping',
            settings: settings,
            ordersList: ordersList,
            shippingMap: shippingMap,
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            currentStatus: req.query.status || 'all',
            bulkOrders: bulkOrders,
            bulkShippingMap: bulkShippingMap
        });
    } catch (err) {
        console.error('Error loading shipping page:', err);
        req.flash('error', 'Error loading shipping page');
        res.redirect('/admin/dashboard');
    }
});

// Update Shipping Settings
router.post('/settings', isAdmin, async function(req, res) {
    try {
        var settings = await getShippingSettings();
        settings.shippingEnabled = req.body.shippingEnabled === 'on';
        settings.shippingType = req.body.shippingType;
        settings.flatRatePerItem = parseFloat(req.body.flatRatePerItem) || 0;
        settings.flatRatePerOrder = parseFloat(req.body.flatRatePerOrder) || 0;
        settings.freeShippingEnabled = req.body.freeShippingEnabled === 'on';
        settings.freeShippingMinAmount = parseFloat(req.body.freeShippingMinAmount) || 0;
        settings.handlingFee = parseFloat(req.body.handlingFee) || 0;
        settings.estimatedDelivery = req.body.estimatedDelivery || '7-21 business days';
        settings.supplierInfo = req.body.supplierInfo || '';
        settings.updatedAt = new Date();
        await settings.save();
        req.flash('success', 'Shipping settings updated successfully');
        res.redirect('/admin/shipping/settings');
    } catch (err) {
        console.error('Error updating shipping settings:', err);
        req.flash('error', 'Error updating shipping settings');
        res.redirect('/admin/shipping/settings');
    }
});

// Order Shipping List (redirects to tabbed page)
router.get('/orders', isAdmin, async function(req, res) {
    res.redirect('/admin/shipping/settings');
});

// Edit shipping for a specific order
router.get('/orders/:id', isAdmin, async function(req, res) {
    try {
        var order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/shipping/settings'); }
        var orderShipping = await OrderShipping.findOne({ order: req.params.id });
        var settings = await getShippingSettings();
        res.render('admin/shipping/order-detail', {
            title: 'Shipping Details - Order #' + order.orderNumber,
            order: order,
            orderShipping: orderShipping || {},
            settings: settings
        });
    } catch (err) {
        console.error('Error loading order shipping details:', err);
        req.flash('error', 'Error loading order details');
        res.redirect('/admin/shipping/settings');
    }
});

// Update shipping for a specific order
router.post('/orders/:id', isAdmin, async function(req, res) {
    try {
        var order = await Order.findById(req.params.id);
        if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/shipping/settings'); }
        
        var orderShipping = await OrderShipping.findOne({ order: req.params.id });
        if (!orderShipping) { orderShipping = new OrderShipping({ order: req.params.id }); }
        
        // Tracking & Supplier Info
        orderShipping.trackingNumber = req.body.trackingNumber || '';
        orderShipping.trackingUrl = req.body.trackingUrl || '';
        orderShipping.carrierName = req.body.carrierName || '';
        orderShipping.supplierName = req.body.supplierName || '';
        orderShipping.supplierOrderId = req.body.supplierOrderId || '';
        
        // Cost Tracking
        orderShipping.supplierProductCost = parseFloat(req.body.supplierProductCost) || 0;
        orderShipping.supplierShippingCost = parseFloat(req.body.supplierShippingCost) || 0;
        
        // Status
        orderShipping.shippingNotes = req.body.shippingNotes || '';
        orderShipping.shippingStatus = req.body.shippingStatus || 'pending';
        if (req.body.shippedDate) { orderShipping.shippedDate = new Date(req.body.shippedDate); }
        if (req.body.deliveredDate) { orderShipping.deliveredDate = new Date(req.body.deliveredDate); }
        
        await orderShipping.save();
        
        req.flash('success', 'Shipping details updated for Order #' + order.orderNumber);
        res.redirect('/admin/shipping/orders/' + req.params.id);
    } catch (err) {
        console.error('Error updating order shipping:', err);
        req.flash('error', 'Error updating shipping details');
        res.redirect('/admin/shipping/orders/' + req.params.id);
    }
});

// Bulk update
router.get('/bulk', isAdmin, async function(req, res) {
    res.redirect('/admin/shipping/settings');
});

router.post('/bulk', isAdmin, async function(req, res) {
    try {
        var orderIds = req.body.orderIds;
        if (!orderIds || orderIds.length === 0) { req.flash('error', 'No orders selected'); return res.redirect('/admin/shipping/settings'); }
        if (!Array.isArray(orderIds)) { orderIds = [orderIds]; }
        var updateCount = 0;
        for (var i = 0; i < orderIds.length; i++) {
            var orderId = orderIds[i];
            var orderShipping = await OrderShipping.findOne({ order: orderId });
            if (!orderShipping) { orderShipping = new OrderShipping({ order: orderId }); }
            if (req.body.trackingNumber && req.body.trackingNumber !== '') { orderShipping.trackingNumber = req.body.trackingNumber; }
            if (req.body.carrierName && req.body.carrierName !== '') { orderShipping.carrierName = req.body.carrierName; }
            if (req.body.supplierName && req.body.supplierName !== '') { orderShipping.supplierName = req.body.supplierName; }
            if (req.body.shippingStatus && req.body.shippingStatus !== '') { orderShipping.shippingStatus = req.body.shippingStatus; }
            await orderShipping.save();
            updateCount++;
        }
        req.flash('success', 'Bulk shipping updated for ' + updateCount + ' order(s)');
        res.redirect('/admin/shipping/settings');
    } catch (err) {
        console.error('Error processing bulk shipping:', err);
        req.flash('error', 'Error processing bulk shipping update');
        res.redirect('/admin/shipping/settings');
    }
});

module.exports = router;