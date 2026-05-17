const { z } = require('zod');

const requestBulkWithdrawalSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Amount must be a valid number");
    return num;
  }).refine(val => val >= 500, {
    message: "Minimum withdrawal amount is ₹500"
  })
});

const verifyWithdrawalOTPSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit number")
});

module.exports = {
  requestBulkWithdrawalSchema,
  verifyWithdrawalOTPSchema
};
