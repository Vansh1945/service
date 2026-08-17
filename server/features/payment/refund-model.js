const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      index: true,
    },
    paymentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentRecord',
      index: true,
    },
    originalPaymentMethod: {
      type: String,
      default: 'online',
    },
    originalGateway: {
      type: String,
      default: 'razorpay',
    },
    originalPaymentId: {
      type: String,
    },
    gatewayOrderId: {
      type: String,
    },
    gatewayPaymentId: {
      type: String,
    },
    gatewayRefundId: {
      type: String,
      unique: true,
      sparse: true,
    },
    walletTransactionId: {
      type: String,
    },
    refundDestination: {
      type: String,
      enum: ['original_payment', 'wallet', 'hybrid'],
      default: 'wallet',
    },
    customerChoice: {
      type: String,
      enum: ['original_payment', 'wallet', 'none'],
      default: 'none',
    },
    actualRefundDestination: {
      type: String,
      enum: ['original_payment', 'wallet', 'hybrid'],
      default: 'wallet',
    },
    refundMethod: {
      type: String,
      default: 'razorpay',
    },
    isFallbackUsed: {
      type: Boolean,
      default: false,
    },
    fallbackReason: {
      type: String,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    refundSource: {
      type: String,
      enum: [
        'customer_cancellation',
        'provider_cancellation',
        'admin_cancellation',
        'auto_cancellation',
        'complaint_resolution',
        'duplicate_payment',
        'failed_payment',
        'gateway_failure',
        'wallet_adjustment',
        'admin_action',
        'booking_cancellation',
        'manual_refund',
      ],
      required: true,
    },
    refundReason: {
      type: String,
    },
    cancellationReason: {
      type: String,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    feeDeducted: {
      type: Number,
      default: 0,
      min: 0,
    },
    gatewayRefundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletRefundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundStatus: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    refundType: {
      type: String,
      enum: ['auto', 'manual', 'cancellation', 'complaint', 'admin_adjustment', 'payment_failure', 'duplicate_payment', 'partial', 'full'],
      default: 'auto',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    timeline: [
      {
        status: { type: String, required: true },
        actor: { type: String, default: 'System' },
        notes: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    auditLogs: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userRole: { type: String },
        ip: { type: String },
        details: { type: mongoose.Schema.Types.Mixed },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to add timeline status update
refundSchema.methods.addTimelineStep = function (status, actor = 'System', notes = '') {
  this.timeline.push({
    status,
    actor,
    notes,
    timestamp: new Date(),
  });
};

// Helper method to add audit log entry
refundSchema.methods.addAuditLog = function (action, performedBy, userRole = 'system', details = {}, ip = '') {
  this.auditLogs.push({
    action,
    performedBy,
    userRole,
    ip,
    details,
    timestamp: new Date(),
  });
};

const Refund = mongoose.models.Refund || mongoose.model('Refund', refundSchema);

module.exports = Refund;
