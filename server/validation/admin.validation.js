const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const registerAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long")
});

const approveProviderSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: "Status must be either 'approved' or 'rejected'" })
  }),
  remarks: z.string().optional(),
  rejectionReason: z.string().optional()
});

const adminRefundSchema = z.object({
  reason: z.string().optional(),
  refundAmount: z.number().positive().optional()
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
