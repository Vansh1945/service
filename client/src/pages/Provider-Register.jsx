import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaUser, FaEnvelope, FaPhone, FaLock,
  FaHome, FaMapMarkerAlt, FaCity,
  FaFileAlt, FaBriefcase, FaCheck,
  FaArrowLeft, FaSpinner
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

const ProviderRegistration = () => {
  const navigate = useNavigate();
  const { loginUser, showToast, API } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    otp: '',
    services: [],
    experience: 0,
    serviceArea: '',
    resume: null,
    address: {
      street: '',
      city: '',
      pincode: ''
    }
  });

  const [step, setStep] = useState(1); // 1: Basic info, 2: Additional details, 3: OTP verification + complete registration
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error when field is changed
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      if (file.type !== 'application/pdf') {
        setErrors(prev => ({
          ...prev,
          resume: 'Only PDF files are allowed'
        }));
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({
          ...prev,
          resume: 'File size should be less than 5MB'
        }));
        return;
      }

      setFormData(prev => ({
        ...prev,
        resume: file
      }));

      // Clear any previous errors
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors['resume'];
        return newErrors;
      });
    }
  };

  const validateBasicInfo = () => {
    const newErrors = {};

    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10,15}$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAdditionalInfo = () => {
    const newErrors = {};

    if (!formData.serviceArea) newErrors.serviceArea = 'Service area is required';
    if (!formData.resume) newErrors.resume = 'Resume is required';
    if (formData.services.length === 0) newErrors.services = 'At least one service must be selected';
    if (formData.experience < 0) newErrors.experience = 'Experience cannot be negative';
    if (!formData.address.street) newErrors['address.street'] = 'Street address is required';
    if (!formData.address.city) newErrors['address.city'] = 'City is required';
    if (!formData.address.pincode) newErrors['address.pincode'] = 'Postal code is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!validateBasicInfo()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/provider/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      setOtpSent(true);
      showToast('OTP sent to your email');
      setStep(2); // Move to additional details step
    } catch (error) {
      showToast(error.message, 'error');
      console.error('OTP sending error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate all information before submitting
    if (!validateBasicInfo() || !validateAdditionalInfo()) {
      setIsLoading(false);
      return;
    }

    if (!formData.otp || formData.otp.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' });
      setIsLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('otp', formData.otp);
      formDataToSend.append('resume', formData.resume);
      formDataToSend.append('services', formData.services.join(','));
      formDataToSend.append('experience', formData.experience);
      formDataToSend.append('serviceArea', formData.serviceArea);
      formDataToSend.append('address[street]', formData.address.street);
      formDataToSend.append('address[city]', formData.address.city);
      formDataToSend.append('address[pincode]', formData.address.pincode);

      const response = await fetch(`${API}/provider/register`, {
        method: 'POST',
        body: formDataToSend
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Show success message and redirect to home page
      showToast('Registration successful! Awaiting admin approval.');
      navigate('/');

    } catch (error) {
      showToast(error.message, 'error');
      console.error('Registration error:', error);

      if (error.message.includes('OTP not found') || error.message.includes('expired')) {
        setErrors({ otp: 'Invalid or expired OTP. Please request a new one.' });
        setFormData(prev => ({ ...prev, otp: '' }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold text-blue-900 mb-2"
          >
            {step === 1 && 'Provider Registration'}
            {step === 2 && 'Complete Your Profile'}
            {step === 3 && 'Verify & Complete'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-600"
          >
            {step === 1 && 'Create your provider account'}
            {step === 2 && 'Add your professional details'}
            {step === 3 && 'Verify OTP and complete registration'}
          </motion.p>
        </div>

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          {/* Progress Steps */}
          <div className="flex justify-between mb-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-blue-100 -translate-y-1/2 z-0"></div>
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= stepNumber ? 'bg-yellow-400 text-blue-900' : 'bg-blue-100 text-gray-500'}`}>
                  {step > stepNumber ? (
                    <FaCheck className="text-lg" />
                  ) : (
                    <span className="font-bold">{stepNumber}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={
            step === 1 ? handleSendOtp :
              step === 2 ? (e) => { e.preventDefault(); setStep(3); } :
                handleSubmit
          }>
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Name Field */}
                <div>
                  <label htmlFor="name" className="block text-gray-700 mb-2 font-medium">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                      <FaUser className="text-lg" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors.name ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-gray-700 mb-2 font-medium">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                      <FaEnvelope className="text-lg" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors.email ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                {/* Phone Field */}
                <div>
                  <label htmlFor="phone" className="block text-gray-700 mb-2 font-medium">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                      <FaPhone className="text-lg" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors.phone ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                      placeholder="+1 (123) 456-7890"
                      required
                    />
                  </div>
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-gray-700 mb-2 font-medium">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                      <FaLock className="text-lg" />
                    </div>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors.password ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                      placeholder="Create a password"
                      minLength="6"
                      required
                    />
                  </div>
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-gray-700 mb-2 font-medium">Confirm Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                      <FaLock className="text-lg" />
                    </div>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors.confirmPassword ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                      placeholder="Confirm your password"
                      minLength="6"
                      required
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Additional Details */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Service Area */}
                <div>
                  <label htmlFor="serviceArea" className="block text-gray-700 mb-2">Service Area (City/Pincode)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                      <FaMapMarkerAlt className="text-lg" />
                    </div>
                    <input
                      type="text"
                      id="serviceArea"
                      name="serviceArea"
                      value={formData.serviceArea}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors.serviceArea ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                      placeholder="City or Pincode where you provide services"
                      required
                    />
                  </div>
                  {errors.serviceArea && <p className="text-red-500 text-sm mt-1">{errors.serviceArea}</p>}
                </div>

                {/* Resume Upload */}
                <div>
                  <label htmlFor="resume" className="block text-gray-700 mb-2">Upload Resume (PDF)</label>
                  <div className="relative">
                    <input
                      type="file"
                      id="resume"
                      name="resume"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf"
                      required
                    />
                    <div className={`flex items-center justify-between px-4 py-3 bg-blue-50 rounded-xl border-2 ${errors.resume ? 'border-red-300' : 'border-blue-100'}`}>
                      <span className="text-gray-600 truncate mr-2">
                        {formData.resume ? formData.resume.name : 'No file selected'}
                      </span>
                      <FaFileAlt className="text-blue-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Upload your professional resume in PDF format (max 5MB)</p>
                  {errors.resume && <p className="text-red-500 text-sm mt-1">{errors.resume}</p>}
                </div>

                {/* Years of Experience */}
                <div>
                  <label htmlFor="experience" className="block text-gray-700 mb-2">Years of Experience</label>
                  <input
                    type="number"
                    id="experience"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    min="0"
                    max="50"
                    className={`w-full px-4 py-3 rounded-xl border-2 ${errors.experience ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                    placeholder="0"
                    required
                  />
                  {errors.experience && <p className="text-red-500 text-sm mt-1">{errors.experience}</p>}
                </div>

                {/* Service Categories */}
                <div>
                  <label className="block text-gray-700 mb-2">Service Categories</label>
                  {errors.services && <p className="text-red-500 text-sm mb-2">{errors.services}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    {['Electrical', 'AC', 'Appliance Repair', 'Other'].map(service => (
                      <div key={service} className="flex items-center">
                        <input
                          type="checkbox"
                          id={service}
                          name="services"
                          value={service}
                          checked={formData.services.includes(service)}
                          onChange={(e) => {
                            const { value, checked } = e.target;
                            setFormData(prev => ({
                              ...prev,
                              services: checked
                                ? [...prev.services, value]
                                : prev.services.filter(s => s !== value)
                            }));

                            if (checked && errors.services) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors['services'];
                                return newErrors;
                              });
                            }
                          }}
                          className="h-4 w-4 text-yellow-500 focus:ring-yellow-400 border-blue-200 rounded"
                        />
                        <label htmlFor={service} className="ml-2 text-sm text-gray-700">
                          {service}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Address Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <FaMapMarkerAlt className="mr-2 text-blue-500" />
                    Address Information
                  </h3>

                  {/* Street Address */}
                  <div className="mb-4">
                    <label htmlFor="street" className="block text-gray-700 mb-2">Street Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                        <FaHome className="text-lg" />
                      </div>
                      <input
                        type="text"
                        id="street"
                        name="address.street"
                        value={formData.address.street}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors['address.street'] ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                        placeholder="123 Main St"
                        required
                      />
                    </div>
                    {errors['address.street'] && <p className="text-red-500 text-sm mt-1">{errors['address.street']}</p>}
                  </div>

                  {/* City */}
                  <div className="mb-4">
                    <label htmlFor="city" className="block text-gray-700 mb-2">City</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                        <FaCity className="text-lg" />
                      </div>
                      <input
                        type="text"
                        id="city"
                        name="address.city"
                        value={formData.address.city}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors['address.city'] ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                        placeholder="Your city"
                        required
                      />
                    </div>
                    {errors['address.city'] && <p className="text-red-500 text-sm mt-1">{errors['address.city']}</p>}
                  </div>

                  {/* Pincode */}
                  <div>
                    <label htmlFor="pincode" className="block text-gray-700 mb-2">Postal/Zip Code</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400">
                        <FaMapMarkerAlt className="text-lg" />
                      </div>
                      <input
                        type="text"
                        id="pincode"
                        name="address.pincode"
                        value={formData.address.pincode}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 ${errors['address.pincode'] ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all`}
                        placeholder="12345"
                        required
                      />
                    </div>
                    {errors['address.pincode'] && <p className="text-red-500 text-sm mt-1">{errors['address.pincode']}</p>}
                  </div>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center mx-auto"
                  >
                    <FaArrowLeft className="mr-1" /> Back to basic info
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: OTP Verification and Completion */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="text-center mb-6">
                  <p className="text-gray-700 mb-4">
                    We've sent a 6-digit verification code to<br />
                    <span className="font-semibold">{formData.email}</span>
                  </p>
                  {otpSent && (
                    <p className="text-green-500 mb-4 flex items-center justify-center">
                      <FaCheck className="mr-2" /> OTP sent successfully!
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="otp" className="block text-gray-700 mb-2 font-medium">Enter OTP</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="otp"
                      name="otp"
                      value={formData.otp}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 rounded-xl border-2 ${errors.otp ? 'border-red-300' : 'border-blue-100'} focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all text-center tracking-widest`}
                      placeholder="123456"
                      maxLength="6"
                      required
                    />
                  </div>
                  {errors.otp && <p className="text-red-500 text-sm mt-1">{errors.otp}</p>}
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center mx-auto"
                  >
                    <FaArrowLeft className="mr-1" /> Back to profile details
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center mx-auto mt-2"
                  >
                    Didn't receive code? Resend OTP
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading}
              className={`w-full mt-6 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg ${isLoading ? 'opacity-75' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2" />
                  {step === 1 ? 'Sending OTP...' : step === 2 ? 'Continue...' : 'Complete Registration'}
                </span>
              ) : (
                <span>
                  {step === 1 ? 'Send OTP' : step === 2 ? 'Continue' : 'Complete Registration'}
                </span>
              )}
            </motion.button>
          </form>

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ProviderRegistration;