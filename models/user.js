const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: String,
  referralId: String,         // The referrer's code this user used
  referralCode: String,       // This user's own referral code
  marketerId: { type: String, default: null },
  messageCount: { type: Number, default: 0 },
  trialStartDate: { type: Date, default: Date.now },

  subscription: {
    plan: { type: String, enum: ['free', 'pro', 'elite'], default: 'free' },
    credits: { type: Number, default: 50 },
    expiresAt: { type: Date }
  }
});

module.exports = mongoose.model('User', userSchema);
