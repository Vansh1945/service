const Razorpay = require('razorpay');
const axios = require('axios');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
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
 * Fetch single refund details
 */
razorpay.fetchRazorpayRefund = async function (refundId, paymentId) {
  try {
    if (refundId) {
      return await razorpay.refunds.fetch(refundId);
    }
    if (paymentId) {
      const list = await razorpay.payments.fetchRefunds(paymentId);
      return (list?.items && list.items.length > 0) ? list.items[0] : null;
    }
    return null;
  } catch (err) {
    console.error(`[Razorpay.fetchRazorpayRefund] Error fetching refund ${refundId}:`, err.message);
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
      console.error('[Razorpay.createRefundWithIdempotency] API Error:', err.message);
      if (err.response?.data) return err.response.data;
      throw err;
    }
  }
  return await razorpay.payments.refund(paymentId, payload);
};

module.exports = razorpay;

