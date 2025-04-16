const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const Community = require('../models/Community');
const CommunityUser = require('../models/CommunityUser');
const Cart = require('../models/Cart');
const GroupOrder = require('../models/GroupOrder');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const { ensureAdmin, ensureAdminCartAccess } = require('../middleware/authMiddleware');
const VendorItem = require('../models/VendorItem');

// Middleware to check if user is an admin
const isAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await CommunityUser.findById(req.session.userId);
        if (!user || !user.isAdmin) {
            return res.redirect('/dashboard');
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('Admin authentication error:', err);
        res.redirect('/login');
    }
};

// Create a new community
router.get('/community/create', (req, res) => {
    res.render('createCommunity', { message: null });
});

router.post('/community/create', async (req, res) => {
    try {
        let { name, description, communityId, username, email, password, adminKey } = req.body;

        // Validate all required fields
        if (!name || !description || !username || !email || !password || !adminKey) {
            return res.render('createCommunity', {
                message: 'All fields are required.'
            });
        }

        // Validate community name (3-50 characters)
        if (name.length < 3 || name.length > 50) {
            return res.render('createCommunity', {
                message: 'Community name must be between 3-50 characters.'
            });
        }

        // Validate description (10-500 characters)
        if (description.length < 10 || description.length > 500) {
            return res.render('createCommunity', {
                message: 'Description must be between 10-500 characters.'
            });
        }

        // Validate username (starts with letter, contains only letters, numbers, underscores, 4-16 characters)
        const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,15}$/;
        if (!usernameRegex.test(username)) {
            return res.render('createCommunity', {
                message: 'Username must start with a letter, contain only letters, numbers, and underscores, and be 4-16 characters long.'
            });
        }

        // Validate email
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.render('createCommunity', {
                message: 'Please enter a valid email address.'
            });
        }

        // Validate password (at least 8 characters, letters and numbers)
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('createCommunity', {
                message: 'Password must be at least 8 characters long and include letters and numbers.'
            });
        }

        // Validate admin key (at least 8 characters)
        if (adminKey.length < 8) {
            return res.render('createCommunity', {
                message: 'Admin key must be at least 8 characters long.'
            });
        }

        // Ensure admin key and password are different
        if (adminKey === password) {
            return res.render('createCommunity', {
                message: 'Admin key must be different from your password for security reasons.'
            });
        }

        // Generate communityId from name if not provided or if it's an auto-generated placeholder
        if (!communityId || communityId.startsWith('auto-gen-')) {
            // Create a URL-friendly version of the name for the communityId
            communityId = name.toLowerCase()
                .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
                .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
                .replace(/^-|-$/g, '')      // Remove leading/trailing hyphens
                .substring(0, 30);          // Limit length

            // Add a random suffix to ensure uniqueness
            const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            communityId = `${communityId}-${randomSuffix}`;
        }

        // Check if community ID already exists
        const existingCommunity = await Community.findOne({ communityId });
        if (existingCommunity) {
            return res.render('createCommunity', {
                message: 'Community ID already exists. Please choose another name.'
            });
        }

        // Check if email is already in use
        const existingUser = await CommunityUser.findOne({ email });
        if (existingUser) {
            return res.render('createCommunity', {
                message: 'Email is already in use. Please use a different email.'
            });
        }

        // Create new community
        const community = new Community({
            name,
            description,
            communityId,
            adminUsers: [],
            adminKey: adminKey // Save the admin key in the community document
        });

        await community.save();

        // Create admin user if credentials are provided
        if (username && email && password) {
            try {
                // Hash the password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Create admin user
                const adminUser = new CommunityUser({
                    name: username, // Use username as name for simplicity
                    username,
                    email,
                    password: hashedPassword,
                    isAdmin: true,
                    community: community._id
                });

                await adminUser.save();

                // Associate admin with community
                community.adminUsers.push(adminUser._id);
                await community.save();
                // Set session for automatic login
                req.session.userId = adminUser._id;
                req.session.communityId = community._id;
                req.session.isAdmin = true;

                return res.redirect('/admin/dashboard');
            } catch (error) {
                console.error('Error creating admin user:', error);
                // Continue to login page even if admin creation fails
            }
        }

        // If no admin user was created or failed, redirect to login
        res.redirect('/community/login');
    } catch (err) {
        console.error('Create community error:', err);
        res.render('createCommunity', {
            message: 'Error creating community. Please try again.'
        });
    }
});

