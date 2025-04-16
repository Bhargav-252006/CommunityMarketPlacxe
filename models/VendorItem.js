const mongoose = require('mongoose');

const VendorItemSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorUser', required: true }, // Reference to Vendor
    itemName: { type: String, required: true },
    itemQuantity: { type: Number, required: true },
    costPerUnit: { type: Number, required: true },
    itemId: { type: String, required: true, unique: true },
    category: {
        type: String,
        required: true,
        enum: [
            "Fruits & Vegetables",
            "'Dairy",
            "Bread & Eggs'",
            "Snacks & Munchies",
            "Cold Drinks & Juices",
            "Breakfast & Instant Food",
            "Sweet Tooth",
            "Bakery & Biscuits",
            "'Tea",
            "Coffee & Health Drink'",
            "'Atta",
            "Rice & Dal'",
            "'Masala",
            "Oil & More'",
            "Sauces & Spreads",
            "'Chicken",
            "Meat & Fish'",
            "Organic & Healthy Living",
            "Baby Care",
            "Pharma & Wellness",
            "Cleaning Essentials",
            "Home & Office",
            "Personal Care",
            "Pet Care",
            "Paan Corner",
            "Dairy & Paneer",
            "Atta & Rice",
            "Dals & Pulses",
            "Masalas & Spices",
            "Oils & Ghee",
            "Snacks & Namkeen",
            "Beverages",
            "Pickles & Chutneys",
            "Dry Fruits & Nuts",
            "Sweets & Mithai",
            "Instant Food",
            // Add new categories to match the images
            "Dairy, Bread & Eggs",
            "Masala, Oil & More",
            "Atta, Rice & Dal"
        ]
    },
    subCategory: { type: String },
    description: { type: String },
    unit: { type: String, required: true }, // e.g., kg, g, pcs, etc.
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    discount: { type: Number, default: 0 },
    expiryDate: { type: Date },
    brand: { type: String },
    tags: [String]
}, { timestamps: true });

module.exports = mongoose.model('VendorItem', VendorItemSchema);
