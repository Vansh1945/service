const mongoose = require('mongoose');
const Invoice = require('../models/Invoice-model');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const sendEmail = require('../utils/sendEmail');
const { generatePDFFromHTML } = require('../utils/pdfGenerator');
const path = require('path');
const fs = require('fs');
const { generateCustomerInvoiceHTML } = require('../utils/invoiceTemplate');

// Utility function to populate invoice data
const populateInvoiceData = async (query) => {
  return await Invoice.findOne(query)
    .populate('customer', 'name email phone address')
    .populate('provider', 'name email phone address')
    .populate('service', 'title category basePrice duration')
    .populate('booking', 'date time status paymentStatus')
    .populate('commission.rule', 'name type value')
    .lean()
    .exec();
};

// Generate PDF and save to disk
const generateAndSavePDF = async (invoiceData) => {
  const pdfBuffer = await generatePDF(invoiceData);
  const fileName = `invoice_${invoiceData.invoiceNo}.pdf`;
  const filePath = path.join(__dirname, '../public/invoices', fileName);

  fs.writeFileSync(filePath, pdfBuffer);
  return {
    filePath,
    fileName,
    url: `/invoices/${fileName}`
  };
};

// @desc    Get invoice for customer (without commission)
// @route   GET /api/invoices/customer/:id
// @access  Private (Customer)
exports.getCustomerInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      customer: req.user._id
    })
      .populate('customer', 'name email phone address')
      .populate('provider', 'businessName contactPerson phone address')
      .populate('service', 'title category basePrice duration description')
      .populate('booking', 'date time status paymentStatus')
      .select('-commission -commissionAmount -commissionRule') // Exclude commission fields
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get customer invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Download invoice as PDF for customer
// @route   GET /api/invoices/customer/:id/download
// @access  Private (Customer)
exports.downloadCustomerInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      customer: req.user._id
    })
      .populate('customer', 'name email phone address')
      .populate('provider', 'businessName contactPerson phone address')
      .populate('service', 'title category basePrice duration description')
      .populate('booking', 'date time status paymentStatus')
      .select('-commission -commissionAmount -commissionRule') // Exclude commission fields
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const html = generateCustomerInvoiceHTML(invoice);
    const pdfBuffer = await generatePDFFromHTML(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoiceNo}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download customer invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
};

// @desc    Get single invoice by ID (Provider only)
// @route   GET /api/invoices/provider/:id
// @access  Private (Provider only)
exports.getProviderInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      provider: req.provider._id // Ensure the invoice belongs to this provider
    })
    .populate('customer', 'name email phone')
    .populate('service', 'name basePrice')
    .populate('booking', 'bookingDate status')
    .populate('commission.rule', 'name type value description');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or unauthorized'
      });
    }

    // Format the response with provider-specific details
    const response = {
      success: true,
      data: {
        invoiceNo: invoice.invoiceNo,
        date: invoice.formattedDate,
        dueDate: invoice.formattedDueDate,
        customer: invoice.customer,
        service: {
          name: invoice.service.name,
          amount: invoice.serviceAmount
        },
        products: invoice.productsUsed.map(product => ({
          name: product.name,
          description: product.description,
          quantity: product.quantity,
          rate: product.rate,
          total: product.total
        })),
        subtotal: invoice.serviceAmount + invoice.productsUsed.reduce((sum, p) => sum + p.total, 0),
        tax: invoice.tax,
        discount: invoice.discount,
        totalAmount: invoice.totalAmount,
        paymentStatus: invoice.paymentStatus,
        paymentDetails: invoice.paymentDetails,
        commission: {
          amount: invoice.commission.amount,
          type: invoice.commission.type,
          value: invoice.commission.value,
          description: invoice.commission.description,
          rule: invoice.commission.rule
        },
        netAmount: invoice.netAmount,
        totalPaid: invoice.totalPaid,
        balanceDue: invoice.balanceDue,
        notes: invoice.notes,
        booking: invoice.booking
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get provider invoice by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Add product to invoice (Admin, Provider)
// @route   POST /api/invoices/:id/products
// @access  Private
exports.addProductToInvoice = async (req, res) => {
  try {
    // Check if body exists and is an object
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body'
      });
    }

    const { name, description, quantity, rate } = req.body;

    if (!name || !quantity || !rate) {
      return res.status(400).json({
        success: false,
        message: 'Name, quantity and rate are required',
        requiredFields: ['name', 'quantity', 'rate']
      });
    }

    // Validate quantity and rate are numbers
    if (isNaN(quantity) || isNaN(rate)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity and rate must be numbers'
      });
    }

    let invoice;

    if (req.role === 'admin') {
      invoice = await Invoice.findById(req.params.id);
    } else if (req.role === 'provider') {
      invoice = await Invoice.findById({
        _id: req.params.id,
        provider: req.provider._id
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or unauthorized'
      });
    }

    const newProduct = {
      name: name.trim(),
      description: description ? description.trim() : '',
      quantity: Number(quantity),
      rate: Number(rate),
      total: Number(quantity) * Number(rate)
    };

    invoice.productsUsed.push(newProduct);
    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update product in invoice (Admin, Provider)