// Admin login routes
router.get('/admin/login', (req, res) => {
    res.render('adminLogin', { message: null });
});

router.post('/admin/login', async (req, res) => {
    try {
        const { username, communityId, communityName } = req.body;
        // Find community by ID and name (both must match)
        const community = await Community.findOne({
            communityId: communityId,
            name: communityName
        });

        if (!community) {
            return res.render('adminLogin', {
                message: 'Community not found. Please check the ID and name.'
            });
        }
        // Find admin user for this community matching the username if provided
        let query = {
            community: community._id,
            isAdmin: true
        };

        if (username) {
            query.username = username;
        }

        let adminUser = await CommunityUser.findOne(query);

        // If no admin exists or username doesn't match, create one automatically
        if (!adminUser) {
            try {
                // Create a default admin user for this community
                const defaultUsername = username || `admin_${communityId}`;
                const defaultEmail = `admin_${communityId}@community.com`;
                const defaultPassword = await bcrypt.hash('admin123', 10); // Default password

                adminUser = new CommunityUser({
                    name: 'Community Admin',
                    username: defaultUsername,
                    email: defaultEmail,
                    password: defaultPassword,
                    isAdmin: true,
                    community: community._id
                });

                await adminUser.save();

                // Add admin user to community
                community.adminUsers = community.adminUsers || [];
                community.adminUsers.push(adminUser._id);
                await community.save();
            } catch (createError) {
                console.error('Error creating admin user:', createError);
                return res.render('adminLogin', {
                    message: 'Failed to set up admin account. Please contact support.'
                });
            }
        } else {
        }

        // Set session
        req.session.userId = adminUser._id;
        req.session.isAdmin = true;
        req.session.communityId = community._id;
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Admin login error:', err);
        res.render('adminLogin', {
            message: 'Error logging in. Please try again.'
        });
    }
});

// Admin Dashboard
router.get('/admin/dashboard', isAdmin, async (req, res) => {
    try {
        const community = await Community.findById(req.session.communityId);
        const communityUsers = await CommunityUser.find({
            community: req.session.communityId,
            isAdmin: false
        });

        // Get count of active carts
        const userIds = communityUsers.map(user => user._id);
        // Get all active carts
        const activeCarts = await Cart.find({
            userId: { $in: userIds },
            isActive: true,
            'items.0': { $exists: true } // At least one item in cart
        });
        // For debugging: List all carts
        const allCarts = await Cart.find({ userId: { $in: userIds } });
        allCarts.forEach(cart => {
        });

        const activeCartUserIds = activeCarts.map(cart => cart.userId.toString());

        // Add hasActiveCart flag to each user
        const usersWithCartStatus = communityUsers.map(user => {
            const userObj = user.toObject();
            userObj.hasActiveCart = activeCartUserIds.includes(user._id.toString());
            return userObj;
        });

        // Get recent orders (last 5)
        const recentOrders = await Order.find({
            customerId: { $in: userIds }
        })
            .populate({
                path: 'customerId',
                select: 'name username email',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'items.itemId',
                options: { strictPopulate: false }
            })
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('adminDashboard', {
            community,
            users: usersWithCartStatus,
            activeCartCount: activeCarts.length,
            recentOrders: recentOrders, // Pass recent orders to the template
            message: req.flash('info') || null
        });
    } catch (err) {
        console.error('Management dashboard error:', err);
        res.render('error', {
            message: 'Error loading management dashboard',
            error: err.message
        });
    }
});

// View all community user carts
router.get('/admin/community-carts', isAdmin, async (req, res) => {
    try {
        // Get all non-admin users in this community
        const users = await CommunityUser.find({
            community: req.session.communityId,
            isAdmin: false
        });

        // Get all active carts for these users
        const userIds = users.map(user => user._id);
        const carts = await Cart.find({
            userId: { $in: userIds },
            isActive: true
        }).populate('items.itemId');

        // Map carts to users
        const userCarts = [];
        for (const user of users) {
            const cart = carts.find(c => c.userId.toString() === user._id.toString());
            userCarts.push({
                user,
                cart: cart || { items: [] }
            });
        }

        res.render('communityCarts', {
            userCarts,
            community: await Community.findById(req.session.communityId),
            message: null
        });
    } catch (err) {
        console.error('Community carts error:', err);
        res.render('error', {
            message: 'Error loading community carts',
            error: err.message
        });
    }
});

