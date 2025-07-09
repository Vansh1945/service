const Transaction = require('../models/Transaction-model ');
const Invoice = require('../models/Invoice-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const razorpayService = require('./razorpay-service');

module.exports = {
  async createCustomerPayment(userId, bookingId, amount, paymentMethod) {
    const booking = await Booking.findById(bookingId)
      .populate('service')
      .populate('provider');
    
    if (!booking) throw new Error('Booking not found');
    if (booking.customer.toString() !== userId.toString()) {
      throw new Error('Not authorized for this booking');
    }

    // Create or get invoice
    let invoice = await Invoice.findOne({ booking: bookingId });
    if (!invoice) {
      invoice = await this.createInvoiceFromBooking(booking);
    }

    // Calculate amounts
    const serviceAmount = invoice.serviceAmount;
    const productsAmount = invoice.productsUsed.reduce((sum, p) => sum + p.total, 0);
    const adminAmount = serviceAmount;
    const providerAmount = productsAmount;

    // Create transaction
    const transaction = new Transaction({
      invoice: invoice._id,
      booking: bookingId,
      customer: userId,
      provider: booking.provider._id,
      amount,
      adminAmount,
      providerAmount,
      paymentMethod,
      status: paymentMethod === 'cash' ? 'completed' : 'pending'
    });

    // Handle online payment
    let razorpayOrder;
    if (paymentMethod === 'online') {
      razorpayOrder = await razorpayService.createOrder(amount, `Payment for booking ${bookingId}`);
      transaction.razorpayOrderId = razorpayOrder.id;
    }

    await transaction.save();

    // Update invoice if payment is completed
    if (transaction.status === 'completed') {
      invoice.advancePayment += amount;
      await invoice.save();
    }

    return { transaction, razorpayOrder };
  },

  async verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const isValid = await razorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!isValid) throw new Error('Invalid payment signature');

    const transaction = await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'completed'
      },
      { new: true }
    ).populate('invoice');

    if (!transaction) throw new Error('Transaction not found');

    // Update invoice
    transaction.invoice.advancePayment += transaction.amount;
    await transaction.invoice.save();

    return transaction;
  },

  async payFromWallet(userId, bookingId, amount) {
    const user = await User.findById(userId);
    if (user.walletBalance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const booking = await Booking.findById(bookingId)
      .populate('service')
      .populate('provider');
    
    if (!booking) throw new Error('Booking not found');
    if (booking.customer.toString() !== userId.toString()) {
      throw new Error('Not authorized for this booking');
    }

    // Create or get invoice
    let invoice = await Invoice.findOne({ booking: bookingId });
    if (!invoice) {
      invoice = await this.createInvoiceFromBooking(booking);
    }

    // Calculate amounts
    const serviceAmount = invoice.serviceAmount;
    const productsAmount = invoice.productsUsed.reduce((sum, p) => sum + p.total, 0);
    const adminAmount = serviceAmount;
    const providerAmount = productsAmount;

    // Deduct from wallet
    user.walletBalance -= amount;
    await user.save();

    // Create transaction
    const transaction = await Transaction.create({
      invoice: invoice._id,
      booking: bookingId,
      customer: userId,
      provider: booking.provider._id,
      amount,
      adminAmount,
      providerAmount,
      paymentMethod: 'wallet',
      status: 'completed'
    });

    // Update invoice
    invoice.advancePayment += amount;
    await invoice.save();

    return transaction;
  },

  async initiateWithdrawal(providerId, amount, method, details) {
    const provider = await Provider.findById(providerId);
    
    // Calculate available balance
    const completedTxns = await Transaction.find({
      provider: providerId,
      status: 'completed',
      paymentMethod: { $ne: 'withdrawal' }
    });
    
    const withdrawnAmount = await Transaction.aggregate([
      { 
        $match: { 
          provider: providerId,
          paymentMethod: 'withdrawal',
          status: 'completed'
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalEarnings = completedTxns.reduce((sum, txn) => sum + txn.providerAmount, 0);
    const totalWithdrawn = withdrawnAmount.length > 0 ? withdrawnAmount[0].total : 0;
    const availableBalance = totalEarnings - totalWithdrawn;
    
    if (availableBalance < amount) {
      throw new Error('Insufficient balance for withdrawal');
    }

    // Create withdrawal transaction
    const transaction = await Transaction.create({
      provider: providerId,
      amount,
      providerAmount: amount,
      adminAmount: 0,
      paymentMethod: 'withdrawal',
      withdrawalMethod: method,
      withdrawalDetails: details,
      status: 'pending'
    });

    return transaction;
  },

  async createInvoiceFromBooking(booking) {
    const productsUsed = booking.products.map(p => ({
      name: p.name,
      description: p.description,
      quantity: p.quantity,
      rate: p.price,
      total: p.quantity * p.price
    }));
    
    const productsTotal = productsUsed.reduce((sum, p) => sum + p.total, 0);
    const totalAmount = booking.service.price + productsTotal;
    
    return Invoice.create({
      booking: booking._id,
      provider: booking.provider._id,
      customer: booking.customer,
      service: booking.service._id,
      serviceAmount: booking.service.price,
      productsUsed,
      totalAmount,
      balanceDue: totalAmount
    });
  },

  async getTransactions(userId, userRole) {
    const query = userRole === 'provider' 
      ? { provider: userId } 
      : { customer: userId };
    
    return Transaction.find(query)
      .sort({ createdAt: -1 })
      .populate('invoice')
      .populate('booking')
      .populate('customer', 'name email')
      .populate('provider', 'name email');
  }
};