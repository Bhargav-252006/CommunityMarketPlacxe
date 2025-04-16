const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const VendorUser = require('../models/VendorUser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/vendors')
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

// Get settings page
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const vendor = await VendorUser.findById(req.session.vendorId);
        if (!vendor) {
            return res.redirect('/vendor/login');
        }

        res.render('vendorSettings', {
            vendor,
            successMessage: req.flash ? req.flash('success') : null,
            errorMessage: req.flash ? req.flash('error') : null,
            title: 'Vendor Settings',
            currentPage: 'settings'
        });
    } catch (error) {
        console.error('Error fetching vendor settings:', error);
        res.status(500).render('error', {
            message: 'Error fetching vendor settings',
            error: error.message
        });
    }
});

// Update profile information
router.post('/profile', ensureAuthenticated, upload.single('profileImage'), async (req, res) => {
    try {
        const { businessName, email, phone, address, description } = req.body;

        // Validate required fields
        if (!businessName || !email) {
            if (req.flash) req.flash('error', 'Business name and email are required');
            return res.redirect('/vendor/settings');
        }

        // Check if email is already in use by another vendor
        const existingVendor = await VendorUser.findOne({
            email,
            _id: { $ne: req.session.vendorId }
        });

        if (existingVendor) {
            if (req.flash) req.flash('error', 'Email is already in use');
            return res.redirect('/vendor/settings');
        }

        // Update profile data
        const updateData = {
            businessName,
            email,
            phone,
            address,
            description
        };

        // Add profile image if uploaded
        if (req.file) {
            updateData.profileImage = `/uploads/vendors/${req.file.filename}`;
        }

        await VendorUser.findByIdAndUpdate(req.session.vendorId, updateData);

        if (req.flash) req.flash('success', 'Profile updated successfully');
        res.redirect('/vendor/settings');
    } catch (error) {
        console.error('Error updating profile:', error);
        if (req.flash) req.flash('error', `Error updating profile: ${error.message}`);
        res.redirect('/vendor/settings');
    }
});

// Update password
router.post('/password', ensureAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate form data
        if (!currentPassword || !newPassword || !confirmPassword) {
            if (req.flash) req.flash('error', 'All password fields are required');
            return res.redirect('/vendor/settings');
        }

        if (newPassword !== confirmPassword) {
            if (req.flash) req.flash('error', 'New passwords do not match');
            return res.redirect('/vendor/settings');
        }

        if (newPassword.length < 6) {
            if (req.flash) req.flash('error', 'Password must be at least 6 characters long');
            return res.redirect('/vendor/settings');
        }

        // Get current vendor
        const vendor = await VendorUser.findById(req.session.vendorId);
        if (!vendor) {
            if (req.flash) req.flash('error', 'Vendor not found');
            return res.redirect('/vendor/login');
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, vendor.password);
        if (!isMatch) {
            if (req.flash) req.flash('error', 'Current password is incorrect');
            return res.redirect('/vendor/settings');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await VendorUser.findByIdAndUpdate(req.session.vendorId, {
            password: hashedPassword
        });

        if (req.flash) req.flash('success', 'Password updated successfully');
        res.redirect('/vendor/settings');
    } catch (error) {
        console.error('Error updating password:', error);
        if (req.flash) req.flash('error', `Error updating password: ${error.message}`);
        res.redirect('/vendor/settings');
    }
});

// Update notification settings
router.post('/notifications', ensureAuthenticated, async (req, res) => {
    try {
        const { emailNotifications, orderUpdates, marketingEmails } = req.body;

        // Update notification settings
        await VendorUser.findByIdAndUpdate(req.session.vendorId, {
            notificationSettings: {
                emailNotifications: emailNotifications === 'on',
                orderUpdates: orderUpdates === 'on',
                marketingEmails: marketingEmails === 'on'
            }
        });

        if (req.flash) req.flash('success', 'Notification settings updated successfully');
        res.redirect('/vendor/settings');
    } catch (error) {
        console.error('Error updating notification settings:', error);
        if (req.flash) req.flash('error', `Error updating notification settings: ${error.message}`);
        res.redirect('/vendor/settings');
    }
});

module.exports = router; 