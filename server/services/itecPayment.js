const crypto = require('crypto');

class ITECPaymentService {
  constructor() {
    this.apiKeys = {
      mtn: process.env.ITECPAY_API_KEY_MOBILE_MONEY,
      airtel: process.env.ITECPAY_API_KEY_AIRTEL_MONEY,
      card: process.env.ITECPAY_API_KEY_CARD
    };
    this.callbackUrl = process.env.ITECPAY_CALLBACK_URL;
  }

  getApiKey(provider) {
    const key = this.apiKeys[provider];
    if (!key) throw new Error(`No API key configured for provider: ${provider}`);
    return key;
  }

  // paymentMethod ('mobile_money' | 'airtel_money' | 'card') → provider key
  getProvider(paymentMethod) {
    const map = { mobile_money: 'mtn', airtel_money: 'airtel', card: 'card' };
    return map[paymentMethod] || 'mtn';
  }

  normalizePhone(phone) {
    let p = phone.replace(/[\s\-().]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    // iTechPay api2/pay expects local format: 07XXXXXXXX
    if (p.startsWith('250') && p.length === 12) p = '0' + p.slice(3);
    if (!p.startsWith('0') && p.length === 9) p = '0' + p;
    return p;
  }

  async post(url, body) {
    const safeBody = { ...body };
    if (safeBody.key) safeBody.key = safeBody.key.slice(0, 8) + '...';
    console.log(`[iTechPay] → POST ${url}`);
    console.log(`[iTechPay]   payload: ${JSON.stringify(safeBody)}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    console.log(`[iTechPay] ← HTTP ${response.status} from ${url}`);
    console.log(`[iTechPay]   raw response: ${text.slice(0, 500)}`);

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`iTechPay returned non-JSON (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }
  }

  async createPaymentRequest({ amount, currency, userId, planId, paymentMethod, phone, email }) {
    const provider = this.getProvider(paymentMethod);
    console.log(`[iTechPay] createPaymentRequest: method=${paymentMethod}, provider=${provider}, amount=${amount} ${currency}, userId=${userId}`);

    const apiKey = this.getApiKey(provider);
    const reference = crypto.randomUUID();

    if (paymentMethod === 'card') {
      if (!email) throw new Error('Email is required for card payments');

      const result = await this.post(
        'https://pay.itecpay.rw/api/pay/apis/pesapal/generatecode',
        {
          amount: Number(amount),
          email: email.trim(),
          key: apiKey,
          req_ref: reference,
          currency: currency || 'RWF',
          callback_url: this.callbackUrl
        }
      );

      const pcode = result?.PCODE;
      if (!pcode) {
        console.error(`[iTechPay] Card: no PCODE — status=${result?.status}, error=${result?.error}, message=${result?.message}`);
        const cardErrMsg = (result?.status === 500 || String(result?.error || '').toLowerCase().includes('initiate failed'))
          ? 'Card payment is not yet activated. Please use mobile money or contact iTechPay support.'
          : (result?.message || result?.error || 'Card payment unavailable — no PCODE returned');
        const cardErr = new Error(cardErrMsg);
        cardErr.isGatewayError = true;
        throw cardErr;
      }

      const paymentUrl = result.link || `https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=${pcode}`;
      console.log(`[iTechPay] Card payment created: PCODE=${pcode}, url=${paymentUrl}`);
      return { success: true, paymentUrl, paymentId: pcode, reference };
    }

    // Mobile money (MTN or Airtel)
    if (!phone) throw new Error('Phone number is required for mobile money payments');

    const result = await this.post(
      'https://pay.itecpay.rw/api2/pay',
      {
        amount: Number(amount),
        phone: this.normalizePhone(phone),
        key: apiKey,
        req_ref: reference
      }
    );

    const statusVal = String(result?.status ?? '').toLowerCase();
    const ok = result?.status === 200 || result?.status === true || result?.status === 1 ||
      statusVal === 'success' || statusVal === 'ok' || statusVal === '200';

    if (!ok) {
      const errMsg = result?.data?.message || result?.message || `Payment request failed (status: ${result?.status})`;
      console.error(`[iTechPay] Mobile money rejected: ${errMsg}`);
      const err = new Error(errMsg);
      err.isGatewayError = true;
      throw err;
    }

    const txId = result?.data?.transaction_id || result?.data?.financial_transaction_id || reference;
    console.log(`[iTechPay] Mobile money initiated: txId=${txId}, phone=${this.normalizePhone(phone)}`);
    return {
      success: true,
      paymentUrl: null,
      paymentId: txId,
      reference
    };
  }

  // Shared payout call behind transferToPhone/transferToMomoCode. Mirrors the
  // /api2/pay request/response shape since iTechPay hasn't published payout
  // docs — same { amount, phone, key, req_ref } body, same success heuristic.
  // `destination` is whatever goes in the body's `phone` field, already in the
  // exact form the gateway should receive.
  // NOT YET CONFIRMED against a real successful transfer response; the only
  // test so far returned { status: 400, data: { message: "Unauthorized" } }
  // for a placeholder key. Treat the success path as unverified until a real
  // transfer has been confirmed to actually land on the recipient.
  async sendTransfer({ amount, destination, paymentMethod, reference, destinationKind }) {
    const provider = this.getProvider(paymentMethod || 'mobile_money');
    console.log(`[iTechPay] sendTransfer: provider=${provider}, amount=${amount}, ${destinationKind}=${destination}`);

    const apiKey = this.getApiKey(provider);
    const req_ref = reference || crypto.randomUUID();

    const result = await this.post(
      'https://pay.itecpay.rw/api/transfer',
      {
        amount: Number(amount),
        phone: destination,
        key: apiKey,
        req_ref
      }
    );

    const statusVal = String(result?.status ?? '').toLowerCase();
    const ok = result?.status === 200 || result?.status === true || result?.status === 1 ||
      statusVal === 'success' || statusVal === 'ok' || statusVal === '200';

    if (!ok) {
      const errMsg = result?.data?.message || result?.message || `Transfer failed (status: ${result?.status})`;
      console.error(`[iTechPay] Transfer rejected: ${errMsg}`);
      const err = new Error(errMsg);
      err.isGatewayError = true;
      throw err;
    }

    const txId = result?.data?.transaction_id || result?.data?.financial_transaction_id || req_ref;
    console.log(`[iTechPay] Transfer request accepted: txId=${txId}, ${destinationKind}=${destination}`);
    return {
      success: true,
      transactionId: txId,
      reference: req_ref,
      raw: result
    };
  }

  // Sends money OUT to a phone number (cashout/payout), as opposed to
  // createPaymentRequest which collects money FROM a customer.
  async transferToPhone({ amount, phone, paymentMethod, reference }) {
    return this.sendTransfer({
      amount,
      destination: this.normalizePhone(phone),
      paymentMethod,
      reference,
      destinationKind: 'phone'
    });
  }

  // Sends money OUT to a MoMo Pay merchant code. The code is passed through
  // untouched — normalizePhone() would mangle it (it prepends '0' to 9-char
  // values and strips country codes), and a mangled code could route money to
  // an unrelated destination. iTechPay has no documented code payout, so this
  // may simply be declined; callers should be ready to fall back to recording
  // the withdrawal manually.
  async transferToMomoCode({ amount, code, paymentMethod, reference }) {
    return this.sendTransfer({
      amount,
      destination: String(code).replace(/[\s\-().]/g, ''),
      paymentMethod,
      reference,
      destinationKind: 'momoCode'
    });
  }

  async verifyPayment(reference, paymentMethod) {
    const provider = this.getProvider(paymentMethod);
    const apiKey = this.getApiKey(provider);

    const result = await this.post(
      'https://pay.itecpay.rw/api2/verify',
      { action: 'status_check', req_ref: reference, key: apiKey }
    );

    const rawStatus = String(
      result?.transaction_status ||
      result?.data?.transaction_status ||
      result?.payment_status ||
      result?.data?.payment_status ||
      result?.data?.status ||
      result?.status ||
      ''
    ).toLowerCase();

    // NOTE: result?.status === 200 only means the *API call* succeeded, NOT that
    // the payment was completed. iTechPay always returns {"status":200} on any
    // successful HTTP response. Only trust the inner payment status string.
    const successStatuses = ['completed', 'success', 'paid', 'approved'];
    const isSuccess = successStatuses.includes(rawStatus);

    // iTechPay sometimes returns { status: 200, data: { status: "SUCCESSFUL" } }
    // so we also treat "successful" as success.
    const successfulInner = rawStatus === 'successful' || rawStatus === 'success' || rawStatus === 'successful';
    const finalSuccess = isSuccess || successfulInner;

    return {
      success: finalSuccess,
      status: rawStatus || 'unknown',
      amount: result?.data?.amount || result?.amount,
      currency: result?.data?.currency || 'RWF',
      transactionId: result?.data?.transaction_id || result?.transaction_id
    };
  }

  async processCallback(callbackData) {
    const { transaction_id, amount, status, req_ref, paymentMethod } = callbackData;

    // Validate required fields and status
    if (!transaction_id || !amount || !status) {
      return { success: false, status: status || 'unknown', message: 'Missing required callback fields' };
    }

    const successStatuses = ['completed', 'success', 'paid', 'approved'];
    const normalizedStatus = String(status).toLowerCase();
    if (!successStatuses.includes(normalizedStatus)) {
      return { success: false, status: normalizedStatus, message: `Payment not successful: ${status}` };
    }

    // Active re-verify when possible
    if (req_ref && paymentMethod) {
      try {
        const verification = await this.verifyPayment(req_ref, paymentMethod);
        return {
          success: verification.success,
          status: verification.status,
          amount: verification.amount,
          currency: verification.currency,
          transactionId: verification.transactionId || transaction_id
        };
      } catch (err) {
        console.warn('iTechPay re-verify failed, trusting callback data:', err.message);
      }
    }

    return {
      success: true,
      status: normalizedStatus,
      amount,
      currency: 'RWF',
      transactionId: transaction_id
    };
  }
}

module.exports = new ITECPaymentService();
