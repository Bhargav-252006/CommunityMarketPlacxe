const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const VendorItem = require('../models/VendorItem');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const VendorUser = require('../models/VendorUser');
const Order = require('../models/Order');
const CommunityUser = require('../models/CommunityUser');

// Define categories array
const categories = [
    'Fruits & Vegetables',
    'Dairy & Breakfast',
    'Snacks & Munchies',
    'Beverages',
    'Cleaning Essentials',
    'Personal Care',
    'Kitchen, Garden & Pets',
    'Eggs, Meat & Fish',
    'Atta & Rice',
    'Gourmet & World Food',
    'Baby Care',
    'Pharmacy',
    'Home & Office',
    'Bakery & Biscuits',
    'Fashion',
    'Electronics'
];

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/items')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Error: Images Only!');
        }
    }
});

// Get all items for a vendor
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const vendor = await VendorUser.findById(req.session.vendorId);
        if (!vendor) {
            // Vendor not found - redirect to login
            return res.redirect('/vendor/login');
        }

        const items = await VendorItem.find({ vendorId: req.session.vendorId });

        // Get orders containing this vendor's items
        const itemIds = items.map(item => item._id);
        
        // Try different query approaches to find orders
        const standardOrders = await Order.find({
            'items.itemId': { $in: itemIds }
        })
            .populate('customerId', 'name email')
            .sort({ createdAt: -1 });
        
        // Alternative approach if standard query fails
        if (standardOrders.length === 0) {
            // Get all orders and manually filter
            const allOrders = await Order.find().lean();
            
            const filteredOrders = allOrders.filter(order => {
                return order.items.some(item => {
                    return itemIds.some(id => id.toString() === item.itemId.toString());
                });
            });
            
            // Sort by date and limit to recent 5
            const recentOrders = filteredOrders
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);
                
            // Populate customer info if missing
            for (let order of recentOrders) {
                if (order.customerId && typeof order.customerId !== 'object') {
                    try {
                        const customer = await CommunityUser.findById(order.customerId);
                        if (customer) {
                            order.customerId = {
                                _id: customer._id,
                                name: customer.name,
                                email: customer.email
                            };
                        }
                    } catch (err) {
                        console.error(`[Items] Error populating customer: ${err.message}`);
                    }
                }
            }
            
            // Calculate total sales for stats
            const totalSales = calculateTotalSales(filteredOrders, itemIds, items);
            // Count pending orders
            const pendingOrders = filteredOrders.filter(order => order.status === 'Pending');
            
            res.render('vendorItemsManagement', {
                items: items || [],
                vendor: vendor,
                categories: categories,
                recentOrders: recentOrders || [],
                orders: filteredOrders,
                pendingOrders: pendingOrders,
                totalSales: totalSales,
                title: 'Vendor Items',
                currentPage: 'items'
            });
            return;
        }
        
        // If we got here, standard query worked
        // Limit to 5 recent orders for display
        const recentOrders = standardOrders.slice(0, 5);
        
        // Calculate total sales for stats
        const totalSales = calculateTotalSales(standardOrders, itemIds, items);
        // Count pending orders
        const pendingOrders = standardOrders.filter(order => order.status === 'Pending');

        res.render('vendorItemsManagement', {
            items: items || [],
            vendor: vendor,
            categories: categories,
            recentOrders: recentOrders || [],
            orders: standardOrders,
            pendingOrders: pendingOrders,
            totalSales: totalSales,
            title: 'Vendor Items',
            currentPage: 'items'
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).render('error', {
            message: 'Error fetching items',
            error: error.message
        });
    }
});

