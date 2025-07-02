const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  email: String,
  referralId: String,
  referralCode: String,
  trialStartDate: Date,
  subscription: {
    plan: String,
    credits: Number,
    expiresAt: Date
  },
  marketer: { type: mongoose.Schema.Types.ObjectId, ref: 'Marketer', default: null } // ✅ Add this
});


module.exports = mongoose.model('Marketer', marketerSchema);
