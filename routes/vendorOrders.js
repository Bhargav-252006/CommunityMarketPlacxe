const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const GroupOrder = require('../models/GroupOrder');
const VendorItem = require('../models/VendorItem');
const CommunityUser = require('../models/CommunityUser');

// Get all orders for a vendor
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Create a simple vendor object with just the name
        const vendor = {
            businessName: 'Vendor Dashboard'
        };

        // Check if vendorId exists in session
        if (!req.session.vendorId) {
            console.error('No vendorId found in session');
            return res.status(401).render('error', {
                message: 'Unauthorized',
                error: 'You must be logged in as a vendor to view orders'
            });
        }

        // Find all items for this vendor
        const vendorItems = await VendorItem.find({ vendorId: req.session.vendorId });
        
        const itemIds = vendorItems.map(item => item._id);

        // Find orders that contain any of these items
        const orders = await Order.find({
            'items.itemId': { $in: itemIds }
        })
            .populate('customerId', 'name username email')
            .populate('groupOrderId')
            .sort({ createdAt: -1 });
            
        res.render('vendorOrders', {
            orders,
            orderStatuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
            title: 'Vendor Orders',
            currentPage: 'orders',
            vendor: vendor // Pass simple vendor object to the template
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('error', {
            message: 'Error fetching orders',
            error: error.message
        });
    }
});

// View single order details
router.get('/view/:id', ensureAuthenticated, async (req, res) => {
    try {
        // Create a simple vendor object with just the name
        const vendor = {
            businessName: 'Vendor Dashboard'
        };

        const order = await Order.findById(req.params.id)
            .populate('customerId', 'name username email')
            .populate('groupOrderId');

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: 'The requested order could not be found'
            });
        }

        // Get vendor items to check if this vendor owns any items in the order
        const vendorItems = await VendorItem.find({ vendorId: req.session.vendorId });
        const vendorItemIds = vendorItems.map(item => item._id.toString());

        // Check if any order items belong to this vendor
        const hasVendorItems = order.items.some(item =>
            vendorItemIds.includes(item.itemId.toString())
        );

        if (!hasVendorItems) {
            return res.status(403).render('error', {
                message: 'Access denied',
                error: 'You do not have permission to view this order'
            });
        }

        // Populate the item details
        const populatedItems = [];
        for (const item of order.items) {
            if (vendorItemIds.includes(item.itemId.toString())) {
                const vendorItem = await VendorItem.findById(item.itemId);
                populatedItems.push({
                    ...item.toObject(),
                    details: vendorItem
                });
            }
        }

        res.render('vendorOrderDetails', {
            order,
            vendorItems: populatedItems,
            orderStatuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
            title: 'Order Details',
            currentPage: 'orders',
            vendor: vendor // Pass simple vendor object to the template
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', {
            message: 'Error fetching order details',
            error: error.message
        });
    }
});

// Update order status
router.post('/update-status/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).render('error', {
                message: 'Invalid status',
                error: 'The provided status is not valid.'
            });
        }

        // Find the order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: 'The requested order could not be found.'
            });
        }

        // Get vendor items to ensure vendor can update this order
        const vendorItems = await VendorItem.find({ vendorId: req.session.vendorId });
        const vendorItemIds = vendorItems.map(item => item._id.toString());

        // Check if any order items belong to this vendor
        const hasVendorItems = order.items.some(item =>
            vendorItemIds.includes(item.itemId.toString())
        );

        if (!hasVendorItems) {
            return res.status(403).render('error', {
                message: 'Access denied',
                error: 'You do not have permission to update this order.'
            });
        }

        // Update order status
        order.status = status;

        // Update individual item statuses for this vendor's items
        order.items.forEach(item => {
            if (vendorItemIds.includes(item.itemId.toString())) {
                item.status = status;
            }
        });

        await order.save();

        res.redirect('/vendor/orders');
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).render('error', {
            message: 'Error updating order status',
            error: error.message
        });
    }
});

