var express = require('express');
var router = express.Router();
var Product = require('../models/Product');

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

    if (q.trim() === '') {
      return res.redirect('/products');
    }

    var regex = new RegExp(q, 'i');
    var products = await Product.find({
      $or: [
        { name: regex },
        { description: regex },
        { category: regex }
      ]
    });

    res.render('search', {
      title: 'Search',
      query: q,
      products: products
    });

  } catch (err) {
    res.render('error', { message: 'Search error' });
  }
});

module.exports = router;