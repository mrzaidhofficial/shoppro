var mongoose = require('mongoose');

var productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, maxlength: 200 },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    profit: { type: Number, default: 0 },
    freeShipping: { type: Boolean, default: false },
    category: {
        type: String,
        required: true,
        enum: ['Electronics', 'Clothing', 'Home & Garden', 'Accessories', 'Sports', 'Books', 'Other']
    },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
    featured: { type: Boolean, default: false },
    specifications: { type: Map, of: String },
    ratings: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        date: { type: Date, default: Date.now }
    }],
    averageRating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function(next) {
    if (this.cost && this.price) { this.profit = this.price - this.cost; }
    else { this.profit = 0; }
    next();
});

productSchema.methods.calculateAverageRating = function() {
    if (this.ratings.length === 0) { this.averageRating = 0; this.numReviews = 0; }
    else {
        var total = 0;
        this.ratings.forEach(function(r) { total += r.rating; });
        this.averageRating = Math.round((total / this.ratings.length) * 10) / 10;
        this.numReviews = this.ratings.length;
    }
    return this.save();
};

module.exports = mongoose.model('Product', productSchema);