// @route   PUT /api/invoices/:id/products/:productId
// @access  Private
exports.updateProductInInvoice = async (req, res) => {
  try {
    const { name, description, quantity, rate } = req.body;

    let invoice;

    if (req.role === 'admin') {
      invoice = await Invoice.findById(req.params.id);
    } else if (req.role === 'provider') {
      invoice = await Invoice.findById({
        _id: req.params.id,
        provider: req.provider._id
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or unauthorized'
      });
    }

    const productIndex = invoice.productsUsed.findIndex(
      p => p._id.toString() === req.params.productId
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in invoice'
      });
    }

    const product = invoice.productsUsed[productIndex];

    if (name) product.name = name;
    if (description) product.description = description;
    if (quantity) product.quantity = quantity;
    if (rate) product.rate = rate;

    product.total = product.quantity * product.rate;

    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Remove product from invoice (Admin, Provider)
// @route   DELETE /api/invoices/:id/products/:productId
// @access  Private
exports.removeProductFromInvoice = async (req, res) => {
  try {
    let invoice;

    if (req.role === 'admin') {
      invoice = await Invoice.findById(req.params.id);
    } else if (req.role === 'provider') {
      invoice = await Invoice.findById({
        _id: req.params.id,
        provider: req.provider._id
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or unauthorized'
      });
    }

    invoice.productsUsed = invoice.productsUsed.filter(
      p => p._id.toString() !== req.params.productId
    );

    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Remove product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update invoice details (Admin only)
// @route   PUT /api/invoices/:id
// @access  Private (Admin)
exports.updateInvoice = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can update invoice details'
      });
    }

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const { serviceAmount, tax, discount, notes } = req.body;

    if (serviceAmount !== undefined) invoice.serviceAmount = serviceAmount;
    if (tax !== undefined) invoice.tax = tax;
    if (discount !== undefined) invoice.discount = discount;
    if (notes !== undefined) invoice.notes = notes;

    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all invoices for admin
// @route   GET /api/invoices/admin/all
// @access  Private (Admin)
exports.getAllInvoicesForAdmin = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can access all invoices'
      });
    }

    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.paymentStatus = status;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name email')
      .populate('provider', 'businessName')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get invoices for provider
// @route   GET /api/invoices/provider/all
// @access  Private (Provider)
exports.getInvoicesForProvider = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { provider: req.provider._id };
    if (status) query.paymentStatus = status;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name email')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get provider invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get invoices for customer
// @route   GET /api/invoices/customer/all
// @access  Private (Customer)
exports.getInvoicesForCustomer = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { customer: req.user._id };
    if (status) query.paymentStatus = status;

    const invoices = await Invoice.find(query)
      .populate('provider', 'businessName name email phone')
      .populate('service', 'title category description')
      .populate('customer', 'name email phone')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get customer invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get service invoices for customer
// @route   GET /api/invoices/user/service-invoices
// @access  Private (Customer)
exports.getServiceInvoicesForCustomer = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      customer: req.user._id,
      $or: [
        { productsUsed: { $exists: false } },
        { productsUsed: { $size: 0 } }
      ]
    };
    if (status) query.paymentStatus = status;

    const invoices = await Invoice.find(query)
      .populate('provider', 'businessName name email phone')
      .populate('service', 'title category description')
      .populate('customer', 'name email phone')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get service invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get product invoices for customer
// @route   GET /api/invoices/user/product-invoices
// @access  Private (Customer)
exports.getProductInvoicesForCustomer = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      customer: req.user._id,
      productsUsed: { $exists: true, $not: { $size: 0 } }
    };
    if (status) query.paymentStatus = status;

    const invoices = await Invoice.find(query)
      .populate('provider', 'businessName name email phone')
      .populate('service', 'title category description')
      .populate('customer', 'name email phone')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get product invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Process product payment to provider