// Accept order (update all items to Processing)
router.post('/accept/:id', ensureAuthenticated, async (req, res) => {
    try {
        const orderId = req.params.id;

        // Find the order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: 'The requested order could not be found'
            });
        }

        // Get vendor items to check if this vendor owns any items in the order
        const vendorItems = await VendorItem.find({ vendorId: req.session.vendorId });
        const vendorItemIds = vendorItems.map(item => item._id.toString());

        // Check if any order items belong to this vendor
        const hasVendorItems = order.items.some(item =>
            vendorItemIds.includes(item.itemId.toString())
        );

        if (!hasVendorItems) {
            return res.status(403).render('error', {
                message: 'Access denied',
                error: 'You do not have permission to update this order'
            });
        }

        // Update all items belonging to this vendor to "Processing"
        for (const item of order.items) {
            if (vendorItemIds.includes(item.itemId.toString())) {
                item.status = 'Processing';
            }
        }

        // Check if all items in the order have the same status
        const allItemsProcessing = order.items.every(item => item.status === 'Processing');
        if (allItemsProcessing) {
            order.status = 'Processing';
        }

        await order.save();

        // If this is part of a group order, check if all orders in the group have the same status
        if (order.isGroupOrder && order.groupOrderId) {
            const groupOrder = await GroupOrder.findById(order.groupOrderId);
            if (groupOrder) {
                const allOrdersInGroup = await Order.find({ groupOrderId: groupOrder._id });
                const allGroupOrdersProcessing = allOrdersInGroup.every(o => o.status === 'Processing');

                if (allGroupOrdersProcessing) {
                    groupOrder.status = 'Processing';
                    await groupOrder.save();
                }
            }
        }

        res.redirect(`/vendor/orders/view/${orderId}`);
    } catch (error) {
        console.error('Error accepting order:', error);
        res.status(500).render('error', {
            message: 'Error accepting order',
            error: error.message
        });
    }
});

// Update all items in the order to a specific status
router.post('/update-all-items/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).render('error', {
                message: 'Invalid status',
                error: 'The provided status is not valid.'
            });
        }

        // Find the order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: 'The requested order could not be found.'
            });
        }

        // Get vendor items to ensure vendor can update this order
        const vendorItems = await VendorItem.find({ vendorId: req.session.vendorId });
        const vendorItemIds = vendorItems.map(item => item._id.toString());

        // Check if any order items belong to this vendor
        const hasVendorItems = order.items.some(item =>
            vendorItemIds.includes(item.itemId.toString())
        );

        if (!hasVendorItems) {
            return res.status(403).render('error', {
                message: 'Access denied',
                error: 'You do not have permission to update this order.'
            });
        }

        // Update status for all items that belong to this vendor
        order.items.forEach(item => {
            if (vendorItemIds.includes(item.itemId.toString())) {
                item.status = status;
            }
        });

        // Check if all items in the order have the same status
        const allItemsHaveSameStatus = order.items.every(item => item.status === status);
        if (allItemsHaveSameStatus) {
            order.status = status;
        }

        await order.save();

        // If this is part of a group order, check if all orders in the group have the same status
        if (order.isGroupOrder && order.groupOrderId) {
            const groupOrder = await GroupOrder.findById(order.groupOrderId);
            if (groupOrder) {
                const allOrdersInGroup = await Order.find({ groupOrderId: groupOrder._id });
                const allGroupOrdersHaveSameStatus = allOrdersInGroup.every(o => o.status === status);

                if (allGroupOrdersHaveSameStatus) {
                    groupOrder.status = status;
                    await groupOrder.save();
                }
            }
        }

        res.redirect(`/vendor/orders/view/${orderId}`);
    } catch (error) {
        console.error('Error updating order items:', error);
        res.status(500).render('error', {
            message: 'Error updating order items',
            error: error.message
        });
    }
});

module.exports = router; 