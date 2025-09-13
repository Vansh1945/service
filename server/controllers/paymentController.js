// controllers/paymentController.js
const mongoose = require('mongoose');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const sendEmail = require('../utils/sendEmail');
const ExcelJS = require('exceljs');


// Provider - Get earnings summary
const getEarningsSummary = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.provider._id)) {
      return res.status(400).json({ success: false, error: 'Invalid provider ID' });
    }

    const providerId = new mongoose.Types.ObjectId(req.provider._id);

    // 1️⃣ Aggregate earnings grouped by paymentMethod
    const earnings = await ProviderEarning.aggregate([
      {
        $match: {
          provider: providerId,
          isVisibleToProvider: true
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: '$booking' },
      { $match: { 'booking.status': 'completed' } },
      {
        $group: {
          _id: '$booking.paymentMethod',
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netAmount' },
          totalCommission: { $sum: '$commissionAmount' }
        }
      }
    ]);

    // 2️⃣ Available Balance = Online Net Earnings - Commission Pending
    const availableEarningsSum = await ProviderEarning.aggregate([
      {
        $match: {
          provider: providerId,
          isVisibleToProvider: true,
          paymentRecord: { $exists: false }
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: '$booking' },
      { $match: { 'booking.status': 'completed' } },
      {
        $group: {
          _id: '$booking.paymentMethod',
          totalNet: { $sum: '$netAmount' },
          totalCommission: { $sum: '$commissionAmount' }
        }
      }
    ]);

    let onlineNet = 0;
    let commissionPending = 0;

    availableEarningsSum.forEach(item => {
      if (item._id === 'online') {
        onlineNet += item.totalNet;
      } else if (item._id === 'cash') {
        commissionPending += item.totalCommission;
      }
    });

    const availableBalance = onlineNet - commissionPending;

    // 3️⃣ Process overall earnings data
    let totalEarnings = 0;
    let cashReceived = 0;

    earnings.forEach(item => {
      totalEarnings += item.totalNet;

      if (item._id === 'cash') {
        cashReceived += item.totalGross;  // Cash received should be gross amount (total service amount)
      }
    });

    res.json({
      success: true,
      totalEarnings,       // Online + Cash Net Earnings
      cashReceived,        // Total cash service amounts
      commissionPending,   // Cash commission amount pending
      availableBalance     // Online Net - Commission Pending
    });

  } catch (err) {
    console.error('Earnings summary error:', err);
    res.status(500).json({ success: false, error: 'Server error', details: err.message });
  }
};




