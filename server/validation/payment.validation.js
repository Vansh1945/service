const { z } = require('zod');

const requestBulkWithdrawalSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Amount must be a valid number");
    return num;
  }).refine(val => val > 0, {
    message: "Withdrawal amount must be a positive number"
  })
});

const verifyWithdrawalOTPSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit number")
});

module.exports = {
  requestBulkWithdrawalSchema,
  verifyWithdrawalOTPSchema
};
