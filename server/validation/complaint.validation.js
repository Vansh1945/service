const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const submitComplaintSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  bookingId: objectIdSchema.optional().or(z.literal('')),
  complaintType: z.enum([
    'poor_quality', 'incomplete_work', 'provider_late', 'payment_issue', 'overcharged_service', 'behaviour_issue', 'cancel_booking', 'other'
  ]).optional()
});

const resolveComplaintSchema = z.object({
  resolutionNotes: z.string().min(1, "Resolution notes are required"),
  decision: z.enum([
    'approve_refund', 'reject_refund', 'manual_review',
    'request_more_evidence', 're_service', 'partial_refund', 'full_refund', 'platform_credit', 'provider_warning', 'provider_penalty'
  ]).optional()
});

const updateComplaintStatusSchema = z.object({
  status: z.enum(['Open', 'In-Progress', 'Solved', 'Reopened', 'Closed', 'submitted', 'under_review', 'provider_responded', 'admin_review', 'resolved', 'rejected', 'refunded', 'request_more_evidence'], {
    errorMap: () => ({ message: "Invalid status" })
  }),
  resolutionNotes: z.string().min(1, "Admin Remarks (Required) is required")
});

const reopenComplaintSchema = z.object({
  reason: z.string().min(1, "Reason for reopening is required")
});

const replyToComplaintSchema = z.object({
  message: z.string().optional()
});

module.exports = {
  submitComplaintSchema,
  resolveComplaintSchema,
  updateComplaintStatusSchema,
  reopenComplaintSchema,
  replyToComplaintSchema
};
