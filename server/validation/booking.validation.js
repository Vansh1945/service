const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

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

const validateBookingTransition = (currentStatus, targetStatus) => {
  const normalize = (status) => {
    if (!status) return 'Pending';
    const statusMap = {
      'pending': 'Pending',
      'searchingprovider': 'SearchingProvider',
      'offered': 'Offered',
      'assigned': 'Assigned',
      'accepted': 'Accepted',
      'ontheway': 'OnTheWay',
      'arrived': 'Arrived',
      'started': 'Started',
      'inprogress': 'InProgress',
      'in-progress': 'InProgress',
      'in_progress': 'InProgress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'rejected': 'Rejected',
      'expired': 'Expired',
      'reassigned': 'Reassigned',
      'refunded': 'Refunded',
      'waiting admin assignment': 'Reassigned',
      'confirmed': 'Accepted',
      'scheduled': 'Accepted',
      'no-show': 'Cancelled'
    };
    const cleanKey = status.toLowerCase().replace(/[^a-z]/g, '');
    return statusMap[cleanKey] || statusMap[status.toLowerCase()] || status;
  };

  const curr = normalize(currentStatus);
  const tgt = normalize(targetStatus);

  if (curr === tgt) return true;

  const transitions = {
    'Pending': ['SearchingProvider', 'Cancelled', 'Assigned', 'Accepted'],
    'SearchingProvider': ['Offered', 'Cancelled', 'Expired', 'Reassigned', 'Assigned', 'Accepted'],
    'Offered': ['Assigned', 'Accepted', 'Rejected', 'Expired', 'Reassigned', 'Cancelled'],
    'Assigned': ['Accepted', 'Rejected', 'Cancelled', 'Reassigned'],
    'Accepted': ['OnTheWay', 'Cancelled', 'Started', 'InProgress', 'Completed'],
    'OnTheWay': ['Arrived', 'Cancelled', 'Started'],
    'Arrived': ['Started', 'Cancelled'],
    'Started': ['InProgress', 'Completed'],
    'InProgress': ['Completed'],
    'Completed': ['Refunded'],
    'Cancelled': ['Refunded'],
    'Rejected': ['Reassigned', 'SearchingProvider', 'Cancelled', 'Pending'],
    'Expired': ['Reassigned', 'SearchingProvider', 'Cancelled', 'Pending'],
    'Reassigned': ['SearchingProvider', 'Offered', 'Assigned', 'Cancelled', 'Pending'],
    'Refunded': []
  };

  const allowed = transitions[curr] || [];
  return allowed.includes(tgt);
};

module.exports = {
  createBookingSchema,
  confirmBookingSchema,
  updateBookingStatusSchema,
  updateBookingPaymentSchema,
  validateBookingTransition
};
