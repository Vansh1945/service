const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const ratingSchema = z.union([z.string(), z.number()]).transform((val) => {
  const num = Number(val);
  if (isNaN(num)) throw new Error("Rating must be a valid number");
  return num;
}).refine(val => val >= 1 && val <= 5, {
  message: "Rating must be between 1 and 5"
});

const submitFeedbackSchema = z.object({
  bookingId: objectIdSchema,
  providerRating: ratingSchema,
  providerComment: z.string().optional(),
  serviceRating: ratingSchema,
  serviceComment: z.string().optional()
});

const editFeedbackSchema = z.object({
  providerRating: ratingSchema.optional(),
  providerComment: z.string().optional(),
  serviceRating: ratingSchema.optional(),
  serviceComment: z.string().optional()
});

module.exports = {
  submitFeedbackSchema,
  editFeedbackSchema
};
