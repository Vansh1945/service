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

const completeProfileSchema = z.object({
  services: z.union([z.string(), z.array(z.string())]).optional(),
  experience: z.union([z.string(), z.number()]).optional(),
  serviceArea: z.string().min(1, "Service area is required"),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().regex(/^\d{6}$/, "Postal code must be 6 digits"),
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
  addressLine: z.string().optional().or(z.literal(''))
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
  lat: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  lng: z.union([z.number(), z.string()]).nullable().optional().transform(val => (val === null || val === undefined || val === '') ? null : parseFloat(val)),
  houseNumber: z.string().optional().or(z.literal('')),
  road: z.string().optional().or(z.literal('')),
  landmark: z.string().optional().or(z.literal('')),
  area: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  formattedAddress: z.string().optional().or(z.literal('')),
  addressLine: z.string().optional().or(z.literal(''))
});

module.exports = {
  initiateRegistrationSchema,
  completeRegistrationSchema,
  loginForCompletionSchema,
  completeProfileSchema,
  updateProviderProfileSchema
};
