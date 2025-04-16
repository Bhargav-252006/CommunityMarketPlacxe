const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const flash = require('connect-flash');
const compression = require('compression');
const { preventCache } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboard');
const vendorItemsRoutes = require('./routes/vendorItems');
const vendorOrdersRoutes = require('./routes/vendorOrders');
const vendorAnalyticsRoutes = require('./routes/vendorAnalytics');
const vendorSettingsRoutes = require('./routes/vendorSettings');
const cartRoutes = require('./routes/cartRoutes');
const communityItemsRoutes = require('./routes/communityItems');
const groupOrdersRoutes = require('./routes/groupOrders');
const communityOrdersRoutes = require('./routes/communityOrders');
const communityManagement = require('./routes/communityManagement');
const CommunityUser = require('./models/CommunityUser');
const Cart = require('./models/Cart');
const GroupOrder = require('./models/GroupOrder');
const VendorUser = require('./models/VendorUser');
const apiRoutes = require('./routes/api');
require('dotenv').config();
const path = require('path');

const app = express();

// Connect to MongoDB with retry functionality
connectDB().catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
});

// Trust proxy for secure cookies behind Render's proxy
app.set('trust proxy', 1);

// Middleware

// Add production optimizations
const oneYear = 31536000000;
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? oneYear : 0,
    etag: true,
    lastModified: true
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add support for JSON request bodies

// Add compression for faster page loads
app.use(compression({
    level: 6, // Compression level (0-9)
    threshold: 1024 // Only compress responses larger than 1KB
}));

// Apply cache control middleware to all routes
app.use(preventCache);

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
        return res.status(200).json({});
    }
    next();
});

// Handle MongoDB connection issues
const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'defaultsecret',  // Fallback secret
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        // Remove crypto configuration to use default behavior
        // This will prevent decryption errors with existing sessions
        autoRemove: 'native',
        touchAfter: 24 * 60 * 60, // 24 hours
        collectionName: 'sessions' // Explicitly name the collection
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // Extend to 24 hours for better user experience
        httpOnly: true, // Prevents client-side JS from reading the cookie
        secure: process.env.NODE_ENV === 'production', // Ensures cookies are only used over HTTPS in production
        sameSite: 'lax' // Changed from 'strict' to 'lax' to help with redirects
    }
};

// Session middleware before routes
app.use(session(sessionOptions));

// Flash messages
app.use(flash());

// Log session info before processing the request 
app.use((req, res, next) => {
    // Add flash messages to res.locals
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');

    // Continue to the next middleware
    next();
});

// Add prevent-back.js to all dashboard pages
app.use((req, res, next) => {
    if (req.path.includes('/dashboard')) {
        res.locals.scripts = res.locals.scripts || [];
        res.locals.scripts.push('/js/prevent-back.js');
    }
    next();
});

// Set EJS as View Engine
app.set('view engine', 'ejs');

// Add community management information to all requests with a user session
app.use(async (req, res, next) => {
    if (req.session && req.session.userId) {
        try {
            const user = await CommunityUser.findById(req.session.userId);
            if (user) {
                req.user = user;
                // Set the community ID in the session if not already set
                if (user.community && !req.session.communityId) {
                    req.session.communityId = user.community;
                }
                // Set admin status in the session
                req.session.isAdmin = user.isAdmin;
            }
        } catch (err) {
            console.error('Error fetching user info:', err);
        }
    }
    next();
});

// Add vendor session info to all requests with a vendor session
app.use(async (req, res, next) => {
    // Handle vendor sessions
    if (req.session && req.session.vendorId) {
        try {
            const vendor = await VendorUser.findById(req.session.vendorId);
            if (vendor) {
                req.vendor = vendor;
            } else {
                console.warn(`Invalid vendorId in session: ${req.session.vendorId}`);
            }
        } catch (err) {
            console.error('Error retrieving vendor from session ID:', err);
        }
    }

    next();
});

// Database connection monitoring middleware
let lastConnectionWarning = 0;
app.use((req, res, next) => {
    // Check MongoDB connection status on each request
    if (mongoose.connection.readyState !== 1) {
        const now = Date.now();
        // Only log once per minute to avoid flooding the console
        if (now - lastConnectionWarning > 60000) {
            console.warn('MongoDB connection is not ready on request to:', req.originalUrl);
            lastConnectionWarning = now;

            // Try to reconnect if disconnected (readyState 0)
            if (mongoose.connection.readyState === 0) {
                console.log('Attempting to reconnect to MongoDB...');
                connectDB().catch(err => {
                    console.error('Failed to reconnect to MongoDB:', err.message);
                });
            }
        }
    }
    next();
});

// Middleware to handle category image requests
app.use('/uploads/items', (req, res, next) => {
    const filename = path.basename(req.url);
    if (filename.includes('&') || filename.includes('%20') || filename.includes(',')) {
        // This is likely a category image - serve a generic placeholder instead
        console.log(`[DEBUG] Serving generic image for category: ${filename}`);
        return res.redirect('/img/placeholder-category.jpg');
    }
    next();
});

