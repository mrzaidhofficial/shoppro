require('dotenv').config();
var express = require('express');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo');
var flash = require('express-flash');
var helmet = require('helmet');
var path = require('path');

var app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      frameSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.mailjet.com"],
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

var mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI environment variable is not set!');
  process.exit(1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || '57a28291c920e9323df0e0ab7c0c23df0cc750aa1686d5a88829db82f21812c0f866c31c0ab8a4a22404c8835bb4823e47a909e9a3f4150d1bc518fb2e22783e',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: 'sessions',
    ttl: 1 * 24 * 60 * 60,
    autoRemove: 'native',
    touchAfter: 24 * 3600
  }),
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

app.use(flash());

app.use(function(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.cart = req.session.cart || [];
  res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
  res.locals.messages = req.flash();
  res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
  next();
});

async function start() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');

    app.use('/', require('./routes/index'));
    app.use('/products', require('./routes/products'));
    app.use('/cart', require('./routes/cart'));
    app.use('/auth', require('./routes/auth'));
    app.use('/admin', require('./routes/admin'));
    app.use('/admin/shipping', require('./routes/shipping'));
    app.use('/admin/finances', require('./routes/finances'));

    app.use(function(req, res) {
      res.status(404).render('error', { message: 'Page not found' });
    });

    app.use(function(err, req, res, next) {
      console.error(err.stack);
      res.status(500).render('error', { message: 'Something went wrong. Please try again later.' });
    });

    var PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', function() {
      console.log('ShopNest server running on port ' + PORT);
    });

  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}

start();