// Provider - Request withdrawal (Only Bank Transfer)
const requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const providerId = req.provider._id;
      const { amount } = req.body;

      // 🔹 Validate amount
      if (!amount || isNaN(amount) || amount < 500) {
        throw new Error("Invalid amount. Minimum withdrawal is ₹500.");
      }

      // 🔹 Get available balance
      const availableBalance = await ProviderEarning.getAvailableBalance(providerId);
      if (amount > availableBalance) {
        throw new Error(
          `Requested ₹${amount} exceeds available balance ₹${availableBalance}`
        );
      }

      // 🔹 Get provider bank details
      const provider = await Provider.findById(providerId).select("bankDetails name wallet");
      if (!provider || !provider.bankDetails?.accountNo) {
        throw new Error("No bank details found in provider profile.");
      }

      const paymentMethod = "bank_transfer";
      const paymentDetails = {
        accountNumber: provider.bankDetails.accountNo,
        accountName: provider.bankDetails.accountName,
        ifscCode: provider.bankDetails.ifsc,
        bankName: provider.bankDetails.bankName,
      };

      // 🔹 Create Payment Record
      const paymentRecord = new PaymentRecord({
        provider: providerId,
        amount,
        netAmount: amount,
        paymentMethod,
        paymentDetails,
        status: "requested",
        transactionReference: `WDL-${Date.now()}-${Math.floor(
          1000 + Math.random() * 9000
        )}`,
      });

      await paymentRecord.save({ session });

      // 🔹 Link existing available ProviderEarning records
      const availableEarnings = await ProviderEarning.find({
        provider: providerId,
        isVisibleToProvider: true,
        paymentRecord: { $exists: false },
      }).session(session);

      let amountToAllocate = amount;
      const allocatedEarningIds = [];

      for (const earning of availableEarnings) {
        if (amountToAllocate <= 0) break;

        const allocateAmount = Math.min(earning.netAmount, amountToAllocate);

        // Link earning to this payment record
        earning.paymentRecord = paymentRecord._id;
        await earning.save({ session });

        allocatedEarningIds.push(earning._id);
        amountToAllocate -= allocateAmount;
      }

      if (amountToAllocate > 0) {
        throw new Error(
          `Could not allocate full withdrawal amount. Remaining: ₹${amountToAllocate}`
        );
      }

      // 🔹 Save linked earnings in payment record
      paymentRecord.earnings = allocatedEarningIds;
      await paymentRecord.save({ session });
      // 🔹 Update provider wallet immediately
      if (!provider.wallet) {
        provider.wallet = {
          availableBalance: 0,
          totalWithdrawn: 0,
          lastUpdated: new Date()
        };
      }

      provider.wallet.availableBalance = Math.max(
        0,
        (provider.wallet.availableBalance || 0) - amount
      );
      provider.wallet.totalWithdrawn = (provider.wallet.totalWithdrawn || 0) + amount;
      provider.wallet.lastUpdated = new Date();
      await provider.save({ session });


      // 🔹 Schedule auto status update to "processing" after 3 hours
      setTimeout(async () => {
        try {
          const record = await PaymentRecord.findById(paymentRecord._id);
          if (record && record.status === "requested") {
            record.status = "processing";
            record.processedAt = new Date();
            await record.save();
          }
        } catch (err) {
          console.error("Error auto-updating withdrawal to processing:", err);
        }
      }, 3 * 60 * 60 * 1000); // 3 hours

      res.json({
        success: true,
        message: "Withdrawal request submitted successfully",
        data: {
          reference: paymentRecord.transactionReference,
          amount: paymentRecord.amount,
          status: paymentRecord.status,
          method: paymentRecord.paymentMethod,
          createdAt: paymentRecord.createdAt,
        },
      });
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  } finally {
    await session.endSession();
  }
};


