const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const addressSchema = z.object({
  street: z.string().min(5, "Street address must be at least 5 characters long").max(100, "Street address must not exceed 100 characters"),
  city: z.string()
    .min(2, "City must be at least 2 characters long")
    .max(50, "City must not exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "City can only contain letters and spaces"),
  postalCode: z.string()
    .regex(/^\d{6}$/, "Postal code must be a valid 6-digit number")
    .optional()
    .or(z.literal(''))
});

const createBookingSchema = z.object({
  serviceId: objectIdSchema,
  date: z.string().refine((val) => {
    const bookingDate = new Date(val);
    if (isNaN(bookingDate.getTime())) return false;
    // Strip hours so we only compare date parts or verify it's not in past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate >= today;
  }, {
    message: "Booking date must be today or in the future"
  }),
  time: z.string().optional(),
  address: addressSchema,
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be greater than 0").optional(),
  paymentMethod: z.enum(['online', 'cash', 'wallet', 'mixed'], {
    errorMap: () => ({ message: "Payment method must be either 'online', 'cash', 'wallet' or 'mixed'" })
  })
});

const confirmBookingSchema = z.object({
  bookingId: objectIdSchema,
  paymentMethod: z.enum(['online', 'wallet', 'mixed', 'cash']),
  paymentDetails: z.record(z.any()).optional()
});

const updateBookingStatusSchema = z.object({
  status: z.string().min(1, "Status is required")
});

const updateBookingPaymentSchema = z.object({
  paymentMethod: z.enum(['online', 'cash', 'wallet', 'mixed']),
  paymentStatus: z.enum(['pending', 'processing', 'paid', 'failed'])
});

module.exports = {
  createBookingSchema,
  confirmBookingSchema,
  updateBookingStatusSchema,
  updateBookingPaymentSchema
};
