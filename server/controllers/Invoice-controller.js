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
      .select('-commission -commissionAmount -commissionRule')
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
      .select('-commission -commissionAmount -commissionRule')
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
      provider: req.provider._id
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

    const { serviceAmount, tax, discount, notes, status } = req.body;

    if (serviceAmount !== undefined) invoice.serviceAmount = serviceAmount;
    if (tax !== undefined) invoice.tax = tax;
    if (discount !== undefined) invoice.discount = discount;
    if (notes !== undefined) invoice.notes = notes;
    if (status && ['active', 'cancelled', 'refunded'].includes(status)) {
      invoice.status = status;
    }

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

    const { page = 1, limit = 10, status, type, paymentStatus } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (type) query.invoiceType = type;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name email')
      .populate('provider', 'businessName')
      .populate('service', 'title')
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
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { provider: req.provider._id };
    if (status) query.status = status;
    if (type) query.invoiceType = type;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name email')
      .populate('service', 'title')
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
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { customer: req.user._id };
    if (status) query.status = status;
    if (type) query.invoiceType = type;

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
// @route   GET /api/invoices/customer/service
// @access  Private (Customer)
exports.getServiceInvoicesForCustomer = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      customer: req.user._id,
      invoiceType: 'service'
    };
    if (status) query.status = status;

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
// @route   GET /api/invoices/customer/product
// @access  Private (Customer)
exports.getProductInvoicesForCustomer = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      customer: req.user._id,
      invoiceType: 'product'
    };
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('provider', 'businessName name email phone')
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

// @desc    Get service invoices for provider
// @route   GET /api/invoices/provider/service
// @access  Private (Provider)
exports.getServiceInvoicesForProvider = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      provider: req.provider._id,
      invoiceType: 'service'
    };
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name email phone')
      .populate('service', 'title category basePrice')
      .populate('booking', 'date time status')
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
    console.error('Get provider service invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get product invoices for provider
// @route   GET /api/invoices/provider/product
// @access  Private (Provider)
exports.getProductInvoicesForProvider = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      provider: req.provider._id,
      invoiceType: 'product'
    };
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
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
    console.error('Get provider product invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create product invoice by provider
// @route   POST /api/invoices/provider/product
// @access  Private (Provider)
exports.createProductInvoice = async (req, res) => {
  try {
    const { 
      customerId, 
      products, 
      tax = 0, 
      discount = 0, 
      notes,
      providerPaymentDetails 
    } = req.body;

    if (!customerId || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and products are required'
      });
    }

    // Validate products
    for (const product of products) {
      if (!product.name || !product.quantity || !product.rate) {
        return res.status(400).json({
          success: false,
          message: 'Each product must have name, quantity, and rate'
        });
      }
    }

    // Generate invoice number
    const invoiceNo = await Invoice.generateInvoiceNumber();

    // Calculate totals
    const productsTotal = products.reduce((sum, product) => {
      return sum + (product.quantity * product.rate);
    }, 0);

    const subtotal = productsTotal;
    const totalAmount = subtotal + tax - discount;

    const invoiceData = {
      invoiceNo,
      invoiceType: 'product',
      provider: req.provider._id,
      customer: customerId,
      serviceAmount: 0,
      productsUsed: products.map(product => ({
        name: product.name,
        description: product.description || '',
        quantity: product.quantity,
        rate: product.rate,
        total: product.quantity * product.rate
      })),
      tax,
      discount,
      totalAmount,
      netAmount: totalAmount,
      commission: {
        amount: 0,
        type: 'fixed',
        value: 0,
        description: 'No commission for product invoices'
      },
      paymentStatus: 'pending',
      notes,
      providerPaymentDetails
    };

    const invoice = await Invoice.create(invoiceData);

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('provider', 'businessName name email phone')
      .populate('customer', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Product invoice created successfully',
      data: populatedInvoice
    });

  } catch (error) {
    console.error('Create product invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update product invoice (only if pending)
// @route   PUT /api/invoices/provider/product/:id
// @access  Private (Provider)
exports.updateProductInvoice = async (req, res) => {
  try {
    const { products, tax, discount, notes, providerPaymentDetails } = req.body;

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      provider: req.provider._id,
      invoiceType: 'product',
      paymentStatus: 'pending'
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or cannot be modified (payment already processed)'
      });
    }

    // Update fields if provided
    if (products && Array.isArray(products)) {
      invoice.productsUsed = products.map(product => ({
        name: product.name,
        description: product.description || '',
        quantity: product.quantity,
        rate: product.rate,
        total: product.quantity * product.rate
      }));
    }

    if (tax !== undefined) invoice.tax = tax;
    if (discount !== undefined) invoice.discount = discount;
    if (notes !== undefined) invoice.notes = notes;
    if (providerPaymentDetails) invoice.providerPaymentDetails = providerPaymentDetails;

    await invoice.save();

    const updatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer', 'name email phone')
      .populate('provider', 'businessName name email phone');

    res.status(200).json({
      success: true,
      message: 'Product invoice updated successfully',
      data: updatedInvoice
    });

  } catch (error) {
    console.error('Update product invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete product invoice (only if pending)
// @route   DELETE /api/invoices/provider/product/:id
// @access  Private (Provider)
exports.deleteProductInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      provider: req.provider._id,
      invoiceType: 'product',
      paymentStatus: 'pending'
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or cannot be deleted (payment already processed)'
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Product invoice deleted successfully'
    });

  } catch (error) {
    console.error('Delete product invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Customer pay product invoice directly
// @route   POST /api/invoices/customer/product/:id/pay
// @access  Private (Customer)
exports.payProductInvoiceDirectly = async (req, res) => {
  try {
    const { paymentMethod, transactionId, paymentGateway } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      customer: req.user._id,
      invoiceType: 'product'
    }).populate('provider', 'businessName name email phone');

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

    // Create payment record
    const paymentDetail = {
      method: paymentMethod,
      amount: invoice.totalAmount,
      date: new Date(),
      status: 'success',
      transactionId,
      paymentGateway
    };

    // Add payment to invoice
    invoice.paymentDetails.push(paymentDetail);
    invoice.paymentStatus = 'paid';

    await invoice.save();

    // Send notification to provider
    if (invoice.provider.email) {
      await sendEmail({
        to: invoice.provider.email,
        subject: 'Product Payment Received',
        text: `You have received a payment of ₹${invoice.totalAmount} for product invoice ${invoice.invoiceNo} from ${req.user.name}.`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        invoiceNo: invoice.invoiceNo,
        amount: invoice.totalAmount,
        paymentMethod,
        transactionId,
        status: 'paid'
      }
    });

  } catch (error) {
    console.error('Pay product invoice directly error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Confirm cash payment (Provider only)
// @route   POST /api/invoices/provider/:id/confirm-cash
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