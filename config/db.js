const mongoose = require('mongoose');
require('dotenv').config();

// Connection options for better reliability
const options = {
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    connectTimeoutMS: 10000, // Connection timeout
    retryWrites: true, // Retry write operations
    maxPoolSize: 10, // Maximum number of connections in the pool
    family: 4 // Use IPv4, skip IPv6
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