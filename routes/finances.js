var express = require('express');
var router = express.Router();
var Order = require('../models/Order');
var Product = require('../models/Product');

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Admin access required');
    res.redirect('/auth/login');
}

// Main Finance Dashboard
router.get('/', isAdmin, async function(req, res) {
    try {
        var page = parseInt(req.query.page) || 1;
        var limit = 25;
        var skip = (page - 1) * limit;
        
        // Filters
        var filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        if (req.query.dateFrom || req.query.dateTo) {
            filter.createdAt = {};
            if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo + 'T23:59:59');
        }
        
        var totalOrders = await Order.countDocuments(filter);
        var totalPages = Math.ceil(totalOrders / limit);
        
        var orders = await Order.find(filter)
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get product costs for each order item
        for (var i = 0; i < orders.length; i++) {
            if (orders[i].items && orders[i].items.length > 0) {
                for (var j = 0; j < orders[i].items.length; j++) {
                    var item = orders[i].items[j];
                    if (item.product) {
                        var product = await Product.findById(item.product).select('cost');
                        item.cost = product ? (product.cost || 0) : 0;
                    } else {
                        item.cost = 0;
                    }
                }
            }
        }
        
        // Summary calculations for all filtered orders (not paginated)
        var allFilteredOrders = await Order.find(filter);
        var totalRevenue = 0;
        var totalProductCost = 0;
        var totalShippingCost = 0;
        var totalCoupons = 0;
        var totalNetProfit = 0;
        var totalItems = 0;
        
        for (var k = 0; k < allFilteredOrders.length; k++) {
            var order = allFilteredOrders[k];
            totalRevenue += order.total || 0;
            totalShippingCost += order.shippingCost || 0;
            totalCoupons += order.couponDiscount || 0;
            totalItems += order.items ? order.items.length : 0;
            
            if (order.items && order.items.length > 0) {
                for (var l = 0; l < order.items.length; l++) {
                    var orderItem = order.items[l];
                    if (orderItem.product) {
                        var prod = await Product.findById(orderItem.product).select('cost');
                        var itemCost = prod ? (prod.cost || 0) : 0;
                        totalProductCost += itemCost * orderItem.quantity;
                    }
                }
            }
        }
        
        totalNetProfit = totalRevenue - totalProductCost - totalShippingCost;
        
        res.render('admin/finances/index', {
            title: 'Finances',
            orders: orders,
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            currentStatus: req.query.status || 'all',
            currentDateFrom: req.query.dateFrom || '',
            currentDateTo: req.query.dateTo || '',
            // Summary stats
            totalRevenue: totalRevenue,
            totalProductCost: totalProductCost,
            totalShippingCost: totalShippingCost,
            totalCoupons: totalCoupons,
            totalNetProfit: totalNetProfit,
            totalItems: totalItems
        });
    } catch (err) {
        console.error('Finance dashboard error:', err);
        req.flash('error', 'Error loading finance data');
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;