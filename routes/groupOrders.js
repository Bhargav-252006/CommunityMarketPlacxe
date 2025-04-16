const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const GroupOrder = require('../models/GroupOrder');
const CommunityUser = require('../models/CommunityUser');

// Middleware to check if user is admin
const ensureAdmin = async (req, res, next) => {
    try {
        const user = await CommunityUser.findById(req.session.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).render('error', {
                message: 'Access Denied',
                error: 'You must be an admin to access this page'
            });
        }
        next();
    } catch (error) {
        res.status(500).render('error', {
            message: 'Error checking admin status',
            error: error.message
        });
    }
};

// View all group orders (admin only)
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get all group orders
        const groupOrders = await GroupOrder.find()
            .populate('adminId', 'name email')
            .populate('orders')
            .sort({ createdAt: -1 });

        // Get all pending orders not in a group
        const pendingOrders = await Order.find({
            status: 'Pending',
            isGroupOrder: false
        }).populate('customerId', 'name username email');

        res.render('groupOrders', {
            groupOrders,
            pendingOrders
        });
    } catch (error) {
        console.error('Error fetching group orders:', error);
        res.status(500).render('error', {
            message: 'Error fetching group orders',
            error: error.message
        });
    }
});

// Get group order details
router.get('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const groupOrder = await GroupOrder.findById(req.params.id)
            .populate('adminId', 'name email')
            .populate({
                path: 'orders',
                populate: [
                    { path: 'customerId', select: 'name username email' },
                    { path: 'items.itemId' }
                ]
            });

        if (!groupOrder) {
            return res.status(404).render('error', {
                message: 'Group Order not found',
                error: 'The requested group order could not be found'
            });
        }

        res.render('groupOrderDetails', {
            groupOrder,
            orderStatuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
        });
    } catch (error) {
        console.error('Error fetching group order details:', error);
        res.status(500).render('error', {
            message: 'Error fetching group order details',
            error: error.message
        });
    }
});

// Create a new group order from pending orders
router.post('/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { orderIds } = req.body;

        if (!orderIds || (Array.isArray(orderIds) && orderIds.length === 0)) {
            return res.status(400).render('error', {
                message: 'No orders selected',
                error: 'Please select at least one order to create a group order'
            });
        }

        // Convert to array if single item
        const orderIdsArray = Array.isArray(orderIds) ? orderIds : [orderIds];

        // Get all orders
        const orders = await Order.find({
            _id: { $in: orderIdsArray },
            status: 'Pending',
            isGroupOrder: false
        });

        if (orders.length === 0) {
            return res.status(400).render('error', {
                message: 'No valid orders to group',
                error: 'The selected orders are not available for grouping'
            });
        }

        // Calculate total amount
        const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

        // Create group order
        const groupOrder = await GroupOrder.create({
            adminId: req.session.userId,
            orders: orderIdsArray,
            totalAmount
        });

        // Update individual orders
        await Order.updateMany(
            { _id: { $in: orderIdsArray } },
            {
                isGroupOrder: true,
                groupOrderId: groupOrder._id,
                status: 'Processing'
            }
        );

        res.redirect('/group-orders');
    } catch (error) {
        console.error('Error creating group order:', error);
        res.status(500).render('error', {
            message: 'Error creating group order',
            error: error.message
        });
    }
});

// Update group order status
router.post('/:id/status', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const groupOrder = await GroupOrder.findById(req.params.id);

        if (!groupOrder) {
            return res.status(404).render('error', {
                message: 'Group order not found',
                error: 'The requested group order could not be found'
            });
        }

        // Update group order status
        groupOrder.status = status;
        await groupOrder.save();

        // Update all associated orders
        await Order.updateMany(
            { groupOrderId: groupOrder._id },
            { status }
        );

        res.redirect('/group-orders');
    } catch (error) {
        console.error('Error updating group order status:', error);
        res.status(500).render('error', {
            message: 'Error updating group order status',
            error: error.message
        });
    }
});

module.exports = router; 