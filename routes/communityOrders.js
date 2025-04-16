const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const GroupOrder = require('../models/GroupOrder');
const VendorItem = require('../models/VendorItem');
const VendorUser = require('../models/VendorUser');

// Get all orders for the logged-in community user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Find all orders for this user
        const orders = await Order.find({ customerId: req.session.userId })
            .sort({ createdAt: -1 });

        res.render('orders', {
            orders,
            title: 'My Orders',
            currentPage: 'orders',
            messages: {
                success: req.flash('success') || [],
                error: req.flash('error') || []
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('error', {
            message: 'Error fetching orders',
            error: error.message
        });
    }
});

// Order history route - MUST COME BEFORE THE :id ROUTE
router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        // Find all completed orders for this user
        const completedOrders = await Order.find({
            customerId: req.session.userId,
            status: { $in: ['Delivered', 'Cancelled'] }
        }).sort({ createdAt: -1 });

        res.render('orderHistory', {
            orders: completedOrders,
            title: 'Order History',
            currentPage: 'orderHistory',
            messages: {
                success: req.flash('success') || [],
                error: req.flash('error') || []
            }
        });
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).render('error', {
            message: 'Error fetching order history',
            error: error.message
        });
    }
});

// View single order details
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        // Find the order and make sure it belongs to this user
        const order = await Order.findOne({
            _id: req.params.id,
            customerId: req.session.userId
        });

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: 'The requested order could not be found or you do not have permission to view it.'
            });
        }

        // Get group order info if this is part of a group order
        let groupOrderStatus = null;
        if (order.isGroupOrder && order.groupOrderId) {
            const groupOrder = await GroupOrder.findById(order.groupOrderId);
            if (groupOrder) {
                groupOrderStatus = groupOrder.status;
            }
        }

        // Populate the item details
        const populatedItems = [];
        for (const item of order.items) {
            const vendorItem = await VendorItem.findById(item.itemId);
            if (vendorItem) {
                const vendor = await VendorUser.findById(vendorItem.vendorId);
                populatedItems.push({
                    ...item.toObject(),
                    details: {
                        ...vendorItem.toObject(),
                        vendorName: vendor ? vendor.businessName : 'Unknown Vendor'
                    }
                });
            } else {
                populatedItems.push({
                    ...item.toObject(),
                    details: null
                });
            }
        }

        // Replace the order items with the populated items
        order.items = populatedItems;

        res.render('orderDetails', {
            order,
            groupOrderStatus,
            title: 'Order Details'
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', {
            message: 'Error fetching order details',
            error: error.message
        });
    }
});

module.exports = router; 