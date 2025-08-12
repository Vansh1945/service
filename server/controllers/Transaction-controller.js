const Transaction = require('../models/Transaction-model ');
const Booking = require('../models/Booking-model');
const Invoice = require('../models/Invoice-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { sendEmail } = require('../utils/sendEmail');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
  try {
    const { bookingId, amount, paymentMethod } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and amount are required'
      });
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `booking_${bookingId}`,
      payment_capture: 1,
      notes: {
        bookingId: bookingId.toString(),
        userId: userId.toString()
      }
    };

    const order = await razorpay.orders.create(options);

    // Create transaction record
    const transaction = new Transaction({
      amount: amount,
      currency: 'INR',
      paymentMethod: paymentMethod || 'online',
      booking: bookingId,
      user: userId,
      razorpayOrderId: order.id,
      paymentStatus: 'pending'
    });

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order,
        key: RAZORPAY_KEY_ID,
        transactionId: transaction._id
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      orderId,
      paymentId,
      signature,
      bookingId,
      transactionId
    } = req.body;

    // Validate input
    if (!orderId || !paymentId || !signature || !bookingId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'All payment verification fields are required'
      });
    }

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Update transaction record
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    transaction.razorpayPaymentId = paymentId;
    transaction.razorpaySignature = signature;
    transaction.paymentStatus = 'completed';
    transaction.razorpayResponse = req.body;
    await transaction.save();

    // Update booking status
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    booking.paymentStatus = 'paid';
    booking.status = 'accepted';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        transactionId: transaction._id,
        bookingId: booking._id
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
};

/**
 * @desc    Razorpay webhook handler
 * @route   POST /api/payments/webhook
 * @access  Public
 */
const handleWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const razorpaySignature = req.headers['x-razorpay-signature'];

  if (!webhookSecret) {
    console.error('Webhook secret not configured');
    return res.status(500).send('Server error');
  }

  // Verify webhook signature
  const shasum = crypto.createHmac('sha256', webhookSecret);
  shasum.update(JSON.stringify(req.body));
  const generatedSignature = shasum.digest('hex');

  if (generatedSignature !== razorpaySignature) {
    console.warn('Webhook signature verification failed');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body.event;
  const payment = req.body.payload.payment?.entity;

  if (!payment) {
    return res.status(400).send('Invalid webhook payload');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handleSuccessfulPayment(payment, session);
        break;
      case 'payment.failed':
        await handleFailedPayment(payment, session);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    await session.commitTransaction();
    res.json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// Helper function to handle successful payment from webhook
const handleSuccessfulPayment = async (payment, session) => {
  // 1. Find transaction by order ID
  const transaction = await Transaction.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    {
      status: 'completed',
      razorpayPaymentId: payment.id,
      razorpayResponse: payment,
      paymentMethod: payment.method || 'online',
      updatedAt: new Date()
    },
    { new: true, session }
  );

  if (!transaction) {
    throw new Error('Transaction not found for successful payment');
  }

  // 2. Find the booking
  const booking = await Booking.findById(transaction.booking).session(session);
  
  if (!booking) {
    throw new Error('Booking not found');
  }

  // 3. Update booking payment status
  booking.paymentStatus = 'paid';
  booking.paidAmount = transaction.amount;
  booking.paymentDate = new Date();
  await booking.save({ session });

  // 4. If this is a post-service payment, ensure invoice is created
  if (transaction.paymentType === 'post_service' && !booking.invoice) {
    const invoice = await createInvoiceForBooking(booking, session);
    booking.invoice = invoice._id;
    await booking.save({ session });
  }

  // 5. Send payment confirmation email
  await sendPaymentConfirmationEmail(booking, transaction, transaction.user);
};

// Helper function to handle failed payment from webhook
const handleFailedPayment = async (payment, session) => {
  await Transaction.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    {
      status: 'failed',
      razorpayPaymentId: payment.id,
      razorpayResponse: payment,
      updatedAt: new Date()
    },
    { session }
  );

  // For upfront payments, mark booking as payment failed
  const transaction = await Transaction.findOne({ 
    razorpayOrderId: payment.order_id 
  }).session(session);

  if (transaction && transaction.paymentType !== 'post_service') {
    await Booking.findByIdAndUpdate(
      transaction.booking,
      { paymentStatus: 'failed' },
      { session }
    );
  }
};

// Helper function to create invoice for booking
const createInvoiceForBooking = async (booking, session) => {
  // 1. Calculate commission (same logic as in your completeBooking controller)
  let commissionAmount = 0;
  let commissionRuleId = null;
  let commissionType = 'percentage';
  let commissionValue = 10; // Default 10%

  try {
    const provider = await Provider.findById(booking.provider).session(session);
    const performanceTier = provider?.performanceTier || 'standard';
    const commissionRule = await CommissionRule.getCommissionForProvider(booking.provider, performanceTier);

    if (commissionRule) {
      commissionRuleId = commissionRule._id;
      commissionType = commissionRule.type;
      commissionValue = commissionRule.value;

      if (commissionType === 'percentage') {
        commissionAmount = booking.totalAmount * (commissionValue / 100);
      } else {
        commissionAmount = commissionValue;
      }
    } else {
      // Fallback to default 10% if no rule found
      commissionAmount = booking.totalAmount * 0.10;
    }
  } catch (commissionError) {
    console.error('Commission calculation error:', commissionError);
    commissionAmount = booking.totalAmount * 0.10;
  }

  // 2. Generate invoice number
  const date = new Date();
  const prefix = 'INV-' +
    date.getFullYear().toString().slice(-2) +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') + '-';
  
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }).session(session);
  const lastSeq = lastInvoice ? parseInt(lastInvoice.invoiceNo.replace(prefix, '')) || 0 : 0;
  const invoiceNo = prefix + (lastSeq + 1).toString().padStart(4, '0');

  // 3. Create invoice
  const invoice = new Invoice({
    invoiceNo,
    booking: booking._id,
    provider: booking.provider,
    customer: booking.customer,
    service: booking.services[0].service,
    serviceAmount: booking.subtotal,
    totalAmount: booking.totalAmount,
    netAmount: booking.totalAmount - commissionAmount,
    commission: {
      amount: commissionAmount,
      type: commissionType,
      value: commissionValue,
      ...(commissionRuleId && { rule: commissionRuleId })
    },
    paymentStatus: 'paid',
    paymentDetails: [{
      method: 'online',
      amount: booking.totalAmount,
      status: 'success',
      transactionId: booking._id
    }]
  });

  await invoice.save({ session });
  return invoice;
};

// Helper function to send payment confirmation email
const sendPaymentConfirmationEmail = async (booking, transaction, userId) => {
  try {
    const user = await User.findById(userId);
    const service = await Service.findById(booking.services[0].service);

    const emailHtml = `
      <h2>Payment Confirmation</h2>
      <p>Your payment has been successfully processed.</p>
      <p><strong>Transaction ID:</strong> ${transaction._id}</p>
      <p><strong>Booking ID:</strong> ${booking._id}</p>
      <p><strong>Service:</strong> ${service.title}</p>
      <p><strong>Amount Paid:</strong> ₹${transaction.amount.toFixed(2)}</p>
      <p><strong>Payment Method:</strong> ${transaction.paymentMethod}</p>
      <p><strong>Payment Date:</strong> ${new Date().toLocaleString()}</p>
      <p>Thank you for your payment!</p>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Payment Confirmation',
      html: emailHtml
    });
  } catch (emailError) {
    console.error('Failed to send payment confirmation email:', emailError);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook
};