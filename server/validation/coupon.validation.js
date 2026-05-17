const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const createCouponSchema = z.object({
  code: z.string().min(3, "Coupon code must be at least 3 characters").max(20, "Coupon code must not exceed 20 characters").toUpperCase(),
  discountType: z.enum(['percentage', 'flat'], {
    errorMap: () => ({ message: "Discount type must be either 'percentage' or 'flat'" })
  }),
  discountValue: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Discount value must be a number");
    return num;
  }).refine(val => val > 0, "Discount value must be greater than 0"),
  expiryDate: z.string().refine((val) => {
    const expiry = new Date(val);
    if (isNaN(expiry.getTime())) return false;
    return expiry > new Date();
  }, {
    message: "Expiry date must be in the future"
  }),
  minBookingValue: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }).optional(),
  isGlobal: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') return val === 'true';
    return !!val;
  }).optional(),
  isFirstBooking: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') return val === 'true';
    return !!val;
  }).optional(),
  assignedTo: objectIdSchema.optional().or(z.literal('')).or(z.null()),
  usageLimit: z.union([z.string(), z.number()]).transform((val) => {
    if (!val) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }).optional().nullable()
});

const updateCouponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase().optional(),
  discountType: z.enum(['percentage', 'flat']).optional(),
  discountValue: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Discount value must be a number");
    return num;
  }).refine(val => val > 0, "Discount value must be greater than 0").optional(),
  expiryDate: z.string().refine((val) => {
    const expiry = new Date(val);
    if (isNaN(expiry.getTime())) return false;
    return expiry > new Date();
  }, {
    message: "Expiry date must be in the future"
  }).optional(),
  minBookingValue: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }).optional(),
  isGlobal: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') return val === 'true';
    return !!val;
  }).optional(),
  isFirstBooking: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') return val === 'true';
    return !!val;
  }).optional(),
  assignedTo: objectIdSchema.optional().or(z.literal('')).or(z.null()),
  usageLimit: z.union([z.string(), z.number()]).transform((val) => {
    if (!val) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }).optional().nullable(),
  isActive: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') return val === 'true';
    return !!val;
  }).optional()
});

const applyCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").toUpperCase(),
  bookingValue: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Booking value must be a valid number");
    return num;
  })
});

const markCouponUsedSchema = z.object({
  code: z.string().min(1, "Coupon code is required").toUpperCase(),
  bookingValue: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Booking value must be a valid number");
    return num;
  })
});

module.exports = {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  markCouponUsedSchema
};
