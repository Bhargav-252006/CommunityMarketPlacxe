const mongoose = require('mongoose');
require('dotenv').config();

// Production optimizations
if (process.env.NODE_ENV === 'production') {
    // Log slow queries (taking more than 500ms)
    mongoose.set('debug', {
        slowMs: 500,
        logFn: (collectionName, methodName, ...methodArgs) => {
            if (methodName.startsWith('find') || methodName === 'aggregate') {
                console.warn(`[SLOW QUERY] ${collectionName}.${methodName} (>500ms)`);
            }
        }
    });

    // Disable automatic indexing in production
    mongoose.set('autoIndex', false);
}

// Connection options for better reliability
const options = {
    serverSelectionTimeoutMS: 10000, // Increased timeout for server selection
    socketTimeoutMS: 60000, // Increased socket timeout
    connectTimeoutMS: 15000, // Increased connection timeout
    retryWrites: true, // Retry write operations
    maxPoolSize: 15, // Increased pool size for production
    family: 4, // Use IPv4, skip IPv6
    autoIndex: false // Don't build indexes in production
};

const connectDB = async () => {
    let retries = 5;

    while (retries > 0) {
        try {
            await mongoose.connect(process.env.MONGO_URI, options);
            console.log('MongoDB successfully connected');
            return; // Connection successful, exit function
        } catch (error) {
            console.error('MongoDB connection error:', error.message);

            if (error.name === 'MongoServerSelectionError' && retries > 0) {
                console.log(`Connection attempt failed. Retrying... (${retries} attempts left)`);
                retries--;
                // Wait for 2 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.error('Failed to connect to MongoDB after multiple attempts');
                process.exit(1); // Exit with error
            }
        }
    }

    console.error('Could not connect to MongoDB. Check your connection string and ensure MongoDB is running.');
    process.exit(1); // Exit with error after all retries failed
};

module.exports = connectDB;