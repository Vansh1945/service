const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const createOrderSchema = z.object({
  bookingId: objectIdSchema,
  amount: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Amount must be a valid number");
    return num;
  }).refine(val => val > 0, "Amount must be greater than 0"),
  paymentMethod: z.enum(['online', 'mixed'], {
    errorMap: () => ({ message: "Payment method must be either 'online' or 'mixed'" })
  })
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "Razorpay Order ID is required"),
  razorpay_payment_id: z.string().min(1, "Razorpay Payment ID is required"),
  razorpay_signature: z.string().min(1, "Razorpay Signature is required"),
  bookingId: objectIdSchema,
  transactionId: objectIdSchema
});

module.exports = {
  createOrderSchema,
  verifyPaymentSchema
};
