const { z } = require('zod');

const objectIdSchema = z.string().refine((val) => {
  return /^[0-9a-fA-F]{24}$/.test(val);
}, {
  message: "Invalid ObjectId format"
});

const startTestSchema = z.object({
  categories: z.array(objectIdSchema).min(1, "At least one category is required").max(3, "At most three categories are allowed")
});

const submitTestSchema = z.object({
  testId: objectIdSchema,
  answers: z.array(
    z.object({
      questionId: objectIdSchema,
      selectedOption: z.number().int().nonnegative()
    })
  )
});

module.exports = {
  startTestSchema,
  submitTestSchema
};