// Create group order for community
router.post('/admin/create-group-order', isAdmin, async (req, res) => {
    let groupOrder = null;
    try {
        const { selectedUsers } = req.body;
        const userIds = Array.isArray(selectedUsers) ? selectedUsers : [selectedUsers];

        if (!userIds || userIds.length === 0) {
            return res.redirect('/admin/community-carts?error=No users selected');
        }

        // Get the community ID from session
        const communityId = req.session.communityId;
        if (!communityId) {
            return res.redirect('/admin/community-carts?error=Community ID not found in session');
        }

        // Get all carts for selected users
        const carts = await Cart.find({
            userId: { $in: userIds },
            isActive: true
        }).populate('items.itemId');

        if (carts.length === 0) {
            return res.redirect('/admin/community-carts?error=No active carts found');
        }

        // Calculate the total amount from all carts
        let overallTotalAmount = 0;

        // Prepare order items and calculate total amount
        const allOrders = [];

        for (const cart of carts) {
            if (cart.items.length === 0) continue;

            const orderItems = cart.items.map(item => ({
                itemId: item.itemId._id,
                quantity: item.quantity,
                price: item.itemId.costPerUnit,
                vendorId: item.itemId.vendorId
            }));

            const orderTotalAmount = orderItems.reduce(
                (total, item) => total + (item.price * item.quantity), 0
            );

            overallTotalAmount += orderTotalAmount;

            allOrders.push({
                userId: cart.userId,
                items: orderItems,
                totalAmount: orderTotalAmount
            });
        }

        // Create a new group order
        groupOrder = new GroupOrder({
            communityId: communityId, // Explicitly use from session
            adminId: req.session.userId,
            totalAmount: overallTotalAmount,
            status: 'Processing',
            orders: [], // Initialize with empty orders array
            createdAt: new Date() // Explicitly set creation date
        });

        await groupOrder.save();
        // Create individual orders and link them to the group order
        for (const orderData of allOrders) {
            const order = new Order({
                userId: orderData.userId,
                items: orderData.items,
                totalAmount: orderData.totalAmount,
                status: 'Processing',
                groupOrderId: groupOrder._id,
                isGroupOrder: true,
                customerId: orderData.userId,  // Add the customerId field (same as userId)
                createdAt: new Date() // Explicitly set creation date
            });

            await order.save();
            // Add this order to the group order's orders array
            groupOrder.orders.push(order._id);
        }

        // Save the group order again to update the orders array
        await groupOrder.save();
        // Update all the carts to inactive
        const updateResult = await Cart.updateMany(
            { userId: { $in: userIds }, isActive: true },
            { isActive: false }
        );
        // Redirect to the group orders page
        req.flash('success', `Created group order with ${groupOrder.orders.length} orders for a total of ₹${overallTotalAmount.toFixed(2)}`);
        res.redirect('/admin/group-orders');
    } catch (err) {
        console.warn('Create group order error:', err);
        req.flash('error', 'Error creating group order: ' + err.message);
        res.redirect('/admin/community-carts?error=Error creating group order');
    } finally {
        // This ensures that any pending operations are completed 
        // and resources are properly released even if there was an error
        if (mongoose.connection.readyState === 1) { // 1 = connected
            // Log completion of operation
            console.log('Group order creation operation completed');
        }
    }
});

// View group orders for the community
router.get('/admin/group-orders', isAdmin, async (req, res) => {
    try {
        const groupOrders = await GroupOrder.find({
            communityId: req.session.communityId
        }).sort({ createdAt: -1 });

        res.render('adminGroupOrders', {
            groupOrders,
            community: await Community.findById(req.session.communityId),
            message: null
        });
    } catch (err) {
        console.error('Group orders error:', err);
        res.render('error', {
            message: 'Error loading group orders',
            error: err.message
        });
    }
});

