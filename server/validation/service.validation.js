const { z } = require('zod');

const createServiceSchema = z.object({
  title: z.string().min(1, "Service title is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  basePrice: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Price must be a valid number");
    return num;
  }),
  duration: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Duration must be a valid number");
    return num;
  }),
  specialNotes: z.string().optional(),
  materialsUsed: z.string().optional()
});

const updateServiceSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  basePrice: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Price must be a valid number");
    return num;
  }).optional(),
  duration: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Duration must be a valid number");
    return num;
  }).optional(),
  specialNotes: z.string().optional(),
  materialsUsed: z.string().optional(),
  existingImages: z.string().optional()
});

const updateBasePriceSchema = z.object({
  basePrice: z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("Price must be a valid number");
    return num;
  })
});

module.exports = {
  createServiceSchema,
  updateServiceSchema,
  updateBasePriceSchema
};
