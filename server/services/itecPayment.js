const crypto = require('crypto');

class ITECPaymentService {
  constructor() {
    this.apiKeys = {
      airtel_money: process.env.ITECPAY_API_KEY_AIRTEL_MONEY,
      mobile_money: process.env.ITECPAY_API_KEY_MOBILE_MONEY,
      card: process.env.ITECPAY_API_KEY_CARD
    };
    this.callbackSecret = process.env.ITECPAY_CALLBACK_SECRET;
    this.callbackUrl = process.env.ITECPAY_CALLBACK_URL;
    this.baseUrl = process.env.ITECPAY_BASE_URL || 'https://pay.itecpay.rw/api';
  }

  getApiKey(paymentMethod) {
    const key = this.apiKeys[paymentMethod];
    if (!key) throw new Error(`No API key configured for payment method: ${paymentMethod}`);
    return key;
  }

  verifyCallbackSignature(payload, receivedSignature) {
    const sortedParams = Object.keys(payload)
      .sort()
      .map(k => `${k}=${payload[k]}`)
      .join('&');
    const expected = crypto
      .createHmac('sha256', this.callbackSecret)
      .update(sortedParams)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  async createPaymentRequest({ amount, currency, userId, planId, paymentMethod, description, returnUrl, cancelUrl }) {
    const apiKey = this.getApiKey(paymentMethod);
    const timestamp = Date.now();
    const reference = `SUB_${userId}_${planId}_${timestamp}`;

    const payload = {
      amount,
      currency,
      reference,
      description,
      paymentMethod,
      returnUrl,
      cancelUrl,
      callbackUrl: this.callbackUrl,
      timestamp
    };

    const response = await fetch(`${this.baseUrl}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to create payment request');
    }

    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: result.paymentId,
      reference
    };
  }

  async verifyPayment(paymentId, paymentMethod) {
    const apiKey = this.getApiKey(paymentMethod);

    const response = await fetch(`${this.baseUrl}/payments/${paymentId}/verify`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to verify payment');
    }

    return {
      success: result.status === 'completed',
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      transactionId: result.transactionId,
      paymentMethod: result.paymentMethod || paymentMethod
    };
  }

  async processCallback(callbackData) {
    const { paymentId, transactionId, status, signature, paymentMethod } = callbackData;

    const signaturePayload = { paymentId, status, transactionId };
    if (!this.verifyCallbackSignature(signaturePayload, signature)) {
      throw new Error('Invalid callback signature');
    }

    const verification = await this.verifyPayment(paymentId, paymentMethod);

    return {
      success: verification.success,
      status: verification.status,
      amount: verification.amount,
      currency: verification.currency,
      transactionId: verification.transactionId,
      paymentMethod: verification.paymentMethod
    };
  }

  async refundPayment(paymentId, paymentMethod, amount, reason) {
    const apiKey = this.getApiKey(paymentMethod);

    const response = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ amount, reason })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to process refund');
    }

    return {
      success: true,
      refundId: result.refundId,
      status: result.status
    };
  }
}

module.exports = new ITECPaymentService();
