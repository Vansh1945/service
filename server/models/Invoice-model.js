const mongoose = require('mongoose');
const { Schema } = mongoose;
const shortid = require('shortid');

// Product Used Sub-Schema
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
    min: [0, 'Total cannot be negative']
  }
});

// Counter Schema for invoice sequence
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 }
});
const Counter = mongoose.model('Counter', counterSchema);

// Invoice Schema
const invoiceSchema = new Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true
  },
  bookingId: {
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
    set: v => Math.round(v * 100) / 100
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
  advancePayment: {
    type: Number,
    default: 0,
    min: [0, 'Advance payment cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
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
    default: function () {
      const date = new Date(this.generatedAt);
      date.setDate(date.getDate() + 7); // 7 days from generation
      return date;
    }
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
invoiceSchema.index({ bookingId: 1 });
invoiceSchema.index({ provider: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ service: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ generatedAt: -1 });
invoiceSchema.index({ dueDate: 1 });

// Pre-save hook to calculate totals and generate invoice number
invoiceSchema.pre('save', async function (next) {
  // Generate invoice number if new document
  if (this.isNew) {
    const date = new Date();
    const prefix = 'INV-' +
      date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0') + '-';
    
    // Get the next sequence number
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'invoiceNo' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    this.invoiceNo = prefix + counter.seq.toString().padStart(4, '0');
  }

  // Calculate product totals with rounding
  this.productsUsed.forEach(product => {
    product.total = Math.round((product.quantity * product.rate) * 100) / 100;
  });

  // Calculate sum of products
  const productsTotal = this.productsUsed.reduce(
    (sum, product) => sum + product.total, 0
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

// Static Methods
invoiceSchema.statics.findByCustomer = function (customerId, status = null) {
  const query = { customer: customerId };
  if (status) query.paymentStatus = status;
  return this.find(query).sort({ generatedAt: -1 });
};

invoiceSchema.statics.findByProvider = function (providerId, status = null) {
  const query = { provider: providerId };
  if (status) query.paymentStatus = status;
  return this.find(query).sort({ generatedAt: -1 });
};

// Instance Methods
invoiceSchema.methods.markAsPaid = function (paymentMethod) {
  if (this.paymentStatus === 'paid') {
    throw new Error('Invoice is already paid');
  }
  this.paymentStatus = 'paid';
  this.paidBy = paymentMethod;
  this.balanceDue = 0;
  return this.save();
};

invoiceSchema.methods.addAdvancePayment = function (amount, paymentMethod) {
  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) {
    throw new Error('Advance amount must be positive');
  }

  this.advancePayment = Math.round((this.advancePayment + amount) * 100) / 100;

  // Recalculate balance
  this.balanceDue = Math.round((this.totalAmount - this.advancePayment) * 100) / 100;

  // Update payment status
  if (this.balanceDue <= 0) {
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partially_paid';
  }

  this.paidBy = paymentMethod;
  return this.save();
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;