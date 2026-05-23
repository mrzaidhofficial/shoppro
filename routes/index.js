var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
var Order = require('../models/Order');
var { OrderShipping } = require('../models/Shipping');

router.get('/', async function(req, res) {
  try {
    var featuredProducts = await Product.find({ featured: true }).limit(8);
    var newArrivals = await Product.find().sort({ createdAt: -1 }).limit(4);
    res.render('index', {
      title: 'ShopPro',
      featuredProducts: featuredProducts,
      newArrivals: newArrivals
    });
  } catch (err) {
    res.render('error', { message: 'Homepage error' });
  }
});

router.get('/about', function(req, res) {
  res.render('about', { title: 'About' });
});

router.get('/contact', function(req, res) {
  res.render('contact', { title: 'Contact' });
});

router.get('/search', async function(req, res) {
  try {
    var q = req.query.q || '';
    if (q.trim() === '') { return res.redirect('/products'); }
    var regex = new RegExp(q, 'i');
    var products = await Product.find({
      $or: [{ name: regex }, { description: regex }, { category: regex }]
    });
    res.render('search', { title: 'Search', query: q, products: products });
  } catch (err) {
    res.render('error', { message: 'Search error' });
  }
});

// Order Tracking Page
router.get('/track', function(req, res) {
  res.render('track', { 
    title: 'Track Order',
    order: null,
    orderShipping: null,
    error: null,
    searched: false
  });
});

// Order Tracking Lookup
router.post('/track', async function(req, res) {
  try {
    var orderNumber = req.body.orderNumber ? req.body.orderNumber.trim() : '';
    var email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    
    if (!orderNumber || !email) {
      return res.render('track', {
        title: 'Track Order',
        order: null,
        orderShipping: null,
        error: 'Please enter both order number and email address.',
        searched: true
      });
    }
    
    var order = await Order.findOne({ orderNumber: orderNumber })
      .populate('user', 'firstName lastName email');
    
    if (!order) {
      return res.render('track', {
        title: 'Track Order',
        order: null,
        orderShipping: null,
        error: 'Order not found. Please check your order number and try again.',
        searched: true
      });
    }
    
    // Verify email matches
    if (order.user && order.user.email !== email) {
      return res.render('track', {
        title: 'Track Order',
        order: null,
        orderShipping: null,
        error: 'The email address does not match this order.',
        searched: true
      });
    }
    
    var orderShipping = await OrderShipping.findOne({ order: order._id });
    
    res.render('track', {
      title: 'Track Order #' + order.orderNumber,
      order: order,
      orderShipping: orderShipping || {},
      error: null,
      searched: true
    });
    
  } catch (err) {
    console.error('Tracking error:', err);
    res.render('track', {
      title: 'Track Order',
      order: null,
      orderShipping: null,
      error: 'Error looking up order. Please try again.',
      searched: true
    });
  }
});

module.exports = router;