// @route   POST /api/invoices/:id/product-payment
// @access  Private (Customer)
exports.processProductPayment = async (req, res) => {
  try {
    const { paymentMethod, upiId, transactionId, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      customer: req.user._id
    })
      .populate('provider', 'businessName name email phone')
      .populate('customer', 'name email phone');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    // Calculate product total
    const productTotal = invoice.productsUsed.reduce((sum, product) => sum + product.total, 0);

    if (amount && Math.abs(amount - productTotal) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match product total'
      });
    }

    // Create payment record
    const paymentDetail = {
      method: paymentMethod,
      amount: productTotal,
      date: new Date(),
      status: paymentMethod === 'cash' ? 'pending' : 'success'
    };

    if (paymentMethod === 'upi' && upiId) {
      paymentDetail.transactionId = transactionId || `UPI_${Date.now()}`;
      paymentDetail.upiId = upiId;
    }

    // Add payment to invoice
    invoice.paymentDetails.push(paymentDetail);

    // Update payment status
    if (paymentMethod === 'upi') {
      invoice.paymentStatus = 'paid';
    } else if (paymentMethod === 'cash') {
      invoice.paymentStatus = 'pending'; // Will be confirmed by provider
    }

    await invoice.save();

    // Send notification to provider
    if (paymentMethod === 'upi') {
      await sendEmail({
        to: invoice.provider.email,
        subject: 'Product Payment Received',
        text: `You have received a payment of ₹${productTotal} via UPI for invoice ${invoice.invoiceNo} from ${invoice.customer.name}.`
      });
    } else if (paymentMethod === 'cash') {
      await sendEmail({
        to: invoice.provider.email,
        subject: 'Cash Payment Pending Confirmation',
        text: `Customer ${invoice.customer.name} has selected cash payment of ₹${productTotal} for invoice ${invoice.invoiceNo}. Please confirm receipt when payment is made.`
      });
    }

    res.status(200).json({
      success: true,
      message: paymentMethod === 'cash' 
        ? 'Cash payment recorded. Provider will confirm receipt.' 
        : 'Payment processed successfully',
      data: {
        invoiceNo: invoice.invoiceNo,
        amount: productTotal,
        paymentMethod,
        status: invoice.paymentStatus
      }
    });

  } catch (error) {
    console.error('Process product payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Confirm cash payment (Provider only)
// @route   POST /api/invoices/:id/confirm-cash-payment
// @access  Private (Provider)
exports.confirmCashPayment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      provider: req.provider._id
    })
      .populate('customer', 'name email phone');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or unauthorized'
      });
    }

    // Find pending cash payment
    const cashPayment = invoice.paymentDetails.find(
      payment => payment.method === 'cash' && payment.status === 'pending'
    );

    if (!cashPayment) {
      return res.status(400).json({
        success: false,
        message: 'No pending cash payment found'
      });
    }

    // Update payment status
    cashPayment.status = 'success';
    invoice.paymentStatus = 'paid';

    await invoice.save();

    // Send confirmation to customer
    await sendEmail({
      to: invoice.customer.email,
      subject: 'Cash Payment Confirmed',
      text: `Your cash payment of ₹${cashPayment.amount} for invoice ${invoice.invoiceNo} has been confirmed by the provider.`
    });

    res.status(200).json({
      success: true,
      message: 'Cash payment confirmed successfully',
      data: {
        invoiceNo: invoice.invoiceNo,
        amount: cashPayment.amount,
        confirmedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Confirm cash payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get my invoices (unified endpoint for frontend)
// @route   GET /api/invoice/user/my-invoices
// @access  Private (Customer)
exports.getMyInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;

    let query = { customer: req.user._id };
    
    if (status) query.paymentStatus = status;
    
    // Filter by invoice type
    if (type === 'service') {
      query.$or = [
        { productsUsed: { $exists: false } },
        { productsUsed: { $size: 0 } }
      ];
    } else if (type === 'product') {
      query.productsUsed = { $exists: true, $not: { $size: 0 } };
    }

    const invoices = await Invoice.find(query)
      .populate('provider', 'businessName name email phone')
      .populate('service', 'title category description')
      .populate('customer', 'name email phone')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
