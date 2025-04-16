const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/authMiddleware');
const Cart = require('../models/Cart');
const VendorItem = require('../models/VendorItem');
const Order = require('../models/Order');
const CommunityUser = require('../models/CommunityUser');

// View cart
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Ensure users can only view their own cart
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/login');
        }

        // Always check and set isAdmin status
        const isAdmin = req.session.isAdmin || false;

        let cart = await Cart.findOne({ userId: req.session.userId, isActive: true })
            .populate('items.itemId');

        if (!cart) {
            cart = await Cart.create({
                userId: req.session.userId,
                items: [],
                totalAmount: 0,
                isActive: true
            });
        } else {
            // Filter out items that are no longer available
            // This ensures community users only see available items
            const availableItems = cart.items.filter(item =>
                item.itemId && item.itemId.isAvailable === true
            );

            // Update cart with only available items
            cart.items = availableItems;

            // Recalculate total amount
            let total = 0;
            for (const cartItem of cart.items) {
                total += cartItem.price * cartItem.quantity;
            }
            cart.totalAmount = total;

            // Save the updated cart
            await cart.save();
        }

        res.render('cart', {
            cart,
            isAdmin: isAdmin,
            messages: {
                success: req.flash('success') || [],
                error: req.flash('error') || []
            }
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).render('error', {
            message: 'Error fetching cart',
            error: error.message
        });
    }
});

// Add to cart
router.post('/add', ensureAuthenticated, async (req, res) => {
    try {
        const { itemId, quantity = 1, returnToItems } = req.body;
        const userId = req.session.userId;

        if (!itemId) {
            console.error('ItemId missing from request');
            req.flash('error', 'Item information is missing');
            return res.redirect(req.get('Referer') || '/community/dashboard');
        }

        const item = await VendorItem.findById(itemId);
        if (!item) {
            console.error(`Item not found with ID: ${itemId}`);
            req.flash('error', 'Item not found');
            return res.redirect(req.get('Referer') || '/community/dashboard');
        }

        let cart = await Cart.findOne({ userId, isActive: true });
        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
                totalAmount: 0,
                isActive: true
            });
        }

        const itemIndex = cart.items.findIndex(i => i.itemId && i.itemId.toString() === itemId);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += parseInt(quantity);
        } else {
            // Add new item to cart with correct field names from VendorItem
            cart.items.push({
                itemId: item._id,
                quantity: parseInt(quantity),
                price: item.costPerUnit // Using the correct field name from VendorItem model
            });
        }

        // Recalculate total
        let total = 0;
        for (const cartItem of cart.items) {
            total += cartItem.price * cartItem.quantity;
        }
        cart.totalAmount = total;

        await cart.save();
        req.flash('success', `${item.name} added to cart`);

        // Always redirect back to the referrer page or dashboard
        const referrer = req.get('Referer');
        if (referrer) {
            return res.redirect(referrer);
        } else if (returnToItems === 'true') {
            return res.redirect('/community/dashboard');
        } else {
            return res.redirect('/cart');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        req.flash('error', 'Error adding item to cart: ' + error.message);
        res.redirect(req.get('Referer') || '/community/dashboard');
    }
});

// Remove item from cart
router.post('/remove/:itemId', ensureAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.userId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        cart.items = cart.items.filter(
            item => item.itemId.toString() !== req.params.itemId
        );

        // Calculate total amount
        let total = 0;
        for (const cartItem of cart.items) {
            total += cartItem.price * cartItem.quantity;
        }
        cart.totalAmount = total;

        await cart.save();
        res.redirect('/cart');
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).render('error', {
            message: 'Error removing item from cart',
            error: error.message
        });
    }
});

// Place order (for community admin only)
router.post('/place-order', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.userId })
            .populate('items.itemId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).render('error', {
                message: 'Cannot place order',
                error: 'Your cart is empty'
            });
        }

        // Check for sufficient stock before placing order
        for (const cartItem of cart.items) {
            if (cartItem.itemId) {
                // Fetch the latest item state to check current stock
                const currentItem = await VendorItem.findById(cartItem.itemId._id);

                if (!currentItem) {
                    req.flash('error', 'Some items in your cart are no longer available');
                    return res.redirect('/cart');
                }

                if (currentItem.itemQuantity < cartItem.quantity) {
                    req.flash('error', `Not enough stock for ${currentItem.itemName}. Available: ${currentItem.itemQuantity}`);
                    return res.redirect('/cart');
                }

                // Check if item is still available
                if (!currentItem.isAvailable) {
                    req.flash('error', `${currentItem.itemName} is no longer available`);
                    return res.redirect('/cart');
                }
            }
        }

        // Create order
        const order = await Order.create({
            items: cart.items.map(item => ({
                itemId: item.itemId._id,
                quantity: item.quantity,
                status: 'Pending'
            })),
            totalAmount: cart.totalAmount,
            customerId: req.session.userId,
            status: 'Pending'
        });

        // Update inventory quantities (decrease stock)
        for (const cartItem of cart.items) {
            if (cartItem.itemId) {
                await VendorItem.findByIdAndUpdate(
                    cartItem.itemId._id,
                    { $inc: { itemQuantity: -cartItem.quantity } }
                );
            }
        }

        // Clear cart
        cart.items = [];
        cart.totalAmount = 0;
        await cart.save();

        // Add success message
        req.flash('success', 'Your order has been placed successfully!');
        res.redirect('/orders');
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).render('error', {
            message: 'Error placing order',
            error: error.message
        });
    }
});

// Add to cart via AJAX
router.post('/api/add', ensureAuthenticated, async (req, res) => {
    try {
        const { itemId, quantity = 1 } = req.body;
        const userId = req.session.userId;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: 'Item information is missing'
            });
        }

        // Find the item to get its price and other details
        const item = await VendorItem.findById(itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Get the user's active cart
        let cart = await Cart.findOne({ userId, isActive: true });

        // If no active cart exists, create a new one
        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
                totalAmount: 0,
                isActive: true,  // Explicitly set this to true
                createdAt: new Date()
            });
        }

        // Check if the item already exists in the cart
        const itemIndex = cart.items.findIndex(item =>
            item.itemId && item.itemId.toString() === itemId);

        if (itemIndex > -1) {
            // Item exists, update quantity
            cart.items[itemIndex].quantity += parseInt(quantity);
        } else {
            // Add new item to cart with all required fields
            cart.items.push({
                itemId: item._id,
                quantity: parseInt(quantity),
                price: item.costPerUnit  // Use the correct field from VendorItem
            });
        }

        // Calculate total amount
        let total = 0;
        for (const cartItem of cart.items) {
            total += cartItem.price * cartItem.quantity;
        }
        cart.totalAmount = total;

        // Save the cart
        await cart.save();

        // Verify the cart was saved properly by retrieving it again
        const verifiedCart = await Cart.findById(cart._id);

        return res.json({
            success: true,
            message: `${item.name || item.itemName} added to cart`,
            cart: {
                id: cart._id,
                isActive: cart.isActive,
                itemCount: cart.items.length,
                totalAmount: cart.totalAmount
            }
        });
    } catch (error) {
        console.error('Error in AJAX add to cart:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding item to cart: ' + error.message
        });
    }
});

module.exports = router; 