// View details of a specific group order
router.get('/admin/group-order/:id', isAdmin, async (req, res) => {
    try {
        const groupOrder = await GroupOrder.findById(req.params.id);
        if (!groupOrder) {
            return res.redirect('/admin/group-orders?error=Group order not found');
        }

        const orders = await Order.find({ groupOrderId: groupOrder._id })
            .populate('userId')
            .populate('items.itemId')
            .populate('items.vendorId');

        res.render('adminGroupOrderDetails', {
            groupOrder,
            orders,
            community: await Community.findById(req.session.communityId),
            message: null
        });
    } catch (err) {
        console.error('Group order details error:', err);
        res.render('error', {
            message: 'Error loading group order details',
            error: err.message
        });
    }
});

// View individual user's cart
router.get('/admin/user-cart/:userId', ensureAdmin, ensureAdminCartAccess, async (req, res) => {
    try {
        // Set cache control headers to prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        const { userId } = req.params;
        const user = req.targetUser; // User data already verified by middleware

        // Get the user's active cart with deeply populated items
        let cart = await Cart.findOne({
            userId: userId,
            isActive: true
        }).populate({
            path: 'items.itemId',
            populate: {
                path: 'vendorId',
                model: 'VendorUser',
                select: 'businessName'
            }
        });

        // If no cart exists, create an empty one for display
        if (!cart) {
            cart = { items: [] };
        } else if (cart.items && cart.items.length > 0) {
            // Filter out any items with null itemId (which could happen if items were deleted)
            cart.items = cart.items.filter(item => item.itemId);

            // Add vendorName to each item if available
            cart.items.forEach(item => {
                if (item.itemId && item.itemId.vendorId) {
                    item.itemId.vendorName = item.itemId.vendorId.businessName;
                }
            });
        }

        // Fetch available items for admin to add to cart
        const availableItems = await VendorItem.find({ isAvailable: true })
            .populate('vendorId', 'businessName')
            .sort({ name: 1 });

        // Log cart information for debugging
        // Render the admin view of user cart
        res.render('adminUserItems', {
            user,
            cart,
            availableItems,
            community: await Community.findById(req.session.communityId),
            message: req.flash('success') || req.flash('error') || null,
            isAdminView: true // Add flag to indicate this is admin view
        });
    } catch (err) {
        console.error('Error fetching user cart:', err);
        res.status(500).render('error', {
            message: 'Error fetching user cart',
            error: err
        });
    }
});

// Admin adding item to user's cart
router.post('/admin/user-cart/:userId/add', ensureAdmin, ensureAdminCartAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const { itemId, quantity = 1 } = req.body;

        if (!itemId) {
            req.flash('error', 'Item information is missing');
            return res.redirect(`/admin/user-cart/${userId}`);
        }

        // Find the item
        const item = await VendorItem.findById(itemId);
        if (!item) {
            req.flash('error', 'Item not found');
            return res.redirect(`/admin/user-cart/${userId}`);
        }

        // Find or create user's cart
        let cart = await Cart.findOne({
            userId: userId,
            isActive: true
        });

        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
                totalAmount: 0,
                isActive: true
            });
        }

        // Check if item already exists in cart
        const itemIndex = cart.items.findIndex(i => i.itemId && i.itemId.toString() === itemId);

        if (itemIndex > -1) {
            // Item exists, update quantity
            cart.items[itemIndex].quantity += parseInt(quantity);
        } else {
            // Add new item to cart
            cart.items.push({
                itemId: item._id,
                quantity: parseInt(quantity),
                price: item.costPerUnit
            });
        }

        // Recalculate total
        let total = 0;
        for (const cartItem of cart.items) {
            const itemPrice = cartItem.price || 0;
            const itemQuantity = cartItem.quantity || 0;
            total += itemPrice * itemQuantity;
        }
        cart.totalAmount = total;

        await cart.save();

        req.flash('success', `${item.name} added to user's cart`);
        return res.redirect(`/admin/user-cart/${userId}`);
    } catch (error) {
        console.error('Error adding item to user cart:', error);
        req.flash('error', 'Error adding item to cart: ' + error.message);
        return res.redirect(`/admin/user-cart/${userId}`);
    }
});

