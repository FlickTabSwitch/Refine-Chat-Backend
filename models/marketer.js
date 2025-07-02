const mongoose = require('mongoose');

const marketerSchema = new mongoose.Schema({
  name: String,
  email: String,
  referralCode: { type: String, unique: true },
  phone: String,
  notes: String, // for admin
  referredUsers: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 }, // optional future
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Marketer', marketerSchema);
