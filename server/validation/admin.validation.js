const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const registerAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long")
});

const approveProviderSchema = z.object({
  status: z.enum(['approved', 'rejected', 'active', 'restricted', 'suspended', 'blocked', 'pending_review'], {
    errorMap: () => ({ message: "Status must be one of: approved, rejected, active, restricted, suspended, blocked, pending_review" })
  }),
  remarks: z.string().optional(),
  rejectionReason: z.string().optional(),
  durationDays: z.number().optional()
});

const adminRefundSchema = z.object({
  reason: z.string().optional(),
  refundAmount: z.number().positive().optional(),
  amount: z.number().nonnegative().optional(),
  type: z.enum(['full', 'partial']).optional(),
  absorption: z.enum(['platform', 'provider', 'shared']).optional()
});

const togglePayoutHoldSchema = z.object({
  status: z.enum(['held', 'available'], {
    errorMap: () => ({ message: "Status must be either 'held' or 'available'" })
  }),
  reason: z.string().optional()
});

module.exports = {
  registerAdminSchema,
  approveProviderSchema,
  adminRefundSchema,
  togglePayoutHoldSchema
};
