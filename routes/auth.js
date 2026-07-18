var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var User = require('../models/User');
var Order = require('../models/Order');
var { OrderShipping } = require('../models/Shipping');
var emailService = require('../services/emailService');

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
        var rememberMe = req.body.remember === 'on';
        
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
        
        // Remember Me - extend cookie maxAge to 30 days
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        }
        
        req.flash('success', 'Welcome back, ' + user.firstName + '!');
        
        req.session.save(function(err) {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/auth/signin');
            }
            return res.redirect('/');
        });
        
    } catch (err) {
        console.error('Sign in error:', err);
        req.flash('error', 'Sign in failed');
        res.redirect('/auth/signin');
    }
});

// Sign Up handler
router.post('/signup', async function(req, res) {
    try {
        var firstName = req.body.firstName.trim();
        var lastName = req.body.lastName.trim();
        var email = req.body.email.trim().toLowerCase();
        var password = req.body.password;
        var password2 = req.body.password2;
        
        if (!firstName || !lastName || !email || !password) {
            req.flash('error', 'All fields are required');
            return res.redirect('/auth/signup');
        }
        
        if (password !== password2) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/auth/signup');
        }
        
        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters');
            return res.redirect('/auth/signup');
        }
        
        var existingUser = await User.findOne({ email: email });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.redirect('/auth/signup');
        }
        
        var user = new User({
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password
        });
        
        await user.save();
        req.flash('success', 'Account created! Please sign in.');
        res.redirect('/auth/signin');
        
    } catch (err) {
        console.error('Sign up error:', err);
        req.flash('error', 'Sign up failed');
        res.redirect('/auth/signup');
    }
});

// Forgot Password page
router.get('/forgot-password', function(req, res) {
    res.render('forgot-password', { title: 'Forgot Password' });
});

// Forgot Password handler
router.post('/forgot-password', async function(req, res) {
    try {
        var email = req.body.email.trim().toLowerCase();
        var user = await User.findOne({ email: email });
        
        if (!user) {
            req.flash('error', 'No account found with that email address.');
            return res.redirect('/auth/forgot-password');
        }
        
        // Generate reset token
        var resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();
        
        // Send reset email
        await emailService.sendPasswordResetEmail(user.email, user.firstName, resetToken);
        
        req.flash('success', 'Password reset link has been sent to your email. Please check your inbox.');
        res.redirect('/auth/signin');
        
    } catch (err) {
        console.error('Forgot password error:', err);
        req.flash('error', 'Error sending reset email. Please try again.');
        res.redirect('/auth/forgot-password');
    }
});

// Reset Password page
router.get('/reset-password/:token', async function(req, res) {
    try {
        var user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            req.flash('error', 'Password reset link is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }
        
        res.render('reset-password', { title: 'Reset Password', token: req.params.token });
        
    } catch (err) {
        console.error('Reset password page error:', err);
        req.flash('error', 'Error loading reset page.');
        res.redirect('/auth/forgot-password');
    }
});

// Reset Password handler
router.post('/reset-password/:token', async function(req, res) {
    try {
        var user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            req.flash('error', 'Password reset link is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }
        
        var password = req.body.password;
        var password2 = req.body.password2;
        
        if (password !== password2) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/auth/reset-password/' + req.params.token);
        }
        
        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters.');
            return res.redirect('/auth/reset-password/' + req.params.token);
        }
        
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        req.flash('success', 'Your password has been reset successfully. Please sign in with your new password.');
        res.redirect('/auth/signin');
        
    } catch (err) {
        console.error('Reset password error:', err);
        req.flash('error', 'Error resetting password. Please try again.');
        res.redirect('/auth/forgot-password');
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