var express = require('express');
var router = express.Router();
var User = require('../models/User');
var Order = require('../models/Order');
var { OrderShipping } = require('../models/Shipping');

// Sign In page
router.get('/signin', function(req, res) {
  res.render('login', { title: 'Sign In' });
});

// Sign Up page
router.get('/signup', function(req, res) {
  res.render('register', { title: 'Sign Up' });
});

// Sign In handler
router.post('/signin', async function(req, res) {
  try {
    var email = req.body.email.trim().toLowerCase();
    var password = req.body.password;
    
    var user = await User.findOne({ email: email });
    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/signin');
    }
    
    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/signin');
    }
    
    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    };
    
    req.flash('success', 'Welcome back, ' + user.firstName + '!');
    res.redirect('/');
    
  } catch (err) {
    console.error('Sign in error:', err);
    req.flash('error', 'Sign in failed');
    res.redirect('/auth/signin');
  }
});

// Sign In handler
router.post('/signin', async function(req, res) {
    try {
        var email = req.body.email.trim().toLowerCase();
        var password = req.body.password;
        
        var user = await User.findOne({ email: email });
        if (!user) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/signin');
        }
        
        var isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/signin');
        }
        
        req.session.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
        };
        
        req.flash('success', 'Welcome back, ' + user.firstName + '!');
        
        req.session.save(function(err) {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/auth/signin');
            }
            res.redirect('/');
        });
        
    } catch (err) {
        console.error('Sign in error:', err);
        req.flash('error', 'Sign in failed');
        res.redirect('/auth/signin');
    }
});

// Logout
router.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    if (err) {
      console.error('Logout error:', err);
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// Profile page
router.get('/profile', async function(req, res) {
  if (!req.session.user) {
    return res.redirect('/auth/signin');
  }
  try {
    var orders = await Order.find({ user: req.session.user.id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    var orderIds = orders.map(function(o) { return o._id; });
    var shippingInfos = await OrderShipping.find({ order: { $in: orderIds } });
    var shippingMap = {};
    shippingInfos.forEach(function(si) { shippingMap[si.order.toString()] = si; });
    
    orders = orders.map(function(order) {
      var o = order.toObject();
      var si = shippingMap[order._id.toString()];
      if (si && si.trackingNumber) {
        o.trackingNumber = si.trackingNumber;
      }
      return o;
    });
    
    res.render('profile', { 
      title: 'My Account',
      orders: orders
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.render('profile', { 
      title: 'My Account',
      orders: []
    });
  }
});

module.exports = router;