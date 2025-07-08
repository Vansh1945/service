import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaUser, FaEnvelope, FaPhone, FaLock, 
  FaHome, FaMapMarkerAlt, FaCity, 
  FaFileAlt, FaBriefcase, FaCheck, 
  FaArrowLeft, FaSpinner
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';

const ProviderRegistration = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'provider',
    address: {
      street: '',
      city: '',
      pincode: ''
    },
    resume: null,
    services: [],
    experience: 0,
    serviceArea: '',
    otp: ''
  });

  const [step, setStep] = useState(1); // 1: Basic info, 2: OTP verification, 3: Additional details
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

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
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        resume: file
      }));
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validate basic info
    if (!formData.name || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      alert('Please fill all required fields');
      setIsLoading(false);
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Simulate sending OTP (in a real app, call your API)
    console.log('Sending OTP to:', formData.email);
    setTimeout(() => {
      setOtpSent(true);
      setIsLoading(false);
      setStep(2); // Move to OTP verification step
    }, 1500);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate OTP verification (in a real app, call your API)
    console.log('Verifying OTP:', formData.otp);
    setTimeout(() => {
      setIsLoading(false);
      setStep(3); // Move to additional details step
    }, 1500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validate additional details
    if (!formData.serviceArea || !formData.resume || formData.experience < 0 || formData.services.length === 0) {
      alert('Please fill all required fields');
      setIsLoading(false);
      return;
    }

    // Simulate registration (in a real app, call your API)
    console.log('Registering provider:', formData);
    setTimeout(() => {
      setIsLoading(false);
      navigate('/login');
    }, 2000);
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
            {step === 2 && 'Verify Your Email'}
            {step === 3 && 'Complete Your Profile'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-600"
          >
            {step === 1 && 'Create your provider account'}
            {step === 2 && `We sent a code to ${formData.email}`}
            {step === 3 && 'Add your professional details'}
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
            step === 2 ? handleVerifyOtp : 
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                      placeholder="John Doe"
                      required
                    />
                  </div>
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                      placeholder="+1 (123) 456-7890"
                      required
                    />
                  </div>
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                      placeholder="Create a password"
                      required
                      minLength="6"
                    />
                  </div>
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                      placeholder="Confirm your password"
                      required
                      minLength="6"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
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
                      className="w-full px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all text-center tracking-widest"
                      placeholder="123456"
                      maxLength="6"
                      required
                    />
                  </div>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center mx-auto"
                  >
                    <FaArrowLeft className="mr-1" /> Back to previous step
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Additional Details */}
            {step === 3 && (
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                      placeholder="City or Pincode where you provide services"
                      required
                    />
                  </div>
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
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-xl border-2 border-blue-100">
                      <span className="text-gray-600 truncate mr-2">
                        {formData.resume ? formData.resume.name : 'No file selected'}
                      </span>
                      <FaFileAlt className="text-blue-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Upload your professional resume in PDF format</p>
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                    placeholder="0"
                    required
                  />
                </div>

                {/* Service Categories */}
                <div>
                  <label className="block text-gray-700 mb-2">Service Categories</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Painting', 'Cleaning'].map(service => (
                      <div key={service} className="flex items-center">
                        <input
                          type="checkbox"
                          id={service}
                          name="services"
                          value={service.toLowerCase()}
                          onChange={(e) => {
                            const { value, checked } = e.target;
                            setFormData(prev => ({
                              ...prev,
                              services: checked 
                                ? [...prev.services, value] 
                                : prev.services.filter(s => s !== value)
                            }));
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
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                        placeholder="123 Main St"
                        required
                      />
                    </div>
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
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                        placeholder="Your city"
                        required
                      />
                    </div>
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
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all"
                        placeholder="12345"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center mx-auto"
                  >
                    <FaArrowLeft className="mr-1" /> Back to OTP verification
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
                  {step === 1 ? 'Sending OTP...' : step === 2 ? 'Verifying...' : 'Registering...'}
                </span>
              ) : (
                <span>
                  {step === 1 ? 'Send OTP' : step === 2 ? 'Verify OTP' : 'Complete Registration'}
                </span>
              )}
            </motion.button>
          </form>

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/provider-login" className="text-blue-600 hover:text-blue-800 font-medium">
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