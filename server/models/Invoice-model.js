const mongoose = require('mongoose');
const { Schema } = mongoose;

// Product Sub-Schema
const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: [0, 'Rate cannot be negative']
  },
  total: {
    type: Number,
    min: [0, 'Total cannot be negative'],
    default: 0
  }
}, { _id: true });

// Payment Details Sub-Schema
const paymentDetailSchema = new Schema({
  method: {
    type: String,
    required: true,
    enum: ['cod', 'online', 'wallet', 'cash', 'card', 'upi']
  },
  transactionId: String,
  paymentGateway: String,
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  }
});

// Provider Payment Details Sub-Schema
const providerPaymentDetailsSchema = new Schema({
  upiId: {
    type: String,
    trim: true
  },
  qrCodeImage: {
    type: String,
    trim: true
  },
  bankDetails: {
    accountNumber: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true
    },
    accountHolderName: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    }
  }
});

// Commission Details Sub-Schema
const commissionDetailSchema = new Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  rule: {
    type: Schema.Types.ObjectId,
    ref: 'CommissionRule'
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  description: String
});

// Invoice Schema
const invoiceSchema = new Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true
  },
  invoiceType: {
    type: String,
    enum: ['service', 'product'],
    required: true,
    default: 'service'
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: function () {
      return this.invoiceType === 'service';
    }
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider reference is required']
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer reference is required']
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: function () {
      return this.invoiceType === 'service';
    }
  },
  serviceAmount: {
    type: Number,
    required: function () {
      return this.invoiceType === 'service';
    },
    min: [0, 'Service amount cannot be negative'],
    set: v => Math.round(v * 100) / 100,
    default: 0
  },
  productsUsed: {
    type: [productSchema],
    default: []
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  commission: {
    type: commissionDetailSchema,
    required: true
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  netAmount: {
    type: Number,
    required: true,
    min: [0, 'Net amount cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'partially_paid'],
    default: 'pending'
  },
  paymentDetails: [paymentDetailSchema],
  providerPaymentDetails: providerPaymentDetailsSchema,
  generatedAt: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    default: function () {
      const date = new Date(this.generatedAt);
      date.setDate(date.getDate() + 7);
      return date;
    }
  },
  notes: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'refunded'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
invoiceSchema.index({ booking: 1 });
invoiceSchema.index({ provider: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ service: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ generatedAt: -1 });
invoiceSchema.index({ dueDate: 1 });

// Calculate totals before save
invoiceSchema.pre('save', function (next) {
  // Calculate product totals
  this.productsUsed.forEach(product => {
    product.total = Math.round((product.quantity * product.rate) * 100) / 100;
  });

  // Calculate products total
  const productsTotal = this.productsUsed.reduce(
    (sum, product) => sum + (product.total || 0), 0
  );

  // Calculate subtotal (service + products)
  const subtotal = this.serviceAmount + productsTotal;

  // Calculate total amount (subtotal + tax - discount)
  this.totalAmount = Math.round((subtotal + this.tax - this.discount) * 100) / 100;

  // Calculate net amount (total - commission)
  this.netAmount = Math.round((this.totalAmount - (this.commission?.amount || 0)) * 100) / 100;

  // Calculate payment status based on payment details
  const totalPaid = this.paymentDetails.reduce(
    (sum, payment) => sum + (payment.status === 'success' ? payment.amount : 0), 0
  );

  if (totalPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    this.paymentStatus = 'partially_paid';
  } else {
    this.paymentStatus = 'pending';
  }

  next();
});

// Virtuals
invoiceSchema.virtual('formattedDate').get(function () {
  return this.generatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

invoiceSchema.virtual('formattedDueDate').get(function () {
  return this.dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

invoiceSchema.virtual('totalPaid').get(function () {
  return this.paymentDetails.reduce(
    (sum, payment) => sum + (payment.status === 'success' ? payment.amount : 0), 0
  );
});

invoiceSchema.virtual('balanceDue').get(function () {
  return Math.max(0, this.totalAmount - this.totalPaid);
});

// Static Methods
invoiceSchema.statics.generateInvoiceNumber = async function () {
  const date = new Date();
  const prefix = 'INV-' +
    date.getFullYear().toString().slice(-2) +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') + '-';

  const lastInvoice = await this.findOne({}, {}, { sort: { createdAt: -1 } });
  const lastSeq = lastInvoice ? parseInt(lastInvoice.invoiceNo.slice(-4)) : 0;
  return prefix + (lastSeq + 1).toString().padStart(4, '0');
};

invoiceSchema.statics.createFromBooking = async function (booking, options = {}) {
  const Service = mongoose.model('Service');

  const service = await Service.findById(booking.services[0].service);
  if (!service) throw new Error('Service not found');

  // Generate invoice number
  const invoiceNo = await this.generateInvoiceNumber();

  const invoiceData = {
    invoiceNo,
    booking: booking._id,
    provider: booking.provider,
    customer: booking.customer,
    service: booking.services[0].service,
    serviceAmount: service.basePrice,
    totalAmount: booking.totalAmount,
    netAmount: booking.totalAmount - booking.commissionAmount,
    commission: {
      amount: booking.commissionAmount,
      rule: booking.commissionRule,
      type: booking.commissionRule?.type || 'percentage',
      value: booking.commissionRule?.value || 0,
      description: booking.commissionRule
        ? `Commission (${booking.commissionRule.type === 'percentage' ?
          booking.commissionRule.value + '%' :
          '₹' + booking.commissionRule.value})`
        : 'No commission applied'
    },
    paymentStatus: booking.paymentStatus === 'paid' ? 'paid' : 'pending'
  };

  if (booking.paymentStatus === 'paid') {
    invoiceData.paymentDetails = [{
      method: booking.paymentMethod || 'online',
      amount: booking.totalAmount,
      status: 'success',
      transactionId: booking.transactionId,
      paymentGateway: booking.paymentGateway
    }];
  }

  // Create invoice with session if provided
  if (options.session) {
    return this.create([invoiceData], { session: options.session }).then(invoices => invoices[0]);
  }

  return this.create(invoiceData);
};

// Instance Methods
invoiceSchema.methods.addPayment = async function (paymentData) {
  this.paymentDetails.push(paymentData);
  await this.save();
  return this;
};

invoiceSchema.methods.addProduct = async function (productData) {
  this.productsUsed.push(productData);
  await this.save();
  return this;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;