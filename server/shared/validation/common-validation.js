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
        const errorsList = error.errors || error.issues || [];
        errorsList.forEach((err) => {
          const path = err.path ? err.path.join('.') : 'field';
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(err.message || 'Validation error');
        });
        console.log("❌ Zod Validation Failed:", JSON.stringify(formattedErrors, null, 2));
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

// Chat Schemas
const createRoomSchema = z.object({
  roomType: z.enum(['provider_customer', 'customer_admin', 'provider_admin', 'complaint_admin']).optional(),
  bookingId: objectIdSchema.optional().nullable().or(z.literal('')),
  complaintId: objectIdSchema.optional().nullable().or(z.literal('')),
  customerId: objectIdSchema.optional().nullable().or(z.literal('')),
  providerId: objectIdSchema.optional().nullable().or(z.literal(''))
});

const sendMessageSchema = z.object({
  roomId: objectIdSchema,
  messageType: z.enum(['text', 'image', 'file', 'audio', 'video', 'system']).optional(),
  content: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.string().optional()).or(z.literal('')),
  replyTo: objectIdSchema.optional().nullable()
});

const markSeenSchema = z.object({
  roomId: objectIdSchema
});

const typingStatusSchema = z.object({
  roomId: objectIdSchema,
  isTyping: z.boolean().optional()
});

const deleteMessageForMeSchema = z.object({
  roomId: objectIdSchema,
  messageId: objectIdSchema
});

// Contact Schemas
const submitContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().or(z.literal('')),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(1, "Message is required")
});

const replyToContactSchema = z.object({
  message: z.string().min(1, "Reply message is required")
});

// Question Schemas
const createQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  options: z.array(z.string()).min(2, "Questions must have between 2-5 options").max(5),
  correctAnswer: z.number().int().nonnegative(),
  category: z.string().min(1, "Category is required")
});

const updateQuestionSchema = z.object({
  questionText: z.string().optional(),
  options: z.array(z.string()).min(2, "Questions must have between 2-5 options").max(5).optional(),
  correctAnswer: z.number().int().nonnegative().optional(),
  category: z.union([z.string(), z.record(z.any())]).optional(),
  isActive: z.boolean().optional()
});

const createBulkQuestionsSchema = z.object({
  questions: z.array(createQuestionSchema).min(1, "Questions array must not be empty")
});

// Referral Schemas
const updateReferralSettingsSchema = z.object({
  referralProgramPaused: z.boolean().optional(),
  customerRewardType: z.string().optional(),
  customerRewardAmount: z.number().optional(),
  referredRewardType: z.string().optional(),
  referredRewardAmount: z.number().optional(),
  providerRewardType: z.string().optional(),
  providerRewardAmount: z.number().optional(),
  referredProviderRewardType: z.string().optional(),
  referredProviderRewardAmount: z.number().optional(),
  referralExpiryDays: z.number().optional(),
  referralLimitPerUser: z.number().optional(),
  customerReferralEligibilityBookings: z.number().optional(),
  providerReferralEligibilityBookings: z.number().optional(),
  dailyReferralLimitPerUser: z.number().optional(),
  monthlyReferralLimitPerUser: z.number().optional(),
  systemReferralOwner: z.string().optional()
}).catchall(z.any());

const addMilestoneSchema = z.object({
  bookingsCount: z.union([z.number(), z.string()]).transform(val => Number(val)),
  rewardAmount: z.union([z.number(), z.string()]).transform(val => Number(val)),
  description: z.string().optional()
});

const releaseHeldRewardSchema = z.object({
  referralId: objectIdSchema
});

// Surge Schemas
const createSurgeRuleSchema = z.object({
  chargeType: z.enum(['night_charge', 'festive_charge', 'rain_charge', 'high_demand']),
  scope: z.enum(['global', 'zone']),
  zoneId: z.union([objectIdSchema, z.literal('')]).optional().nullable(),
  mode: z.enum(['flat', 'percentage']),
  value: z.number().nonnegative(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  maxBookingValue: z.number().optional().nullable(),
  active: z.boolean().optional()
});

const updateSurgeRuleSchema = createSurgeRuleSchema.partial();

// Zone Schemas
const createZoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  polygon: z.object({
    type: z.string().optional(),
    coordinates: z.array(z.array(z.array(z.number())))
  }),
  priority: z.number().optional(),
  status: z.string().optional(),
  serviceRadius: z.number().optional(),
  maxProviders: z.number().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
  zoneLevel: z.enum(['city', 'service', 'local', 'micro']).optional(),
  parentZone: z.union([objectIdSchema, z.literal(''), z.null()]).optional(),
  adjacentZones: z.array(objectIdSchema).optional()
});

const updateZoneSchema = createZoneSchema.partial();

const resolveZoneByCoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number()
});

// Commission Schemas
const createCommissionRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(['flat', 'percentage']),
  value: z.number().nonnegative(),
  applyTo: z.enum(['global', 'zone', 'performanceScore', 'specificProvider']),
  performanceScore: z.number().optional(),
  specificProvider: z.string().optional(),
  effectiveFrom: z.string().datetime().or(z.string()).optional().nullable(),
  effectiveUntil: z.string().datetime().or(z.string()).optional().nullable()
});

const updateCommissionRuleSchema = createCommissionRuleSchema.partial();

// Notification Schemas
const saveTokenSchema = z.object({
  token: z.string().min(100).max(500),
  deviceId: z.union([z.string(), z.number()]).optional(),
  platform: z.string().optional(),
  appVersion: z.string().optional()
});

const removeTokenSchema = z.object({
  token: z.string()
});

const sendBroadcastSchema = z.object({
  audience: z.enum(['all', 'customer', 'provider']).optional(),
  targetRole: z.enum(['all', 'customer', 'provider']).optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  message: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  scheduledFor: z.string().optional().nullable(),
  scheduledTime: z.string().optional().nullable(),
  sendNow: z.boolean().optional(),
  city: z.string().optional(),
  targetCity: z.string().optional(),
  providerCategory: z.string().optional(),
  targetProviderCategory: z.string().optional(),
  minBookings: z.number().optional(),
  targetZones: z.array(z.string()).optional()
});

const updateNotificationSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  url: z.string().optional(),
  scheduledTime: z.string().optional().nullable(),
  targetZones: z.array(z.string()).optional()
});

const createTemplateSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  targetAudience: z.record(z.any()).optional()
});

const updateTemplateSchema = createTemplateSchema.partial();

const anyBodySchema = z.any();

module.exports = {
  objectIdSchema,
  validateBody,
  validateQuery,
  validateParams,
  anyBodySchema,
  // Chat
  createRoomSchema,
  sendMessageSchema,
  markSeenSchema,
  typingStatusSchema,
  deleteMessageForMeSchema,
  // Contact
  submitContactSchema,
  replyToContactSchema,
  // Question
  createQuestionSchema,
  updateQuestionSchema,
  createBulkQuestionsSchema,
  // Referral
  updateReferralSettingsSchema,
  addMilestoneSchema,
  releaseHeldRewardSchema,
  // Surge
  createSurgeRuleSchema,
  updateSurgeRuleSchema,
  // Zone
  createZoneSchema,
  updateZoneSchema,
  resolveZoneByCoordinatesSchema,
  // Commission
  createCommissionRuleSchema,
  updateCommissionRuleSchema,
  // Notification
  saveTokenSchema,
  removeTokenSchema,
  sendBroadcastSchema,
  updateNotificationSchema,
  createTemplateSchema,
  updateTemplateSchema
};
