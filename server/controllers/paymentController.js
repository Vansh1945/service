// controllers/paymentController.js
const mongoose = require('mongoose');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const sendEmail = require('../utils/sendEmail');
const ExcelJS = require('exceljs');


// Helper function to calculate payment settlement
const calculatePaymentSettlement = (availableBalanceResult) => {
  return availableBalanceResult.reduce(
    (settlement, item) => {
      if (item._id === 'online') {
        // For online payments, add net amount to available balance
        settlement.availableBalance += item.totalNet || 0;
      } else if (item._id === 'cash') {
        // For cash payments, provider keeps full amount but owes commission
        settlement.commissionPending += item.totalCommission || 0;
        settlement.availableBalance -= item.totalCommission || 0;
      }
      return settlement;
    },
    { availableBalance: 0, commissionPending: 0 }
  );
};

// Provider - Get earnings summary
const getEarningsSummary = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.provider._id)) {
      return res.status(400).json({ success: false, error: 'Invalid provider ID' });
    }

    const providerId = new mongoose.Types.ObjectId(req.provider._id);
    const { startDate, endDate } = req.query;

    // Build match conditions
    const matchConditions = {
      provider: providerId,
      isVisibleToProvider: true
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      matchConditions.createdAt = { $gte: start, $lte: end };
    }

    // Get earnings (filtered by date if provided)
    const earnings = await ProviderEarning.aggregate([
      {
        $match: matchConditions
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
          _id: null,
          totalEarnings: { $sum: '$netAmount' },
          cashReceived: {
            $sum: {
              $cond: [{ $eq: ['$booking.paymentMethod', 'cash'] }, '$grossAmount', 0]
            }
          },
          commissionPending: {
            $sum: {
              $cond: [{ $eq: ['$booking.paymentMethod', 'cash'] }, '$commissionAmount', 0]
            }
          }
        }
      }
    ]);

    // Get available balance data grouped by payment method
    const availableBalanceResult = await ProviderEarning.aggregate([
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
        $lookup: {
          from: 'paymentrecords',
          localField: 'paymentRecord',
          foreignField: '_id',
          as: 'paymentInfo'
        }
      },
      { $unwind: { path: '$paymentInfo', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'paymentInfo': { $exists: false } },
            { 'paymentInfo.status': { $ne: 'completed' } }
          ]
        }
      },
      {
        $group: {
          _id: '$booking.paymentMethod',
          totalNet: { $sum: '$netAmount' },
          totalCommission: { $sum: '$commissionAmount' }
        }
      }
    ]);

    // Calculate payment settlement using helper function
    const settlement = calculatePaymentSettlement(availableBalanceResult);

    // Ensure available balance doesn't go negative
    settlement.availableBalance = Math.max(0, settlement.availableBalance);

    // Get total requested/processing withdrawals that should be deducted from available balance
    const pendingWithdrawals = await PaymentRecord.aggregate([
      {
        $match: {
          provider: providerId,
          status: { $in: ['requested', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPendingWithdrawals: { $sum: '$amount' }
        }
      }
    ]);

    const totalPendingWithdrawals = pendingWithdrawals.length > 0
      ? pendingWithdrawals[0].totalPendingWithdrawals
      : 0;

    // Subtract pending withdrawals from available balance
    settlement.availableBalance = Math.max(0, settlement.availableBalance - totalPendingWithdrawals);

    const result = earnings[0] || {
      totalEarnings: 0,
      cashReceived: 0,
      commissionPending: 0
    };

    res.json({
      success: true,
      totalEarnings: result.totalEarnings || 0,
      cashReceived: result.cashReceived || 0,
      commissionPending: result.commissionPending || 0,
      availableBalance: settlement.availableBalance,
      pendingWithdrawals: totalPendingWithdrawals
    });

  } catch (err) {
    console.error('Earnings summary error:', err);
    res.status(500).json({ success: false, error: 'Server error', details: err.message });
  }
};


// Provider - Request bulk withdrawal
const requestBulkWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const providerId = req.provider._id;
      const { amount } = req.body;

      // Validate amount
      if (!amount || isNaN(amount) || amount < 500) {
        throw new Error("Invalid amount. Minimum withdrawal is ₹500.");
      }

      // Calculate available balance
      const availableBalanceResult = await ProviderEarning.aggregate([
        {
          $match: {
            provider: new mongoose.Types.ObjectId(providerId),
            isVisibleToProvider: true,
          },
        },
        {
          $lookup: {
            from: 'paymentrecords',
            localField: 'paymentRecord',
            foreignField: '_id',
            as: 'paymentInfo',
          },
        },
        {
          $unwind: {
            path: '$paymentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $or: [
              { paymentInfo: null },
              { 'paymentInfo.status': { $ne: 'completed' } },
            ],
          },
        },
        {
          $lookup: {
            from: 'bookings',
            localField: 'booking',
            foreignField: '_id',
            as: 'booking',
          },
        },
        { $unwind: '$booking' },
        { $match: { 'booking.status': 'completed' } },
        {
          $group: {
            _id: '$booking.paymentMethod',
            totalNet: { $sum: '$netAmount' },
            totalCommission: { $sum: '$commissionAmount' },
          },
        },
      ]).session(session);

      let baseAvailableBalance = 0;
      availableBalanceResult.forEach(item => {
        if (item._id === 'online') {
          baseAvailableBalance += item.totalNet || 0;
        } else if (item._id === 'cash') {
          baseAvailableBalance -= item.totalCommission || 0;
        }
      });
      baseAvailableBalance = Math.max(0, baseAvailableBalance);

      // Get total pending withdrawals
      const pendingWithdrawals = await PaymentRecord.aggregate([
        {
          $match: {
            provider: new mongoose.Types.ObjectId(providerId),
            status: { $in: ['requested', 'processing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalPendingWithdrawals: { $sum: '$amount' }
          }
        }
      ]).session(session);

      const totalPendingWithdrawals = pendingWithdrawals.length > 0
        ? pendingWithdrawals[0].totalPendingWithdrawals
        : 0;

      // Calculate actual available balance after deducting pending withdrawals
      const actualAvailableBalance = Math.max(0, baseAvailableBalance - totalPendingWithdrawals);

      if (amount > actualAvailableBalance) {
        throw new Error('Insufficient balance for withdrawal');
      }

      // Get provider bank details
      const provider = await Provider.findById(providerId)
        .select("bankDetails name")
        .session(session);

      if (!provider) throw new Error("Provider not found.");
      if (!provider.bankDetails?.accountNo) throw new Error("Bank details missing.");

      // Find eligible ProviderEarning records (latest first)
      const eligibleEarnings = await ProviderEarning.find({
        provider: providerId,
        paymentRecord: { $exists: false },
        isVisibleToProvider: true
      })
      .populate({
        path: 'booking',
        match: { status: 'completed' }
      })
      .sort({ createdAt: -1 }) // Latest first
      .session(session);

      // Filter earnings with completed bookings
      const validEarnings = eligibleEarnings.filter(e => e.booking);

      // Accumulate earnings until amount is covered
      let accumulatedAmount = 0;
      const selectedEarnings = [];
      for (const earning of validEarnings) {
        if (accumulatedAmount >= amount) break;
        accumulatedAmount += earning.netAmount;
        selectedEarnings.push(earning);
      }

      if (accumulatedAmount < amount) {
        throw new Error('Insufficient eligible earnings for withdrawal');
      }

      // Create PaymentRecord
      const paymentRecord = new PaymentRecord({
        provider: providerId,
        amount,
        netAmount: amount,
        paymentMethod: "bank_transfer",
        paymentDetails: {
          accountNumber: provider.bankDetails.accountNo,
          accountName: provider.bankDetails.accountName,
          ifscCode: provider.bankDetails.ifsc,
          bankName: provider.bankDetails.bankName,
        },
        status: 'processing',
        withdrawalType: 'manual_bulk',
        notes: "Manual bulk withdrawal",
        transactionReference: `WDL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      });

      await paymentRecord.save({ session });

      // Link selected earnings to payment record
      const selectedEarningIds = selectedEarnings.map(e => e._id);
      await ProviderEarning.updateMany(
        { _id: { $in: selectedEarningIds } },
        { paymentRecord: paymentRecord._id },
        { session }
      );

      // Calculate updated available balance
      const updatedAvailableBalance = actualAvailableBalance - amount;

      res.json({
        success: true,
        message: "Manual bulk withdrawal processed successfully",
        data: {
          reference: paymentRecord.transactionReference,
          amount: paymentRecord.amount,
          status: paymentRecord.status,
          withdrawalType: paymentRecord.withdrawalType,
          method: paymentRecord.paymentMethod,
          createdAt: paymentRecord.createdAt,
          availableBalance: updatedAvailableBalance
        }
      });
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  } finally {
    await session.endSession();
  }
};



// Provider - Earnings Report (View or Download Excel)
const downloadEarningsReport = async (req, res) => {
  try {
    const providerId = req.provider._id;
    const { startDate, endDate, download, page = 1, limit = 20 } = req.query;

    let filter = { provider: new mongoose.Types.ObjectId(providerId) };

    if (download === "true") {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: "Start date and End date are required for download" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, error: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, error: "Maximum range is 2 months" });
      }

      filter.createdAt = { $gte: start, $lte: end };
    }

    // Get total count for pagination
    const total = await ProviderEarning.countDocuments(filter);

    // Modified aggregation with sorting and pagination
    const earnings = await ProviderEarning.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "bookings",
          localField: "booking",
          foreignField: "_id",
          as: "bookingInfo",
        },
      },
      { $unwind: "$bookingInfo" },
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
        $addFields: {
          paymentMethod: "$bookingInfo.paymentMethod",
          status: {
            $cond: {
              if: { $and: [{ $ne: ["$paymentInfo", null] }, { $eq: ["$paymentInfo.status", "completed"] }] },
              then: "Withdrawn",
              else: "Available"
            }
          }
        },
      },
      {
        $sort: { createdAt: -1 } // Sort by latest first
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          booking: 1,
          grossAmount: 1,
          commissionRate: 1,
          commissionAmount: 1,
          netAmount: 1,
          createdAt: 1,
          paymentMethod: 1,
          status: 1,
        },
      },
    ]);

    if (!earnings.length && page === 1) {
      return res.status(200).json({ success: false, message: "No earnings found" });
    }

    if (download === "true") {
      // For download, get all earnings without pagination
      const allEarnings = await ProviderEarning.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "bookings",
            localField: "booking",
            foreignField: "_id",
            as: "bookingInfo",
          },
        },
        { $unwind: "$bookingInfo" },
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
          $addFields: {
            paymentMethod: "$bookingInfo.paymentMethod",
            status: {
              $cond: {
                if: { $and: [{ $ne: ["$paymentInfo", null] }, { $eq: ["$paymentInfo.status", "completed"] }] },
                then: "Withdrawn",
                else: "Available"
              }
            }
          },
        },
        {
          $sort: { createdAt: -1 } // Sort by latest first
        },
        {
          $project: {
            booking: 1,
            grossAmount: 1,
            commissionRate: 1,
            commissionAmount: 1,
            netAmount: 1,
            createdAt: 1,
            paymentMethod: 1,
            status: 1,
          },
        },
      ]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Earnings Report");

      worksheet.columns = [
        { header: "Booking ID", key: "booking", width: 25 },
        { header: "Gross Amount (₹)", key: "grossAmount", width: 20 },
        { header: "Commission Rate (%)", key: "commissionRate", width: 20 },
        { header: "Commission Amount (₹)", key: "commissionAmount", width: 20 },
        { header: "Net Amount (₹)", key: "netAmount", width: 20 },
        { header: "Payment Method", key: "paymentMethod", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Created At", key: "createdAt", width: 25 },
      ];

      allEarnings.forEach((earning) => {
        worksheet.addRow({
          booking: earning.booking?.toString() || "N/A",
          grossAmount: earning.grossAmount || 0,
          commissionRate: earning.commissionRate || 0,
          commissionAmount: earning.commissionAmount || 0,
          netAmount: earning.netAmount || 0,
          paymentMethod: earning.paymentMethod || "unknown",
          status: earning.status || "N/A",
          createdAt: earning.createdAt
            ? new Date(earning.createdAt).toISOString().slice(0, 19).replace("T", " ")
            : "N/A",
        });
      });

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
      });

      res.setHeader("Content-Disposition", `attachment; filename=earnings_report_${startDate}_to_${endDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);

      console.log("Earnings report generated and sent successfully");
      return;
    } else {
      res.json({ success: true, earnings, total, page: parseInt(page), limit: parseInt(limit) });
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

    let filter = { provider: providerId };

    if (download === "true") {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "StartDate and EndDate are required for download" });
      }

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

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
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Withdrawal Report");

      // Define columns
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

      // Add header row
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
      });

      // Add data rows
      records.forEach((record) => {
        worksheet.addRow({
          reference: record.transactionReference || "N/A",
          amount: record.amount,
          netAmount: record.netAmount || record.amount,
          paymentMethod: record.paymentMethod === "bank_transfer" ? "Bank Transfer" : record.paymentMethod,
          accountNumber: record.paymentDetails?.accountNumber || "N/A",
          ifscCode: record.paymentDetails?.ifscCode || "N/A",
          bankName: record.paymentDetails?.bankName || "N/A",
          status: record.status,
          requestedDate: record.createdAt.toLocaleString('en-IN'),
          processedDate: record.completedAt ? record.completedAt.toLocaleString('en-IN') : "N/A",
          remark: record.adminRemark || record.rejectionReason || "N/A",
        });
      });

      // Set headers
      res.setHeader("Content-Disposition", `attachment; filename=withdrawal_report_${startDate}_to_${endDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      // Use write instead of writeBuffer for better compatibility
      await workbook.xlsx.write(res);

      // End the response after writing
      res.end();

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

// Admin  Related Code

// Admin - Get All withdrawal requests
const getAllWithdrawalRequests = async (req, res) => {
  try {
    let { status, page = 1, limit = 10, startDate, endDate, providerSearch, sortBy } = req.query;

    const filter = {};
    if (status) filter.status = status; // requested / processing / completed / rejected

    // Date filter (optional) with validation
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, error: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, error: "Maximum range is 2 months" });
      }
      end.setHours(23, 59, 59, 999); // Include the entire end date
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    }

    const skip = (page - 1) * limit;

    // Calculate one week ago
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build aggregation pipeline
    let pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'providerearnings',
          localField: '_id',
          foreignField: 'paymentRecord',
          as: 'earnings'
        }
      },
      {
        $addFields: {
          earningsCount: { $size: '$earnings' }
        }
      },
      {
        $lookup: {
          from: 'providers',
          localField: 'provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'admins',
          localField: 'admin',
          foreignField: '_id',
          as: 'admin'
        }
      },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          let: { providerId: '$provider._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$provider', '$$providerId'] },
                    { $eq: ['$status', 'completed'] },
                    { $gte: ['$createdAt', oneWeekAgo] }
                  ]
                }
              }
            }
          ],
          as: 'bookingsLastWeek'
        }
      },
      {
        $addFields: {
          bookingsLastWeekCount: { $size: '$bookingsLastWeek' }
        }
      }
    ];

    // Add provider search filter
    if (providerSearch) {
      pipeline.push({
        $match: {
          $or: [
            { 'provider.name': { $regex: providerSearch, $options: 'i' } },
            { 'provider._id': mongoose.isValidObjectId(providerSearch) ? new mongoose.Types.ObjectId(providerSearch) : null }
          ].filter(Boolean)
        }
      });
    }

    // Add sorting
    let sortStage = { $sort: { createdAt: -1 } }; // default: latest first
    if (sortBy === 'amount_desc') {
      sortStage = { $sort: { amount: -1, createdAt: -1 } }; // highest amount first, then latest
    } else if (sortBy === 'amount_asc') {
      sortStage = { $sort: { amount: 1, createdAt: -1 } }; // lowest amount first, then latest
    } else if (sortBy === 'createdAt_desc') {
      sortStage = { $sort: { createdAt: -1 } }; // newest first
    } else if (sortBy === 'createdAt_asc') {
      sortStage = { $sort: { createdAt: 1 } }; // oldest first
    }
    pipeline.push(sortStage);

    // Add pagination
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          'provider.password': 0,
          'provider.createdAt': 0,
          'provider.updatedAt': 0,
          'admin.password': 0,
          'admin.createdAt': 0,
          'admin.updatedAt': 0
        }
      }
    );

    // Get total count (need to apply filters except pagination)
    let countPipeline = pipeline.slice(0, -3); // Remove skip, limit, project
    if (providerSearch) {
      // Add search filter to count pipeline
      countPipeline.push({
        $match: {
          $or: [
            { 'provider.name': { $regex: providerSearch, $options: 'i' } },
            { 'provider._id': mongoose.isValidObjectId(providerSearch) ? new mongoose.Types.ObjectId(providerSearch) : null }
          ].filter(Boolean)
        }
      });
    }
    countPipeline.push({ $count: "total" });

    const [records, countResult] = await Promise.all([
      PaymentRecord.aggregate(pipeline),
      PaymentRecord.aggregate(countPipeline)
    ]);

    const total = countResult.length > 0 ? countResult[0].total : 0;

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
    const { transactionReference, notes, utrNo, transferDate, transferTime } = req.body;

    // Validate required fields for approval
    if (!transactionReference) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Transaction reference is required" });
    }

    if (!utrNo) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "UTR number is required" });
    }

    if (!transferDate || !transferTime) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Transfer date and time are required" });
    }

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

    // 2️⃣ Update payment record with new fields
    paymentRecord.status = "completed";
    paymentRecord.transactionReference = transactionReference;
    paymentRecord.utrNo = utrNo;
    paymentRecord.transferDate = new Date(transferDate);
    paymentRecord.transferTime = transferTime;
    paymentRecord.adminRemark = notes || "";
    paymentRecord.admin = req.admin._id;
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

    const provider = paymentRecord.provider;
    if (!provider) {
      throw new Error('Provider not found for this payment record.');
    }

    // Update payment record
    paymentRecord.status = "rejected";
    paymentRecord.rejectionReason = rejectionReason || "No reason provided";
    paymentRecord.adminRemark = adminRemark || "";
    paymentRecord.admin = req.admin._id;
    paymentRecord.completedAt = new Date();
    await paymentRecord.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Send email to provider (outside transaction)
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
    const maxRangeMs = 62 * 24 * 60 * 60 * 1000; // 62 days

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
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Requested Amount', key: 'amount', width: 15 },
      { header: 'Net Amount Paid', key: 'netAmount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Account Number (Masked)', key: 'accountNumber', width: 25 },
      { header: 'IFSC Code', key: 'ifscCode', width: 20 },
      { header: 'Bank Name', key: 'bankName', width: 25 },
      { header: 'UTR No', key: 'utrNo', width: 25 },
      { header: 'Transfer Date Time', key: 'transferDateTime', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Requested Date', key: 'requestedDate', width: 20 },
      { header: 'Completed Date', key: 'completedDate', width: 20 },
      { header: 'Admin Remark / Rejection Reason', key: 'adminRemark', width: 30 }
    ];

    records.forEach(record => {
      const rawAccount = record.paymentDetails.accountNumber || '';
      const maskedAccount = rawAccount.length > 4 ? 'X'.repeat(rawAccount.length - 4) + rawAccount.slice(-4) : rawAccount;

      worksheet.addRow({
        providerName: record.provider ? record.provider.name : '-',
        providerId: record.provider ? record.provider._id.toString() : '-',
        amount: record.amount,
        netAmount: record.netAmount,
        paymentMethod: record.paymentMethod,
        accountNumber: maskedAccount,
        ifscCode: record.paymentDetails.ifscCode || '-',
        bankName: record.paymentDetails.bankName || '-',
        utrNo: record.utrNo || '-',
        transferDateTime: record.transferDate && record.transferTime ? new Date(`${record.transferDate.toISOString().split('T')[0]}T${record.transferTime}`).toLocaleString() : '-',
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
          providerName: record.provider ? record.provider.name : 'N/A',
          providerId: record.provider ? record.provider._id.toString() : 'N/A',
          amount: record.amount,
          reason: record.rejectionReason || record.adminRemark || 'N/A',
          status: record.status,
          requestedAt: record.createdAt.toISOString().slice(0, 10),
          actionDate: record.completedAt ? record.completedAt.toISOString().slice(0, 10) : 'N/A'
        });
      });

      res.setHeader('Content-Disposition', `attachment; filename=failed_rejected_withdrawals_${startDate}_to_${endDate}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      await workbook.xlsx.write(res);
      res.end();

    } else {
      res.json({ success: true, records });
    }
  } catch (error) {
    console.error('Failed rejected withdrawals report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate failed rejected withdrawals report' });
  }
};