// Create a default community if none exists
const createDefaultCommunityIfNone = async () => {
    try {
        // Check if any communities exist
        const count = await Community.countDocuments();

        if (count === 0) {
            const DEFAULT_ADMIN_KEY = 'admin123special';

            // Create a default community
            const defaultCommunity = new Community({
                name: 'Default Community',
                description: 'This is a default community created by the system.',
                communityId: 'default-community',
                adminUsers: [],
                adminKey: DEFAULT_ADMIN_KEY
            });

            await defaultCommunity.save();
            // Create a default admin
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const adminUser = new CommunityUser({
                name: 'Admin',
                username: 'admin',
                email: 'admin@example.com',
                password: hashedPassword,
                isAdmin: true,
                community: defaultCommunity._id
            });

            await adminUser.save();
            // Link admin to community
            defaultCommunity.adminUsers.push(adminUser._id);
            await defaultCommunity.save();
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error creating default community:', err);
        return false;
    }
};

// Admin view user items - new route with enhanced debugging
router.get('/admin/view-user-items/:userId', isAdmin, ensureAdminCartAccess, async (req, res) => {
    // Add cache control headers to prevent browser caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    try {
        const userId = req.params.userId;
        const shouldRefresh = req.query.refresh === 'true';

        // Find the user
        const user = await CommunityUser.findById(userId);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/dashboard');
        }

        // Get the community context
        const communityId = req.session.communityId;
        const community = await Community.findById(communityId);

        // Find all carts for this user
        const allUserCarts = await Cart.find({ userId });

        // Find the user's active cart or create one if needed
        let cart = await Cart.findOne({ userId, isActive: true })
            .populate({
                path: 'items.itemId',
                populate: {
                    path: 'vendorId',
                    select: 'businessName'
                }
            });

        // If refresh requested and no active cart, activate the most recent one
        if (shouldRefresh && !cart && allUserCarts.length > 0) {
            // Sort by createdAt descending
            const sortedCarts = allUserCarts.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt));

            const mostRecentCart = sortedCarts[0];

            // Set this cart to active
            mostRecentCart.isActive = true;
            await mostRecentCart.save();

            // Reload with populated data
            cart = await Cart.findById(mostRecentCart._id)
                .populate({
                    path: 'items.itemId',
                    populate: {
                        path: 'vendorId',
                        select: 'businessName'
                    }
                });
        }

        // If still no cart, create an empty one
        if (!cart) {
            cart = await Cart.create({
                userId,
                communityId: req.session.communityId,
                items: [],
                totalAmount: 0,
                isActive: true
            });
        }

        // Handle potential null itemId references or missing prices
        let hasIssues = false;

        if (cart.items && cart.items.length > 0) {
            // Filter out null itemId references
            const validItems = cart.items.filter(item => item.itemId);
            if (validItems.length !== cart.items.length) {
                // Update the cart items to only include valid ones
                cart.items = validItems;
                hasIssues = true;
            }

            // Check for missing prices
            for (const item of cart.items) {
                if (item.itemId) {
                    // If price is missing, use the item's costPerUnit
                    if (!item.price && item.itemId.costPerUnit) {
                        item.price = item.itemId.costPerUnit;
                        hasIssues = true;
                    }
                }
            }

            // If any issues found, save the cart
            if (hasIssues) {
                // Recalculate total
                let totalAmount = 0;
                for (const item of cart.items) {
                    if (item.itemId && item.price) {
                        totalAmount += item.price * item.quantity;
                    }
                }
                cart.totalAmount = totalAmount;

                await cart.save();
            }
        }

        // Add vendor names for easier display in the UI
        const cartItems = cart.items.map(item => {
            if (item.itemId) {
                return {
                    ...item.toObject(),
                    vendorName: item.itemId.vendorId ? item.itemId.vendorId.businessName : 'Unknown Vendor'
                };
            }
            return null;
        }).filter(Boolean); // Filter out any null items

        // Get the items available from vendors to add to cart
        const availableItems = await VendorItem.find({ isAvailable: true })
            .populate('vendorId', 'businessName');

        res.render('adminViewUserItems', {
            user,
            community,
            cart: { ...cart.toObject(), items: cartItems },
            availableItems,
            message: req.flash('info') || req.flash('success') || req.flash('error') || null
        });
    } catch (error) {
        console.error('Error in admin view user items:', error);
        req.flash('error', 'An error occurred while fetching user items');
        res.redirect('/admin/dashboard');
    }
});

