const { z } = require('zod');
const { objectIdSchema } = require('../../shared/validation/common-validation');

const registerAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please provide a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
  signupSecret: z.string().min(1, "Signup secret is required")
});

const approveProviderSchema = z.object({
  status: z.enum(['approved', 'rejected', 'active', 'restricted', 'suspended', 'blocked', 'pending_review', 'bank_approved', 'bank_rejected'], {
    errorMap: () => ({ message: "Status must be one of: approved, rejected, active, restricted, suspended, blocked, pending_review, bank_approved, bank_rejected" })
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
