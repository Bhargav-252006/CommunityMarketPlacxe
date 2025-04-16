const mongoose = require('mongoose');

const CommunityUserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    community: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CommunityUser', CommunityUserSchema);
