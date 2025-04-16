const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CommunityUser = require('../models/CommunityUser');
const VendorUser = require('../models/VendorUser');

exports.getCommunityLogin = (req, res) => {
    res.render('communityLogin', { message: null });
};

exports.getVendorLogin = (req, res) => {
    res.render('vendorLogin', { message: null });
};

exports.registerCommunity = async (req, res) => {
    try {
        const { name, username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new CommunityUser({ name, username, email, password: hashedPassword });
        await user.save();
        res.redirect('/login/community');
    } catch (error) {
        res.render('communityRegister', { message: "Error registering user" });
    }
};

exports.loginCommunity = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await CommunityUser.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('communityLogin', { message: "Invalid credentials" });
        }
        req.session.userId = user._id;
        res.redirect('/dashboard');
    } catch (error) {
        res.render('communityLogin', { message: "Login failed" });
    }
};