// Admin Add Item to User Cart - New Route for the new template
router.post('/admin/view-user-items/:userId/add', isAdmin, ensureAdminCartAccess, async (req, res) => {
    try {
        const userId = req.params.userId;
        const { itemId, quantity } = req.body;

        // Validate input
        if (!itemId || !quantity || quantity < 1) {
            req.flash('error', 'Invalid item or quantity');
            return res.redirect(`/admin/view-user-items/${userId}`);
        }

        // Find the item to get its price
        const item = await VendorItem.findById(itemId);
        if (!item) {
            req.flash('error', 'Item not found');
            return res.redirect(`/admin/view-user-items/${userId}`);
        }

        // Get user's active cart - use isActive: true
        let cart = await Cart.findOne({ userId: userId, isActive: true });

        // If no active cart exists, create one
        if (!cart) {
            cart = new Cart({
                userId: userId,
                communityId: req.session.communityId,
                isActive: true,
                items: []
            });
        }

        // Check if item already exists in cart
        const existingItemIndex = cart.items.findIndex(item =>
            item.itemId && item.itemId.toString() === itemId);

        if (existingItemIndex !== -1) {
            // Update quantity if item exists
            cart.items[existingItemIndex].quantity += parseInt(quantity);
        } else {
            // Add new item if it doesn't exist
            cart.items.push({
                itemId: itemId,
                quantity: parseInt(quantity),
                price: item.costPerUnit // Add the price field
            });
        }

        // Calculate totalAmount for the cart
        let totalAmount = 0;
        for (const cartItem of cart.items) {
            const itemPrice = cartItem.price || 0;
            const itemQuantity = cartItem.quantity || 0;
            totalAmount += itemPrice * itemQuantity;
        }
        cart.totalAmount = totalAmount;

        await cart.save();

        req.flash('info', 'Item added to cart successfully');
        res.redirect(`/admin/view-user-items/${userId}`);

    } catch (error) {
        console.error('Error adding item to user cart:', error);
        req.flash('error', 'An error occurred while adding item to cart');
        res.redirect(`/admin/view-user-items/${req.params.userId}`);
    }
});

