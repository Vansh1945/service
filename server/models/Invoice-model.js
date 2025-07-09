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
});

// Invoice Schema
const invoiceSchema = new Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is required']
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
    required: [true, 'Service reference is required']
  },
  serviceAmount: {
    type: Number,
    required: [true, 'Service amount is required'],
    min: [0, 'Service amount cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
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
  advancePayment: {
    type: Number,
    default: 0,
    min: [0, 'Advance payment cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  balanceDue: {
    type: Number,
    default: 0,
    min: [0, 'Balance due cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  paidBy: {
    type: String,
    enum: ['online', 'cash', 'wallet', 'card', 'upi'],
    required: [true, 'Payment method is required']
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partially_paid'],
    default: 'pending'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    default: function() {
      const date = new Date(this.generatedAt);
      date.setDate(date.getDate() + 7); // 7 days from generation
      return date;
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
invoiceSchema.index({ booking: 1 });
invoiceSchema.index({ provider: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ service: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ generatedAt: -1 });
invoiceSchema.index({ dueDate: 1 });

// Generate invoice number before save
invoiceSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  const date = new Date();
  const prefix = 'INV-' +
    date.getFullYear().toString().slice(-2) +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') + '-';
  
  // Find the last invoice to generate sequential number
  const lastInvoice = await this.constructor.findOne({}, {}, { sort: { createdAt: -1 } });
  const lastSeq = lastInvoice ? parseInt(lastInvoice.invoiceNo.slice(-4)) : 0;
  
  this.invoiceNo = prefix + (lastSeq + 1).toString().padStart(4, '0');
  next();
});

// Calculate totals before save
invoiceSchema.pre('save', function(next) {
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

  // Calculate balance due (total - advance)
  this.balanceDue = Math.round((this.totalAmount - this.advancePayment) * 100) / 100;

  // Update payment status based on balance
  if (this.balanceDue <= 0) {
    this.paymentStatus = 'paid';
  } else if (this.advancePayment > 0) {
    this.paymentStatus = 'partially_paid';
  } else {
    this.paymentStatus = 'pending';
  }

  next();
});

// Virtuals for formatted dates
invoiceSchema.virtual('formattedDate').get(function() {
  return this.generatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

invoiceSchema.virtual('formattedDueDate').get(function() {
  return this.dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Static Methods
invoiceSchema.statics.findByCustomer = function(customerId, status = null) {
  const query = { customer: customerId };
  if (status) query.paymentStatus = status;
  return this.find(query).sort({ generatedAt: -1 });
};

invoiceSchema.statics.findByProvider = function(providerId, status = null) {
  const query = { provider: providerId };
  if (status) query.paymentStatus = status;
  return this.find(query).sort({ generatedAt: -1 });
};

// Instance Methods
invoiceSchema.methods.markAsPaid = function(paymentMethod) {
  if (this.paymentStatus === 'paid') {
    throw new Error('Invoice is already paid');
  }
  this.paymentStatus = 'paid';
  this.paidBy = paymentMethod;
  this.balanceDue = 0;
  this.advancePayment = this.totalAmount;
  return this.save();
};

invoiceSchema.methods.addAdvancePayment = function(amount, paymentMethod) {
  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) {
    throw new Error('Advance amount must be positive');
  }

  this.advancePayment = Math.round((this.advancePayment + amount) * 100) / 100;
  this.paidBy = paymentMethod;

  // Recalculate balance
  this.balanceDue = Math.round((this.totalAmount - this.advancePayment) * 100) / 100;

  // Update payment status
  if (this.balanceDue <= 0) {
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partially_paid';
  }

  return this.save();
};

// Create from booking static method
invoiceSchema.statics.createFromBooking = async function(booking) {
  const productsUsed = booking.products.map(product => ({
    name: product.name,
    description: product.description,
    quantity: product.quantity,
    rate: product.price,
    total: Math.round(product.quantity * product.price * 100) / 100
  }));

  const productsTotal = productsUsed.reduce((sum, p) => sum + p.total, 0);
  const totalAmount = Math.round((booking.service.price + productsTotal) * 100) / 100;

  return this.create({
    booking: booking._id,
    provider: booking.provider,
    customer: booking.customer,
    service: booking.service,
    serviceAmount: booking.service.price,
    productsUsed,
    totalAmount,
    balanceDue: totalAmount,
    paidBy: 'pending'
  });
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;