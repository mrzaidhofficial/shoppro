var express = require('express');
var router = express.Router();
var User = require('../models/User');
var Order = require('../models/Order');

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
        var email = req.body.email;
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
        
        // Save session before redirecting
        req.session.save(function(err) {
            if (err) {
                return res.redirect('/auth/signin');
            }
            res.redirect('/');
        });
        
    } catch (err) {
        req.flash('error', 'Sign in failed');
        res.redirect('/auth/signin');
    }
});

// Sign Up handler
router.post('/signup', async function(req, res) {
    try {
        var firstName = req.body.firstName;
        var lastName = req.body.lastName;
        var email = req.body.email;
        var password = req.body.password;
        var password2 = req.body.password2;
        
        if (password !== password2) {
            req.flash('error', 'Passwords do not match');
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
        req.flash('error', 'Sign up failed');
        res.redirect('/auth/signup');
    }
});

// Logout
router.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if (err) {
            return res.redirect('/');
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
        
        res.render('profile', { 
            title: 'My Account',
            orders: orders
        });
    } catch (err) {
        res.render('profile', { 
            title: 'My Account',
            orders: []
        });
    }
});

module.exports = router;