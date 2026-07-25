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

module.exports = {
  requestBulkWithdrawalSchema
};
