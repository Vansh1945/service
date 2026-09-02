const Razorpay = require('razorpay');
const axios = require('axios');

const isProd = process.env.NODE_ENV === 'production';
const rzpKeyId = process.env.RAZORPAY_KEY_ID;
const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (isProd && (!rzpKeyId || !rzpKeySecret)) {
  console.warn('⚠️ WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables are missing in production!');
}

const razorpay = new Razorpay({
  key_id: rzpKeyId || 'dummy_key',
  key_secret: rzpKeySecret || 'dummy_secret'
});

/**
 * Fetch all payments with pagination loop (count=100)
 */
razorpay.fetchAllPaymentsDetailed = async function ({ from, to, count = 100 } = {}) {
  const allItems = [];
  let skip = 0;
  while (true) {
    const params = { count, skip };
    if (from) params.from = Math.floor(new Date(from).getTime() / 1000);
    if (to) params.to = Math.floor(new Date(to).getTime() / 1000);

    try {
      const res = await razorpay.payments.all(params);
      const items = res.items || res || [];
      if (!Array.isArray(items) || items.length === 0) break;
      allItems.push(...items);
      if (items.length < count) break;
      skip += count;
    } catch (err) {
      console.error(`[Razorpay.fetchAllPaymentsDetailed] Error at skip=${skip}:`, err.message);
      break;
    }
  }
  return allItems;
};

/**
 * Fetch all refunds with pagination loop (count=100)
 */
razorpay.fetchAllRazorpayRefunds = async function ({ from, to, count = 100 } = {}) {
  const allItems = [];
  let skip = 0;
  while (true) {
    const params = { count, skip };
    if (from) params.from = Math.floor(new Date(from).getTime() / 1000);
    if (to) params.to = Math.floor(new Date(to).getTime() / 1000);

    try {
      const res = await razorpay.refunds.all(params);
      const items = res.items || res || [];
      if (!Array.isArray(items) || items.length === 0) break;
      allItems.push(...items);
      if (items.length < count) break;
      skip += count;
    } catch (err) {
      console.error(`[Razorpay.fetchAllRazorpayRefunds] Error at skip=${skip}:`, err.message);
      break;
    }
  }
  return allItems;
};

/**
 * Fetch all settlements with pagination loop (count=100)
 */
razorpay.fetchRazorpaySettlements = async function ({ from, to, count = 100 } = {}) {
  const allItems = [];
  let skip = 0;
  while (true) {
    const params = { count, skip };
    if (from) params.from = Math.floor(new Date(from).getTime() / 1000);
    if (to) params.to = Math.floor(new Date(to).getTime() / 1000);

    try {
      const res = await razorpay.settlements.all(params);
      const items = res.items || res || [];
      if (!Array.isArray(items) || items.length === 0) break;
      allItems.push(...items);
      if (items.length < count) break;
      skip += count;
    } catch (err) {
      console.error(`[Razorpay.fetchRazorpaySettlements] Error at skip=${skip}:`, err.message);
      break;
    }
  }
  return allItems;
};

/**
 * Fetch Combined Settlement Recon
 */
razorpay.fetchRazorpaySettlementReconCombined = async function ({ year, month, day, count = 100 } = {}) {
  const allItems = [];
  let skip = 0;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return allItems;
  }

  while (true) {
    try {
      const params = { count, skip };
      if (year) params.year = year;
      if (month) params.month = month;
      if (day) params.day = day;

      const res = await axios.get('https://api.razorpay.com/v1/settlements/recon/combined', {
        auth: { username: keyId, password: keySecret },
        params
      });

      const items = res.data?.items || res.data?.entity || (Array.isArray(res.data) ? res.data : []);
      if (!Array.isArray(items) || items.length === 0) break;
      allItems.push(...items);
      if (items.length < count) break;
      skip += count;
    } catch (err) {
      console.error(`[Razorpay.fetchRazorpaySettlementReconCombined] Error at skip=${skip}:`, err.message);
      break;
    }
  }
  return allItems;
};

