const express = require('express');
const router = express.Router();

// Check session validity
router.get('/check-session', (req, res) => {
    const isAuthenticated = req.session && (req.session.userId || req.session.vendorId);
    res.json({ authenticated: isAuthenticated });
});

module.exports = router; 