const { z } = require('zod');

const stringArrayField = z.union([z.string(), z.array(z.string())]).optional().transform(val => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return [val]; }
  }
  return val;
});

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
  serviceIncludes: stringArrayField,
  serviceExcludes: stringArrayField,
  serviceGuarantees: stringArrayField,
  materialsUsed: stringArrayField,
  serviceType: z.enum(['standard', 'premium', 'emergency']).optional(),
  warranty: z.union([z.string(), z.object({
    duration: z.union([z.string(), z.number()]).transform(Number),
    unit: z.enum(['days', 'months'])
  })]).optional().transform(val => {
    let parsed = val;
    if (typeof val === 'string' && val.trim() !== '') {
      try { parsed = JSON.parse(val); } catch (e) { return undefined; }
    }
    if (parsed && (parsed.duration === '' || parsed.duration === null || parsed.duration === undefined || isNaN(Number(parsed.duration)))) {
      return undefined;
    }
    return parsed;
  }),
  tags: stringArrayField,
  faqs: z.union([z.string(), z.array(z.object({
    question: z.string(),
    answer: z.string()
  }))]).optional().transform(val => {
    if (typeof val === 'string' && val.trim() !== '') {
      try { return JSON.parse(val); } catch (e) { return []; }
    }
    return val;
  }),
  shortDescription: z.string().max(150).optional(),
  isFeatured: z.union([z.string(), z.boolean()]).transform(val => String(val) === 'true').optional(),
  prerequisites: stringArrayField,
  discountPrice: z.union([z.string(), z.number()]).transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    if (isNaN(num)) throw new Error("Discount price must be a valid number");
    return num;
  }).optional()
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
  serviceIncludes: stringArrayField,
  serviceExcludes: stringArrayField,
  serviceGuarantees: stringArrayField,
  materialsUsed: stringArrayField,
  existingImages: z.string().optional(),
  isActive: z.union([z.string(), z.boolean()]).transform(val => String(val) === 'true').optional(),
  serviceType: z.enum(['standard', 'premium', 'emergency']).optional(),
  warranty: z.union([z.string(), z.object({
    duration: z.union([z.string(), z.number()]).transform(Number),
    unit: z.enum(['days', 'months'])
  })]).optional().transform(val => {
    let parsed = val;
    if (typeof val === 'string' && val.trim() !== '') {
      try { parsed = JSON.parse(val); } catch (e) { return undefined; }
    }
    if (parsed && (parsed.duration === '' || parsed.duration === null || parsed.duration === undefined || isNaN(Number(parsed.duration)))) {
      return undefined;
    }
    return parsed;
  }),
  tags: stringArrayField,
  faqs: z.union([z.string(), z.array(z.object({
    question: z.string(),
    answer: z.string()
  }))]).optional().transform(val => {
    if (typeof val === 'string' && val.trim() !== '') {
      try { return JSON.parse(val); } catch (e) { return []; }
    }
    return val;
  }),
  shortDescription: z.string().max(150).optional(),
  isFeatured: z.union([z.string(), z.boolean()]).transform(val => String(val) === 'true').optional(),
  prerequisites: stringArrayField,
  discountPrice: z.union([z.string(), z.number()]).transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    if (isNaN(num)) throw new Error("Discount price must be a valid number");
    return num;
  }).optional()
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
