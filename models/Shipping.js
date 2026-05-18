var mongoose = require('mongoose');

var shippingSettingsSchema = new mongoose.Schema({
    shippingEnabled: { type: Boolean, default: true },
    shippingType: { 
        type: String, 
        enum: ['flat_rate', 'free', 'disabled'],
        default: 'flat_rate'
    },
    flatRatePerItem: { type: Number, default: 5.99 },
    flatRatePerOrder: { type: Number, default: 0 },
    freeShippingEnabled: { type: Boolean, default: false },
    freeShippingMinAmount: { type: Number, default: 100 },
    handlingFee: { type: Number, default: 0 },
    estimatedDelivery: { type: String, default: '7-21 business days' },
    supplierInfo: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

var orderShippingSchema = new mongoose.Schema({
    order: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order', 
        required: true,
        unique: true
    },
    customShippingCost: { type: Number, default: null },
    shippingType: { 
        type: String, 
        enum: ['flat_rate', 'free', 'disabled', 'custom'],
        default: null
    },
    trackingNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    carrierName: { type: String, default: '' },
    supplierName: { type: String, default: '' },
    supplierOrderId: { type: String, default: '' },
    shippingNotes: { type: String, default: '' },
    shippingStatus: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    shippedDate: { type: Date },
    deliveredDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

orderShippingSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    if (this.shippingStatus === 'shipped' && !this.shippedDate) {
        this.shippedDate = new Date();
    }
    if (this.shippingStatus === 'delivered' && !this.deliveredDate) {
        this.deliveredDate = new Date();
    }
    next();
});

var ShippingSettings = mongoose.model('ShippingSettings', shippingSettingsSchema);
var OrderShipping = mongoose.model('OrderShipping', orderShippingSchema);

module.exports = { ShippingSettings, OrderShipping };