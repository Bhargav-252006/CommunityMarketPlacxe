const jwt = require('jsonwebtoken');
const CommunityUser = require('../models/CommunityUser');
const VendorUser = require('../models/VendorUser');

// Middleware to check if user is authenticated (session-based)
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/community/login');
};

// Middleware to check if user is a vendor
const isVendor = (req, res, next) => {
    if (req.session.vendorId) {
        return next();
    }
    res.redirect('/vendor/login');
};

// Middleware to check if user is a community admin
const isCommunityAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/community/login');
        }

        const user = await CommunityUser.findById(req.session.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).render('error', { 
                message: 'Access denied. Admin privileges required.' 
            });
        }

        next();
    } catch (err) {
        console.error('Admin authentication error:', err);
        res.status(500).render('error', { 
            message: 'Authentication error. Please try again.' 
        });
    }
};

module.exports = {
    isAuthenticated,
    isVendor,
    isCommunityAdmin
}; 