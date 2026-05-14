var express = require('express');
var router = express.Router();
var Product = require('../models/Product');

router.get('/', async function(req, res) {
  try {
    var category = req.query.category || '';
    var sort = req.query.sort || 'newest';
    var page = parseInt(req.query.page) || 1;
    var limit = 12;
    var skip = (page - 1) * limit;
    
    var query = {};
    if (category) query.category = category;
    
    var sortOption = {};
    if (sort === 'price-asc') sortOption = { price: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { averageRating: -1 };
    else sortOption = { createdAt: -1 };
    
    var totalProducts = await Product.countDocuments(query);
    var totalPages = Math.ceil(totalProducts / limit);
    
    var products = await Product.find(query).sort(sortOption).skip(skip).limit(limit);
    var categories = await Product.distinct('category');
    
    res.render('products', {
      title: 'Products',
      products: products,
      categories: categories,
      currentCategory: category,
      currentSort: sort,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts
    });
  } catch (err) {
    res.render('error', { message: 'Error loading products' });
  }
});

router.get('/:id', async function(req, res) {
  try {
    var product = await Product.findById(req.params.id).populate('ratings.user', 'firstName lastName');
    if (!product) return res.render('error', { message: 'Product not found' });
    
    // Add to recently viewed
    if (!req.session.recentlyViewed) req.session.recentlyViewed = [];
    req.session.recentlyViewed = req.session.recentlyViewed.filter(function(id) { return id !== req.params.id; });
    req.session.recentlyViewed.unshift(req.params.id);
    if (req.session.recentlyViewed.length > 6) req.session.recentlyViewed = req.session.recentlyViewed.slice(0, 6);
    
    var relatedProducts = await Product.find({ category: product.category, _id: { $ne: product._id } }).limit(4);
    
    // Fetch recently viewed products
    var recentlyViewed = [];
    if (req.session.recentlyViewed && req.session.recentlyViewed.length > 1) {
      var recentIds = req.session.recentlyViewed.filter(function(id) { return id !== req.params.id; }).slice(0, 4);
      recentlyViewed = await Product.find({ _id: { $in: recentIds } });
      // Reorder to match session order
      recentlyViewed.sort(function(a, b) {
        return recentIds.indexOf(a._id.toString()) - recentIds.indexOf(b._id.toString());
      });
    }
    
    res.render('product-detail', {
      title: product.name,
      product: product,
      relatedProducts: relatedProducts,
      recentlyViewed: recentlyViewed
    });
  } catch (err) {
    res.render('error', { message: 'Error loading product' });
  }
});

router.post('/:id/review', async function(req, res) {
  try {
    if (!req.session.user) {
      req.flash('error', 'Please sign in to leave a review');
      return res.redirect('/auth/signin');
    }
    
    var product = await Product.findById(req.params.id);
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }
    
    var alreadyReviewed = product.ratings.find(function(r) {
      return r.user.toString() === req.session.user.id.toString();
    });
    
    if (alreadyReviewed) {
      req.flash('error', 'You have already reviewed this product');
      return res.redirect('/products/' + req.params.id);
    }
    
    var rating = parseInt(req.body.rating);
    if (rating < 1 || rating > 5) {
      req.flash('error', 'Rating must be between 1 and 5');
      return res.redirect('/products/' + req.params.id);
    }
    
    product.ratings.push({ user: req.session.user.id, rating: rating, review: req.body.review || '', date: new Date() });
    await product.calculateAverageRating();
    req.flash('success', 'Review added successfully!');
    res.redirect('/products/' + req.params.id);
    
  } catch (err) {
    req.flash('error', 'Error adding review');
    res.redirect('/products/' + req.params.id);
  }
});

module.exports = router;