// Admin - Provider Ledger Report
const providerLedgerReport = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { fromDate, toDate } = req.query;

    // Validate providerId
    if (!mongoose.isValidObjectId(providerId)) {
      return res.status(400).json({ success: false, error: 'Invalid provider ID' });
    }

    // Validate dates
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({ success: false, error: 'Date range must be between 7 days and 2 months' });
    }

    // Get earnings for the provider
    const earnings = await ProviderEarning.aggregate([
      {
        $match: {
          provider: new mongoose.Types.ObjectId(providerId),
          createdAt: { $gte: start, $lte: end }
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
      {
        $lookup: {
          from: 'paymentrecords',
          localField: 'paymentRecord',
          foreignField: '_id',
          as: 'paymentInfo',
        },
      },
      { $unwind: { path: '$paymentInfo', preserveNullAndEmptyArrays: true } },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Provider Ledger Report');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Booking ID', key: 'bookingId', width: 25 },
      { header: 'Gross Amount', key: 'grossAmount', width: 15 },
      { header: 'Commission Rate', key: 'commissionRate', width: 15 },
      { header: 'Commission Amount', key: 'commissionAmount', width: 15 },
      { header: 'Net Amount', key: 'netAmount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 }, // cash / online
      { header: 'Withdrawal Linked', key: 'withdrawalLinked', width: 15 },
      { header: 'Withdrawal Reference ID', key: 'withdrawalRef', width: 25 },
      { header: 'Status', key: 'status', width: 15 } // Booking status
    ];

    earnings.forEach(earning => {
      worksheet.addRow({
        date: earning.createdAt.toISOString().slice(0, 10),
        bookingId: earning.booking._id.toString(),
        grossAmount: earning.grossAmount,
        commissionRate: earning.commissionRate,
        commissionAmount: earning.commissionAmount,
        netAmount: earning.netAmount,
        paymentMethod: earning.booking.paymentMethod,
        withdrawalLinked: earning.paymentRecord ? 'Yes' : 'No',
        withdrawalRef: earning.paymentInfo?.transactionReference || '-',
        status: earning.booking.status
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename=provider_ledger_${providerId}_${fromDate}_to_${toDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Provider ledger report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate provider ledger report' });
  }
};

// Admin - Earnings Summary Report
const earningsSummaryReport = async (req, res) => {
  try {
    const { fromDate, toDate, groupBy = 'month' } = req.query;

    let start, end, dateFilter = {};

    if (fromDate && toDate) {
      start = new Date(fromDate);
      end = new Date(toDate);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7 || diffDays > 62) {
        return res.status(400).json({ success: false, error: 'Date range must be between 7 days and 2 months' });
      }

      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    let groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };

    if (groupBy === 'week') {
      groupId = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
    }

    // Aggregate earnings
    const summary = await ProviderEarning.aggregate([
      {
        $match: dateFilter
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
          _id: groupId,
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get withdrawals for the same period
    const withdrawals = await PaymentRecord.aggregate([
      {
        $match: {
          status: 'completed',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: groupId,
          totalWithdrawn: { $sum: '$amount' }
        }
      }
    ]);

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Earnings Summary Report');

    worksheet.columns = [
      { header: 'Period', key: 'period', width: 20 },
      { header: 'Total Platform Earnings (Gross)', key: 'totalGross', width: 25 },
      { header: 'Total Provider Earnings (Net)', key: 'totalNet', width: 25 },
      { header: 'Total Commission Earned', key: 'totalCommission', width: 25 },
      { header: 'Total Withdrawals Processed', key: 'totalWithdrawn', width: 25 },
      { header: 'Net Platform Revenue', key: 'netRevenue', width: 20 }
    ];

    summary.forEach(item => {
      const period = groupBy === 'week' 
        ? `Week ${item._id.week}, ${item._id.year}`
        : `${item._id.year}-${(item._id.month || 0).toString().padStart(2, '0')}`;

      const withdrawalData = withdrawals.find(w => 
        w._id.year === item._id.year && 
        (groupBy === 'week' ? w._id.week === item._id.week : w._id.month === item._id.month)
      );

      worksheet.addRow({
        period,
        totalGross: item.totalGross,
        totalCommission: item.totalCommission,
        totalNet: item.totalNet,
        totalWithdrawn: withdrawalData ? withdrawalData.totalWithdrawn : 0,
        netRevenue: item.totalCommission // Platform revenue is essentially the commission
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename=earnings_summary_${fromDate}_to_${toDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Earnings summary report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate earnings summary report' });
  }
};

// Admin - Payout History Report
const payoutHistoryReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({ success: false, error: 'Date range must be between 7 days and 2 months' });
    }

    const payouts = await PaymentRecord.find({
      status: 'completed',
      createdAt: { $gte: start, $lte: end }
    }).populate('provider', 'name').populate('admin', 'name').sort({ createdAt: -1 });

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payout History Report');

    worksheet.columns = [
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Bank Details', key: 'bankDetails', width: 30 },
      { header: 'Transaction Reference', key: 'reference', width: 25 },
      { header: 'Requested Date', key: 'requestedDate', width: 20 },
      { header: 'Processed Date', key: 'completedDate', width: 20 },
      { header: 'Approved By', key: 'approvedBy', width: 20 }
    ];

    payouts.forEach(payout => {
      const bankInfo = payout.paymentDetails 
        ? `${payout.paymentDetails.bankName} - ${payout.paymentDetails.accountNumber}` 
        : 'N/A';

      worksheet.addRow({
        providerName: payout.provider.name,
        providerId: payout.provider._id.toString(),
        amount: payout.amount,
        paymentMethod: payout.paymentMethod,
        bankDetails: bankInfo,
        reference: payout.transactionReference,
        requestedDate: payout.createdAt.toISOString().slice(0, 10),
        completedDate: payout.completedAt ? payout.completedAt.toISOString().slice(0, 10) : '',
        approvedBy: payout.admin ? payout.admin.name : 'Admin'
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename=payout_history_${fromDate}_to_${toDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Payout history report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate payout history report' });
  }
};

// Admin - Outstanding Balance Report
const outstandingBalanceReport = async (req, res) => {
  try {
    const providers = await Provider.find({ isDeleted: false }).select('name email phone');

    const reportData = [];

    for (const provider of providers) {
      // Calculate available balance
      const availableBalanceResult = await ProviderEarning.aggregate([
        {
          $match: {
            provider: provider._id,
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
            totalNet: { $sum: '$netAmount' },
            totalCommission: { $sum: '$commissionAmount' }
          }
        }
      ]);

      let availableBalance = 0;
      availableBalanceResult.forEach(item => {
        if (item._id === 'online') {
          availableBalance += item.totalNet;
        } else if (item._id === 'cash') {
          availableBalance -= item.totalCommission;
        }
      });
      availableBalance = Math.max(0, availableBalance);

      // Pending withdrawals
      const pendingWithdrawals = await PaymentRecord.aggregate([
        {
          $match: {
            provider: provider._id,
            status: { $in: ['requested', 'processing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: '$amount' }
          }
        }
      ]);

      const totalPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].totalPending : 0;

      const outstandingBalance = Math.max(0, availableBalance - totalPending);

      // Get last withdrawal date
      const lastWithdrawal = await PaymentRecord.findOne({
        provider: provider._id,
        status: 'completed'
      }).sort({ completedAt: -1 });

      const lastWithdrawalDate = lastWithdrawal ? lastWithdrawal.completedAt : null;
      const daysPending = lastWithdrawalDate 
        ? Math.floor((new Date() - lastWithdrawalDate) / (1000 * 60 * 60 * 24)) 
        : 'N/A';

      if (outstandingBalance > 0) {
        reportData.push({
          providerId: provider._id.toString(),
          providerName: provider.name,
          availableBalance: outstandingBalance,
          lastWithdrawalDate: lastWithdrawalDate ? lastWithdrawalDate.toISOString().slice(0, 10) : 'Never',
          daysPending
        });
      }
    }

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Outstanding Balance Report');

    worksheet.columns = [
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Available Balance', key: 'availableBalance', width: 20 },
      { header: 'Last Withdrawal Date', key: 'lastWithdrawalDate', width: 20 },
      { header: 'Days Pending', key: 'daysPending', width: 15 }
    ];

    reportData.forEach(item => {
      worksheet.addRow(item);
    });

    res.setHeader('Content-Disposition', `attachment; filename=outstanding_balance_report.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Outstanding balance report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate outstanding balance report' });
  }
};


module.exports = {
  // Provider
  getEarningsSummary,
  requestBulkWithdrawal,
  downloadEarningsReport,
  downloadWithdrawalReport,


  // Admin
  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  generateWithdrawalReport,
  generateProviderEarningsReport,
  getCommissionReport,
  failedRejectedWithdrawalsReport,
  providerLedgerReport,
  earningsSummaryReport,
  payoutHistoryReport,
  outstandingBalanceReport
};
