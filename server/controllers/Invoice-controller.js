const Invoice = require('../models/Invoice-model');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const CommissionRule = require('../models/CommissionRule-model');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Configure PDF storage directory
const INVOICE_STORAGE_PATH = path.join(__dirname, '../uploads/invoices');

// Ensure invoice directory exists
if (!fs.existsSync(INVOICE_STORAGE_PATH)) {
  fs.mkdirSync(INVOICE_STORAGE_PATH, { recursive: true });
}

// Generate PDF Invoice
const generatePDF = async (invoice, filePath, userRole) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      
      // Invoice Details
      doc.fontSize(12)
         .text(`Invoice Number: ${invoice.invoiceNo}`, { align: 'left' })
         .text(`Date: ${invoice.formattedDate}`, { align: 'left' })
         .moveDown();

      // Customer Details
      doc.text(`Customer: ${invoice.customer.name}`)
         .text(`Phone: ${invoice.customer.phone}`)
         .moveDown();

      // Provider Details
      doc.text(`Provider: ${invoice.provider.name}`)
         .text(`GSTIN: ${invoice.provider.gstin || 'N/A'}`)
         .moveDown();

      // Service Details
      doc.fontSize(14).text('Service Details', { underline: true });
      doc.fontSize(12)
         .text(`Service: ${invoice.service.title}`)
         .text(`Amount: ₹${invoice.serviceAmount.toFixed(2)}`)
         .moveDown();

      // Products Used
      if (invoice.productsUsed && invoice.productsUsed.length > 0) {
        doc.fontSize(14).text('Products Used', { underline: true });
        invoice.productsUsed.forEach(product => {
          doc.text(`${product.name} (${product.quantity} x ₹${product.rate.toFixed(2)}) - ₹${product.total.toFixed(2)}`);
        });
        doc.moveDown();
      }

      // Discount Details
      if (invoice.discount > 0) {
        doc.text(`Discount: -₹${invoice.discount.toFixed(2)}`)
           .moveDown();
      }

      // Tax Details
      if (invoice.tax > 0) {
        doc.text(`Tax: ₹${invoice.tax.toFixed(2)}`)
           .moveDown();
      }

      // Commission Details (only for providers)
      if (userRole === 'provider' && invoice.commission) {
        doc.fontSize(14).text('Commission Details', { underline: true });
        doc.fontSize(12)
           .text(`Commission: ${invoice.commission.type === 'percentage' ? 
                  `${invoice.commission.value}%` : 
                  `₹${invoice.commission.value}`}`)
           .text(`Commission Amount: -₹${invoice.commission.amount.toFixed(2)}`)
           .moveDown();
      }

      // Total Amount
      doc.fontSize(16)
         .text(`Total Amount: ₹${invoice.totalAmount.toFixed(2)}`, { align: 'right' });
      
      if (userRole === 'provider') {
        doc.text(`Net Amount After Commission: ₹${invoice.netAmount.toFixed(2)}`, 
               { align: 'right' });
      }

      // Payment Status
      doc.moveDown()
         .text(`Payment Status: ${invoice.paymentStatus.toUpperCase().replace('_', ' ')}`, 
               { align: 'right' });

      doc.end();
      
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      console.error('PDF generation error:', err);
      reject(err);
    }
  });
};

// Generate Invoice Data for Frontend
const generateInvoiceData = async (invoiceId, userRole) => {
  try {
    const invoice = await Invoice.findById(invoiceId)
      .populate('customer', 'name email phone address')
      .populate('provider', 'name address gstin')
      .populate('service', 'title description')
      .populate('booking', 'subtotal totalDiscount totalAmount paymentMethod')
      .populate('commission.rule', 'name description type value');

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Prepare role-specific data
    const invoiceData = invoice.toObject();
    
    // Format dates
    invoiceData.formattedDate = new Date(invoice.createdAt).toLocaleDateString();
    invoiceData.formattedDueDate = invoice.dueDate 
      ? new Date(invoice.dueDate).toLocaleDateString()
      : 'On Receipt';

    // Format amounts
    invoiceData.formattedAmounts = {
      serviceAmount: invoice.serviceAmount?.toFixed(2) || '0.00',
      discount: invoice.discount?.toFixed(2) || '0.00',
      tax: invoice.tax?.toFixed(2) || '0.00',
      totalAmount: invoice.totalAmount?.toFixed(2) || '0.00',
      netAmount: invoice.netAmount?.toFixed(2) || '0.00',
      commissionAmount: invoice.commission?.amount?.toFixed(2) || '0.00'
    };

    // Hide commission details from non-providers
    if (userRole !== 'provider') {
      delete invoiceData.commission;
      delete invoiceData.netAmount;
    }

    return invoiceData;
  } catch (error) {
    console.error('Error generating invoice data:', error);
    throw error;
  }
};