// Provider - Earnings Report (View or Download Excel)
const downloadEarningsReport = async (req, res) => {
  try {
    const providerId = req.provider._id;
    const { startDate, endDate, download } = req.query;

    let filter = { provider: new mongoose.Types.ObjectId(providerId) };

    if (download === "true") {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: "Start date and End date are required for download" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, error: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, error: "Maximum range is 2 months" });
      }

      filter.createdAt = { $gte: start, $lte: end };
    }

    const earnings = await ProviderEarning.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "paymentrecords",
          localField: "paymentRecord",
          foreignField: "_id",
          as: "paymentInfo",
        },
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          booking: 1,
          grossAmount: 1,
          commissionRate: 1,
          commissionAmount: 1,
          netAmount: 1,
          createdAt: 1,
          status: {
            $switch: {
              branches: [
                {
                  case: { $ifNull: ["$paymentInfo", false] },
                  then: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$paymentInfo.status", "completed"] }, then: "paid" },
                        { case: { $in: ["$paymentInfo.status", ["pending", "processing"]] }, then: "processing" },
                        { case: { $in: ["$paymentInfo.status", ["failed", "rejected"]] }, then: "failed" },
                      ],
                      default: "unknown",
                    },
                  },
                },
              ],
              default: "available",
            },
          },
        },
      },
    ]);

    if (!earnings.length) {
      return res.status(200).json({ success: false, message: "No earnings found" });
    }

    if (download === "true") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Earnings Report");

      worksheet.columns = [
        { header: "Booking ID", key: "booking", width: 25 },
        { header: "Gross Amount (₹)", key: "grossAmount", width: 20 },
        { header: "Commission Rate (%)", key: "commissionRate", width: 20 },
        { header: "Commission Amount (₹)", key: "commissionAmount", width: 20 },
        { header: "Net Amount (₹)", key: "netAmount", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Created At", key: "createdAt", width: 25 },
      ];

      earnings.forEach((earning) => {
        worksheet.addRow({
          booking: earning.booking.toString(),
          grossAmount: earning.grossAmount,
          commissionRate: earning.commissionRate,
          commissionAmount: earning.commissionAmount,
          netAmount: earning.netAmount,
          status: earning.status,
          createdAt: new Date(earning.createdAt).toISOString().slice(0, 19).replace("T", " "),
        });
      });

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
      });

      // Set headers BEFORE sending the response
      res.setHeader("Content-Disposition", `attachment; filename=earnings_report_${startDate}_to_${endDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);

      // Send success message after sending buffer
      console.log("Earnings report generated and sent successfully");
      return;
    } else {
      res.json({ success: true, earnings });
    }
  } catch (error) {
    console.error("Error generating earnings report:", error);
    res.status(500).json({ success: false, error: "Failed to generate earnings report" });
  }
};

// Provider - Withdrawal Report (View or Download Excel)
const downloadWithdrawalReport = async (req, res) => {
  try {
    const providerId = req.provider._id;
    const { startDate, endDate, download } = req.query;

    let filter = { provider: new mongoose.Types.ObjectId(providerId) };

    if (download === "true") {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "StartDate and EndDate are required for download" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, message: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, message: "Maximum range is 2 months" });
      }

      filter.createdAt = { $gte: start, $lte: end };
    }

    const records = await PaymentRecord.find(filter).sort({ createdAt: -1 });

    if (!records.length) {
      return res.status(200).json({ success: true, message: "No withdrawal records found", records: [] });
    }

    if (download === "true") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Withdrawal Report");

      worksheet.columns = [
        { header: "Reference ID", key: "reference", width: 30 },
        { header: "Requested Amount (₹)", key: "amount", width: 20 },
        { header: "Net Amount Paid (₹)", key: "netAmount", width: 20 },
        { header: "Payment Method", key: "paymentMethod", width: 20 },
        { header: "Account Number", key: "accountNumber", width: 25 },
        { header: "IFSC Code", key: "ifscCode", width: 20 },
        { header: "Bank Name", key: "bankName", width: 25 },
        { header: "Status", key: "status", width: 15 },
        { header: "Requested Date", key: "requestedDate", width: 20 },
        { header: "Processed Date", key: "processedDate", width: 25 },
        { header: "Admin Remark / Rejection", key: "remark", width: 40 },
      ];

      records.forEach((record) => {
        worksheet.addRow({
          reference: record.transactionReference || "N/A",
          amount: record.amount,
          netAmount: record.netAmount,
          paymentMethod: record.paymentMethod === "bank_transfer" ? "Bank Transfer" : record.paymentMethod,
          accountNumber: record.paymentDetails?.accountNumber || "N/A",
          ifscCode: record.paymentDetails?.ifscCode || "N/A",
          bankName: record.paymentDetails?.bankName || "N/A",
          status: record.status,
          requestedDate: record.createdAt.toISOString().slice(0, 19).replace("T", " "),
          processedDate: record.completedAt?.toISOString().slice(0, 19).replace("T", " ") || "N/A",
          remark: record.adminRemark || record.rejectionReason || "N/A",
        });
      });

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
      });

      res.setHeader("Content-Disposition", `attachment; filename=withdrawal_report_${startDate}_to_${endDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);

      console.log("Withdrawal report generated and sent successfully");
      return;
    } else {
      res.json({ success: true, records });
    }
  } catch (error) {
    console.error("Error generating withdrawal report:", error);
    res.status(500).json({ success: false, message: "Failed to generate withdrawal report", error: error.message });
  }
};


// Admin - Get All withdrawal requests
const getAllWithdrawalRequests = async (req, res) => {
  try {
    let { status, page = 1, limit = 10, startDate, endDate } = req.query;

    const filter = {};
    if (status) filter.status = status; // requested / processing / completed / rejected

    // Date filter (optional)
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      PaymentRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("provider", "name email phone bankDetails")
        .populate("admin", "name email"),
      PaymentRecord.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: "Withdrawal requests fetched successfully",
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: records
    });

  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Admin - Approve withdrawal request
const approveWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { transactionReference, notes } = req.body;

    // 1️⃣ Find PaymentRecord with provider populated
    let paymentRecord = await PaymentRecord.findById(id)
      .populate("provider")
      .session(session);

    if (!paymentRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Withdrawal request not found" });
    }

    if (!['requested', 'processing'].includes(paymentRecord.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot approve request with status: ${paymentRecord.status}` });
    }

    // 2️⃣ Update payment record
    paymentRecord.status = "completed";
    paymentRecord.transactionReference = transactionReference;
    paymentRecord.adminRemark = notes || "";
    paymentRecord.completedAt = new Date();
    await paymentRecord.save({ session });

    // 3️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 4️⃣ Re-fetch provider after transaction to ensure populated fields
    const provider = await Provider.findById(paymentRecord.provider._id);

    if (!provider || !provider.email) {
      console.warn("Provider email not found, skipping email send");
    } else {
      const emailHtml = `
        <h3>Withdrawal Request Approved ✅</h3>
        <p>Dear ${provider.name},</p>
        <p>Your withdrawal request of ₹${paymentRecord.netAmount} has been approved successfully.</p>
        <p><strong>Transaction Reference:</strong> ${transactionReference}</p>
        <p><strong>Payment Method:</strong> ${paymentRecord.paymentMethod}</p>
        <p><strong>Approved On:</strong> ${paymentRecord.completedAt.toLocaleString()}</p>
        <p><strong>Admin Remark:</strong> ${notes || "N/A"}</p>
        <br/>
        <p>Regards,</p>
        <p><b>Raj Electrical Service</b></p>
      `;
      try {
        await sendEmail({
          to: provider.email,
          subject: "Withdrawal Request Approved - Raj Electrical Service",
          html: emailHtml
        });

        // Mark email as sent
        paymentRecord.emailSent = true;
        paymentRecord.emailSentAt = new Date();
        await paymentRecord.save();
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Withdrawal request approved successfully",
      data: paymentRecord
    });

  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) { }
    session.endSession();
    console.error("Error approving withdrawal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// Admin - Reject withdrawal request
const rejectWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { rejectionReason, adminRemark } = req.body;

    // Find the payment record
    const paymentRecord = await PaymentRecord.findById(id).populate("provider").session(session);
    if (!paymentRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Withdrawal request not found" });
    }

    if (!['requested', 'processing'].includes(paymentRecord.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot reject a request with status: ${paymentRecord.status}` });
    }

    // Update payment record
    paymentRecord.status = "rejected";
    paymentRecord.rejectionReason = rejectionReason || "No reason provided";
    paymentRecord.adminRemark = adminRemark || "";
    paymentRecord.completedAt = new Date();
    await paymentRecord.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Send email to provider (outside transaction)
    const provider = paymentRecord.provider;
    const emailHtml = `
      <h3>Withdrawal Request Rejected ❌</h3>
      <p>Dear ${provider.name},</p>
      <p>Your withdrawal request has been rejected.</p>
      <p><strong>Rejected Amount:</strong> ₹${paymentRecord.netAmount}</p>
      <p><strong>Payment Method:</strong> ${paymentRecord.paymentMethod}</p>
      <p><strong>Rejection Reason:</strong> ${paymentRecord.rejectionReason}</p>
      <p><strong>Admin Remark:</strong> ${paymentRecord.adminRemark || "N/A"}</p>
      <p><strong>Processed On:</strong> ${paymentRecord.completedAt.toLocaleString()}</p>
      <br/>
      <p>Regards,</p>
      <p><b>Raj Electrical Service</b></p>
    `;

    await sendEmail({
      to: provider.email,
      subject: "Withdrawal Request Rejected - Raj Electrical Service",
      html: emailHtml
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal request rejected successfully",
      data: paymentRecord
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error rejecting withdrawal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// Admin - Generate Withdrawal / Payment Report
const generateWithdrawalReport = async (req, res) => {
  try {
    const { status, fromDate, toDate, page = 1, limit = 100 } = req.query;

    // Validate required date range
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required"
      });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Ensure min 7 days and max 2 months range
    const diffMs = to - from;
    const minRangeMs = 7 * 24 * 60 * 60 * 1000;    // 7 days
    const maxRangeMs = 60 * 24 * 60 * 60 * 1000; // 60 days

    if (diffMs < minRangeMs || diffMs > maxRangeMs) {
      return res.status(400).json({
        success: false,
        message: "Date range must be between 7 days and 2 months"
      });
    }

    // Build filter
    const filter = {
      createdAt: { $gte: from, $lte: to }
    };
    if (status) {
      filter.status = status;
    }

    // Fetch PaymentRecords with provider details populated
    const records = await PaymentRecord.find(filter)
      .populate('provider', 'name bankDetails')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Generate Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Withdrawal Report');

    worksheet.columns = [
      { header: 'Transaction Reference', key: 'transactionReference', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Requested Amount', key: 'amount', width: 15 },
      { header: 'Net Amount Paid', key: 'netAmount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Account Number', key: 'accountNumber', width: 25 },
      { header: 'IFSC Code', key: 'ifscCode', width: 20 },
      { header: 'Bank Name', key: 'bankName', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Requested Date', key: 'requestedDate', width: 20 },
      { header: 'Completed Date', key: 'completedDate', width: 20 },
      { header: 'Admin Remark / Rejection Reason', key: 'adminRemark', width: 30 }
    ];

    records.forEach(record => {
      worksheet.addRow({
        transactionReference: record.transactionReference || '-',
        providerId: record.provider ? record.provider._id.toString() : '-',
        providerName: record.provider ? record.provider.name : '-',
        amount: record.amount,
        netAmount: record.netAmount,
        paymentMethod: record.paymentMethod,
        accountNumber: record.paymentDetails.accountNumber || '-',
        ifscCode: record.paymentDetails.ifscCode || '-',
        bankName: record.paymentDetails.bankName || '-',
        status: record.status,
        requestedDate: record.createdAt.toLocaleString(),
        completedDate: record.completedAt ? record.completedAt.toLocaleString() : '-',
        adminRemark: record.adminRemark || record.rejectionReason || '-'
      });
    });

    // Send Excel file as response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=withdrawal_report_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Generate withdrawal report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating report',
      error: error.message
    });
  }
};

