/**
 * Production server entry point
 * This file ensures all environment variables are set properly before starting the app
 */

// Set NODE_ENV to production if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// MongoDB optimizations for production
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false); // Disable command buffering for better memory usage

// Require the main app
const app = require('./app');

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Set SESSION_SECRET if not already set
if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET not set! Using a random value (not recommended for production)');
    process.env.SESSION_SECRET = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

// Memory monitoring for Render
let memoryInterval;
if (process.env.NODE_ENV === 'production') {
    memoryInterval = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100;

        if (memoryUsageMB > 450) { // Approaching Render's 512MB limit
            console.warn(`HIGH MEMORY USAGE: ${memoryUsageMB}MB - Triggering garbage collection`);
            if (global.gc) {
                global.gc();
                console.log('Garbage collection completed');
            }
        }
    }, 30000); // Check every 30 seconds
}

// Start server
const server = app.listen(PORT, () => {
    console.log(`[PRODUCTION] Server running on port ${PORT}`);
    console.log(`MongoDB connected to: ${process.env.MONGO_URI.split('@')[1]}`); // Only log the host, not credentials
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    clearInterval(memoryInterval);
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false)
            .then(() => {
                console.log('MongoDB connection closed');
                process.exit(0);
            })
            .catch(err => {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    clearInterval(memoryInterval);
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false)
            .then(() => {
                console.log('MongoDB connection closed');
                process.exit(0);
            })
            .catch(err => {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            });
    });
}); 