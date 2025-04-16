const express = require('express');
const router = express.Router();
const CommunityUser = require('../models/CommunityUser');
const VendorUser = require('../models/VendorUser');
const VendorItem = require('../models/VendorItem');
const Order = require('../models/Order');
const GroupOrder = require('../models/GroupOrder');
const { ensureAuthenticated, preventAdminDirectAccess } = require('../middleware/authMiddleware');

// Dashboard Route
router.get('/dashboard', ensureAuthenticated, preventAdminDirectAccess, async (req, res) => {
    try {
        // Check if session is valid
        if (!req.session.userId && !req.session.vendorId) {
            // Clear any existing session data
            req.session.destroy((err) => {
                if (err) console.error('Error destroying session:', err);
                return res.redirect('/login');
            });
            return;
        }

        let user;
        let featuredItems = [];
        let recentOrders = [];
        let pendingOrders = [];
        let groupOrders = [];

        if (req.session.userId) {
            // Community User Dashboard
            user = await CommunityUser.findById(req.session.userId);
            if (!user) {
                // Clear invalid session and redirect to login
                req.session.destroy((err) => {
                    if (err) console.error('Error destroying session:', err);
                    return res.redirect('/login');
                });
                return;
            }

            // Get featured items (latest 4 available items)
            featuredItems = await VendorItem.find({ isAvailable: true })
                .populate('vendorId', 'businessName')
                .sort({ createdAt: -1 })
                .limit(4);

            // Get recent orders
            recentOrders = await Order.find({ customerId: req.session.userId })
                .sort({ createdAt: -1 })
                .limit(5);

            // For admin users, get additional data
            if (user.isAdmin) {
                // Admin users should be redirected to admin dashboard
                // This is handled by preventAdminDirectAccess middleware
                // But adding an extra check here for safety
                return res.redirect('/admin/dashboard');
            }

            // Consistently render the communityDashboard for regular users
            res.render('communityDashboard', {
                user,
                featuredItems,
                recentOrders,
                pendingOrders,
                groupOrders,
                isAdmin: false, // Explicitly set to false for regular users
                currentPage: 'dashboard',
                messages: {
                    success: req.flash('success') || [],
                    error: req.flash('error') || []
                }
            });
        } else if (req.session.vendorId) {
            // Vendor Dashboard
            user = await VendorUser.findById(req.session.vendorId);
            if (!user) {
                return res.redirect('/vendor/login');
            }

            // Get vendor items
            const items = await VendorItem.find({ vendorId: req.session.vendorId });

            // Get all orders containing this vendor's items (for statistics)
            const vendorItemIds = items.map(item => item._id);

            // Only proceed with item checks if there are actually items
            let testOrder = null;
            let testOrderWithString = null;
            let directOrder = null;

            if (vendorItemIds.length > 0) {
                // Try a different approach - query one specific item ID only
                testOrder = await Order.findOne({
                    'items.itemId': vendorItemIds[0]
                }).lean();

                // Compare with string version
                const stringItemId = vendorItemIds[0].toString();
                testOrderWithString = await Order.findOne({
                    'items.itemId': stringItemId
                }).lean();

                // Try a direct query with the known ID
                directOrder = await Order.findById('67dfb0f3b32ab7340a10c3d0').lean();
            }

            // ALTERNATIVE APPROACH: Find all orders then filter for this vendor's items
            const allOrders = await Order.find().lean();

            // Safely filter orders based on vendor items, handling the case where there are no items
            const filteredOrders = vendorItemIds.length > 0 ? allOrders.filter(order => {
                // Check if any items in the order belong to this vendor
                return order.items.some(item => {
                    return vendorItemIds.some(vendorItemId =>
                        vendorItemId.toString() === item.itemId.toString()
                    );
                });
            }) : [];

            // Safe query to find orders that contain any of this vendor's items
            const allVendorOrders = vendorItemIds.length > 0 ?
                await Order.find({
                    'items.itemId': { $in: vendorItemIds }
                }).populate('customerId', 'name email') : [];

            // If the standard query failed but our filtered approach worked, use that instead
            const vendorOrders = allVendorOrders.length > 0 ? allVendorOrders : filteredOrders;

            // Get recent orders for display (limited to 5)
            let recentVendorOrders = [];
            if (vendorOrders.length > 0) {
                // Sort by date (newest first)
                recentVendorOrders = [...vendorOrders]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5);

                // Populate customer info if missing
                for (let order of recentVendorOrders) {
                    if (order.customerId && typeof order.customerId !== 'object') {
                        try {
                            const customer = await CommunityUser.findById(order.customerId);
                            if (customer) {
                                order.customerName = customer.name;
                                order.customerEmail = customer.email;
                            }
                        } catch (err) {
                            console.error(`Error populating customer info: ${err.message}`);
                        }
                    }
                }
            }

            // Calculate total sales safely
            const totalSales = calculateTotalSales(vendorOrders, vendorItemIds, items);

            // Count pending orders (those with status "Pending")
            const pendingOrders = vendorOrders.filter(order => order.status === 'Pending');

            // Render the vendor dashboard with all statistics
            res.render('vendorDashboard', {
                vendor,
                items,
                recentOrders: recentVendorOrders,
                orders: vendorOrders,
                pendingOrders: pendingOrders,
                totalSales: totalSales,
                title: 'Vendor Dashboard',
                currentPage: 'dashboard'
            });
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
});

// GET Vendor Dashboard
router.get('/vendor/dashboard', ensureAuthenticated, async (req, res) => {
    try {
        // Ensure session exists
        if (!req.session.vendorId) {
            return res.redirect('/vendor/login'); // Redirect if no session
        }

        // Fetch the logged-in vendor
        const vendor = await VendorUser.findById(req.session.vendorId);
        if (!vendor) {
            return res.redirect('/vendor/login');
        }

        // Fetch items that belong to the vendor
        const items = await VendorItem.find({ vendorId: vendor._id });

        // Get all orders containing this vendor's items (for statistics)
        const vendorItemIds = items.map(item => item._id);

        // Only proceed with item checks if there are actually items
        let testOrder = null;
        let testOrderWithString = null;
        let directOrder = null;

        if (vendorItemIds.length > 0) {
            // Try a different approach - query one specific item ID only
            testOrder = await Order.findOne({
                'items.itemId': vendorItemIds[0]
            }).lean();

            // Compare with string version
            const stringItemId = vendorItemIds[0].toString();
            testOrderWithString = await Order.findOne({
                'items.itemId': stringItemId
            }).lean();

            // Try a direct query with the known ID
            directOrder = await Order.findById('67dfb0f3b32ab7340a10c3d0').lean();
        }

        // ALTERNATIVE APPROACH: Find all orders then filter for this vendor's items
        const allOrders = await Order.find().lean();

        // Safely filter orders based on vendor items, handling the case where there are no items
        const filteredOrders = vendorItemIds.length > 0 ? allOrders.filter(order => {
            // Check if any items in the order belong to this vendor
            return order.items.some(item => {
                return vendorItemIds.some(vendorItemId =>
                    vendorItemId.toString() === item.itemId.toString()
                );
            });
        }) : [];

        // Safe query to find orders that contain any of this vendor's items
        const allVendorOrders = vendorItemIds.length > 0 ?
            await Order.find({
                'items.itemId': { $in: vendorItemIds }
            }).populate('customerId', 'name email') : [];

        // If the standard query failed but our filtered approach worked, use that instead
        const vendorOrders = allVendorOrders.length > 0 ? allVendorOrders : filteredOrders;

        // Get recent orders for display (limited to 5)
        let recentVendorOrders = [];
        if (vendorOrders.length > 0) {
            // Sort by date (newest first)
            recentVendorOrders = [...vendorOrders]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            // Populate customer info if missing
            for (let order of recentVendorOrders) {
                if (order.customerId && typeof order.customerId !== 'object') {
                    try {
                        const customer = await CommunityUser.findById(order.customerId);
                        if (customer) {
                            order.customerName = customer.name;
                            order.customerEmail = customer.email;
                        }
                    } catch (err) {
                        console.error(`Error populating customer info: ${err.message}`);
                    }
                }
            }
        }

        // Calculate total sales safely
        const totalSales = calculateTotalSales(vendorOrders, vendorItemIds, items);

        // Count pending orders (those with status "Pending")
        const pendingOrders = vendorOrders.filter(order => order.status === 'Pending');

        // Render the vendor dashboard with all statistics
        res.render('vendorDashboard', {
            vendor,
            items,
            recentOrders: recentVendorOrders,
            orders: vendorOrders,
            pendingOrders: pendingOrders,
            totalSales: totalSales,
            title: 'Vendor Dashboard',
            currentPage: 'dashboard'
        });
    } catch (err) {
        console.error(err);
        res.redirect('/vendor/login'); // Redirect to login if error occurs
    }
});

// Helper function to calculate total sales
function calculateTotalSales(orders, vendorItemIds, items) {
    // Return 0 if there are no orders or no vendor items
    if (!orders || orders.length === 0 || !vendorItemIds || vendorItemIds.length === 0) {
        return 0;
    }

    let totalSales = 0;

    orders.forEach(order => {
        // Only include orders that are being processed, shipped, or delivered
        if (['Processing', 'Shipped', 'Delivered'].includes(order.status)) {
            order.items.forEach(item => {
                // Check if this item belongs to this vendor
                const itemId = item.itemId ? item.itemId.toString() : null;
                if (itemId && vendorItemIds.some(id => id.toString() === itemId)) {
                    // Find the corresponding vendor item to get price information
                    const vendorItem = items.find(vItem => vItem._id.toString() === itemId);

                    if (vendorItem) {
                        // Use vendor item cost per unit as price
                        const price = parseFloat(vendorItem.costPerUnit) || 0;
                        const quantity = parseInt(item.quantity) || 0;

                        totalSales += price * quantity;
                    }
                }
            });
        }
    });

    return totalSales;
}

module.exports = router;
