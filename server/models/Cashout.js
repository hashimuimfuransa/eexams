const mongoose = require('mongoose');

// A record of revenue withdrawn from the platform to the super admin's own
// mobile money number, via iTechPay's /api/transfer payout endpoint
// (server/services/itecPayment.js -> transferToPhone). Only created after
// iTechPay confirms the transfer succeeded, so its running total is what's
// actually left the platform — see getAvailableBalance() in
// subscriptionController.js.
const CashoutSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ['mtn', 'airtel'],
    required: true
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  // iTechPay's transaction id and raw response for the transfer, kept for
  // reconciliation if the recipient ever disputes not receiving the money.
  transactionId: {
    type: String,
    default: null
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Cashout', CashoutSchema);
