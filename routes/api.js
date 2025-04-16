const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Check session validity
router.get('/check-session', (req, res) => {
    const isAuthenticated = req.session && (req.session.userId || req.session.vendorId);
    res.json({ authenticated: isAuthenticated });
});

// Health check endpoint for Render
router.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        status: 'ok',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        database: dbStatus
    });
});

module.exports = router; 