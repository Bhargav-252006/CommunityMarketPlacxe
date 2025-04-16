const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const CommunityUser = require('../models/CommunityUser');
const VendorUser = require('../models/VendorUser');
const Community = require('../models/Community');
const communityManagement = require('./communityManagement');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isVendor, isCommunityAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/vendor-logos');
    },
    filename: function (req, file, cb) {
        cb(null, 'vendor-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

router.get('/login', (req, res) => {
    // Check if we need to reset session due to errors
    if (req.query.reset) {
        // Regenerate session to fix potential session corruption
        req.session.regenerate(err => {
            if (err) {
                console.error('Failed to regenerate session:', err);
            }
            // Show a helpful message to the user
            res.render('generalLogin', { message: 'Your session has been reset. Please login again.' });
        });
        return;
    }

    res.render('generalLogin', { message: null });
});

router.post('/login', (req, res) => {
    const { role } = req.body;

    // Redirect to the appropriate login page based on role
    if (role === 'community') {
        return res.redirect('/community/login');
    } else if (role === 'vendor') {
        return res.redirect('/vendor/login');
    } else if (role === 'admin') {
        return res.redirect('/admin/login');
    } else {
        return res.render('generalLogin', { message: 'Please select a valid role.' });
    }
});

// =================== Community Routes =================== //

// GET Community Registration Page
router.get('/community/register', async (req, res) => {
    try {
        // Get all available communities for the user to select
        const communities = await Community.find();
        res.render('communityRegister', {
            message: null,
            communities: communities
        });
    } catch (err) {
        console.error('Error fetching communities for registration:', err);
        res.render('communityRegister', {
            message: 'Error loading communities. Please try again.',
            communities: []
        });
    }
});

// Helper function to check for leading whitespace
const hasLeadingWhitespace = (value) => {
    return typeof value === 'string' && value.startsWith(' ');
};

// POST Community Registration
router.post('/community/register', async (req, res) => {
    try {
        let { name, username, email, password, confirmPassword, communityId } = req.body;

        // Validate required fields
        if (!name || !username || !email || !password) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'All fields are required.',
                communities: communities
            });
        }

        // Check for leading whitespace in text fields
        if (hasLeadingWhitespace(name) || hasLeadingWhitespace(username) || hasLeadingWhitespace(email)) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Input fields cannot start with spaces.',
                communities: communities
            });
        }

        // Validate name length (3-50 characters)
        if (name.length < 3 || name.length > 50) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Name must be between 3-50 characters.',
                communities: communities
            });
        }

        // Validate username format (starts with letter, contains only letters, numbers, underscores, 4-16 characters)
        const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,15}$/;
        if (!usernameRegex.test(username)) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Username must start with a letter, contain only letters, numbers, and underscores, and be 4-16 characters long.',
                communities: communities
            });
        }

        // Validate email format
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Please enter a valid email address.',
                communities: communities
            });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Password must be at least 8 characters and include letters and numbers.',
                communities: communities
            });
        }

        // Check if passwords match
        if (confirmPassword && password !== confirmPassword) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Passwords do not match.',
                communities: communities
            });
        }

        // If no communityId is provided, get the first available community
        if (!communityId) {
            const communities = await Community.find().limit(1);
            if (communities && communities.length > 0) {
                communityId = communities[0]._id;
            } else {
                return res.render('communityRegister', {
                    message: 'No communities available. Please contact an administrator.',
                    communities: []
                });
            }
        }

        // Validate community exists
        const community = await Community.findById(communityId);
        if (!community) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: 'Selected community does not exist. Please choose a valid community.',
                communities: communities
            });
        }

        // Check for existing users with same email or username
        const existingUser = await CommunityUser.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            const communities = await Community.find();
            return res.render('communityRegister', {
                message: existingUser.email === email ?
                    'Email already exists. Try logging in!' :
                    'Username already taken. Please choose a different username.',
                communities: communities
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new CommunityUser({
            name,
            username,
            email,
            password: hashedPassword,
            isAdmin: false,
            community: communityId
        });

        await user.save();
        res.redirect('/community/login');
    } catch (err) {
        console.error('Community registration error:', err);
        const communities = await Community.find();
        res.render('communityRegister', {
            message: 'Error registering user. Please try again.',
            communities: communities
        });
    }
});

// POST Admin Registration - this would typically be done through a different interface
router.post('/admin/register', async (req, res) => {
    try {
        const { name, username, email, password, communityId } = req.body;

        // Check if community exists
        const community = await Community.findById(communityId);
        if (!community) {
            return res.status(400).json({
                success: false,
                message: 'Community not found'
            });
        }

        // Check if user already exists
        const existingUser = await CommunityUser.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Create admin user
        const hashedPassword = await bcrypt.hash(password, 10);
        const adminUser = new CommunityUser({
            name,
            username,
            email,
            password: hashedPassword,
            isAdmin: true,
            community: communityId
        });

        await adminUser.save();

        // Add admin to community's admin list
        community.adminUsers.push(adminUser._id);
        await community.save();

        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            userId: adminUser._id
        });
    } catch (err) {
        console.error('Admin registration error:', err);
        res.status(500).json({
            success: false,
            message: 'Error registering admin user'
        });
    }
});

