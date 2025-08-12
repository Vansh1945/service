// controllers/paymentController.js
const mongoose = require('mongoose');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const CommissionRule = require('../models/CommissionRule-model');
const { sendEmail } = require('../utils/sendEmail');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to format date
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

// Provider - Get earnings summary with commission breakdown
const getEarningsSummary = async (req, res) => {
  try {
    const providerId = req.user.id;
    
    const [balance, summary, paymentHistory] = await Promise.all([
      ProviderEarning.getAvailableBalance(providerId),
      ProviderEarning.getEarningsSummary(providerId),
      PaymentRecord.getProviderRecords(providerId, 1, 5)
    ]);
    
    // Calculate totals
    const totals = {
      gross: 0,
      commission: 0,
      net: 0
    };
    
    summary.forEach(item => {
      totals.gross += item.totalGross || 0;
      totals.commission += item.totalCommission || 0;
      totals.net += item.totalNet || 0;
    });
    
    res.json({
      success: true,
      data: {
        availableBalance: balance,
        earningsSummary: summary,
        totals,
        recentPayments: paymentHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Provider - Request withdrawal
const requestWithdrawal = async (req, res) => {
  try {
    const providerId = req.user.id;
    const { amount, paymentMethod } = req.body;
    
    // Validate amount
    const availableBalance = await ProviderEarning.getAvailableBalance(providerId);
    if (amount > availableBalance) {
      return res.status(400).json({ 
        success: false, 
        error: 'Requested amount exceeds available balance' 
      });
    }
    
    // Create payment record
    const paymentRecord = new PaymentRecord({
      provider: providerId,
      amount,
      netAmount: amount, // Assuming no fees for now
      paymentMethod,
      status: 'pending',
      transactionReference: `WDR-${Date.now()}`,
      type: 'withdrawal'
    });
    
    await paymentRecord.save();
    
    // Mark earnings as processing
    await ProviderEarning.updateMany(
      { 
        provider: providerId, 
        status: 'available' 
      },
      { 
        $set: { 
          status: 'processing',
          paymentRecord: paymentRecord._id 
        } 
      }
    );
    
    // Notify admin (in real app, this would be a more robust notification system)
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'New Withdrawal Request',
      text: `Provider ${providerId} has requested a withdrawal of $${amount} via ${paymentMethod}`
    });
    
    res.json({ 
      success: true, 
      message: 'Withdrawal request submitted successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Provider - Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    const providerId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const records = await PaymentRecord.find({ provider: providerId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await PaymentRecord.countDocuments({ provider: providerId });
    
    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Provider - Get earnings by booking
const getEarningsByBooking = async (req, res) => {
  try {
    const providerId = req.user.id;
    const { bookingId } = req.params;
    
    const earning = await ProviderEarning.findOne({
      provider: providerId,
      booking: bookingId
    }).populate('commissionRule', 'name type value');
    
    if (!earning) {
      return res.status(404).json({ 
        success: false, 
        error: 'No earnings found for this booking' 
      });
    }
    
    res.json({
      success: true,
      data: earning
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Provider - Download statement (PDF)
const downloadStatement = async (req, res) => {
  try {
    const providerId = req.user.id;
    const { startDate, endDate } = req.query;
    
    const match = { provider: providerId };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const [earnings, payments] = await Promise.all([
      ProviderEarning.find(match)
        .sort({ createdAt: -1 })
        .populate('booking', 'service date')
        .populate('commissionRule', 'name type value'),
        
      PaymentRecord.find({ provider: providerId, ...(startDate || endDate ? {
        createdAt: {
          ...(startDate ? { $gte: new Date(startDate) } : {}),
          ...(endDate ? { $lte: new Date(endDate) } : {})
        }
      } : {}) })
        .sort({ createdAt: -1 })
    ]);
    
    // Create PDF document
    const doc = new PDFDocument();
    const filename = `statement-${providerId}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../temp', filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'));
    }
    
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    
    // Add document content
    doc.fontSize(20).text('Payment Statement', { align: 'center' });
    doc.moveDown();
    
    // Provider info
    const provider = await Provider.findById(providerId);
    doc.fontSize(12).text(`Provider: ${provider.name}`);
    doc.text(`Email: ${provider.email}`);
    doc.text(`Phone: ${provider.phone}`);
    doc.text(`Statement Period: ${startDate ? formatDate(startDate) : 'All time'} - ${endDate ? formatDate(endDate) : 'Present'}`);
    doc.moveDown();
    
    // Earnings summary
    doc.fontSize(14).text('Earnings Summary', { underline: true });
    doc.moveDown();
    
    const earningsSummary = await ProviderEarning.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' }
        }
      }
    ]);
    
    const summary = earningsSummary.length ? earningsSummary[0] : {
      totalGross: 0,
      totalCommission: 0,
      totalNet: 0
    };
    
    doc.text(`Total Earnings: $${summary.totalGross.toFixed(2)}`);
    doc.text(`Total Commission: $${summary.totalCommission.toFixed(2)}`);
    doc.text(`Net Earnings: $${summary.totalNet.toFixed(2)}`);
    doc.moveDown();
    
    // Earnings details
    doc.fontSize(14).text('Earnings Details', { underline: true });
    doc.moveDown();
    
    if (earnings.length === 0) {
      doc.text('No earnings found for this period');
    } else {
      earnings.forEach((earning, index) => {
        doc.text(`#${index + 1}: ${formatDate(earning.createdAt)} - ${earning.booking?.service || 'N/A'}`);
        doc.text(`   Amount: $${earning.grossAmount.toFixed(2)}`);
        doc.text(`   Commission: $${earning.commissionAmount.toFixed(2)} (${earning.commissionRule?.name || 'Default'})`);
        doc.text(`   Net: $${earning.netAmount.toFixed(2)} - Status: ${earning.status}`);
        doc.moveDown(0.5);
      });
    }
    
    doc.moveDown();
    
    // Payment details
    doc.fontSize(14).text('Payment History', { underline: true });
    doc.moveDown();
    
    if (payments.length === 0) {
      doc.text('No payments found for this period');
    } else {
      payments.forEach((payment, index) => {
        doc.text(`#${index + 1}: ${formatDate(payment.createdAt)} - ${payment.transactionReference}`);
        doc.text(`   Amount: $${payment.amount.toFixed(2)}`);
        doc.text(`   Net Received: $${payment.netAmount.toFixed(2)}`);
        doc.text(`   Method: ${payment.paymentMethod} - Status: ${payment.status}`);
        doc.moveDown(0.5);
      });
    }
    
    doc.end();
    
    stream.on('finish', () => {
      res.download(filePath, filename, (err) => {
        if (err) console.error('Error sending file:', err);
        // Clean up file after download
        fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Provider - Download statement (Excel)
const downloadStatementExcel = async (req, res) => {
  try {
    const providerId = req.user.id;
    const { startDate, endDate } = req.query;
    
    const match = { provider: providerId };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const [earnings, payments] = await Promise.all([
      ProviderEarning.find(match)
        .sort({ createdAt: -1 })
        .populate('booking', 'service date')
        .populate('commissionRule', 'name type value'),
        
      PaymentRecord.find({ provider: providerId, ...(startDate || endDate ? {
        createdAt: {
          ...(startDate ? { $gte: new Date(startDate) } : {}),
          ...(endDate ? { $lte: new Date(endDate) } : {})
        }
      } : {}) })
        .sort({ createdAt: -1 })
    ]);
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Statement');
    
    // Add provider info
    const provider = await Provider.findById(providerId);
    worksheet.addRow(['Provider Statement']);
    worksheet.addRow(['Name:', provider.name]);
    worksheet.addRow(['Email:', provider.email]);
    worksheet.addRow(['Phone:', provider.phone]);
    worksheet.addRow(['Period:', `${startDate ? formatDate(startDate) : 'All time'} - ${endDate ? formatDate(endDate) : 'Present'}`]);
    worksheet.addRow([]);
    
    // Add earnings summary
    const earningsSummary = await ProviderEarning.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' }
        }
      }
    ]);
    
    const summary = earningsSummary.length ? earningsSummary[0] : {
      totalGross: 0,
      totalCommission: 0,
      totalNet: 0
    };
    
    worksheet.addRow(['Earnings Summary']);
    worksheet.addRow(['Total Earnings:', `$${summary.totalGross.toFixed(2)}`]);
    worksheet.addRow(['Total Commission:', `$${summary.totalCommission.toFixed(2)}`]);
    worksheet.addRow(['Net Earnings:', `$${summary.totalNet.toFixed(2)}`]);
    worksheet.addRow([]);
    
    // Add earnings details
    worksheet.addRow(['Earnings Details']);
    worksheet.addRow(['Date', 'Service', 'Amount', 'Commission', 'Net', 'Status']);
    
    earnings.forEach(earning => {
      worksheet.addRow([
        formatDate(earning.createdAt),
        earning.booking?.service || 'N/A',
        earning.grossAmount,
        earning.commissionAmount,
        earning.netAmount,
        earning.status
      ]);
    });
    
    worksheet.addRow([]);
    
    // Add payment details
    worksheet.addRow(['Payment History']);
    worksheet.addRow(['Date', 'Reference', 'Amount', 'Net', 'Method', 'Status']);
    
    payments.forEach(payment => {
      worksheet.addRow([
        formatDate(payment.createdAt),
        payment.transactionReference,
        payment.amount,
        payment.netAmount,
        payment.paymentMethod,
        payment.status
      ]);
    });
    
    // Generate file
    const filename = `statement-${providerId}-${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../temp', filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'));
    }
    
    await workbook.xlsx.writeFile(filePath);
    
    res.download(filePath, filename, (err) => {
      if (err) console.error('Error sending file:', err);
      // Clean up file after download
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Get all provider earnings
const getAllProviderEarnings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, providerId } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (providerId) filter.provider = providerId;
    
    const earnings = await ProviderEarning.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('provider', 'name email')
      .populate('booking', 'service date')
      .populate('commissionRule', 'name type value');
    
    const total = await ProviderEarning.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        earnings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Process booking payment
const processBookingPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .populate('service')
      .populate('provider');
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }
    
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ 
        success: false, 
        error: 'Booking already paid' 
      });
    }
    
    // Find applicable commission rule
    const commissionRule = await CommissionRule.findOne({
      serviceType: booking.service.type,
      isActive: true
    }).sort({ priority: 1 });
    
    // Calculate commission
    let commissionAmount = 0;
    if (commissionRule) {
      if (commissionRule.type === 'percentage') {
        commissionAmount = booking.totalPrice * (commissionRule.value / 100);
      } else {
        commissionAmount = commissionRule.value; // Fixed amount
      }
    }
    
    // Create provider earning record
    const providerEarning = new ProviderEarning({
      provider: booking.provider._id,
      booking: booking._id,
      grossAmount: booking.totalPrice,
      commissionAmount,
      netAmount: booking.totalPrice - commissionAmount,
      status: 'pending', // Will become available after clearing period
      commissionRule: commissionRule?._id
    });
    
    await providerEarning.save();
    
    // Update booking payment status
    booking.paymentStatus = 'paid';
    booking.paymentDate = new Date();
    await booking.save();
    
    // Notify provider
    await sendEmail({
      to: booking.provider.email,
      subject: 'New Earnings Added',
      text: `You have earned $${providerEarning.netAmount.toFixed(2)} from booking ${booking._id}`
    });
    
    res.json({ 
      success: true, 
      message: 'Payment processed successfully',
      data: providerEarning
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Get all withdrawal requests
const getAllWithdrawalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = { type: 'withdrawal' };
    if (status) filter.status = status;
    
    const requests = await PaymentRecord.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('provider', 'name email');
    
    const total = await PaymentRecord.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Process withdrawal
const processWithdrawal = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { status, transactionId } = req.body;
    
    const paymentRecord = await PaymentRecord.findById(recordId)
      .populate('provider', 'name email');
    
    if (!paymentRecord) {
      return res.status(404).json({ 
        success: false, 
        error: 'Payment record not found' 
      });
    }
    
    if (paymentRecord.type !== 'withdrawal') {
      return res.status(400).json({ 
        success: false, 
        error: 'Not a withdrawal record' 
      });
    }
    
    if (paymentRecord.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Withdrawal already processed' 
      });
    }
    
    // Update payment record
    paymentRecord.status = status;
    if (transactionId) paymentRecord.transactionReference = transactionId;
    await paymentRecord.save();
    
    // Update associated earnings
    if (status === 'completed') {
      await ProviderEarning.updateMany(
        { paymentRecord: recordId },
        { $set: { status: 'paid' } }
      );
      
      // Notify provider
      await sendEmail({
        to: paymentRecord.provider.email,
        subject: 'Withdrawal Processed',
        text: `Your withdrawal request of $${paymentRecord.amount.toFixed(2)} has been processed successfully.`
      });
    } else if (status === 'rejected') {
      await ProviderEarning.updateMany(
        { paymentRecord: recordId },
        { $set: { status: 'available' } }
      );
      
      // Notify provider
      await sendEmail({
        to: paymentRecord.provider.email,
        subject: 'Withdrawal Rejected',
        text: `Your withdrawal request of $${paymentRecord.amount.toFixed(2)} has been rejected.`
      });
    }
    
    res.json({ 
      success: true, 
      message: `Withdrawal ${status} successfully`,
      data: paymentRecord
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Generate report (PDF)
const generateReport = async (req, res) => {
  try {
    const { providerId, startDate, endDate, reportType } = req.query;
    
    const match = providerId ? { provider: mongoose.Types.ObjectId(providerId) } : {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    let title = 'Admin Report';
    if (providerId) {
      const provider = await Provider.findById(providerId);
      title = `Report for ${provider.name}`;
    }
    
    // Create PDF document
    const doc = new PDFDocument();
    const filename = `report-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../temp', filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'));
    }
    
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    
    // Add document content
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown();
    
    // Report info
    doc.fontSize(12).text(`Report Type: ${reportType || 'General'}`);
    doc.text(`Period: ${startDate ? formatDate(startDate) : 'All time'} - ${endDate ? formatDate(endDate) : 'Present'}`);
    doc.moveDown();
    
    // Summary statistics
    doc.fontSize(14).text('Summary Statistics', { underline: true });
    doc.moveDown();
    
    const stats = await ProviderEarning.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          availableCount: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const summary = stats.length ? stats[0] : {
      totalGross: 0,
      totalCommission: 0,
      totalNet: 0,
      pendingCount: 0,
      availableCount: 0,
      paidCount: 0
    };
    
    doc.text(`Total Earnings: $${summary.totalGross.toFixed(2)}`);
    doc.text(`Total Commission: $${summary.totalCommission.toFixed(2)}`);
    doc.text(`Net Paid to Providers: $${summary.totalNet.toFixed(2)}`);
    doc.moveDown();
    doc.text(`Pending Earnings: ${summary.pendingCount}`);
    doc.text(`Available for Withdrawal: ${summary.availableCount}`);
    doc.text(`Paid Earnings: ${summary.paidCount}`);
    doc.moveDown();
    
    // Top providers
    if (!providerId) {
      doc.fontSize(14).text('Top Providers', { underline: true });
      doc.moveDown();
      
      const topProviders = await ProviderEarning.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$provider',
            totalNet: { $sum: '$netAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalNet: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'providers',
            localField: '_id',
            foreignField: '_id',
            as: 'provider'
          }
        },
        { $unwind: '$provider' }
      ]);
      
      if (topProviders.length === 0) {
        doc.text('No provider data available');
      } else {
        topProviders.forEach((provider, index) => {
          doc.text(`${index + 1}. ${provider.provider.name}`);
          doc.text(`   Earnings: $${provider.totalNet.toFixed(2)} (${provider.count} bookings)`);
          doc.moveDown(0.5);
        });
      }
      
      doc.moveDown();
    }
    
    // Recent payments
    doc.fontSize(14).text('Recent Payments', { underline: true });
    doc.moveDown();
    
    const payments = await PaymentRecord.find(providerId ? { provider: providerId } : {})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('provider', 'name');
    
    if (payments.length === 0) {
      doc.text('No payment records found');
    } else {
      payments.forEach((payment, index) => {
        doc.text(`#${index + 1}: ${formatDate(payment.createdAt)} - ${payment.provider?.name || 'N/A'}`);
        doc.text(`   Amount: $${payment.amount.toFixed(2)}`);
        doc.text(`   Net: $${payment.netAmount.toFixed(2)}`);
        doc.text(`   Method: ${payment.paymentMethod} - Status: ${payment.status}`);
        doc.moveDown(0.5);
      });
    }
    
    doc.end();
    
    stream.on('finish', () => {
      res.download(filePath, filename, (err) => {
        if (err) console.error('Error sending file:', err);
        // Clean up file after download
        fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Get top providers
const getTopProviders = async (req, res) => {
  try {
    const { limit = 5, period = 'month' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'week') {
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
      dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
    } else if (period === 'year') {
      dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
    }
    
    const topProviders = await ProviderEarning.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$provider',
          totalEarnings: { $sum: '$netAmount' },
          bookingCount: { $sum: 1 }
        }
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'providers',
          localField: '_id',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: '$provider' },
      {
        $project: {
          _id: 0,
          providerId: '$_id',
          name: '$provider.name',
          email: '$provider.email',
          totalEarnings: 1,
          bookingCount: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      data: topProviders
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin - Generate report (Excel)
const generateReportExcel = async (req, res) => {
  try {
    const { providerId, startDate, endDate, reportType } = req.query;
    
    const match = providerId ? { provider: mongoose.Types.ObjectId(providerId) } : {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    // Add report info
    worksheet.addRow(['Admin Report']);
    if (providerId) {
      const provider = await Provider.findById(providerId);
      worksheet.addRow(['Provider:', provider.name]);
    }
    worksheet.addRow(['Report Type:', reportType || 'General']);
    worksheet.addRow(['Period:', `${startDate ? formatDate(startDate) : 'All time'} - ${endDate ? formatDate(endDate) : 'Present'}`]);
    worksheet.addRow([]);
    
    // Add summary statistics
    worksheet.addRow(['Summary Statistics']);
    
    const stats = await ProviderEarning.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          availableCount: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const summary = stats.length ? stats[0] : {
      totalGross: 0,
      totalCommission: 0,
      totalNet: 0,
      pendingCount: 0,
      availableCount: 0,
      paidCount: 0
    };
    
    worksheet.addRow(['Total Earnings:', `$${summary.totalGross.toFixed(2)}`]);
    worksheet.addRow(['Total Commission:', `$${summary.totalCommission.toFixed(2)}`]);
    worksheet.addRow(['Net Paid to Providers:', `$${summary.totalNet.toFixed(2)}`]);
    worksheet.addRow([]);
    worksheet.addRow(['Pending Earnings:', summary.pendingCount]);
    worksheet.addRow(['Available for Withdrawal:', summary.availableCount]);
    worksheet.addRow(['Paid Earnings:', summary.paidCount]);
    worksheet.addRow([]);
    
    // Add top providers
    if (!providerId) {
      worksheet.addRow(['Top Providers']);
      worksheet.addRow(['Rank', 'Name', 'Earnings', 'Bookings']);
      
      const topProviders = await ProviderEarning.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$provider',
            totalNet: { $sum: '$netAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalNet: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'providers',
            localField: '_id',
            foreignField: '_id',
            as: 'provider'
          }
        },
        { $unwind: '$provider' }
      ]);
      
      topProviders.forEach((provider, index) => {
        worksheet.addRow([
          index + 1,
          provider.provider.name,
          provider.totalNet,
          provider.count
        ]);
      });
      
      worksheet.addRow([]);
    }
    
    // Add recent payments
    worksheet.addRow(['Recent Payments']);
    worksheet.addRow(['Date', 'Provider', 'Amount', 'Net', 'Method', 'Status']);
    
    const payments = await PaymentRecord.find(providerId ? { provider: providerId } : {})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('provider', 'name');
    
    payments.forEach(payment => {
      worksheet.addRow([
        formatDate(payment.createdAt),
        payment.provider?.name || 'N/A',
        payment.amount,
        payment.netAmount,
        payment.paymentMethod,
        payment.status
      ]);
    });
    
    // Generate file
    const filename = `report-${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../temp', filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'));
    }
    
    await workbook.xlsx.writeFile(filePath);
    
    res.download(filePath, filename, (err) => {
      if (err) console.error('Error sending file:', err);
      // Clean up file after download
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getEarningsSummary,
  requestWithdrawal,
  getPaymentHistory,
  getEarningsByBooking,
  downloadStatement,
  downloadStatementExcel,
  getAllProviderEarnings,
  processBookingPayment,
  getAllWithdrawalRequests,
  processWithdrawal,
  generateReport,
  getTopProviders,
  generateReportExcel
};