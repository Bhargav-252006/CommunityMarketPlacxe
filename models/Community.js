const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
    communityId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    adminUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommunityUser'
    }],
    adminKey: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Community', CommunitySchema); 