// Helper function to calculate total sales
function calculateTotalSales(orders, vendorItemIds, items) {
    let totalSales = 0;
    
    orders.forEach(order => {
        // Only include orders that are being processed, shipped, or delivered
        if (['Processing', 'Shipped', 'Delivered'].includes(order.status)) {
            order.items.forEach(item => {
                // Check if this item belongs to this vendor
                if (vendorItemIds.some(id => id.toString() === item.itemId.toString())) {
                    // Find the corresponding vendor item to get price information
                    const vendorItem = items.find(vItem => vItem._id.toString() === item.itemId.toString());
                    
                    if (vendorItem) {
                        // Use vendor item cost per unit as price
                        const price = parseFloat(vendorItem.costPerUnit) || 0;
                        const quantity = parseInt(item.quantity) || 0;
                        
                        // Add this item's contribution to total sales
                        const itemTotal = price * quantity;
                        totalSales += itemTotal;
                    }
                }
            });
        }
    });
    
    return totalSales;
}

// Add new item
router.post('/add', ensureAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const {
            itemName,
            category,
            itemQuantity,
            unit,
            costPerUnit,
            brand,
            description,
            expiryDate
        } = req.body;

        // Validate required fields
        if (!itemName || !category || !itemQuantity || !unit || !costPerUnit) {
            throw new Error('Missing required fields');
        }

        const imageUrl = req.file ? `/uploads/items/${req.file.filename}` : null;

        const newItem = new VendorItem({
            vendorId: req.session.vendorId,
            itemName,
            category,
            itemQuantity: Number(itemQuantity),
            unit,
            costPerUnit: Number(costPerUnit),
            brand,
            description,
            imageUrl,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            itemId: `ITEM${Date.now()}${Math.floor(Math.random() * 1000)}`,
            isAvailable: true
        });

        await newItem.save();
        res.redirect('/vendor/items');
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).render('error', {
            message: 'Error adding item',
            error: error.message
        });
    }
});

// Edit item
router.get('/edit/:id', ensureAuthenticated, async (req, res) => {
    try {
        const item = await VendorItem.findOne({
            _id: req.params.id,
            vendorId: req.session.vendorId
        });

        if (!item) {
            return res.status(404).render('error', {
                message: 'Item not found',
                error: 'The requested item does not exist or you do not have permission to edit it.'
            });
        }

        res.render('editItem', {
            item,
            title: 'Edit Item',
            currentPage: 'items'
        });
    } catch (error) {
        res.status(500).render('error', {
            message: 'Error fetching item',
            error: error.message
        });
    }
});

// Update item
router.post('/edit/:id', ensureAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const {
            itemName,
            category,
            itemQuantity,
            unit,
            costPerUnit,
            brand,
            description,
            expiryDate,
            isAvailable
        } = req.body;

        const updateData = {
            itemName,
            category,
            itemQuantity: Number(itemQuantity),
            unit,
            costPerUnit: Number(costPerUnit),
            brand,
            description,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            isAvailable: isAvailable === 'on'
        };

        if (req.file) {
            updateData.imageUrl = `/uploads/items/${req.file.filename}`;
        }

        await VendorItem.findOneAndUpdate(
            { _id: req.params.id, vendorId: req.session.vendorId },
            updateData
        );

        res.redirect('/vendor/items');
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).send('Error updating item');
    }
});

// Delete item
router.get('/delete/:id', ensureAuthenticated, async (req, res) => {
    try {
        await VendorItem.findOneAndDelete({
            _id: req.params.id,
            vendorId: req.session.vendorId
        });
        res.redirect('/vendor/items');
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Error deleting item');
    }
});

// Export inventory
router.get('/export', ensureAuthenticated, async (req, res) => {
    try {
        const items = await VendorItem.find({ vendorId: req.session.vendorId });
        const csv = items.map(item => ({
            'Item ID': item.itemId,
            'Name': item.itemName,
            'Category': item.category,
            'Quantity': item.itemQuantity,
            'Unit': item.unit,
            'Cost per Unit': item.costPerUnit,
            'Brand': item.brand,
            'Description': item.description,
            'Expiry Date': item.expiryDate,
            'Status': item.isAvailable ? 'In Stock' : 'Out of Stock'
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');

        // Convert to CSV
        const csvString = [
            Object.keys(csv[0]).join(','),
            ...csv.map(row => Object.values(row).join(','))
        ].join('\n');

        res.send(csvString);
    } catch (error) {
        console.error('Error exporting inventory:', error);
        res.status(500).send('Error exporting inventory');
    }
});

module.exports = router;