// Add current year to all views
app.use((req, res, next) => {
    res.locals.currentYear = new Date().getFullYear();
    next();
});

// Add performance optimization script to all pages in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        res.locals.scripts = res.locals.scripts || [];
        res.locals.scripts.push('/js/performance-optimization.js');
        next();
    });
}

// **Routes**
app.use(authRoutes);
app.use(dashboardRoutes);
app.use('/vendor/items', vendorItemsRoutes);
app.use('/vendor/orders', vendorOrdersRoutes);
app.use('/vendor/analytics', vendorAnalyticsRoutes);
app.use('/vendor/settings', vendorSettingsRoutes);
app.use('/cart', cartRoutes);
app.use('/items', communityItemsRoutes);
app.use('/group-orders', groupOrdersRoutes);
app.use('/orders', communityOrdersRoutes);
app.use('/', communityManagement.router);
app.use('/admin', communityManagement.router);
app.use('/api', apiRoutes);

app.get('/', (req, res) => res.redirect('/login'));

// Add API routes for admin dashboard data
app.get('/api/admin/cart-count', async (req, res) => {
    try {
        if (!req.session.userId || !req.session.isAdmin || !req.session.communityId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Get all non-admin users in this community
        const users = await CommunityUser.find({
            community: req.session.communityId,
            isAdmin: false
        });

        const userIds = users.map(user => user._id);
        const activeCarts = await Cart.countDocuments({
            userId: { $in: userIds },
            isActive: true
        });

        res.json({ success: true, count: activeCarts });
    } catch (err) {
        console.error('Error fetching cart count:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/group-order-count', async (req, res) => {
    try {
        if (!req.session.userId || !req.session.isAdmin || !req.session.communityId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const groupOrders = await GroupOrder.countDocuments({
            communityId: req.session.communityId
        });

        res.json({ success: true, count: groupOrders });
    } catch (err) {
        console.error('Error fetching group order count:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Route debugging middleware - log all requests that make it to this point
app.use((req, res, next) => {
    console.log(`[DEBUG ROUTES] ${req.method} ${req.originalUrl} - No matching route found`);
    next();
});

// Add 404 and error handling middleware at the end of all route definitions
app.use((req, res, next) => {
    console.error(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).render('error', {
        message: 'Page Not Found',
        error: {
            status: 404,
            stack: `The requested URL ${req.originalUrl} was not found on this server.`
        }
    });
});

app.use((err, req, res, next) => {
    // Log the error with timestamp
    console.error(`[${new Date().toISOString()}] Error occurred: ${err.message}`, err.stack);

    // Set appropriate status code (default to 500 if none set)
    const statusCode = err.status || 500;

    // Provide different error views based on requested format
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        // JSON response for AJAX requests
        return res.status(statusCode).json({
            success: false,
            message: err.message,
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }

    // Standard HTML error page
    res.status(statusCode).render('error', {
        message: err.message,
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Shared shutdown function for all exit scenarios
let isShuttingDown = false;
function shutdown(reason) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nShutdown initiated: ${reason}`);

    // Close database connection if needed
    if (mongoose.connection.readyState !== 0) {
        try {
            mongoose.connection.close(false);
            console.log('MongoDB connection closed');
        } catch (err) {
            console.error('Error closing MongoDB connection:', err);
        }
    }

    // Final exit
    console.log('Exiting process');
    process.exit(0);
}

// Only start the server directly if not being required by another module (like server.js)
if (require.main === module) {
    // Function to start server and try alternative ports if the main one is in use
    function startServer(port) {
        const server = app.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
            console.log('Press Ctrl+C to stop the server');
        }).on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.warn(`⚠️ Port ${port} is already in use, trying port ${port + 1}...`);
                startServer(port + 1);
            } else {
                console.error('Server error:', error);
                shutdown('Server error: ' + error.message);
            }
        });

        // Monitor database connection during runtime
        let dbMonitorInterval = setInterval(async () => {
            if (mongoose.connection.readyState !== 1) {
                console.warn('Periodic DB connection check failed - attempting reconnection');
                try {
                    await connectDB();
                    console.log('Database reconnection successful');
                } catch (error) {
                    console.error('Database reconnection failed:', error.message);
                }
            }
        }, 60000); // Check every minute

        // Handle shutdown signals
        function handleShutdown(signal) {
            clearInterval(dbMonitorInterval);
            server.close(() => {
                console.log('HTTP server closed');
                shutdown(signal);
            });
        }

        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));

        return server;
    }

    // Start the server on port 3000 by default
    const PORT = process.env.PORT || 3000;
    startServer(PORT);
} else {
    // If being required as a module (like in server.js), just export the app
    console.log('App is being required as a module');
}

// Export the app for use in other files (like server.js)
module.exports = app;
