module.exports = {
    // Enhanced cache control middleware
    preventCache: (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        next();
    },

    // Add a new middleware to check session validity
    checkSession: (req, res, next) => {
        if (req.session && (req.session.userId || req.session.vendorId)) {
            return next();
        }

        // If no valid session, redirect to login
        if (req.path.startsWith('/vendor')) {
            return res.redirect('/vendor/login');
        }
        return res.redirect('/login');
    },

    ensureAuthenticated: (req, res, next) => {
        if (req.session.userId || req.session.vendorId) {
            return next();
        }
        // Check if the request is for vendor routes
        if (req.path.startsWith('/vendor')) {
            return res.redirect('/vendor/login');
        }
        res.redirect('/login');
    },
    ensureGuest: (req, res, next) => {
        if (!req.session.userId && !req.session.vendorId) {
            return next();
        }
        // Check if the request is for vendor routes
        if (req.path.startsWith('/vendor')) {
            return res.redirect('/vendor/items');
        }
        res.redirect('/dashboard');
    },
    // New middleware to ensure the user is an admin
    ensureAdmin: async (req, res, next) => {
        // Check if user is logged in
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        // Check if user is an admin
        if (!req.session.isAdmin) {
            return res.status(403).render('error', {
                message: 'Access Denied',
                error: 'You must be an admin to perform this action'
            });
        }

        next();
    },
    // Middleware to prevent admin users from accessing user dashboards directly
    preventAdminDirectAccess: (req, res, next) => {
        // If an admin is viewing a user's data, they should be redirected to admin interface
        if (req.session.isAdmin && req.originalUrl === '/dashboard') {
            console.log('Admin attempting to access user dashboard - redirecting to admin dashboard');
            return res.redirect('/admin/dashboard');
        }

        // For non-admin users, allow access to the dashboard
        next();
    },
    // Middleware to handle admin cart management permissions
    ensureAdminCartAccess: async (req, res, next) => {
        // Check if user is logged in and is an admin
        if (!req.session.userId || !req.session.isAdmin) {
            return res.status(403).render('error', {
                message: 'Access Denied',
                error: 'You must be an admin to view user carts'
            });
        }

        // If we're viewing a specific user's cart, verify the user belongs to admin's community
        if (req.params.userId) {
            try {
                const CommunityUser = require('../models/CommunityUser');
                const user = await CommunityUser.findOne({
                    _id: req.params.userId,
                    community: req.session.communityId
                });

                if (!user) {
                    return res.status(404).render('error', {
                        message: 'User not found',
                        error: 'The requested user does not exist or does not belong to your community'
                    });
                }

                // Store user data for the route handler
                req.targetUser = user;
            } catch (err) {
                console.error('Admin cart access error:', err);
                return res.status(500).render('error', {
                    message: 'Error accessing user data',
                    error: err.message
                });
            }
        }

        next();
    }
};
