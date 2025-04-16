/**
 * Production optimization script for Render deployment
 * This script runs during the build phase to optimize the application
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Running production optimizations...');

// Ensure NODE_ENV is set to production
process.env.NODE_ENV = 'production';
console.log('✓ Environment set to production');

// Validate critical environment variables
const requiredVars = ['MONGO_URI', 'SESSION_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please add these to your Render environment variables');
    process.exit(1);
}

console.log('✓ Environment variables validated');

// Create a health check file if it doesn't exist
const healthCheckPath = path.join(__dirname, '..', 'routes', 'api.js');
let apiContent = '';

try {
    apiContent = fs.readFileSync(healthCheckPath, 'utf8');
} catch (err) {
    console.error(`❌ Could not read API routes file: ${err.message}`);
    process.exit(1);
}

// Add health check endpoint if it doesn't exist
if (!apiContent.includes('/health')) {
    console.log('✓ Adding health check endpoint for Render...');
    const healthCheckCode = `
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
`;

    // Find a good spot to insert the health check (before module.exports)
    const moduleExportsIndex = apiContent.indexOf('module.exports');
    if (moduleExportsIndex !== -1) {
        const newContent = apiContent.slice(0, moduleExportsIndex) + healthCheckCode + apiContent.slice(moduleExportsIndex);
        fs.writeFileSync(healthCheckPath, newContent);
        console.log('✓ Health check endpoint added successfully');
    } else {
        console.log('⚠️ Could not add health check endpoint - module.exports not found');
    }
}

console.log('✅ Production optimization complete. Ready for deployment!'); 