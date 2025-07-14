const Invoice = require('../models/Invoice-model');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../utils/sendEmail');

// @desc    Get all invoices (Admin)
// @route   GET /api/invoices
// @access  Private/Admin
const getAllInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find()
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('service', 'title')
      .setOptions({ showCommission: true })
      .sort({ generatedAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res, next) => {
  try {
    let invoice;
    
    if (req.user.role === 'admin' || req.user.role === 'provider') {
      // For admin/provider, show commission details
      invoice = await Invoice.findById(req.params.id)
        .setOptions({ showCommission: true })
        .populate('customer', 'name email phone address')
        .populate('provider', 'name email phone address')
        .populate('service', 'title description');
    } else {
      // For regular users, hide commission details
      invoice = await Invoice.findById(req.params.id)
        .populate('customer', 'name email phone address')
        .populate('provider', 'name email phone address')
        .populate('service', 'title description');
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check authorization
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

    // For users, create a sanitized version without commission details
    if (req.user.role === 'user') {
      const invoiceObj = invoice.toObject();
      delete invoiceObj.commissionDetails;
      delete invoiceObj.commissionAmount;
      delete invoiceObj.netAmount;
      return res.status(200).json({
        success: true,
        data: invoiceObj
      });
    }

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get invoices for customer
// @route   GET /api/invoices/customer/my-invoices
// @access  Private/User
const getMyInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ customer: req.user.id })
      .populate('provider', 'name')
      .populate('service', 'title')
      .sort({ generatedAt: -1 });

    // Sanitize invoices to remove commission details for users
    const sanitizedInvoices = invoices.map(invoice => {
      const invoiceObj = invoice.toObject();
      delete invoiceObj.commissionDetails;
      delete invoiceObj.commissionAmount;
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

// @desc    Get invoices for provider
// @route   GET /api/invoices/provider/my-invoices
// @access  Private/Provider
const getProviderInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ provider: req.user.id })
      .setOptions({ showCommission: true })
      .populate('customer', 'name phone')
      .populate('service', 'title')
      .sort({ generatedAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (err) {
    console.error('Error fetching provider invoices:', err);
    next(err); // This should be handled by your error middleware
  }
};

// @desc    Auto-create invoice when booking is marked completed
// @route   (Triggered automatically via Booking model hook)
// @access  System-generated
const autoGenerateInvoice = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('provider')
      .populate('service');

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ bookingId: booking._id });
    if (existingInvoice) {
      throw new Error('Invoice already exists for this booking');
    }

    // Calculate amounts
    const serviceAmount = booking.service.basePrice;
    const productsTotal = booking.productsUsed?.reduce((sum, p) => sum + (p.rate * p.quantity), 0) || 0;
    const subTotal = serviceAmount + productsTotal;
    const taxAmount = subTotal * 0.18; // Example: 18% GST
    const totalAmount = subTotal + taxAmount;

    // Calculate commission (example logic)
    const commissionRate = 0.15; // 15% commission
    const commissionAmount = totalAmount * commissionRate;
    const netAmount = totalAmount - commissionAmount;

    // Auto-generated invoice data
    const invoiceData = {
      bookingId: booking._id,
      provider: booking.provider._id,
      customer: booking.customer._id,
      service: booking.service._id,
      serviceAmount,
      productsUsed: booking.productsUsed || [],
      tax: taxAmount,
      totalAmount,
      commissionAmount,
      netAmount,
      paymentStatus: booking.paymentStatus === 'paid' ? 'paid' : 'pending',
      paidBy: booking.paymentMethod || 'cash',
      invoiceNo: generateInvoiceNumber(),
      commissionDetails: {
        baseRate: commissionRate * 100, // 15%
        baseType: 'percentage',
        penaltyRules: []
      }
    };

    const invoice = await Invoice.create(invoiceData);
    
    // Update booking reference
    booking.invoice = invoice._id;
    await booking.save();

    // Send notification
    await sendInvoiceEmail(invoice, booking);

    return invoice;
  } catch (error) {
    console.error('Auto-invoice generation failed:', error.message);
    throw error;
  }
};