// Auto-generate invoice with commission
const autoGenerateInvoice = async (booking, commissionDetails) => {
  const invoiceData = {
    booking: booking._id,
    provider: booking.provider,
    customer: booking.customer,
    service: booking.services[0].service,
    serviceAmount: booking.subtotal || 0,
    discount: booking.totalDiscount || 0,
    totalAmount: booking.totalAmount || 0,
    netAmount: booking.totalAmount - (commissionDetails.amount || 0),
    commission: {
      amount: commissionDetails.amount,
      rule: commissionDetails.baseRule._id,
      type: commissionDetails.baseRule.type,
      value: commissionDetails.baseRule.value,
      description: `Platform commission (${commissionDetails.baseRule.value}${commissionDetails.baseRule.type === 'percentage' ? '%' : ' fixed'})`
    },
    paymentStatus: booking.paymentStatus === 'paid' ? 'paid' : 'pending',
    notes: `Booking completed on ${new Date().toLocaleDateString()}`
  };

  if (booking.paymentStatus === 'paid') {
    invoiceData.paymentDetails = [{
      method: booking.paymentMethod || 'online',
      amount: booking.totalAmount,
      status: 'success'
    }];
  }

  const invoice = await Invoice.create(invoiceData);
  return invoice;
};

// Get invoice data for frontend template
const getInvoiceForFrontend = async (req, res, next) => {
  try {
    const invoiceData = await generateInvoiceData(req.params.id, req.user.role);
    
    res.status(200).json({
      success: true,
      data: invoiceData
    });
  } catch (err) {
    next(err);
  }
};

// Get single invoice with role-based data
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('provider', 'name email phone address gstin')
      .populate('service', 'title description')
      .populate('commission.rule', 'name description type value')
      .populate({
        path: 'booking',
        select: 'subtotal totalDiscount totalAmount paymentMethod',
        populate: {
          path: 'services.service',
          select: 'title description'
        }
      });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Authorization checks
    if (req.user.role === 'user' && !invoice.customer._id.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    if (req.user.role === 'provider' && !invoice.provider._id.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    // Prepare role-specific response
    const responseData = invoice.toObject();
    
    // Format dates
    responseData.formattedDate = new Date(invoice.createdAt).toLocaleDateString();
    responseData.formattedDueDate = invoice.dueDate 
      ? new Date(invoice.dueDate).toLocaleDateString()
      : 'On Receipt';

    // Hide commission details from non-providers
    if (req.user.role !== 'provider') {
      delete responseData.commission;
      delete responseData.netAmount;
    }

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (err) {
    next(err);
  }
};

// Get customer invoices
const getMyInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ customer: req.user.id })
      .populate('provider', 'name')
      .populate('service', 'title')
      .populate('booking', 'subtotal totalDiscount totalAmount')
      .sort({ createdAt: -1 });

    const sanitizedInvoices = invoices.map(invoice => {
      const invoiceObj = invoice.toObject();
      delete invoiceObj.commission;
      delete invoiceObj.netAmount;
      return invoiceObj;
    });

    res.status(200).json({
      success: true,
      count: sanitizedInvoices.length,
      data: sanitizedInvoices
    });
  } catch (err) {
    next(err);
  }
};

// Get provider invoices with commission calculation
const getProviderInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ provider: req.provider.id })
      .populate('customer', 'name phone')
      .populate('service', 'title')
      .populate('commission.rule', 'name type value')
      .populate('booking', 'subtotal totalDiscount totalAmount')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totalEarnings = invoices.reduce((sum, inv) => sum + inv.netAmount, 0);
    const totalCommission = invoices.reduce((sum, inv) => sum + (inv.commission?.amount || 0), 0);

    res.status(200).json({
      success: true,
      count: invoices.length,
      summary: {
        totalEarnings: totalEarnings.toFixed(2),
        totalCommission: totalCommission.toFixed(2),
        totalInvoices: invoices.length
      },
      data: invoices.map(invoice => ({
        ...invoice.toObject(),
        formattedAmounts: {
          totalAmount: invoice.totalAmount?.toFixed(2) || '0.00',
          netAmount: invoice.netAmount?.toFixed(2) || '0.00',
          commissionAmount: (invoice.commission?.amount || 0).toFixed(2)
        }
      }))
    });
  } catch (err) {
    next(err);
  }
};

// Download invoice PDF
const downloadInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('provider', 'name email phone address gstin')
      .populate('service', 'title description')
      .populate('commission.rule', 'name type value')
      .populate('booking', 'subtotal totalDiscount totalAmount');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Authorization checks
    if (req.user.role === 'user' && !invoice.customer._id.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    if (req.user.role === 'provider' && !invoice.provider._id.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    // Check/Generate PDF
    let filePath;
    if (invoice.invoicePdf) {
      filePath = path.join(__dirname, '../../public', invoice.invoicePdf);
      if (!fs.existsSync(filePath)) {
        invoice.invoicePdf = null;
        await invoice.save();
      }
    }

    if (!invoice.invoicePdf || !fs.existsSync(filePath)) {
      const fileName = `invoice_${invoice.invoiceNo}.pdf`.replace(/\s+/g, '_');
      filePath = path.join(INVOICE_STORAGE_PATH, fileName);
      
      await generatePDF(invoice, filePath, req.user.role);
      
      invoice.invoicePdf = `/invoices/${fileName}`;
      await invoice.save();
    }

    // Stream the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNo}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      res.status(500).json({
        success: false,
        message: 'Error streaming invoice file'
      });
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  autoGenerateInvoice,
  getInvoice,
  getInvoiceForFrontend,
  getMyInvoices,
  getProviderInvoices,
  downloadInvoice,
  generateInvoiceData
};