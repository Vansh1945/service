const { z } = require('zod');
const { objectIdSchema } = require('./common.validation');

const passwordSchema = z.string()
  .min(6, "Password must be at least 6 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const initiateRegistrationSchema = z.object({
  email: z.string().email("Please enter a valid email address")
});

const completeRegistrationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  otp: z.string().min(1, "OTP is required"),
  password: passwordSchema,
  name: z.string().min(1, "Name is required"),
  phone: z.string().regex(/^\d{10}$/, "Please enter a valid 10-digit phone number"),
  dateOfBirth: z.string().refine((val) => {
    const dob = new Date(val);
    if (isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 18;
  }, {
    message: "You must be at least 18 years old to register"
  })
});

const loginForCompletionSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

const parseJsonOrObject = (val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val;
};

const addressValidationSchema = z.object({
  houseNumber: z.string().min(1, "House Number is required"),
  street: z.string().min(1, "Street is required"),
  landmark: z.string().min(1, "Landmark is required"),
  villageCity: z.string().min(1, "Village/City is required"),
  district: z.string().min(1, "District is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits")
});

const completeProfileSchema = z.object({
  services: z.union([z.string(), z.array(z.string())]).optional(),
  experience: z.union([z.string(), z.number()]).optional(),
  serviceArea: z.string().min(1, "Service area is required"),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  accountNo: z.string().regex(/^[0-9]{9,18}$/, "Please enter a valid account number (9-18 digits)"),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please enter a valid IFSC code"),
  lat: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  lng: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  houseNumber: z.string().optional().or(z.literal('')),
  road: z.string().optional().or(z.literal('')),
  landmark: z.string().optional().or(z.literal('')),
  area: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  formattedAddress: z.string().optional().or(z.literal('')),
  addressLine: z.string().optional().or(z.literal('')),
  addressSame: z.preprocess(val => val === 'true' || val === true, z.boolean()),
  currentAddress: z.preprocess(parseJsonOrObject, addressValidationSchema),
  permanentAddress: z.preprocess(parseJsonOrObject, addressValidationSchema),
  selfDeclaration: z.preprocess(val => val === 'true' || val === true, z.boolean().refine(v => v === true, 'Self declaration must be accepted')),
  agreementAccepted: z.preprocess(val => val === 'true' || val === true, z.boolean().refine(v => v === true, 'Agreement must be accepted')),
  termsAccepted: z.preprocess(val => val === 'true' || val === true, z.boolean().refine(v => v === true, 'Terms must be accepted')),
  privacyAccepted: z.preprocess(val => val === 'true' || val === true, z.boolean().refine(v => v === true, 'Privacy policy must be accepted')),
  signedName: z.string().min(1, "Signature name is required"),
  signatureMethod: z.enum(['draw', 'type']),
  signatureImage: z.string().min(1, "Digital signature is required")
});

const updateProviderProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, "Please enter a valid 10-digit phone number").optional(),
  dateOfBirth: z.string().refine((val) => {
    const dob = new Date(val);
    if (isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 18;
  }, {
    message: "You must be at least 18 years old"
  }).optional(),
  services: z.union([z.string(), z.array(z.string())]).optional(),
  experience: z.union([z.string(), z.number()]).optional(),
  serviceArea: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().regex(/^\d{6}$/, "Postal code must be 6 digits").optional(),
  country: z.string().optional(),
  accountNo: z.string().regex(/^[0-9]{9,18}$/, "Please enter a valid account number (9-18 digits)").optional(),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please enter a valid IFSC code").optional(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  updateType: z.string().optional(),
  isOnline: z.union([z.boolean(), z.string()]).optional().transform(val => typeof val === 'string' ? val === 'true' : val),
  availabilityStatus: z.enum(['online', 'busy', 'break', 'leave']).optional(),
  trustedProvider: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  instantBookingEnabled: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  emergencyBookingEnabled: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  scheduledBookingEnabled: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  providerReliabilityScore: z.preprocess(val => typeof val === 'string' ? parseFloat(val) : val, z.number().min(0).max(100)).optional(),
  lat: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  lng: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  houseNumber: z.string().optional().or(z.literal('')),
  road: z.string().optional().or(z.literal('')),
  landmark: z.string().optional().or(z.literal('')),
  area: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  formattedAddress: z.string().optional().or(z.literal('')),
  addressLine: z.string().optional().or(z.literal('')),
  notificationPreferences: z.union([z.string(), z.record(z.any())]).optional(),
  addressSame: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  currentAddress: z.preprocess(parseJsonOrObject, addressValidationSchema.partial()).optional(),
  permanentAddress: z.preprocess(parseJsonOrObject, addressValidationSchema.partial()).optional(),
  selfDeclaration: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  agreementAccepted: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  termsAccepted: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  privacyAccepted: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  signedName: z.string().optional(),
  signatureMethod: z.enum(['draw', 'type']).optional(),
  signatureImage: z.string().optional()
});

module.exports = {
  initiateRegistrationSchema,
  completeRegistrationSchema,
  loginForCompletionSchema,
  completeProfileSchema,
  updateProviderProfileSchema
};