// GET Community Login Page
router.get('/community/login', async (req, res) => {
    try {
        // Check MongoDB connection status
        const connectionState = mongoose.connection.readyState;

        // Always try to create a default community if needed
        try {
            await communityManagement.createDefaultCommunityIfNone();
        } catch (createErr) {
            console.error('Error in createDefaultCommunityIfNone:', createErr);
            // Continue even if this fails
        }

        // Get all available communities for the user to select
        let communities = [];
        try {
            communities = await Community.find();
        } catch (findErr) {
            console.error('Error finding communities:', findErr);
            throw findErr; // Re-throw to be caught by outer catch
        }

        if (communities.length === 0) {
            // Try again with a direct creation as a last resort
            try {
                const emergencyCommunity = new Community({
                    name: 'Emergency Community',
                    description: 'Created automatically due to database issues',
                    communityId: 'emergency-' + Date.now().toString().slice(-6),
                    adminUsers: []
                });

                await emergencyCommunity.save();

                // Try fetching again
                communities = await Community.find();
            } catch (emergencyErr) {
                console.error('Failed emergency community creation:', emergencyErr);
                // Continue with empty communities array
            }
        }

        res.render('communityLogin', {
            message: communities.length === 0 ? 'No communities found. Please create one first.' : null,
            communities: communities
        });
    } catch (err) {
        console.error('Error fetching communities for login:', err);

        // More helpful error message based on error type
        let errorMessage = 'Error loading communities. ';

        if (err.name === 'MongoNetworkError' || err.message.includes('connection failed')) {
            errorMessage += 'Database connection problem. Please ensure MongoDB is running.';
        } else {
            errorMessage += 'Please try again or contact support if the problem persists.';
        }

        // Render the page with error
        res.render('communityLogin', {
            message: errorMessage,
            communities: []
        });
    }
});

// Add this route before the POST /community/login route
router.post('/community/check-admin', async (req, res) => {
    try {
        const { email, password, communityId } = req.body;

        // Find community first
        const community = await Community.findById(communityId);
        if (!community) {
            return res.json({ isAdmin: false });
        }

        // Find user with the given email in the selected community
        const user = await CommunityUser.findOne({
            email,
            community: communityId
        });

        if (!user) {
            return res.json({ isAdmin: false });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ isAdmin: false });
        }

        // Return whether the user is an admin
        return res.json({
            isAdmin: user.isAdmin,
            communityName: community.name
        });
    } catch (err) {
        console.error('Error checking admin status:', err);
        return res.json({ isAdmin: false });
    }
});

