const mongoose = require('mongoose');

const VendorUserSchema = new mongoose.Schema({
    businessName: { type: String, required: true },
    vendorId: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    ownerName: { type: String },
    phone: { type: String },
    address: { type: String },
    description: { type: String, default: '' },
    categories: { type: String, default: '' },
    logo: { type: String, default: '' },
    bankDetails: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('VendorUser', VendorUserSchema);
