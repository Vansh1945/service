import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { register } from '../services/AuthService';
import {
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  Home,
  Building,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Shield,
  Zap,
  HeadphonesIcon,
  Sparkles,
  Award,
  Flag
} from 'lucide-react';
import AddressSelector from '../components/AddressSelector';

const CustomerRegistration = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: ''
    }
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { API, showToast } = useAuth();
  const navigate = useNavigate();

  const totalSteps = 3;

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

  // Helper function to handle backend validation errors
  const handleValidationErrors = (backendErrors) => {
    console.log("Backend errors received:", backendErrors);
    if (backendErrors && typeof backendErrors === 'object') {
      setErrors(backendErrors);

      // Show toast for the first error
      const errorValues = Object.values(backendErrors);
      const firstError = errorValues[0];

      console.log("First error to toast:", firstError);
      if (typeof firstError === 'string') {
        showToast(firstError, 'error');
      } else if (firstError && firstError.message) {
        showToast(firstError.message, 'error');
      } else {
        showToast('Validation failed. Please check form inputs.', 'error');
      }
    } else {
      showToast('Validation failed. Registration rejected.', 'error');
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await register(formData);
      const data = response.data;

      showToast(data.message || 'Registration successful! You can now login.');
      navigate('/login');

    } catch (err) {
      console.error('Registration error:', err);

      const errorData = err.response?.data;
      console.log('Error Data Structure:', errorData);

      const errorMsg = errorData?.message || err.message || 'Registration failed';

      if (errorData?.errors) {
        handleValidationErrors(errorData.errors);
      } else {
        showToast(typeof errorMsg === 'string' ? errorMsg : 'Registration failed with status code 400', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 3) {
      // Final submission
      await handleSubmit();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const ProgressIndicator = () => (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 transform ${step <= currentStep
                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
            >
              {step < currentStep ? (
                <CheckCircle className="w-6 h-6 animate-pulse" />
              ) : (
                <span className="font-bold">{step}</span>
              )}
              {step <= currentStep && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
              )}
            </div>
            {step < 3 && (
              <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ease-out ${step < currentStep
                    ? 'w-full bg-primary'
                    : 'w-0 bg-gray-300'
                    }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="text-sm text-secondary/60 font-medium tracking-wide">
          Step {currentStep} of {totalSteps}
        </p>
        <div className="mt-2 text-xs text-primary font-semibold">
          {currentStep === 1 && "Personal Information"}
          {currentStep === 2 && "Address Details"}
          {currentStep === 3 && "Account Security"}
        </div>
      </div>
    </div>
  );

  const BenefitsSection = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary/10 to-accent/10 rounded-full mb-4">
          <Sparkles className="w-4 h-4 text-primary mr-2" />
          <span className="text-sm font-semibold text-secondary">Trusted by 10,000+ Customers</span>
        </div>

        <h1 className="text-5xl lg:text-6xl font-bold text-secondary leading-tight">
          Join <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SafeVolt</span>
          <br />
          <span className="text-3xl lg:text-4xl font-semibold text-secondary/80">Solutions Today!</span>
        </h1>

        <p className="text-xl text-secondary/70 max-w-md mx-auto leading-relaxed">
          Experience premium electrical services with verified professionals.
          <span className="font-semibold text-primary"> Join thousands of satisfied customers!</span>
        </p>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="group bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-secondary">Lightning Fast</h3>
              <p className="text-sm text-secondary/60">Same-day service</p>
            </div>
          </div>
          <p className="text-sm text-secondary/70">Get your electrical issues resolved within hours, not days. Our rapid response team is always ready.</p>
        </div>

        <div className="group bg-gradient-to-br from-accent/5 to-accent/10 rounded-2xl p-6 border border-accent/20 hover:border-accent/40 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-secondary">Certified Experts</h3>
              <p className="text-sm text-secondary/60">Licensed professionals</p>
            </div>
          </div>
          <p className="text-sm text-secondary/70">All our electricians are fully licensed, insured, and background-checked for your peace of mind.</p>
        </div>

        <div className="group bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-secondary">Quality Guaranteed</h3>
              <p className="text-sm text-secondary/60">100% satisfaction</p>
            </div>
          </div>
          <p className="text-sm text-secondary/70">We stand behind our work with a comprehensive warranty and satisfaction guarantee.</p>
        </div>

        <div className="group bg-gradient-to-br from-accent/5 to-accent/10 rounded-2xl p-6 border border-accent/20 hover:border-accent/40 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <HeadphonesIcon className="w-6 h-6 text-accent" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-secondary">24/7 Support</h3>
              <p className="text-sm text-secondary/60">Always available</p>
            </div>
          </div>
          <p className="text-sm text-secondary/70">Round-the-clock customer support for emergencies and questions. We're here when you need us.</p>
        </div>
      </div>

    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 ">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-secondary mb-3">Personal Details</h2>
              <p className="text-secondary/70 text-lg">Let's start with your basic information</p>
              <div className="w-16 h-1 bg-gradient-to-r from-primary to-accent mx-auto mt-4 rounded-full"></div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label htmlFor="name" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
                  Full Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <User className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
                  </div>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary placeholder-secondary/50 hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium"
                    placeholder="Enter your full name"
                  />

                </div>
              </div>

              <div className="group">
                <label htmlFor="email" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Mail className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
                  </div>
                  <input
                    type="text"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary placeholder-secondary/50 hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium"
                    placeholder="your@email.com"
                  />

                </div>
              </div>

              <div className="group">
                <label htmlFor="phone" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
                  Phone Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Phone className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
                  </div>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary placeholder-secondary/50 hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium"
                    placeholder="+91 98765-32100"
                  />

                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 ">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-secondary mb-3">Address Information</h2>
              <p className="text-secondary/70 text-lg">Where can we reach you for services?</p>
              <div className="w-16 h-1 bg-gradient-to-r from-primary to-accent mx-auto mt-4 rounded-full"></div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label htmlFor="street" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
                  Street Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Home className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
                  </div>
                  <input
                    type="text"
                    id="street"
                    name="address.street"
                    value={formData.address.street}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary placeholder-secondary/50 hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium"
                    placeholder="123 Main Street, Apartment 4B"
                  />

                </div>
              </div>

              <div className="group">
                <AddressSelector
                  selectedState={formData.address.state}
                  selectedCity={formData.address.city}
                  onStateChange={(value) => handleChange({ target: { name: 'address.state', value } })}
                  onCityChange={(value) => handleChange({ target: { name: 'address.city', value } })}
                />
              </div>

              <div className="group">
                <label htmlFor="postalCode" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
                  Postal Code *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <MapPin className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
                  </div>
                  <input
                    type="text"
                    id="postalCode"
                    name="address.postalCode"
                    value={formData.address.postalCode}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary placeholder-secondary/50 hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium"
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 "> {/* Added mt-8 for top margin */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-secondary mb-3">Account Setup</h2>
              <p className="text-secondary/70 text-lg">Create a secure password for your account</p>
              <div className="w-16 h-1 bg-gradient-to-r from-primary to-accent mx-auto mt-4 rounded-full"></div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label htmlFor="password" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
                  Create Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Lock className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary placeholder-secondary/50 hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium"
                    placeholder="At least 8 characters"
                  />
                </div>
                <p className="text-xs text-secondary/60 mt-2">
                  Password should be at least 8 characters long and include letters and numbers
                </p>
              </div>

              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/20">
                <div className="flex items-center mb-3">
                  <Shield className="w-6 h-6 text-primary mr-3" />
                  <h3 className="font-bold text-secondary text-lg">Security & Privacy</h3>
                </div>
                <p className="text-sm text-secondary/70 leading-relaxed">
                  Your information is encrypted and secure. We never share your personal data with third parties.
                  All communications are protected with industry-standard security protocols.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-28 bg-background relative overflow-hidden">


      {/* Main Container - Desktop: Grid Layout, Mobile: Single Column */}
      <div className="w-full max-w-7xl relative z-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">

        {/* Benefits Section - Hidden on mobile, Left side on desktop */}
        <div className="hidden lg:block lg:sticky lg:top-8">
          <BenefitsSection />
        </div>

        {/* Form Container - Full width on mobile, Right side on desktop */}
        <div className="w-full max-w-lg mx-auto lg:mx-0">
          <div className="backdrop-blur-lg bg-transparent rounded-3xl shadow-2xl p-8 border border-primary/20 shadow-primary/10 hover:shadow-primary/20 transition-shadow duration-500 relative overflow-hidden">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-primary/5 rounded-3xl pointer-events-none"></div>
            <div className="relative z-10">
              <ProgressIndicator />

              {renderStepContent()}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 space-x-4">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center px-6 py-3 rounded-2xl border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all duration-300 font-semibold"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isLoading}
                  className={`flex items-center justify-center px-8 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none ${currentStep === 1 ? 'w-full' : 'flex-1'
                    } bg-accent hover:bg-accent/90 text-background shadow-lg hover:shadow-xl`}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-background mr-2"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      <span className="mr-2">
                        {currentStep === 4 && otpSent
                          ? 'Complete Registration'
                          : currentStep === 4
                            ? 'Send Verification Code'
                            : currentStep === 3
                              ? 'Review Information'
                              : 'Continue'
                        }
                      </span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              {/* Login Link */}
              <div className="text-center mt-6">
                <a
                  href="/login"
                  className="text-accent hover:text-accent/80 font-semibold transition-colors duration-300"
                >
                  Already have an account? Sign in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegistration;