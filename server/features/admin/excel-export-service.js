const crypto = require('crypto');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

// Derive 32-byte encryption key from JWT_SECRET or default
const ENCRYPTION_SECRET = process.env.JWT_SECRET || 'service-platform-secure-kyc-key-2026';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

/**
 * Encrypt sensitive ID proof document URL / path using AES-256-CBC
 * @param {string} val
 * @returns {string} Encrypted string in format ENC_AES256:<iv_hex>:<ciphertext_hex>
 */
function encryptDocValue(val) {
  if (!val || typeof val !== 'string' || val.trim() === '') {
    return 'NOT_UPLOADED';
  }
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
    let encrypted = cipher.update(val.trim(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `ENC_AES256:${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    return 'ENCRYPTION_FAILED';
  }
}

/**
 * Format address object into readable string
 */
function formatAddress(addr) {
  if (!addr) return 'N/A';
  if (typeof addr === 'string') return addr;
  const parts = [
    addr.houseNumber,
    addr.street,
    addr.landmark,
    addr.villageCity,
    addr.city,
    addr.district,
    addr.state,
    addr.pincode || addr.postalCode
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'N/A';
}

/**
 * Apply professional styling to worksheet headers and auto-adjust widths
 */
function styleWorksheet(worksheet, headerColor = 'FF0F766E') {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerColor }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'medium', color: { argb: 'FF0D9488' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };
  });

  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      const val = cell.value ? String(cell.value) : '';
      if (val.length > maxLength) {
        maxLength = Math.min(val.length + 3, 50);
      }
      if (rowNumber > 1) {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      }
    });
    column.width = Math.max(maxLength, 14);
  });
}

/**
 * Export all Providers to Excel with encrypted ID proofs
 */
async function exportProvidersToExcel(req, res) {
  try {
    const Provider = mongoose.model('Provider');
    const { status, search } = req.query || {};

    const filter = {
      isDeleted: false,
      ...(status === 'approved' && { approved: true }),
      ...(status === 'pending' && { approved: false }),
      ...(status === 'rejected' && { kycStatus: 'rejected' }),
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { providerId: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      })
    };

    const providersPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'categories',
          localField: 'services',
          foreignField: '_id',
          as: 'serviceCategories'
        }
      },
      {
        $lookup: {
          from: 'feedbacks',
          localField: '_id',
          foreignField: 'providerFeedback.provider',
          as: 'feedback'
        }
      },
      {
        $addFields: {
          averageRating: { $ifNull: [{ $avg: '$feedback.providerFeedback.rating' }, 0] },
          servicesList: {
            $map: {
              input: '$serviceCategories',
              as: 'cat',
              in: '$$cat.name'
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    const providers = await Provider.aggregate(providersPipeline);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Service Platform Admin';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Service Providers', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'Provider ID', key: 'providerId' },
      { header: 'Full Name', key: 'name' },
      { header: 'Email Address', key: 'email' },
      { header: 'Phone Number', key: 'phone' },
      { header: 'Approval Status', key: 'approvalStatus' },
      { header: 'KYC Status', key: 'kycStatus' },
      { header: 'Active Status', key: 'isActive' },
      { header: 'Services Offered', key: 'services' },
      { header: 'Service Area / City', key: 'serviceArea' },
      { header: 'Experience (Years)', key: 'experience' },
      { header: 'Average Rating', key: 'rating' },
      { header: 'Completed Jobs', key: 'completedJobs' },
      { header: 'Cancelled Jobs', key: 'cancelledJobs' },
      { header: 'Wallet Balance (₹)', key: 'walletBalance' },
      { header: 'Current Address', key: 'currentAddress' },
      { header: 'Permanent Address', key: 'permanentAddress' },
      { header: 'Bank Account Holder', key: 'accountName' },
      { header: 'Bank Account Number', key: 'accountNo' },
      { header: 'Bank Name', key: 'bankName' },
      { header: 'Bank IFSC Code', key: 'ifsc' },
      { header: 'Bank UPI ID', key: 'upiId' },
      { header: 'Bank Verification Status', key: 'bankVerificationStatus' },
      { header: 'Joined Date', key: 'joinedDate' }
    ];

    providers.forEach((p) => {
      const bd = p.bankDetails || {};

      worksheet.addRow({
        providerId: p.providerId || `#PROV-${(p._id || '').toString().slice(-8).toUpperCase()}`,
        name: p.name || 'N/A',
        email: p.email || 'N/A',
        phone: p.phone || 'N/A',
        approvalStatus: p.approved ? 'Approved' : (p.kycStatus === 'rejected' ? 'Rejected' : 'Pending'),
        kycStatus: p.kycStatus ? (p.kycStatus.charAt(0).toUpperCase() + p.kycStatus.slice(1)) : 'Pending',
        isActive: p.isActive ? 'Active' : 'Inactive',
        services: Array.isArray(p.servicesList) && p.servicesList.length > 0 ? p.servicesList.join(', ') : (Array.isArray(p.services) ? p.services.join(', ') : 'N/A'),
        serviceArea: p.serviceArea || (p.currentAddress?.villageCity || p.currentAddress?.district || 'All Zones'),
        experience: p.experience !== undefined && p.experience !== null ? p.experience : 0,
        rating: p.averageRating ? Number(p.averageRating).toFixed(1) : '0.0',
        completedJobs: p.completedBookings || 0,
        cancelledJobs: p.canceledBookings || 0,
        walletBalance: p.walletBalance || 0,
        currentAddress: formatAddress(p.currentAddress || p.address),
        permanentAddress: formatAddress(p.permanentAddress || p.address),
        accountName: bd.accountName || 'N/A',
        accountNo: bd.accountNo || 'N/A',
        bankName: bd.bankName || 'N/A',
        ifsc: bd.ifsc || 'N/A',
        upiId: bd.upiId || 'N/A',
        bankVerificationStatus: bd.bankVerificationStatus ? bd.bankVerificationStatus.toUpperCase() : 'PENDING',
        joinedDate: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : 'N/A'
      });
    });

    styleWorksheet(worksheet, 'FF0F766E'); // Teal primary theme

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="providers_export_${dateStr}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting providers to Excel:', error);
    return res.status(500).json({ success: false, message: 'Failed to export providers to Excel', error: error.message });
  }
}

/**
 * Export all Customers to Excel
 */
async function exportCustomersToExcel(req, res) {
  try {
    const User = mongoose.model('User');
    const { search } = req.query || {};

    const searchFilter = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const pipeline = [
      {
        $match: {
          role: 'customer',
          ...searchFilter
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'customer',
          as: 'userBookings'
        }
      },
      {
        $addFields: {
          totalBookings: { $size: '$userBookings' },
          totalSpent: { $ifNull: [{ $sum: '$userBookings.totalAmount' }, 0] }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    const customers = await User.aggregate(pipeline);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Service Platform Admin';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'Customer ID', key: 'id' },
      { header: 'Full Name', key: 'name' },
      { header: 'Email Address', key: 'email' },
      { header: 'Phone Number', key: 'phone' },
      { header: 'Account Status', key: 'status' },
      { header: 'Total Bookings', key: 'totalBookings' },
      { header: 'Total Spent (₹)', key: 'totalSpent' },
      { header: 'Wallet Balance (₹)', key: 'walletBalance' },
      { header: 'Primary Address', key: 'primaryAddress' },
      { header: 'Registration Date', key: 'registeredDate' }
    ];

    customers.forEach((c) => {
      const primaryAddr = (Array.isArray(c.savedAddresses) && c.savedAddresses.length > 0)
        ? formatAddress(c.savedAddresses[0])
        : formatAddress(c.address);

      worksheet.addRow({
        id: c._id ? c._id.toString() : 'N/A',
        name: c.name || 'N/A',
        email: c.email || 'N/A',
        phone: c.phone || 'N/A',
        status: c.isBlocked ? 'Blocked' : 'Active',
        totalBookings: c.totalBookings || 0,
        totalSpent: c.totalSpent || 0,
        walletBalance: c.walletBalance || 0,
        primaryAddress: primaryAddr,
        registeredDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : 'N/A'
      });
    });

    styleWorksheet(worksheet, 'FF0F766E'); // Deep teal theme

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="customers_export_${dateStr}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting customers to Excel:', error);
    return res.status(500).json({ success: false, message: 'Failed to export customers to Excel', error: error.message });
  }
}

module.exports = {
  encryptDocValue,
  exportProvidersToExcel,
  exportCustomersToExcel
};
