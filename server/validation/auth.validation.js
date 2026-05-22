const { z } = require('zod');

const passwordSchema = z.string()
  .min(6, "Password must be at least 6 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required")
});

const addressSchema = z.object({
  street: z.string().min(5, "Street address must be at least 5 characters long").max(100, "Street address must not exceed 100 characters"),
  city: z.string()
    .min(2, "City must be at least 2 characters long")
    .max(50, "City must not exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "City can only contain letters and spaces"),
  postalCode: z.string()
    .regex(/^\d{6}$/, "Postal code must be a valid 6-digit number")
    .optional()
    .or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
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

const registerSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters long")
    .max(50, "Name must not exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: z.string().email("Please provide a valid email address"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please provide a valid 10-digit Indian mobile number"),
  password: passwordSchema,
  address: addressSchema.optional(),
  profilePicUrl: z.string().optional()
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email address")
});

const verifyOTPSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  otp: z.string().min(1, "OTP is required")
});

const resetPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  otp: z.string().min(1, "OTP is required"),
  newPassword: passwordSchema
});

const resendOTPSchema = z.object({
  email: z.string().email("Please provide a valid email address")
});

module.exports = {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  resendOTPSchema
};
