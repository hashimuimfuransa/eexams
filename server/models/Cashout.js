const mongoose = require('mongoose');

// A record of revenue withdrawn from the platform to a destination the super
// admin controls. Three destination types are supported:
//
//   momo_phone — a mobile money number. The only destination that can be paid
//                out automatically, through iTechPay's /api/transfer endpoint
//                (itecPayment.transferToPhone).
//   momo_code  — a MoMo Pay merchant code. Always manual: /api/transfer does
//                not handle Pay codes (a real attempt returned HTTP 200 with
//                an empty body — an outcome that can't be interpreted), so the
//                super admin sends it from their own MoMo app and records it.
//   bank       — a bank account. Always manual: iTechPay publishes no bank
//                payout endpoint at all.
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
  },
  // Reversal of a manual record booked by mistake (wrong amount, wrong
  // destination, duplicate). Soft rather than a delete so the mistake and its
  // correction both stay visible in the history. A reversed row no longer
  // counts against the available balance — see getAvailableBalance().
  //
  // Only ever set on settlementMode 'manual' rows: a 'gateway' row documents
  // money iTechPay actually moved, and un-booking that would overstate the
  // balance and invite withdrawing money the platform no longer holds.
  reversedAt: {
    type: Date,
    default: null
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reversalReason: {
    type: String,
    trim: true,
    default: ''
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