// Admin View User Raw Cart Data (for debugging)
router.get('/admin/debug/user-cart/:userId', isAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Find the user and cart
        const user = await CommunityUser.findById(userId);
        if (!user) {
            return res.json({ error: 'User not found' });
        }

        // Find ALL carts for this user (both active and inactive)
        const allCarts = await Cart.find({ userId: userId })
            .lean();

        // Get cart with populated data
        const activeCart = await Cart.findOne({ userId: userId, isActive: true })
            .populate('items.itemId')
            .lean();

        res.json({
            user: {
                id: user._id,
                name: user.name,
                username: user.username
            },
            allCartsCount: allCarts.length,
            allCarts: allCarts.map(cart => ({
                id: cart._id,
                isActive: cart.isActive,
                itemCount: cart.items ? cart.items.length : 0,
                totalAmount: cart.totalAmount
            })),
            activeCartExists: !!activeCart,
            activeCartDetails: activeCart ? {
                id: activeCart._id,
                itemCount: activeCart.items ? activeCart.items.length : 0,
                items: activeCart.items.map(item => ({
                    id: item._id,
                    itemId: item.itemId ? item.itemId._id : null,
                    name: item.itemId ? (item.itemId.name || item.itemId.itemName) : 'unknown',
                    price: item.price,
                    quantity: item.quantity
                }))
            } : null
        });
    } catch (error) {
        console.error('Debug cart error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify cart data route - lets admin see what user sees
router.get('/admin/verify-user-cart/:userId', isAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Find the user
        const user = await CommunityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the user's cart as it would appear to them
        const userCart = await Cart.findOne({ userId, isActive: true })
            .populate('items.itemId');

        // Get all carts for this user
        const allCarts = await Cart.find({ userId });

        // Also check what the admin would see for this user
        const adminView = await Cart.findOne({ userId, isActive: true })
            .populate({
                path: 'items.itemId',
                populate: {
                    path: 'vendorId',
                    select: 'businessName'
                }
            });

        // Return the diagnostics
        return res.json({
            user: {
                id: user._id,
                name: user.name,
                username: user.username
            },
            activeCartExists: !!userCart,
            visibleToUser: userCart ? {
                id: userCart._id,
                itemCount: userCart.items.length,
                items: userCart.items.map(item => ({
                    id: item._id,
                    itemName: item.itemId ? item.itemId.itemName : 'unknown',
                    quantity: item.quantity,
                    price: item.price,
                    isItemAvailable: item.itemId ? item.itemId.isAvailable : false
                }))
            } : null,
            visibleToAdmin: adminView ? {
                id: adminView._id,
                itemCount: adminView.items.length,
                items: adminView.items.map(item => ({
                    id: item._id,
                    itemName: item.itemId ? item.itemId.itemName : 'unknown',
                    quantity: item.quantity,
                    price: item.price,
                    vendorName: item.itemId && item.itemId.vendorId ? item.itemId.vendorId.businessName : 'Unknown'
                }))
            } : null,
            allUserCarts: allCarts.map(cart => ({
                id: cart._id,
                isActive: cart.isActive,
                itemCount: cart.items.length,
                totalAmount: cart.totalAmount,
                createdAt: cart.createdAt
            }))
        });
    } catch (error) {
        console.error('Cart verification error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// API endpoints for admin dashboard
router.get('/api/admin/cart-count', isAdmin, async (req, res) => {
    try {
        // Get all non-admin users in this community
        const users = await CommunityUser.find({
            community: req.session.communityId,
            isAdmin: false
        });

        // Get their active carts with items
        const userIds = users.map(user => user._id);
        const activeCarts = await Cart.find({
            userId: { $in: userIds },
            isActive: true,
            'items.0': { $exists: true } // At least one item in cart
        });

        return res.json({
            success: true,
            count: activeCarts.length
        });
    } catch (error) {
        console.error('Error fetching cart count:', error);
        return res.status(500).json({
            success: false,
            count: 0,
            error: error.message
        });
    }
});

router.get('/api/admin/group-order-count', isAdmin, async (req, res) => {
    try {
        // Count all group orders for this community
        const count = await GroupOrder.countDocuments({
            communityId: req.session.communityId
        });

        return res.json({
            success: true,
            count: count
        });
    } catch (error) {
        console.error('Error fetching group order count:', error);
        return res.status(500).json({
            success: false,
            count: 0,
            error: error.message
        });
    }
});

// View all community orders in one comprehensive dashboard
router.get('/admin/all-orders', isAdmin, async (req, res) => {
    try {
        // Get all orders for this community (both regular and group orders)
        const communityId = req.session.communityId;
        // Find all orders that either belong to users in this community or are part of group orders
        const communityUsers = await CommunityUser.find({ community: communityId });
        const userIds = communityUsers.map(user => user._id);
        // Find all orders from these users - using customerId instead of userId
        const orders = await Order.find({
            $or: [
                { customerId: { $in: userIds } },
                { isGroupOrder: true } // Include all group orders
            ]
        })
            .populate({
                path: 'customerId',
                select: 'name username email',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'groupOrderId',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'items.itemId',
                populate: {
                    path: 'vendorId',
                    select: 'businessName',
                    options: { strictPopulate: false }
                },
                options: { strictPopulate: false }
            })
            .sort({ createdAt: -1 }); // Most recent first
        // Find all group orders for this community
        const groupOrders = await GroupOrder.find({ communityId })
            .sort({ createdAt: -1 });

        // Create a map of group orders for quick lookup
        const groupOrderMap = {};
        groupOrders.forEach(groupOrder => {
            groupOrderMap[groupOrder._id.toString()] = groupOrder;
        });

        // Create a map of users for quick lookup
        const userMap = {};
        communityUsers.forEach(user => {
            userMap[user._id.toString()] = user;
        });

        // Group orders by status
        const ordersByStatus = {
            'Processing': [],
            'Shipped': [],
            'Delivered': [],
            'Cancelled': [],
            'Pending': []
        };

        // Process each order
        orders.forEach(order => {
            // Add user info if not already populated
            if (order.customerId && !order.customerId.name && userMap[order.customerId.toString()]) {
                order.customerId = userMap[order.customerId.toString()];
            }

            // Add group order info if not already populated
            if (order.groupOrderId && order.isGroupOrder &&
                !order.groupOrderId.communityId &&
                groupOrderMap[order.groupOrderId.toString()]) {
                order.groupOrderId = groupOrderMap[order.groupOrderId.toString()];
            }

            // Add to the appropriate status category
            const status = order.status || 'Processing';
            if (!ordersByStatus[status]) {
                ordersByStatus[status] = [];
            }
            ordersByStatus[status].push(order);
        });

        // Count orders by status
        const orderCounts = {};
        for (const status in ordersByStatus) {
            orderCounts[status] = ordersByStatus[status].length;
        }

        // Get total count
        const totalOrders = orders.length;
        res.render('adminAllOrders', {
            orders,
            ordersByStatus,
            orderCounts,
            totalOrders,
            groupOrders,
            community: await Community.findById(communityId),
            message: req.flash('success') || req.flash('error') || null
        });
    } catch (err) {
        console.error('Error loading all community orders:', err);
        req.flash('error', 'An error occurred while loading community orders: ' + err.message);
        res.redirect('/admin/dashboard');
    }
});

// Add route for viewing individual order details
router.get('/admin/order/:orderId', isAdmin, async (req, res) => {
    try {
        const user = req.user;
        if (!user.isAdmin) {
            req.flash('error_msg', 'You do not have permission to access this page');
            return res.redirect('/dashboard');
        }

        const { orderId } = req.params;
        const community = await Community.findById(user.communityId);

        if (!community) {
            req.flash('error_msg', 'Community not found');
            return res.redirect('/dashboard');
        }
        // Find the order and populate all relevant fields
        const order = await Order.findById(orderId)
            .populate({
                path: 'customerId',
                select: 'name email username'
            })
            .populate({
                path: 'groupOrderId',
                select: 'name description status'
            })
            .populate({
                path: 'items.itemId',
                populate: {
                    path: 'vendorId',
                    select: 'businessName'
                }
            });

        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/admin/all-orders');
        }
        // Add a note about vendor-controlled status updates
        const statusNote = "Note: Order status updates are controlled by vendors, not community managers";

        res.render('adminOrderDetails', {
            user,
            community,
            order,
            statusNote,
            message: req.flash('success_msg')[0] || req.flash('error_msg')[0]
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error loading order details:`, error);
        req.flash('error_msg', 'Failed to load order details');
        res.redirect('/admin/all-orders');
    }
});

// Add route for updating order status
router.get('/admin/order/:orderId/update-status', isAdmin, async (req, res) => {
    try {
        const user = req.user;
        if (!user.isAdmin) {
            req.flash('error_msg', 'You do not have permission to update order status');
            return res.redirect('/dashboard');
        }

        const { orderId } = req.params;
        const { status } = req.query;

        if (!status) {
            req.flash('error_msg', 'Status is required');
            return res.redirect(`/admin/order/${orderId}`);
        }

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            req.flash('error_msg', 'Invalid status');
            return res.redirect(`/admin/order/${orderId}`);
        }
        // Update individual order
        const order = await Order.findById(orderId);

        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/admin/all-orders');
        }

        order.status = status;
        await order.save();

        // If part of a group order, update the group order status if all orders have the same status
        if (order.isGroupOrder && order.groupOrderId) {
            const groupOrderId = order.groupOrderId;
            const allOrdersInGroup = await Order.find({ groupOrderId });

            const allSameStatus = allOrdersInGroup.every(o => o.status === status);

            if (allSameStatus) {
                const groupOrder = await GroupOrder.findById(groupOrderId);
                if (groupOrder) {
                    groupOrder.status = status;
                    await groupOrder.save();
                }
            }
        }

        req.flash('success_msg', `Order status updated to ${status}`);
        res.redirect(`/admin/order/${orderId}`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error updating order status:`, error);
        req.flash('error_msg', 'Failed to update order status');
        res.redirect(`/admin/order/${orderId}`);
    }
});

// Export this function and the router
module.exports = {
    router: router,
    createDefaultCommunityIfNone: createDefaultCommunityIfNone
}; 