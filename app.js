var express = require('express');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo');
var flash = require('express-flash');
var path = require('path');

var app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

var mongoUri = 'mongodb://admin:18980@ac-om48oau-shard-00-00.qysg3mc.mongodb.net:27017,ac-om48oau-shard-00-01.qysg3mc.mongodb.net:27017,ac-om48oau-shard-00-02.qysg3mc.mongodb.net:27017/ecommerce?ssl=true&replicaSet=atlas-cfmec8-shard-0&authSource=admin&appName=ecommerce-cluster';

app.use(session({
  secret: 'shopProSecret2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: { maxAge: 86400000 }
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

async function seedData() {
  var Product = require('./models/Product');
  var User = require('./models/User');
  
  var productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany([
      { name: 'Wireless Headphones', shortDescription: 'Premium noise-cancelling headphones with 30-hour battery life and deep bass.', description: 'Experience crystal-clear audio with our premium noise-cancelling wireless headphones. Featuring advanced ANC technology that blocks out 95% of ambient noise, 30-hour battery life for all-day listening, and plush memory foam ear cushions for unmatched comfort. The 40mm custom drivers deliver rich, deep bass and crisp highs. Bluetooth 5.3 ensures a stable connection up to 33 feet. Built-in microphone for crystal-clear calls. Foldable design with carrying case included.', price: 79.99, category: 'Electronics', stock: 50, featured: true, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop'] },
      { name: 'Cotton T-Shirt', shortDescription: 'Soft 100% organic cotton t-shirt for everyday comfort.', description: 'Made from 100% certified organic cotton, this t-shirt offers unparalleled comfort and breathability. Pre-shrunk fabric ensures a consistent fit wash after wash. The reinforced double-stitched seams provide durability, while the ribbed crew neck maintains its shape. Available in multiple colors to suit any style. Perfect for casual wear, layering, or as a base layer. Machine washable and eco-friendly packaging.', price: 24.99, category: 'Clothing', stock: 200, featured: true, images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop'] },
      { name: 'Water Bottle', shortDescription: 'Double-walled insulated bottle keeps drinks cold 24hrs or hot 12hrs.', description: 'Stay hydrated in style with our premium double-walled vacuum insulated water bottle. Made from professional-grade 18/8 stainless steel, it keeps beverages cold for up to 24 hours or hot for up to 12 hours. The BPA-free lid features a leak-proof seal and wide mouth for easy cleaning and ice insertion. Powder-coated exterior provides a slip-free grip and resists scratches. Holds 32oz of liquid. Perfect for gym, office, hiking, or travel.', price: 34.99, category: 'Home & Garden', stock: 150, featured: true, images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop'] },
      { name: 'Running Shoes', shortDescription: 'Lightweight responsive running shoes with breathable mesh upper.', description: 'Engineered for performance, our lightweight running shoes feature responsive CloudFoam cushioning that absorbs impact and returns energy with every stride. The engineered mesh upper provides maximum breathability while the seamless construction reduces irritation. A durable rubber outsole with strategic traction pattern ensures grip on various surfaces. Reflective elements enhance visibility during low-light runs. OrthoLite sockliner adds extra comfort. Weighs only 9.2 oz.', price: 129.99, category: 'Sports', stock: 75, featured: true, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop'] },
      { name: 'Charging Pad', shortDescription: 'Fast 15W wireless charger compatible with all Qi devices.', description: 'Power up your devices effortlessly with our 15W fast wireless charging pad. Compatible with all Qi-enabled smartphones including iPhone 14/15 series, Samsung Galaxy, Google Pixel, and more. The ultra-slim 6mm design fits anywhere. Smart LED indicator shows charging status without disturbing sleep. Built-in safety features include overcharge protection, temperature control, and foreign object detection. Anti-slip silicone ring keeps your device in place. USB-C cable included.', price: 19.99, category: 'Electronics', stock: 300, featured: false, images: ['https://images.unsplash.com/photo-1633602840838-5c5b1b7b7c2e?w=600&h=600&fit=crop'] },
      { name: 'Leather Wallet', shortDescription: 'Genuine leather bi-fold wallet with RFID blocking security.', description: 'Crafted from premium genuine leather that develops a rich patina over time, this bi-fold wallet combines classic style with modern security. Integrated RFID blocking technology protects your credit cards and IDs from electronic pickpocketing. Features 8 card slots, 2 hidden pockets, a clear ID window, and a full-length bill compartment. Slim profile design at just 0.5 inches thick when full. Hand-stitched edges and a durable nylon-lined interior. Comes in a gift box.', price: 45.99, category: 'Accessories', stock: 100, featured: true, images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop'] },
      { name: 'Yoga Mat', shortDescription: 'Extra thick 6mm non-slip yoga mat with carrying strap.', description: 'Achieve perfect poses on our extra-thick 6mm yoga mat designed for superior comfort and stability. The dual-layer construction features a non-slip textured surface on top and a grippy rubber bottom that stays firmly in place on any floor. Made from eco-friendly TPE material that is free from PVC, latex, and harmful chemicals. The closed-cell design repels moisture and is easy to clean. Includes a carrying strap for convenient transport to the studio or park. Measures 72" x 24".', price: 39.99, category: 'Sports', stock: 120, featured: false, images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop'] },
      { name: 'Coffee Maker', shortDescription: 'Programmable 12-cup coffee maker with built-in grinder.', description: 'Wake up to the aroma of freshly brewed coffee with our programmable 12-cup coffee maker featuring a built-in conical burr grinder. Choose from 8 grind settings for the perfect brew strength. The programmable 24-hour timer lets you set your brew in advance. The thermal stainless steel carafe keeps coffee hot for hours without a heating plate. Features include auto-shutoff, pause-and-serve, and a reusable gold-tone filter. The sleek stainless steel design complements any kitchen.', price: 89.99, category: 'Home & Garden', stock: 60, featured: true, images: ['https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&h=600&fit=crop'] },
      { name: 'Sunglasses', shortDescription: 'Polarized UV400 sunglasses with lightweight titanium frame.', description: 'Protect your eyes in style with our premium polarized sunglasses featuring advanced UV400 protection that blocks 100% of UVA/UVB rays. The ultra-lightweight titanium frame weighs just 18 grams while maintaining exceptional durability. Polarized lenses eliminate glare and enhance color contrast for superior visual clarity. Spring-loaded hinges provide a comfortable fit for all face shapes. Scratch-resistant lens coating and adjustable nose pads. Includes a hard case and microfiber cleaning cloth.', price: 59.99, category: 'Accessories', stock: 85, featured: true, images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=600&fit=crop'] },
      { name: 'Backpack', shortDescription: 'Water-resistant laptop backpack with USB charging port.', description: 'Carry your essentials with confidence in our water-resistant laptop backpack designed for modern professionals and students. The dedicated padded compartment fits laptops up to 15.6 inches. A built-in USB charging port connects to your power bank inside for convenient on-the-go charging. Multiple compartments organize your tablet, documents, water bottle, and accessories. Breathable padded shoulder straps and back panel ensure all-day comfort. Made from durable ripstop polyester with YKK zippers.', price: 49.99, category: 'Accessories', stock: 70, featured: false, images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop'] },
      { name: 'Watch', shortDescription: 'Elegant analog watch with genuine leather strap.', description: 'Make a statement with our elegant analog timepiece featuring a precision Japanese quartz movement for accurate timekeeping. The genuine leather strap with crocodile texture patinas beautifully with age. A scratch-resistant mineral crystal protects the clean white dial with rose gold indices and hands. The 40mm stainless steel case is water resistant to 30 meters. A date window at 3 o\'clock adds functionality. Perfect for both formal occasions and everyday sophistication.', price: 89.99, category: 'Accessories', stock: 45, featured: true, images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&h=600&fit=crop'] },
      { name: 'Belt', shortDescription: 'Full-grain leather belt with brushed nickel buckle.', description: 'Complete your look with our full-grain leather belt crafted from a single piece of premium cowhide for superior durability. The brushed nickel buckle features an elegant matte finish that resists scratching. A classic 35mm width fits most dress and casual pant loops. Reinforced stitching along the edges prevents stretching and ensures years of reliable use. Available in black and brown. Comes with a protective dust bag.', price: 34.99, category: 'Accessories', stock: 110, featured: false, images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop'] },
      { name: 'Mystery Novel', shortDescription: 'Bestselling mystery collection — 5 gripping page-turners.', description: 'Dive into suspense with this exclusive 5-book mystery novel collection from award-winning authors. Each book delivers intricate plots, unexpected twists, and unforgettable characters that will keep you reading late into the night. The collection includes courtroom dramas, psychological thrillers, and classic whodunits. Beautifully bound in premium paperback with French flaps. Perfect for mystery lovers or as a thoughtful gift.', price: 49.99, category: 'Books', stock: 80, featured: false, images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=600&fit=crop'] },
      { name: 'Smart Watch', shortDescription: 'Advanced smartwatch with heart rate, GPS, and 7-day battery.', description: 'Stay connected and healthy with our advanced smartwatch featuring a vibrant 1.4-inch always-on AMOLED display. Monitor your heart rate 24/7, track sleep stages, and measure blood oxygen levels. Built-in GPS accurately tracks runs, rides, and swims. Receive calls, texts, and app notifications on your wrist. With 7-day battery life and water resistance to 50 meters, it keeps up with your active lifestyle. Compatible with iOS and Android.', price: 199.99, category: 'Electronics', stock: 40, featured: true, images: ['https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=600&h=600&fit=crop'] },
      { name: 'Garden Tools', shortDescription: 'Complete 8-piece garden tool set with ergonomic grips.', description: 'Transform your garden with our comprehensive 8-piece tool set. Each tool features ergonomic soft-grip handles that reduce hand fatigue during extended use. The set includes a trowel, transplanter, cultivator, weeder, pruner, fork, spade, and rake. Blades are made from hardened stainless steel that resists rust. Comes in a durable canvas storage bag with individual pockets. Perfect for planting, weeding, pruning, and general garden maintenance.', price: 54.99, category: 'Home & Garden', stock: 90, featured: false, images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=600&fit=crop'] },
      { name: 'Bluetooth Speaker', shortDescription: 'Waterproof 360° speaker with 20-hour battery life.', description: 'Fill any space with immersive 360-degree sound using our portable Bluetooth speaker. Dual full-range drivers and a passive radiator deliver rich bass and crisp highs. IPX7 waterproof rating means it survives submersion in 1 meter of water for 30 minutes — perfect for poolside or beach. The 20-hour rechargeable battery keeps the music going all day. Built-in microphone enables speakerphone calls. Pair two speakers for true stereo sound. Floatable design.', price: 59.99, category: 'Electronics', stock: 110, featured: true, images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop'] }
    ]);
    console.log('Products seeded!');
  }
  
  var adminExists = await User.findOne({ email: 'admin@shoppro.com' });
  if (!adminExists) {
    var adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@shoppro.com',
      password: 'Admin@123',
      role: 'admin'
    });
    await adminUser.save();
    console.log('Admin user created: admin@shoppro.com / Admin@123');
  }
}

async function start() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');
    
    await seedData();

    app.use('/', require('./routes/index'));
    app.use('/products', require('./routes/products'));
    app.use('/cart', require('./routes/cart'));
    app.use('/auth', require('./routes/auth'));
    app.use('/admin', require('./routes/admin'));

    app.use(function(req, res) {
      res.status(404).render('error', { message: 'Page not found' });
    });

    var PORT = process.env.PORT || 3000;
    app.listen(PORT, function() {
      console.log('Server: http://localhost:' + PORT);
    });

  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
}

start();