/**
 * Fetch and reconcile Razorpay refund details without using naive items[0]
 */
razorpay.fetchRazorpayRefund = async function (refundId, paymentId, options = {}) {
  try {
    // 1. Direct Razorpay Refund ID Match (Exact Match)
    if (refundId && typeof refundId === 'string' && refundId.startsWith('rfnd_')) {
      try {
        const directRefund = await razorpay.refunds.fetch(refundId);
        if (directRefund && directRefund.id === refundId) {
          return directRefund;
        }
      } catch (e) {
        // If direct fetch fails, fall through to payment refunds list reconciliation
      }
    }

    if (!paymentId) {
      return null;
    }

    // 2. Fetch all refunds for the payment using Razorpay client API wrapper
    const list = await razorpay.payments.fetchRefunds(paymentId);
    const items = list?.items || (Array.isArray(list) ? list : []);

    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    // 3. Exact target refundId match in items list
    if (refundId) {
      const matchById = items.find(r => r.id === refundId);
      if (matchById) return matchById;
    }

    // Prepare reconciliation signals from options
    const targetAmountPaise = options.amount !== undefined && options.amount !== null
      ? (options.amount > 10000 ? Math.round(options.amount) : Math.round(options.amount * 100))
      : null;
    const localRefundId = options.localRefundId || options.refundId;
    const idempotencyKey = options.idempotencyKey;

    // 4. Match by Razorpay Notes / Reference signals (strongest signal)
    const matchByNotes = items.find(r => {
      if (!r.notes) return false;
      if (localRefundId && (r.notes.refundId === localRefundId || r.notes.localRefundId === localRefundId)) return true;
      if (idempotencyKey && r.notes.idempotencyKey === idempotencyKey) return true;
      return false;
    });
    if (matchByNotes) return matchByNotes;

    // 5. Match by Exact Amount (in paise)
    if (targetAmountPaise !== null) {
      const matchesByAmount = items.filter(r => Math.abs((r.amount || 0) - targetAmountPaise) <= 1);
      if (matchesByAmount.length === 1) {
        return matchesByAmount[0];
      }
      if (matchesByAmount.length > 1 && options.createdAt) {
        // Pick the item created closest to local refund creation timestamp
        const targetTime = new Date(options.createdAt).getTime() / 1000;
        matchesByAmount.sort((a, b) => Math.abs((a.created_at || 0) - targetTime) - Math.abs((b.created_at || 0) - targetTime));
        return matchesByAmount[0];
      }
    }

    // 6. Safe Single Refund Fallback
    if (items.length === 1) {
      const single = items[0];
      if (targetAmountPaise === null || Math.abs((single.amount || 0) - targetAmountPaise) <= 1) {
        return single;
      }
    }

    // If multiple refunds exist and none of the safe signals matched, NEVER arbitrarily return items[0]
    return null;
  } catch (err) {
    console.error(`[Razorpay.fetchRazorpayRefund] Error reconciling refund for payment ${paymentId}:`, err.message);
    return null;
  }
};

/**
 * Create gateway refund with X-Refund-Idempotency header support
 */
razorpay.createRefundWithIdempotency = async function (paymentId, payload, idempotencyKey) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (idempotencyKey && keyId && keySecret) {
    try {
      const res = await axios.post(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, payload, {
        auth: { username: keyId, password: keySecret },
        headers: { 'X-Refund-Idempotency': idempotencyKey }
      });
      return res.data;
    } catch (err) {
      console.error('[Razorpay.createRefundWithIdempotency] API Error:', err.response?.data || err.message);
      if (err.response?.data?.error) {
        const rzpMsg = err.response.data.error.description || err.response.data.error.code || 'Razorpay refund error';
        throw new Error(`Razorpay Refund API Error: ${rzpMsg}`);
      }
      throw err;
    }
  }
  return await razorpay.payments.refund(paymentId, payload);
};

module.exports = razorpay;

