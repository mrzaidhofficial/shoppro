var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
var Order = require('../models/Order');
var { OrderShipping } = require('../models/Shipping');
var emailService = require('../services/emailService');

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

// Contact Form Handler
router.post('/contact', async function(req, res) {
  try {
    var name = req.body.name || 'Anonymous';
    var email = req.body.email || '';
    var subject = req.body.subject || 'No Subject';
    var message = req.body.message || '';
    
    if (!email || !message) {
      req.flash('error', 'Please fill in all required fields.');
      return res.redirect('/contact');
    }
    
    await emailService.sendContactNotification(name, email, subject, message);
    req.flash('success', 'Your message has been sent! We will get back to you within 24-48 hours.');
    res.redirect('/contact');
  } catch (err) {
    console.error('Contact form error:', err);
    req.flash('error', 'Error sending message. Please try again or email us directly.');
    res.redirect('/contact');
  }
});

// Newsletter Subscription Handler
router.post('/newsletter', async function(req, res) {
  try {
    var email = req.body.email || '';
    
    if (!email) {
      req.flash('error', 'Please enter your email address.');
      return res.redirect('/');
    }
    
    await emailService.sendNewsletterNotification(email);
    req.flash('success', 'Thank you for subscribing! Stay tuned for exclusive deals and updates.');
    res.redirect('/');
  } catch (err) {
    console.error('Newsletter error:', err);
    req.flash('error', 'Error subscribing. Please try again.');
    res.redirect('/');
  }
});

router.get('/shipping-policy', function(req, res) {
  res.render('shipping-policy', { title: 'Shipping Policy' });
});

router.get('/returns', function(req, res) {
  res.render('returns', { title: 'Returns & Exchanges' });
});

router.get('/faq', function(req, res) {
  res.render('faq', { title: 'FAQ' });
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

router.get('/track', function(req, res) {
  res.render('track', { 
    title: 'Track Order',
    order: null,
    orderShipping: null,
    error: null,
    searched: false
  });
});

router.post('/track', async function(req, res) {
  try {
    var orderNumber = req.body.orderNumber ? req.body.orderNumber.trim() : '';
    var email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    
    if (!orderNumber || !email) {
      return res.render('track', {
        title: 'Track Order',
        order: null,
        orderShipping: null,
        error: 'Please enter both tracking number and email address.',
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
        error: 'Order not found. Please check your tracking number and try again.',
        searched: true
      });
    }
    
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