// POST Community Login
router.post('/community/login', async (req, res) => {
    try {
        const { email, password, communityId, adminKey } = req.body;

        // Validate required fields
        if (!email || !password || !communityId) {
            return res.render('communityLogin', {
                message: 'All fields are required',
                communities: await Community.find()
            });
        }

        // Check for leading whitespace in email field
        if (hasLeadingWhitespace(email)) {
            return res.render('communityLogin', {
                message: 'Email/username cannot start with spaces',
                communities: await Community.find()
            });
        }

        // Validate community exists
        const community = await Community.findById(communityId);
        if (!community) {
            return res.render('communityLogin', {
                message: 'Selected community does not exist',
                communities: await Community.find()
            });
        }

        // Find user by email or username
        const user = await CommunityUser.findOne({
            $and: [
                { community: communityId },
                { $or: [{ email }, { username: email }] }
            ]
        });

        if (!user) {
            return res.render('communityLogin', {
                message: 'User not found in selected community. Check your email or username.',
                communities: await Community.find()
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('communityLogin', {
                message: 'Invalid password. Please try again.',
                communities: await Community.find()
            });
        }

        // Regenerate session to prevent session fixation
        req.session.regenerate((err) => {
            if (err) {
                console.error('Error regenerating session:', err);
                // Handle error without using async/await inside this callback
                Community.find().then(communities => {
                    return res.render('communityLogin', {
                        message: 'Login error. Please try again.',
                        communities: communities
                    });
                }).catch(findErr => {
                    console.error('Error finding communities:', findErr);
                    return res.render('communityLogin', {
                        message: 'Login error. Please try again.',
                        communities: []
                    });
                });
                return;
            }

            // Set user session with consistent data
            req.session.userId = user._id;
            req.session.communityId = community._id;
            req.session.isAdmin = user.isAdmin;
            req.session.loginTime = Date.now();

            // Save the session before redirection
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err);
                    Community.find().then(communities => {
                        return res.render('communityLogin', {
                            message: 'Login error. Please try again.',
                            communities: communities
                        });
                    }).catch(findErr => {
                        console.error('Error finding communities:', findErr);
                        return res.render('communityLogin', {
                            message: 'Login error. Please try again.',
                            communities: []
                        });
                    });
                    return;
                }

                // Redirect based on user type
                if (user.isAdmin) {
                    // If admin key is provided, verify it
                    if (adminKey) {
                        // Get the community's admin key
                        const communityAdminKey = community.adminKey;

                        // If the admin key doesn't match, show an error
                        if (!communityAdminKey || adminKey !== communityAdminKey) {
                            // Get communities before destroying session
                            req.session.destroy((err) => {
                                if (err) {
                                    console.error('Error destroying session:', err);
                                }

                                return res.render('communityLogin', {
                                    message: 'Invalid admin key. Please try again.',
                                    email: email, // Preserve email for convenience
                                    requireAdminKey: true,
                                    communities: []
                                });
                            });
                            return;
                        }

                        // Admin key verified, redirect to admin dashboard
                        console.log('Admin login successful, redirecting to admin dashboard');
                        return res.redirect('/admin/dashboard');
                    } else {
                        // Admin key is required but not provided
                        req.session.destroy((err) => {
                            if (err) {
                                console.error('Error destroying session:', err);
                            }

                            return res.render('communityLogin', {
                                message: 'Admin key is required for admin login.',
                                email: email, // Preserve email for convenience
                                requireAdminKey: true,
                                communities: []
                            });
                        });
                        return;
                    }
                } else {
                    // Regular user, no admin key needed
                    console.log('Community user login successful, redirecting to dashboard');
                    return res.redirect('/dashboard');
                }
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        const communities = await Community.find();
        res.render('communityLogin', {
            message: 'An error occurred during login. Please try again.',
            communities: communities
        });
    }
});

// =================== Vendor Routes =================== //

// GET Vendor Registration Page
router.get('/vendor/register', (req, res) => {
    res.render('vendorRegister', {
        title: 'Vendor Registration',
        categories: [] // Will be populated with actual categories when available
    });
});

router.post('/vendor/register', async (req, res) => {
    try {
        const { businessName, vendorId, email, password, confirmPassword } = req.body;

        // Validate required fields
        if (!businessName || !vendorId || !email || !password || !confirmPassword) {
            return res.render('vendorRegister', {
                error: 'All fields are required',
                inputData: req.body
            });
        }

        // Check for leading whitespace in text fields
        if (hasLeadingWhitespace(businessName) || hasLeadingWhitespace(vendorId) || hasLeadingWhitespace(email)) {
            return res.render('vendorRegister', {
                error: 'Input fields cannot start with spaces',
                inputData: req.body
            });
        }

        // Validate vendorId format
        const vendorIdRegex = /^[a-zA-Z0-9-_]{4,20}$/;
        if (!vendorIdRegex.test(vendorId)) {
            return res.render('vendorRegister', {
                error: 'Vendor ID must be 4-20 characters and can only contain letters, numbers, hyphens and underscores',
                inputData: req.body
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('vendorRegister', {
                error: 'Please enter a valid email address',
                inputData: req.body
            });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('vendorRegister', {
                error: 'Password must be at least 8 characters with letters and numbers',
                inputData: req.body
            });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.render('vendorRegister', {
                error: 'Passwords do not match',
                inputData: req.body
            });
        }

        // Check if vendor already exists
        const existingVendor = await VendorUser.findOne({
            $or: [
                { email: email },
                { vendorId: vendorId }
            ]
        });

        if (existingVendor) {
            return res.render('vendorRegister', {
                error: 'A vendor with this email or vendor ID already exists',
                inputData: req.body
            });
        }

        // Store the data in session for step 2
        req.session.vendorData = {
            businessName,
            vendorId,
            email,
            password
        };

        // Redirect to step 2
        res.redirect('/vendor/register/step2');

    } catch (error) {
        console.error('Vendor registration step 1 error:', error);
        res.render('vendorRegister', {
            error: 'An error occurred during registration. Please try again.',
            inputData: req.body
        });
    }
});

router.get('/vendor/register/step2', (req, res) => {
    // Check if step 1 was completed
    if (!req.session.vendorData) {
        return res.redirect('/vendor/register');
    }

    // Make sure uploads directory exists
    const uploadDir = 'public/uploads/vendor-logos';
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Get categories from database if available
    // For now, we'll pass an empty array
    res.render('vendorRegisterStep2', {
        title: 'Complete Vendor Registration',
        businessName: req.session.vendorData.businessName,
        categories: [] // Will be populated with actual categories when available
    });
});

router.post('/vendor/register/step2', upload.single('logo'), async (req, res) => {
    try {
        // Check if step 1 was completed
        if (!req.session.vendorData) {
            return res.redirect('/vendor/register');
        }

        const { ownerName, phone, address, description, bankDetails } = req.body;
        const { businessName, vendorId, email, password } = req.session.vendorData;

        // Validate required fields for step 2
        if (!ownerName || !phone || !address) {
            return res.render('vendorRegisterStep2', {
                error: 'Owner name, phone, and address are required',
                businessName,
                inputData: req.body,
                categories: []
            });
        }

        // Check for leading whitespace in text fields
        if (hasLeadingWhitespace(ownerName) || hasLeadingWhitespace(address) ||
            (description && hasLeadingWhitespace(description)) ||
            (bankDetails && hasLeadingWhitespace(bankDetails))) {
            return res.render('vendorRegisterStep2', {
                error: 'Input fields cannot start with spaces',
                businessName,
                inputData: req.body,
                categories: []
            });
        }

        // Validate phone format (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.render('vendorRegisterStep2', {
                error: 'Please enter a valid 10-digit phone number',
                businessName,
                inputData: req.body,
                categories: []
            });
        }

        try {
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Handle logo file if present
            let logoPath = '';
            if (req.file) {
                logoPath = '/uploads/vendor-logos/' + req.file.filename;
            }

            // Create new vendor
            const newVendor = new VendorUser({
                businessName,
                vendorId,
                email,
                password: hashedPassword,
                ownerName,
                phone,
                address,
                description: description || '',
                logo: logoPath,
                bankDetails: bankDetails || '',
                status: 'pending', // Default status for new vendors
                createdAt: new Date()
            });

            // Save the vendor to database
            await newVendor.save();

            // Clear session data
            delete req.session.vendorData;

            // Redirect to login page with success message
            res.redirect('/vendor/login?registered=true');
        } catch (dbError) {
            console.error('Database error during registration:', dbError);
            return res.render('vendorRegisterStep2', {
                error: 'Error saving vendor data. Please try again.',
                businessName,
                inputData: req.body,
                categories: []
            });
        }

    } catch (error) {
        console.error('Vendor registration step 2 error:', error);
        res.render('vendorRegisterStep2', {
            error: 'An error occurred during registration. Please try again.',
            businessName: req.session.vendorData ? req.session.vendorData.businessName : '',
            inputData: req.body,
            categories: []
        });
    }
});

// GET Vendor Login Page
router.get('/vendor/login', (req, res) => {
    res.render('vendorLogin', { message: null });
});

// POST Vendor Login
router.post('/vendor/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.render('vendorLogin', {
                message: 'Email and password are required'
            });
        }

        // Check for leading whitespace in email field
        if (hasLeadingWhitespace(email)) {
            return res.render('vendorLogin', {
                message: 'Email cannot start with spaces'
            });
        }

        // Find vendor by email only (no longer checking vendorId)
        const vendor = await VendorUser.findOne({ email });

        if (!vendor) {
            return res.render('vendorLogin', {
                message: 'Vendor not found. Check your email or register first.'
            });
        }

        const isMatch = await bcrypt.compare(password, vendor.password);
        if (!isMatch) {
            return res.render('vendorLogin', {
                message: 'Invalid password. Please try again.'
            });
        }

        // Store vendor ID in session
        req.session.vendorId = vendor._id;

        // Redirect to the vendor dashboard
        res.redirect('/vendor/dashboard');
    } catch (err) {
        console.error('Vendor Login Error:', err);
        res.render('vendorLogin', {
            message: 'An error occurred during login. Please try again.'
        });
    }
});

// Logout Route (for both Community & Vendor)
router.get('/logout', (req, res) => {
    // Store the session data before destroying it
    const wasVendor = !!req.session.vendorId;

    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/login');
        }

        // Clear any existing cookies
        res.clearCookie('connect.sid');

        // Set cache control headers
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Redirect to appropriate login page
        if (wasVendor) {
            res.redirect('/vendor/login');
        } else {
            res.redirect('/login');
        }
    });
});

// Debug route to test database connection
router.get('/debug/db-status', async (req, res) => {
    try {
        // Check connection state
        const stateMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        const connectionState = mongoose.connection.readyState;

        // Count communities
        const communityCount = await Community.countDocuments();

        // Get a list of communities
        const communities = await Community.find().limit(10);

        res.json({
            success: true,
            database: {
                connectionState: connectionState,
                connectionStateText: stateMap[connectionState] || 'unknown',
                connected: connectionState === 1
            },
            communities: {
                count: communityCount,
                sample: communities.map(c => ({
                    id: c._id,
                    name: c.name,
                    communityId: c.communityId
                }))
            }
        });
    } catch (err) {
        console.error('Database diagnostic error:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            errorName: err.name,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

module.exports = router;
