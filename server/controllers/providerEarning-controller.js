const ProviderEarning = require('../models/ProviderEarning-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const { sendEmail } = require('../utils/sendEmail');
const excelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Admin: Get top providers by earnings
const getTopProviders = async (req, res) => {
  try {
    const { limit = 10, period = 'all' } = req.query;
    let dateFilter = {};

    if (period === 'month') {
      dateFilter = {
        createdAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
        }
      };
    } else if (period === 'year') {
      dateFilter = {
        createdAt: {
          $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
        }
      };
    }

    const topProviders = await ProviderEarning.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$provider',
          totalEarnings: { $sum: '$amount' },
          count: { $sum: 1 }
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
          providerId: '$_id',
          providerName: '$provider.name',
          providerEmail: '$provider.email',
          totalEarnings: 1,
          bookingCount: '$count'
        }
      }
    ]);

    return res.json({
      success: true,
      count: topProviders.length,
      period,
      topProviders
    });
  } catch (error) {
    console.error('Error getting top providers:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching top providers'
    });
  }
};

// Admin: Get top customers by spending
const getTopCustomers = async (req, res) => {
  try {
    const { limit = 10, period = 'all' } = req.query;
    let dateFilter = {};

    if (period === 'month') {
      dateFilter = {
        createdAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
        }
      };
    } else if (period === 'year') {
      dateFilter = {
        createdAt: {
          $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
        }
      };
    }

    const topCustomers = await Booking.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      {
        $group: {
          _id: '$customer',
          totalSpent: { $sum: '$totalAmount' },
          bookingCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          customerId: '$_id',
          customerName: '$customer.name',
          customerEmail: '$customer.email',
          totalSpent: 1,
          bookingCount: 1
        }
      }
    ]);

    return res.json({
      success: true,
      count: topCustomers.length,
      period,
      topCustomers
    });
  } catch (error) {
    console.error('Error getting top customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching top customers'
    });
  }
};

// Admin: Get earnings report with filters
const getEarningsReport = async (req, res) => {
  try {
    const { providerId, startDate, endDate, status } = req.query;
    const filter = {};

    if (providerId) filter.provider = mongoose.Types.ObjectId(providerId);
    if (status) filter.status = status;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const earnings = await ProviderEarning.find(filter)
      .populate('provider', 'name email')
      .populate('booking', 'date service')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: earnings.length,
      earnings
    });
  } catch (error) {
    console.error('Error getting earnings report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching earnings report'
    });
  }
};

// Admin: Generate earnings report (Excel)
const generateEarningsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const earnings = await ProviderEarning.find(filter)
      .populate('provider', 'name email')
      .populate('booking', 'date service');

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Earnings Report');

    // Add headers
    worksheet.columns = [
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider Email', key: 'providerEmail', width: 30 },
      { header: 'Booking Date', key: 'bookingDate', width: 15 },
      { header: 'Service', key: 'service', width: 25 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Date Added', key: 'createdAt', width: 20 }
    ];

    // Add data rows
    earnings.forEach(earning => {
      worksheet.addRow({
        providerName: earning.provider.name,
        providerEmail: earning.provider.email,
        bookingDate: earning.booking.date.toISOString().split('T')[0],
        service: earning.booking.service,
        amount: earning.amount,
        status: earning.status,
        createdAt: earning.createdAt.toISOString()
      });
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=earnings_report.xlsx'
    );

    return workbook.xlsx.write(res).then(() => {
      res.end();
    });
  } catch (error) {
    console.error('Error generating earnings report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating earnings report'
    });
  }
};

// Provider: Get earnings summary
const getEarningsSummary = async (req, res) => {
  try {
    const providerId = req.user._id;

    const [availableBalance, totalEarnings, pendingEarnings] = await Promise.all([
      ProviderEarning.getAvailableBalance(providerId),
      ProviderEarning.aggregate([
        { $match: { provider: providerId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      ProviderEarning.aggregate([
        { $match: { provider: providerId, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    return res.json({
      success: true,
      summary: {
        availableBalance,
        totalEarnings: totalEarnings.length ? totalEarnings[0].total : 0,
        pendingEarnings: pendingEarnings.length ? pendingEarnings[0].total : 0
      }
    });
  } catch (error) {
    console.error('Error getting earnings summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching earnings summary'
    });
  }
};

// Provider: Get earnings statement
const getEarningsStatement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { provider: req.user._id };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const earnings = await ProviderEarning.find(filter)
      .populate('booking', 'date service')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: earnings.length,
      earnings
    });
  } catch (error) {
    console.error('Error getting earnings statement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching earnings statement'
    });
  }
};

// Provider: Download statement (PDF)
const downloadStatement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const providerId = req.user._id;
    const filter = { provider: providerId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [provider, earnings] = await Promise.all([
      Provider.findById(providerId),
      ProviderEarning.find(filter)
        .populate('booking', 'date service')
        .sort({ createdAt: -1 })
    ]);

    const doc = new PDFDocument();
    const fileName = `earnings_statement_${providerId}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../temp', fileName);

    // Ensure temp directory exists
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    // Pipe PDF to file and response
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.pipe(res);

    // Add document content
    doc.fontSize(20).text('Earnings Statement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Provider: ${provider.name} (${provider.email})`);
    doc.text(`Statement Period: ${startDate || 'Beginning'} to ${endDate || 'Now'}`);
    doc.moveDown();

    // Add earnings table
    const table = {
      headers: ['Date', 'Booking', 'Amount', 'Status'],
      rows: earnings.map(earning => [
        earning.createdAt.toISOString().split('T')[0],
        earning.booking.service,
        `$${earning.amount.toFixed(2)}`,
        earning.status
      ])
    };

    // Calculate table layout
    const tableWidth = 500;
    const colWidth = tableWidth / table.headers.length;
    const rowHeight = 20;

    // Draw table headers
    doc.font('Helvetica-Bold');
    table.headers.forEach((header, i) => {
      doc.text(header, i * colWidth, doc.y, { width: colWidth, align: 'left' });
    });
    doc.moveDown();

    // Draw table rows
    doc.font('Helvetica');
    table.rows.forEach(row => {
      const startY = doc.y;
      row.forEach((cell, i) => {
        doc.text(cell, i * colWidth, startY, { width: colWidth, align: 'left' });
      });
      doc.moveDown();
    });

    // Calculate totals
    const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0);
    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Total Earnings: $${totalEarnings.toFixed(2)}`, { align: 'right' });

    // Finalize PDF
    doc.end();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // Clean up after sending
    stream.on('finish', () => {
      setTimeout(() => fs.unlinkSync(filePath), 5000);
    });
  } catch (error) {
    console.error('Error generating statement PDF:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating statement'
    });
  }
};

module.exports = {
  getTopProviders,
  getTopCustomers,
  getEarningsReport,
  generateEarningsReport,
  getEarningsSummary,
  getEarningsStatement,
  downloadStatement
};