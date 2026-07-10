var mongoose = require('mongoose');

var bankDetailsSchema = new mongoose.Schema({
    bankName: { type: String, default: 'Sample Bank' },
    bankBranch: { type: String, default: 'Colombo' },
    bankAccountName: { type: String, default: 'ShopNest (Pvt) Ltd' },
    bankAccountNumber: { type: String, default: '1234567890' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BankDetails', bankDetailsSchema);