// Admin - Provider Wise Earnings Report
const generateProviderEarningsReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Validate dates
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required",
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    // Validate min 7 days, max 2 months
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({
        success: false,
        message: "Date range must be between 7 days and 2 months",
      });
    }

    // Fetch all providers
    const providers = await Provider.find({ isDeleted: false });

    if (!providers.length) {
      return res.status(200).json({
        success: true,
        message: "No providers found",
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Provider Earnings Report");

    worksheet.columns = [
      { header: "Provider ID", key: "providerId", width: 25 },
      { header: "Provider Name", key: "providerName", width: 25 },
      { header: "Total Bookings Completed", key: "totalBookings", width: 20 },
      { header: "Total Earnings (Gross)", key: "totalEarnings", width: 20 },
      { header: "Total Commission", key: "totalCommission", width: 20 },
      { header: "Net Earnings", key: "netEarnings", width: 20 },
      { header: "Total Withdrawn", key: "totalWithdrawn", width: 20 },
      { header: "Pending Balance", key: "pendingBalance", width: 20 },
    ];

    for (const provider of providers) {
      // Get all payment records for this provider within date range
      const records = await PaymentRecord.find({
        provider: provider._id,
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
      });

      const totalBookings = records.length;
      const totalEarnings = records.reduce((sum, r) => sum + (r.amount || 0), 0);

      // Assuming admin cut is difference between gross and net
      const totalCommission = records.reduce((sum, r) => sum + ((r.amount || 0) - (r.netAmount || 0)), 0);
      const netEarnings = records.reduce((sum, r) => sum + (r.netAmount || 0), 0);

      // Total withdrawn: sum of netAmount from completed withdrawals
      const totalWithdrawn = records.reduce((sum, r) => sum + (r.netAmount || 0), 0);

      // Pending balance = total earnings - total withdrawn
      const pendingBalance = totalEarnings - totalWithdrawn;

      worksheet.addRow({
        providerId: provider._id.toString(),
        providerName: provider.name,
        totalBookings,
        totalEarnings,
        totalCommission,
        netEarnings,
        totalWithdrawn,
        pendingBalance
      });
    }

    // Send Excel file
    const fileName = `Provider_Earnings_Report_${fromDate}_to_${toDate}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Provider earnings report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate provider earnings report",
      error: error.message
    });
  }
};

// Admin - Commission Report (Admin Revenue Report)
const getCommissionReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    // Ensure min 7 days, max 2 months (~62 days)
    const diffTime = Math.abs(end - start);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({ success: false, message: 'Date range must be between 7 days and 2 months' });
    }

    // Fetch completed bookings in date range
    const bookings = await Booking.find({
      status: 'completed',
      serviceCompletedAt: { $gte: start, $lte: end }
    })
      .populate('provider', 'name email')
      .populate('services.service', 'title basePrice');

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ success: true, message: 'No completed bookings in the selected date range' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Commission Report');

    // Columns
    worksheet.columns = [
      { header: 'Booking ID', key: 'bookingId', width: 25 },
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Service Name', key: 'serviceName', width: 30 },
      { header: 'Service Qty', key: 'serviceQty', width: 10 },
      { header: 'Service Amount', key: 'serviceAmount', width: 15 },
      { header: 'Total Booking Amount', key: 'totalAmount', width: 20 },
      { header: 'Commission (%)', key: 'commissionPercent', width: 15 },
      { header: 'Commission Amount', key: 'commissionAmount', width: 20 },
      { header: 'Date', key: 'date', width: 20 }
    ];

    // Fill data
    bookings.forEach(booking => {
      booking.services.forEach(item => {
        worksheet.addRow({
          bookingId: booking._id.toString(),
          providerName: booking.provider?.name || 'N/A',
          providerId: booking.provider?._id.toString() || 'N/A',
          serviceName: item.service?.title || 'N/A',
          serviceQty: item.quantity,
          serviceAmount: item.price,
          totalAmount: booking.totalAmount,
          commissionPercent: booking.commissionRule ? ((booking.commissionAmount / booking.totalAmount) * 100).toFixed(2) : 0,
          commissionAmount: booking.commissionAmount,
          date: booking.serviceCompletedAt.toISOString().split('T')[0]
        });
      });
    });

    // Header bold
    worksheet.getRow(1).font = { bold: true };

    // Send Excel file
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Commission_Report_${fromDate}_to_${toDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error('Error generating commission report:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin - Failed / Rejected Withdrawal Report
const failedRejectedWithdrawalsReport = async (req, res) => {
  try {
    const { startDate, endDate, download } = req.query; // download=true for Excel

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays < 7) return res.status(400).json({ message: 'Minimum range is 7 days' });
    if (diffDays > 62) return res.status(400).json({ message: 'Maximum range is 2 months' });

    // Fetch records
    const records = await PaymentRecord.find({
      status: { $in: ['failed', 'rejected'] },
      createdAt: { $gte: start, $lte: end }
    }).populate('provider', 'name email');

    if (download === 'true') {
      // Excel download
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('FailedRejectedWithdrawals');

      worksheet.columns = [
        { header: 'Provider Name', key: 'providerName', width: 25 },
        { header: 'Provider ID', key: 'providerId', width: 25 },
        { header: 'Requested Amount', key: 'amount', width: 20 },
        { header: 'Reason for Rejection', key: 'reason', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Requested Date', key: 'requestedAt', width: 20 },
        { header: 'Action Taken Date', key: 'actionDate', width: 20 }
      ];

      records.forEach(record => {
        worksheet.addRow({
          providerName: record.provider?.name || 'N/A',
          providerId: record.provider?._id || 'N/A',
          amount: record.amount,
          reason: record.rejectionReason || 'N/A',
          status: record.status,
          requestedAt: record.createdAt ? record.createdAt.toISOString().split('T')[0] : 'N/A',
          actionDate: record.completedAt ? record.completedAt.toISOString().split('T')[0] : 'N/A'
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=FailedRejectedWithdrawals_${startDate}_to_${endDate}.xlsx`
      );

      await workbook.xlsx.write(res);
      return res.status(200).end();
    }

    // JSON view
    res.status(200).json(records);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  // Provider
  getEarningsSummary,
  requestWithdrawal,
  downloadEarningsReport,
  downloadWithdrawalReport,


  // Admin 
  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  generateWithdrawalReport,
  generateProviderEarningsReport,
  getCommissionReport,
  failedRejectedWithdrawalsReport

};
