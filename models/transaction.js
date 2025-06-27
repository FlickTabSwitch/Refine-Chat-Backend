// models/transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gateway: { type: String, enum: ['payu', 'paypal'], required: true },
  plan: { type: String, enum: ['pro', 'elite'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['success', 'failed'], required: true },
  txnId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