// @desc    Get all products from invoice (for the service)
// @route   GET /api/v1/invoices/:id/products
// @access  Private/Provider
const getInvoiceProducts = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .select('productsUsed')
      .populate('service', 'title');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Verify provider owns this invoice
    if (!invoice.provider.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this invoice'
      });
    }

    res.status(200).json({
      success: true,
      service: invoice.service.title,
      count: invoice.productsUsed.length,
      data: invoice.productsUsed
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add product to invoice (for the service)
// @route   POST /api/v1/invoices/:id/products
// @access  Private/Provider
const addProductToInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Verify provider owns this invoice
    if (!invoice.provider.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this invoice'
      });
    }

    const { name, description, quantity, rate } = req.body;

    // Validate product data
    if (!name || !quantity || !rate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, quantity and rate for the product'
      });
    }

    // Create new product
    const newProduct = {
      name,
      description: description || '',
      quantity: Number(quantity),
      rate: Number(rate),
      total: Math.round((quantity * rate) * 100) / 100
    };

    // Add product to invoice
    invoice.productsUsed.push(newProduct);

    // Recalculate invoice totals
    await invoice.save();

    res.status(201).json({
      success: true,
      data: invoice.productsUsed[invoice.productsUsed.length - 1] // Return the newly added product
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update product in invoice (for the service)
// @route   PUT /api/v1/invoices/:id/products/:productId
// @access  Private/Provider
const updateProductInInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Verify provider owns this invoice
    if (!invoice.provider.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this invoice'
      });
    }

    const productIndex = invoice.productsUsed.findIndex(
      p => p._id.toString() === req.params.productId
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in this invoice'
      });
    }

    const { name, description, quantity, rate } = req.body;
    const product = invoice.productsUsed[productIndex];

    // Update product fields if provided
    if (name) product.name = name;
    if (description) product.description = description;
    if (quantity) product.quantity = Number(quantity);
    if (rate) product.rate = Number(rate);

    // Recalculate total
    product.total = Math.round((product.quantity * product.rate) * 100) / 100;

    // Save the invoice to trigger totals recalculation
    await invoice.save();

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove product from invoice (for the service)
// @route   DELETE /api/v1/invoices/:id/products/:productId
// @access  Private/Provider
const removeProductFromInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Verify provider owns this invoice
    if (!invoice.provider.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this invoice'
      });
    }

    const productIndex = invoice.productsUsed.findIndex(
      p => p._id.toString() === req.params.productId
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in this invoice'
      });
    }

    // Remove the product
    const removedProduct = invoice.productsUsed.splice(productIndex, 1);

    // Save the invoice to trigger totals recalculation
    await invoice.save();

    res.status(200).json({
      success: true,
      data: removedProduct[0],
      message: 'Product removed from invoice'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin update invoice
// @route   PUT /api/invoices/admin/:id
// @access  Private/Admin
const adminUpdateInvoice = async (req, res, next) => {
  try {
    let invoice = await Invoice.findById(req.params.id)
      .setOptions({ showCommission: true });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Admin can update all fields except invoiceNo once set
    const updateData = { ...req.body };
    if (invoice.invoiceNo && updateData.invoiceNo) {
      delete updateData.invoiceNo;
    }

    invoice = await Invoice.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).setOptions({ showCommission: true });

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Generate PDF for invoice
// @route   GET /api/invoices/:id/download
// @access  Private
const downloadInvoice = async (req, res, next) => {
  try {
    let invoice;
    
    if (req.user.role === 'admin' || req.user.role === 'provider') {
      invoice = await Invoice.findById(req.params.id)
        .setOptions({ showCommission: true })
        .populate('customer', 'name email phone address')
        .populate('provider', 'name email phone address')
        .populate('service', 'title description');
    } else {
      invoice = await Invoice.findById(req.params.id)
        .populate('customer', 'name email phone address')
        .populate('provider', 'name email phone address')
        .populate('service', 'title description');
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check authorization
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

    // Create PDF
    const doc = new PDFDocument();
    const fileName = `invoice_${invoice.invoiceNo}.pdf`;
    const filePath = path.join(__dirname, '../public/invoices', fileName);

    // Ensure directory exists
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    // Pipe PDF to file and response
    doc.pipe(fs.createWriteStream(filePath));
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();
    
    // Invoice details
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNo}`);
    doc.text(`Date: ${invoice.formattedDate}`);
    doc.text(`Due Date: ${invoice.formattedDueDate}`);
    doc.moveDown();

    // Provider and customer details
    doc.text(`Provider: ${invoice.provider.name}`);
    doc.text(`Email: ${invoice.provider.email}`);
    doc.text(`Phone: ${invoice.provider.phone}`);
    doc.moveDown();

    doc.text(`Customer: ${invoice.customer.name}`);
    doc.text(`Email: ${invoice.customer.email}`);
    doc.text(`Phone: ${invoice.customer.phone}`);
    doc.moveDown();

    // Service details
    doc.fontSize(14).text('Service Details', { underline: true });
    doc.fontSize(12).text(`Service: ${invoice.service.title}`);
    doc.text(`Description: ${invoice.service.description}`);
    doc.text(`Amount: ₹${invoice.serviceAmount.toFixed(2)}`);
    doc.moveDown();

    // Products used
    if (invoice.productsUsed.length > 0) {
      doc.fontSize(14).text('Products Used', { underline: true });
      
      // Table header
      doc.text('Product Name', 50, doc.y);
      doc.text('Qty', 250, doc.y);
      doc.text('Rate', 300, doc.y);
      doc.text('Total', 350, doc.y);
      doc.moveDown(0.5);
      
      // Draw line
      doc.moveTo(50, doc.y).lineTo(400, doc.y).stroke();
      doc.moveDown(0.5);

      // Products list
      invoice.productsUsed.forEach(product => {
        doc.text(product.name, 50);
        doc.text(product.quantity.toString(), 250);
        doc.text(`₹${product.rate.toFixed(2)}`, 300);
        doc.text(`₹${product.total.toFixed(2)}`, 350);
        doc.moveDown();
      });

      doc.moveDown();
    }

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.text(`Service Amount: ₹${invoice.serviceAmount.toFixed(2)}`);
    
    if (invoice.productsUsed.length > 0) {
      const productsTotal = invoice.productsUsed.reduce((sum, p) => sum + p.total, 0);
      doc.text(`Products Total: ₹${productsTotal.toFixed(2)}`);
    }
    
    doc.text(`Tax: ₹${invoice.tax.toFixed(2)}`);
    doc.text(`Discount: ₹${invoice.discount.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(16).text(`Total Amount: ₹${invoice.totalAmount.toFixed(2)}`, { align: 'right' });
    doc.text(`Advance Paid: ₹${invoice.advancePayment.toFixed(2)}`, { align: 'right' });
    doc.text(`Balance Due: ₹${invoice.balanceDue.toFixed(2)}`, { align: 'right' });
    
    // Only show commission details to admin/provider
    if (req.user.role === 'admin' || req.user.role === 'provider') {
      doc.moveDown();
      doc.fontSize(14).text('Commission Details', { underline: true });
      doc.text(`Commission Rate: ${invoice.commissionDetails?.baseRate || 0}%`);
      doc.text(`Commission Amount: ₹${invoice.commissionAmount.toFixed(2)}`);
      doc.text(`Net Amount: ₹${invoice.netAmount.toFixed(2)}`);
    }

    doc.moveDown();

    // Payment status
    doc.fontSize(12).text(`Payment Status: ${invoice.paymentStatus.toUpperCase()}`, { align: 'center' });
    doc.text(`Payment Method: ${invoice.paidBy.toUpperCase()}`, { align: 'center' });

    // Finalize PDF
    doc.end();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  } catch (err) {
    next(err);
  }
};

// @desc    Admin set invoice number sequence
// @route   POST /api/invoices/admin/set-invoice-sequence
// @access  Private/Admin
const setInvoiceSequence = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Invoice sequence configuration is not needed with timestamp-based numbering'
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to generate invoice number based on timestamp
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// Helper function to send invoice email
async function sendInvoiceEmail(invoice, booking) {
  const emailHtml = `
    <h2>Your Invoice #${invoice.invoiceNo}</h2>
    <p>Thank you for using our service!</p>
    
    <h3>Invoice Details</h3>
    <p><strong>Date:</strong> ${invoice.formattedDate}</p>
    <p><strong>Due Date:</strong> ${invoice.formattedDueDate}</p>
    <p><strong>Service:</strong> ${booking.service.title}</p>
    
    <h3>Amount Due: ₹${invoice.totalAmount.toFixed(2)}</h3>
    <p>Payment Status: ${invoice.paymentStatus.toUpperCase()}</p>
    
    <p>Please find attached your invoice PDF.</p>
    <p>You can also download it from your account dashboard.</p>
  `;

  await sendEmail({
    to: booking.customer.email,
    subject: `Your Invoice #${invoice.invoiceNo}`,
    html: emailHtml,
    attachments: [
      {
        filename: `invoice_${invoice.invoiceNo}.pdf`,
        path: path.join(__dirname, '../public/invoices', `invoice_${invoice.invoiceNo}.pdf`)
      }
    ]
  });
}

module.exports = {
  getAllInvoices,
  getInvoice,
  getMyInvoices,
  getProviderInvoices,
  autoGenerateInvoice,
  getInvoiceProducts,
  addProductToInvoice,
  updateProductInInvoice,
  removeProductFromInvoice,
  adminUpdateInvoice,
  downloadInvoice,
  setInvoiceSequence
};