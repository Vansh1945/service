const { z } = require('zod');
const { objectIdSchema } = require('../../shared/validation/common-validation');

const addressSchema = z.object({
  street: z.string().min(5, "Street address must be at least 5 characters long").max(100, "Street address must not exceed 100 characters"),
  city: z.string()
    .min(2, "City must be at least 2 characters long")
    .max(50, "City must not exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "City can only contain letters and spaces"),
  state: z.string()
    .min(2, "State must be at least 2 characters long")
    .max(50, "State must not exceed 50 characters"),
  postalCode: z.string()
    .regex(/^\d{6}$/, "Postal code must be a valid 6-digit number")
    .optional()
    .or(z.literal('')),
  country: z.string().optional().default('India'),
  lat: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  lng: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  addressLine: z.string().optional().or(z.literal('')),
  houseNumber: z.string().optional().or(z.literal('')),
  road: z.string().optional().or(z.literal('')),
  landmark: z.string().optional().or(z.literal('')),
  area: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  formattedAddress: z.string().optional().or(z.literal(''))
});

const createBookingSchema = z.object({
  serviceId: objectIdSchema,
  date: z.string().refine((val) => {
    const bookingDate = new Date(val);
    if (isNaN(bookingDate.getTime())) return false;

    // Create Date objects represented in local timezone for comparison
    const bookingDateLocal = new Date(bookingDate.getUTCFullYear(), bookingDate.getUTCMonth(), bookingDate.getUTCDate());
    const todayLocal = new Date();
    todayLocal.setDate(todayLocal.getDate() - 1);
    todayLocal.setHours(0, 0, 0, 0);

    return bookingDateLocal >= todayLocal;
  }, {
    message: "Booking date must be today or in the future"
  }),
  time: z.string().nullable().optional(),
  address: addressSchema,
  notes: z.string().nullable().optional(),
  couponCode: z.string().nullable().optional(),
  quantity: z.number().int().positive("Quantity must be greater than 0").optional(),
  paymentMethod: z.enum(['online', 'cash', 'wallet', 'mixed'], {
    errorMap: () => ({ message: "Payment method must be either 'online', 'cash', 'wallet' or 'mixed'" })
  }),
  bookingType: z.enum(['scheduled', 'instant', 'emergency']).optional(),
  estimatedDuration: z.number().min(0).optional(),
  travelBufferMinutes: z.number().min(0).optional(),
  expectedStartTime: z.union([z.string(), z.date()]).optional(),
  expectedEndTime: z.union([z.string(), z.date()]).optional(),
  providerAcceptanceStatus: z.enum(['pending', 'accepted', 'rejected']).nullable().optional(),
  reassignmentReason: z.string().optional(),
  isEmergency: z.boolean().optional(),
  isInstant: z.boolean().optional(),
  surgeCharge: z.number().min(0).optional(),
  providerBonus: z.number().min(0).optional(),
  bookingPriority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  providerResponseDeadline: z.union([z.string(), z.date()]).optional(),
  trustedProviderOnly: z.boolean().optional()
});

const confirmBookingSchema = z.object({
  bookingId: objectIdSchema,
  paymentMethod: z.enum(['online', 'wallet', 'mixed', 'cash']),
  paymentDetails: z.record(z.any()).optional()
});

const updateBookingStatusSchema = z.object({
  status: z.string().min(1, "Status is required")
});

const updateBookingPaymentSchema = z.object({
  paymentMethod: z.enum(['online', 'cash', 'wallet', 'mixed']),
  paymentStatus: z.enum(['pending', 'processing', 'paid', 'failed'])
});

const normalizeStatus = (status) => {
  if (!status) return 'pending';
  const clean = status.toLowerCase().replace(/[^a-z0-9]/g, '');
  const sMap = {
    'inprogress': 'workstarted',
    'started': 'workstarted',
    'assigned': 'accepted',
    'in_progress': 'workstarted',
    'on_the_way': 'ontheway',
    'searching_provider': 'searchingprovider'
  };
  return sMap[clean] || clean;
};

const ALLOWED_TRANSITIONS = {
  pending: {
    customer: ['cancelled'],
    provider: [],
    system: ['searchingprovider', 'offered', 'accepted', 'cancelled'],
    webhook: ['searchingprovider', 'accepted', 'cancelled'],
    admin: ['searchingprovider', 'offered', 'accepted', 'cancelled', 'rejected']
  },
  searchingprovider: {
    customer: ['cancelled'],
    provider: [],
    system: ['offered', 'accepted', 'pending', 'noshow', 'cancelled'],
    webhook: ['accepted', 'cancelled'],
    admin: ['offered', 'accepted', 'cancelled', 'rejected']
  },
  offered: {
    customer: ['cancelled'],
    provider: ['accepted', 'rejected'],
    system: ['searchingprovider', 'cancelled', 'noshow'],
    webhook: ['accepted', 'cancelled'],
    admin: ['accepted', 'cancelled', 'rejected']
  },
  accepted: {
    customer: ['cancelled'],
    provider: ['ontheway', 'arrived', 'workstarted', 'cancelled'],
    system: ['cancelled', 'noshow'],
    webhook: ['cancelled'],
    admin: ['ontheway', 'arrived', 'workstarted', 'cancelled', 'noshow']
  },
  ontheway: {
    customer: ['cancelled'],
    provider: ['arrived', 'workstarted', 'cancelled'],
    system: ['cancelled'],
    webhook: ['cancelled'],
    admin: ['arrived', 'workstarted', 'cancelled', 'noshow']
  },
  arrived: {
    customer: [],
    provider: ['workstarted', 'cancelled'],
    system: ['cancelled'],
    webhook: ['cancelled'],
    admin: ['workstarted', 'cancelled', 'noshow']
  },
  workstarted: {
    customer: [],
    provider: ['completed'],
    system: [],
    webhook: [],
    admin: ['completed', 'cancelled']
  },
  completed: { customer: [], provider: [], system: [], webhook: [], admin: [] },
  cancelled: { customer: [], provider: [], system: [], webhook: [], admin: [] },
  rejected: { customer: [], provider: [], system: [], webhook: [], admin: [] },
  noshow: { customer: [], provider: [], system: [], webhook: [], admin: [] }
};

const validateBookingTransition = (currentStatus, targetStatus, actor = 'system', options = {}) => {
  const curr = normalizeStatus(currentStatus);
  const tgt = normalizeStatus(targetStatus);

  if (curr === tgt) return true;

  const validActor = (actor || 'system').toLowerCase();
  const actorTransitions = ALLOWED_TRANSITIONS[curr]?.[validActor] || [];

  const fallbackTransitions = Object.values(ALLOWED_TRANSITIONS[curr] || {}).flat();
  const allowed = actorTransitions.length > 0 ? actorTransitions : fallbackTransitions;

  if (allowed.includes(tgt)) return true;

  if (validActor === 'admin' && options.forceAdminOverride) {
    return true;
  }

  return false;
};

module.exports = {
  createBookingSchema,
  confirmBookingSchema,
  updateBookingStatusSchema,
  updateBookingPaymentSchema,
  validateBookingTransition
};
