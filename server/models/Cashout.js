const mongoose = require('mongoose');

// A record of revenue withdrawn from the platform to a destination the super
// admin controls. Three destination types are supported:
//
//   momo_phone — a mobile money number. Sent automatically through iTechPay's
//                /api/transfer payout endpoint (itecPayment.transferToPhone).
//   momo_code  — a MoMo Pay merchant code. Attempted through the same payout
//                endpoint with the code sent verbatim (transferToMomoCode);
//                iTechPay has never confirmed it accepts codes, so this may be
//                declined and fall back to a manual record.
//   bank       — a bank account. iTechPay publishes no bank payout endpoint,
//                so these are always manual: the super admin makes the
//                transfer themselves and records it here.
//
// settlementMode says which of those actually happened: 'gateway' means
// iTechPay confirmed it moved the money, 'manual' means the money was moved
// outside the platform and this row is only bookkeeping. Either way the amount
// counts against the available balance — see getAvailableBalance() in
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
  destinationType: {
    type: String,
    enum: ['momo_phone', 'momo_code', 'bank'],
    default: 'momo_phone',
    required: true
  },
  // Whether the money left through iTechPay or was moved by hand. Manual rows
  // carry no transactionId because no gateway call was made.
  settlementMode: {
    type: String,
    enum: ['gateway', 'manual'],
    default: 'gateway',
    required: true
  },
  // destinationType 'momo_phone' only.
  phoneNumber: {
    type: String,
    trim: true,
    default: null,
    required: function () { return this.destinationType === 'momo_phone'; }
  },
  // destinationType 'momo_code' only — the MoMo Pay merchant code.
  momoCode: {
    type: String,
    trim: true,
    default: null,
    required: function () { return this.destinationType === 'momo_code'; }
  },
  // Mobile money carrier. Meaningless for bank destinations, so only required
  // for the two momo types — null is in the enum so bank rows can store the
  // default without tripping enum validation.
  provider: {
    type: String,
    enum: ['mtn', 'airtel', null],
    default: null,
    required: function () { return this.destinationType !== 'bank'; }
  },
  // destinationType 'bank' only.
  bankName: {
    type: String,
    trim: true,
    default: null,
    required: function () { return this.destinationType === 'bank'; }
  },
  bankAccountNumber: {
    type: String,
    trim: true,
    default: null,
    required: function () { return this.destinationType === 'bank'; }
  },
  bankAccountName: {
    type: String,
    trim: true,
    default: null,
    required: function () { return this.destinationType === 'bank'; }
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  // iTechPay's transaction id and raw response for the transfer, kept for
  // reconciliation if the recipient ever disputes not receiving the money.
  // Both stay null on manual rows.
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Single human-readable destination for tables and confirmation prompts, so
// callers don't each have to branch on destinationType. Rows written before
// destinationType existed are all momo phone numbers.
CashoutSchema.virtual('destinationLabel').get(function () {
  if (this.destinationType === 'bank') {
    return `${this.bankName} — ${this.bankAccountNumber} (${this.bankAccountName})`;
  }
  if (this.destinationType === 'momo_code') {
    return `MoMo code ${this.momoCode}`;
  }
  return this.phoneNumber || '';
});

module.exports = mongoose.model('Cashout', CashoutSchema);
