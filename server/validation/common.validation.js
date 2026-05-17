const { z } = require('zod');

// Schema for MongoDB ObjectId
const objectIdSchema = z.string().refine((val) => {
  return /^[0-9a-fA-F]{24}$/.test(val);
}, {
  message: "Invalid ObjectId format"
});

// Middleware factory for validation
const validate = (location, schema) => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[location]);
      req[location] = parsed; // Replace with validated/parsed data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(err.message);
        });
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: formattedErrors
        });
      }
      next(error);
    }
  };
};

const validateBody = (schema) => validate('body', schema);
const validateQuery = (schema) => validate('query', schema);
const validateParams = (schema) => validate('params', schema);

module.exports = {
  objectIdSchema,
  validateBody,
  validateQuery,
  validateParams
};
