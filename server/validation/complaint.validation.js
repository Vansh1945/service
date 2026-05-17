const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const submitComplaintSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  bookingId: objectIdSchema.optional().or(z.literal('')),
  complaintType: z.enum(['bad_work', 'late_arrival', 'rude_behavior', 'incomplete_work', 'overcharge']).optional()
});

const resolveComplaintSchema = z.object({
  resolutionNotes: z.string().min(1, "Resolution notes are required"),
  decision: z.enum(['approve_refund', 'reject_refund', 'manual_review']).optional()
});

const updateComplaintStatusSchema = z.object({
  status: z.enum(['Open', 'In-Progress', 'Solved', 'Reopened', 'Closed'], {
    errorMap: () => ({ message: "Invalid status" })
  })
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
