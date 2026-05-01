import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, Lock, MapPin, Home, Building,
  ArrowLeft, CheckCircle, Shield, Zap,
  Sparkles, Award, Users,
  DollarSign, Calendar, FileText, Camera, CreditCard,
  Briefcase, RotateCcw, AlertCircle, ChevronDown, X, Info
} from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-toastify/dist/ReactToastify.css';
import useCategory from '../../hooks/useCategory';
import * as SystemService from '../../services/SystemService';
import * as ProviderService from '../../services/ProviderService';

// ─── Static sub-components (defined OUTSIDE the main component to avoid remount) ─

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-secondary bg-background placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-secondary uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const Section = ({ title, icon: Icon, accent = false, tooltip, children }) => (
  <div className={`rounded-xl border p-5 space-y-4 ${accent ? 'border-accent/20 bg-accent/5' : 'border-gray-200 bg-background'}`}>
    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
      {Icon && <Icon className={`w-4 h-4 ${accent ? 'text-accent' : 'text-primary'}`} />}
      <span className="text-sm font-bold text-secondary">{title}</span>
      {tooltip && (
        <div className="relative group ml-auto cursor-pointer">
          <Info className="w-3.5 h-3.5 text-gray-400 hover:text-accent transition-colors" />
          <div className="absolute right-0 top-5 z-50 hidden group-hover:block w-64 bg-secondary text-background text-xs rounded-lg px-3 py-2.5 shadow-lg leading-relaxed">
            <div className="absolute -top-1.5 right-1 w-3 h-3 bg-secondary rotate-45 rounded-sm" />
            {tooltip}
          </div>
        </div>
      )}
    </div>
    {children}
  </div>
);

const FileField = ({ label, fieldName, accept, placeholder, icon: Icon, value, onChange }) => (
  <Field label={label}>
    <div className="relative">
      <input
        type="file"
        id={fieldName}
        name={fieldName}
        onChange={onChange}
        accept={accept}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-background hover:border-primary hover:bg-primary/5 transition-colors">
        <span className={`text-sm truncate ${value ? 'text-secondary font-medium' : 'text-gray-400'}`}>
          {value ? value.name : placeholder}
        </span>
        <Icon className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
      </div>
    </div>
  </Field>
);

// ─── Step progress labels ─
const STEP_LABELS = ['Email', 'Details', 'Login', 'Profile'];
const STEP_ICONS = [Mail, User, Lock, Briefcase];

// ─── Main Component ──────────────────────────────────────────────────────────

const ProviderRegistration = () => {
  const navigate = useNavigate();
  const { API } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    services: '',
    experience: '',
    serviceArea: '',
    resume: null,
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    bankName: '',
    accountName: '',
    accountNo: '',
    ifsc: '',
    passbookImage: null,
    profilePic: null,
  });

  const [step, setStep] = useState(1);
  const [otpSentTime, setOtpSentTime] = useState(null);
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [otpExpiryTime, setOtpExpiryTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const { categories: providerServices, loading: providerServicesLoading, error: providerServicesError } = useCategory();
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // ── OTP countdown timer ──
  useEffect(() => {
    let timer;
    if (otpSentTime) {
      timer = setInterval(() => {
        const secondsSinceSent = Math.round((Date.now() - otpSentTime) / 1000);
        if (secondsSinceSent < 60) {
          setResendCountdown(60 - secondsSinceSent);
          setCanResendOtp(false);
        } else {
          setCanResendOtp(true);
        }
        if (secondsSinceSent >= 300) {
          setOtpExpiryTime(null);
          clearInterval(timer);
        } else if (otpExpiryTime === null) {
          setOtpExpiryTime(new Date(otpSentTime + 300000));
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpSentTime, otpExpiryTime]);


  // ── Handlers ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.files[0] }));
  };

  const handleServiceChange = (service) => {
    const serviceId = service.value || service._id;
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) return prev.filter((id) => id !== serviceId);
      if (prev.length < 3) return [...prev, serviceId];
      return prev;
    });
  };

  const handleInitiateRegistration = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await ProviderService.registerInitiate({ email: formData.email });
        const data = response.data;
        if (data.profileComplete) {
          setStep(3);
          resolve(data.message || 'Incomplete profile found. Please login to complete.');
        } else {
          const sentTime = Date.now();
          setOtpSentTime(sentTime);
          setOtpExpiryTime(new Date(sentTime + 300000));
          setCanResendOtp(false);
          setResendCountdown(60);
          setStep(2);
          resolve('OTP sent successfully! Check your email.');
        }
      } catch (err) {
        reject(err.response?.data?.message || err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
    toast.promise(promise, {
      pending: 'Sending OTP...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await ProviderService.registerComplete({
          email: formData.email,
          otp: formData.otp,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
        });
        const data = response.data;
        
        // Store the token in the correct 'token' key for axiosInstance to pick up
        localStorage.setItem('token', data.token);
        
        setStep(3);
        resolve('Registration successful! Please login to complete your profile.');
      } catch (err) {
        reject(err.response?.data?.message || err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
    toast.promise(promise, {
      pending: 'Registering...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await ProviderService.loginForCompletion({ 
          email: formData.email, 
          password: formData.password 
        });
        const data = response.data;
        
        // Store the token in the correct 'token' key
        localStorage.setItem('token', data.token);
        
        setStep(4);
        resolve('Login successful! Please complete your profile.');
      } catch (err) {
        reject(err.response?.data?.message || err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
    toast.promise(promise, {
      pending: 'Logging in...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };

const handleCompleteProfile = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  const formDataWithServices = { ...formData, services: selectedServices };
  const promise = new Promise(async (resolve, reject) => {
    try {
      const fd = new FormData();
      Object.entries(formDataWithServices).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (['resume', 'passbookImage', 'profilePic'].includes(key)) {
            if (value) fd.append(key, value);
          } else if (key === 'services') {
            value.forEach((s) => fd.append('services', s));
          } else {
            fd.append(key, value);
          }
        }
      });
      await ProviderService.completeProfile(fd);
      resolve('Profile completed successfully! Your account is pending approval.');
      navigate('/');
    } catch (err) {
      reject(err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  });
  toast.promise(promise, {
    pending: 'Completing profile...',
    success: { render({ data }) { return data; }, autoClose: 3000 },
    error: { render({ data }) { return data; }, autoClose: 3000 },
  });
};

const handleResendOTP = async () => {
  if (!canResendOtp) return;
  setIsSubmitting(true);
  const promise = new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(`${API}/provider/register/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend OTP');
      if (data.profileComplete) {
        setStep(3);
        resolve(data.message || 'Incomplete profile found. Please login to complete.');
      } else {
        const sentTime = Date.now();
        setOtpSentTime(sentTime);
        setOtpExpiryTime(new Date(sentTime + 300000));
        setCanResendOtp(false);
        setResendCountdown(60);
        resolve('New OTP sent successfully!');
      }
    } catch (err) {
      reject(err.message);
    } finally {
      setIsSubmitting(false);
    }
  });
  toast.promise(promise, {
    pending: 'Resending OTP...',
    success: { render({ data }) { return data; }, autoClose: 3000 },
    error: { render({ data }) { return data; }, autoClose: 3000 },
  });
};

const formatExpiry = (date) =>
  date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

// ── Step content ──────────────────────────────────────────────────────────

const renderStepContent = () => {
  switch (step) {

    // ── Step 1 : Email ──
    case 1:
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-secondary">Start Your Journey</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your email address to begin registration</p>
          </div>

          <Field label="Email Address *">
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={inputCls}
            />
          </Field>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 items-start">
            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-secondary/80">
              <p className="font-semibold text-secondary mb-0.5">Quick & Secure Registration</p>
              <p>We'll send a verification code to your email to get started.</p>
            </div>
          </div>
        </div>
      );

    // ── Step 2 : OTP + Personal Details ──
    case 2:
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-secondary">Verify & Fill Details</h2>
            <p className="text-sm text-gray-500 mt-1">
              Code sent to <span className="font-semibold text-primary">{formData.email}</span>
            </p>
          </div>

          {/* OTP Banner */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-secondary/80 flex-1">
              <p>Verification code sent to your email.</p>
              <p className="mt-1">
                {otpExpiryTime ? (
                  <>
                    Expires at{' '}
                    <span className="font-medium text-secondary">{formatExpiry(otpExpiryTime)}</span>
                    {' • '}
                    {canResendOtp ? (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={isSubmitting}
                        className="text-accent font-semibold hover:underline"
                      >
                        Resend now
                      </button>
                    ) : (
                      <span className="text-gray-400">Resend in {resendCountdown}s</span>
                    )}
                  </>
                ) : (
                  <span className="text-red-500 font-medium">Code expired — resend to continue</span>
                )}
              </p>
            </div>
          </div>

          {/* OTP Input */}
          <Field label="Enter 6-Digit Code *">
            <div className="flex gap-2">
              <input
                type="text"
                id="otp"
                name="otp"
                value={formData.otp}
                onChange={handleChange}
                maxLength="6"
                placeholder="123456"
                className={`${inputCls} text-center tracking-[0.5em] text-xl font-bold flex-1`}
              />
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={!canResendOtp || isSubmitting}
                className={`px-4 rounded-lg border transition-all flex items-center justify-center ${canResendOtp
                  ? 'bg-primary border-primary text-background hover:bg-primary/90'
                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </Field>

          {/* Personal Info Section */}
          <Section title="Personal Information" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name *">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className={inputCls}
                />
              </Field>
              <Field label="Phone Number *">
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Date of Birth *">
              <DatePicker
                id="dateOfBirth"
                name="dateOfBirth"
                selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                onChange={(date) => {
                  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                    .toISOString()
                    .split('T')[0];
                  setFormData((prev) => ({ ...prev, dateOfBirth: localDate }));
                }}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select Date of Birth"
                showYearDropdown
                scrollableYearDropdown
                yearDropdownItemNumber={100}
                maxDate={new Date()}
                wrapperClassName="w-full"
                className={inputCls}
              />
            </Field>
          </Section>

          {/* Password Section */}
          <Section title="Account Security" icon={Lock}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Create Password *">
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  className={inputCls}
                />
              </Field>
              <Field label="Confirm Password *">
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>
        </div>
      );

    // ── Step 3 : Login ──
    case 3:
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-secondary">Login to Continue</h2>
            <p className="text-sm text-gray-500 mt-1">Access your account to complete your profile</p>
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex gap-3 items-start">
            <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-secondary/80">Your registration was saved. Log in to finish setting up your provider profile.</p>
          </div>

          <Field label="Email Address *">
            <input
              type="email"
              id="email-login"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={inputCls}
            />
          </Field>

          <Field label="Password *">
            <input
              type="password"
              id="password-login"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={inputCls}
            />
          </Field>
        </div>
      );

    // ── Step 4 : Professional Profile ──
    case 4:
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-secondary">Complete Your Profile</h2>
            <p className="text-sm text-gray-500 mt-1">Add professional details to start receiving bookings</p>
          </div>

          {/* Professional Info */}
          <Section title="Professional Information" icon={Briefcase}>
            <Field label="Service Categories (Select 1–3) *">
              {providerServicesLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  Loading categories...
                </div>
              ) : providerServicesError ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Failed to load categories. Please refresh.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedServices.includes(val) && selectedServices.length < 3) {
                          handleServiceChange({ _id: val });
                        }
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className={`${inputCls} appearance-none pr-10 cursor-pointer`}
                    >
                      <option value="" disabled>
                        {selectedServices.length >= 3 ? 'Max 3 selected' : 'Select a category...'}
                      </option>
                      {providerServices.map((svc) => (
                        <option key={svc.value} value={svc.value} disabled={selectedServices.includes(svc.value)}>
                          {svc.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  {selectedServices.length > 0 && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {selectedServices.map((id) => {
                          const svc = providerServices.find((s) => s.value === id) || { label: 'Unknown' };
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/30 rounded-full text-xs font-semibold"
                            >
                              {svc.label}
                              <button
                                type="button"
                                onClick={() => handleServiceChange({ value: id })}
                                className="hover:text-primary/60 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-medium">
                          {selectedServices.length}/3 selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedServices([])}
                          className="text-accent font-semibold hover:underline"
                        >
                          Clear all
                        </button>
                      </div>
                    </>
                  )}

                  {providerServices.length === 0 && (
                    <p className="text-sm text-gray-400 py-2">No categories available.</p>
                  )}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Years of Experience *">
                <input
                  type="number"
                  id="experience"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  placeholder="e.g., 5"
                  min="0"
                  className={inputCls}
                />
              </Field>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wide">Service Area *</label>
                  <div className="relative group cursor-pointer">
                    <Info className="w-3.5 h-3.5 text-gray-400 hover:text-accent transition-colors" />
                    <div className="absolute left-0 top-5 z-50 hidden group-hover:block w-60 bg-secondary text-background text-xs rounded-lg px-3 py-2.5 shadow-lg leading-relaxed">
                      <div className="absolute -top-1.5 left-1 w-3 h-3 bg-secondary rotate-45 rounded-sm" />
                      Enter the <strong>single city or area</strong> where you will provide services. Example: <em>Mumbai</em> or <em>Andheri West</em>. You can update this later from your profile.
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  id="serviceArea"
                  name="serviceArea"
                  value={formData.serviceArea}
                  onChange={handleChange}
                  placeholder="Enter your city (e.g., Mumbai)"
                  className={inputCls}
                />
                {formData.serviceArea && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">📍 {formData.serviceArea}</p>
                )}
              </div>
            </div>
          </Section>

          {/* Address Details */}
          <Section title="Address Details" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Street Address *">
                <input
                  type="text"
                  id="street"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  placeholder="123 Main Street"
                  className={inputCls}
                />
              </Field>
              <Field label="Postal Code *">
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="400001"
                  className={inputCls}
                />
              </Field>
            </div>
            <AddressSelector
              selectedState={formData.state}
              selectedCity={formData.city}
              onStateChange={(value) => handleChange({ target: { name: 'state', value } })}
              onCityChange={(value) => {
                handleChange({ target: { name: 'city', value } });
                handleChange({ target: { name: 'serviceArea', value } });
              }}
            />
          </Section>

          {/* Bank Details */}
          <Section
            title="Bank Details"
            icon={CreditCard}
            accent
            tooltip="Your bank details are used for secure payment transfers after each completed job. All information is encrypted and never shared. Provide the account where you want to receive your earnings."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Account Number *">
                <input
                  type="text"
                  id="accountNo"
                  name="accountNo"
                  value={formData.accountNo}
                  onChange={handleChange}
                  placeholder="1234567890"
                  className={inputCls}
                />
              </Field>
              <Field label="IFSC Code *">
                <input
                  type="text"
                  id="ifsc"
                  name="ifsc"
                  value={formData.ifsc}
                  onChange={handleChange}
                  placeholder="ABCD0123456"
                  className={inputCls}
                />
              </Field>
              <Field label="Bank Name">
                <input
                  type="text"
                  id="bankName"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="e.g., State Bank of India"
                  className={inputCls}
                />
              </Field>
              <Field label="Account Holder Name">
                <input
                  type="text"
                  id="accountName"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Name as per bank records"
                  className={inputCls}
                />
              </Field>
            </div>
            <FileField
              label="Bank Passbook Image *"
              fieldName="passbookImage"
              accept="image/*"
              placeholder="Upload passbook image..."
              icon={Camera}
              value={formData.passbookImage}
              onChange={handleFileChange('passbookImage')}
            />
          </Section>

          {/* Documents */}
          <Section
            title="Documents Upload"
            icon={FileText}
            tooltip="Upload clear images only. 'Any Experience' can be a certificate, work photo, or any proof of your skills. 'Profile Picture' should be a clear face photo. These help build trust with customers."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileField
                label="Any Experience (Image) *"
                fieldName="resume"
                accept="image/*"
                placeholder="Upload experience photo/certificate..."
                icon={Camera}
                value={formData.resume}
                onChange={handleFileChange('resume')}
              />
              <FileField
                label="Profile Picture *"
                fieldName="profilePic"
                accept="image/*"
                placeholder="Upload profile photo..."
                icon={Camera}
                value={formData.profilePic}
                onChange={handleFileChange('profilePic')}
              />
            </div>
          </Section>

          <div className="flex items-start gap-3 mt-4 px-1">
            <input
              type="checkbox"
              id="terms-provider"
              required
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
            />
            <label htmlFor="terms-provider" className="text-xs text-gray-400 leading-relaxed cursor-pointer select-none">
              I agree to the <Link to="/terms" className="text-primary font-bold hover:underline">Provider Terms of Service</Link> and <Link to="/privacy" className="text-primary font-bold hover:underline">Privacy Policy</Link>
            </label>
          </div>
        </div>
      );

    default:
      return null;
  }
};

// ── Benefits sidebar ──────────────────────────────────────────────────────
const BenefitsSection = () => (
  <div className="space-y-6">
    <div className="text-center flex flex-col items-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full mb-4 mt-6">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">Join 2,000+ Trusted Providers</span>
      </div>
      <h1 className="text-4xl font-bold text-secondary leading-tight">
        Become a{' '}
        <span className="text-primary">SafeVolt</span>{' '}
        Provider
      </h1>
      <p className="mt-3 text-sm text-secondary/60 leading-relaxed">
        Join our network of verified electrical professionals and start earning more today.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[
        { icon: DollarSign, title: 'Earn More', desc: 'Set your own rates', color: 'primary' },
        { icon: Shield, title: 'Get Verified', desc: 'Build trust fast', color: 'accent' },
        { icon: Zap, title: 'Fast Payments', desc: 'Instant transfers', color: 'primary' },
        { icon: Calendar, title: 'Flexible Hours', desc: 'Work your way', color: 'accent' },
      ].map(({ icon: Icon, title, desc, color }) => (
        <div
          key={title}
          className={`rounded-xl border p-4 transition-all hover:shadow-sm ${color === 'primary'
            ? 'border-primary/20 bg-primary/5 hover:border-primary/30'
            : 'border-accent/20 bg-accent/5 hover:border-accent/30'
            }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color === 'primary' ? 'bg-primary/15' : 'bg-accent/15'
              }`}
          >
            <Icon className={`w-4 h-4 ${color === 'primary' ? 'text-primary' : 'text-accent'}`} />
          </div>
          <p className="text-sm font-bold text-secondary">{title}</p>
          <p className="text-xs text-secondary/50 mt-0.5">{desc}</p>
        </div>
      ))}
    </div>

    <div className="bg-background border border-secondary/10 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
        <Award className="w-4 h-4 text-primary" /> How It Works
      </h3>
      <div className="space-y-3">
        {[
          { label: 'Register your profile', color: 'primary' },
          { label: 'Get verified by our team', color: 'accent' },
          { label: 'Start receiving bookings', color: 'primary' },
        ].map(({ label, color }, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${color === 'primary' ? 'bg-primary/10' : 'bg-accent/10'
                }`}
            >
              <span className={`text-xs font-bold ${color === 'primary' ? 'text-primary' : 'text-accent'}`}>
                {i + 1}
              </span>
            </div>
            <span className="text-sm text-secondary/80">{label}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="bg-background border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-accent" /> Why Providers Trust SafeVolt
      </h3>
      <div className="space-y-2.5">
        {[
          'Secure payments with instant bank transfer',
          '24/7 customer and provider support',
          'Pre-screened customers with verified needs',
        ].map((text) => (
          <div key={text} className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-xs text-secondary/70">{text}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Progress indicator ────────────────────────────────────────────────────
const ProgressIndicator = () => (
  <div className="mb-8">
    <div className="flex items-center">
      {[1, 2, 3, 4].map((s, idx) => {
        const StepIcon = STEP_ICONS[idx];
        const done = s < step;
        const active = s === step;
        return (
          <div key={s} className="flex-1 last:flex-none flex items-center">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${done
                  ? 'bg-primary text-background'
                  : active
                    ? 'bg-accent text-background ring-4 ring-accent/20 border-2 border-accent'
                    : 'bg-gray-100 text-gray-400'
                  }`}
              >
                {done ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <StepIcon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-accent font-bold' : done ? 'text-secondary' : 'text-gray-400'
                  }`}
              >
                {STEP_LABELS[idx]}
              </span>
            </div>
            {s < 4 && (
              <div className="flex-1 h-0.5 mx-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                <div
                  className={`h-full bg-accent transition-all duration-500 ${done ? 'w-full' : 'w-0'}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ── Submit button labels ──
const submitLabel = {
  1: 'Send Verification Code',
  2: 'Complete Registration',
  3: 'Login & Continue',
  4: 'Submit & Start Earning',
};

// ── Root render ───────────────────────────────────────────────────────────
return (
  <div className="min-h-screen bg-gray-50 pt-20 pb-14 px-4">
    <div className="max-w-7xl mx-auto">

      {/* ── Mobile trust hero ──────────────────────────── */}
      <div className="lg:hidden mb-5">
        {/* Brand headline */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">Join 2,000+ Trusted Providers</span>
          </div>
          <h1 className="text-2xl font-bold text-secondary leading-tight">
            Become a <span className="text-primary">SafeVolt</span> Provider
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Verified electrical professionals earning more every day
          </p>
        </div>

        {/* 4 stat pills */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { icon: DollarSign, label: 'Earn More', sub: 'Flexible rates', color: 'primary' },
            { icon: Shield, label: 'Get Verified', sub: 'Trusted badge', color: 'accent' },
            { icon: Zap, label: 'Fast Payments', sub: 'Instant transfer', color: 'primary' },
            { icon: Calendar, label: 'Flexible Hours', sub: 'Work your way', color: 'accent' },
          ].map(({ icon: Icon, label, sub, color }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${color === 'primary'
                ? 'border-primary/20 bg-primary/5'
                : 'border-accent/20 bg-accent/5'
                }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color === 'primary' ? 'bg-primary/15' : 'bg-accent/15'
                }`}>
                <Icon className={`w-3.5 h-3.5 ${color === 'primary' ? 'text-primary' : 'text-accent'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-secondary leading-tight">{label}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust checks strip */}
        <div className="flex flex-col gap-1.5 bg-background border border-gray-200 rounded-xl px-4 py-3">
          {[
            'Secure payments with instant bank transfer',
            '24/7 provider support, always available',
            'Pre-screened, verified customers only',
          ].map((text) => (
            <div key={text} className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs text-secondary/70">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop: side-by-side layout ───────────────────────────────── */}
      <div className="lg:flex lg:flex-row lg:gap-10 lg:items-start">

        {/* Left: Full benefits — desktop only */}
        <div className="hidden lg:block lg:flex-1">
          <BenefitsSection />
        </div>

        {/* Right: Form card */}
        <div className="w-full lg:flex-1 mt-6 lg:mt-8">
          <div className="bg-background rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <ProgressIndicator />

            <form
              onSubmit={
                step === 1 ? handleInitiateRegistration
                  : step === 2 ? handleCompleteRegistration
                    : step === 3 ? handleLogin
                      : handleCompleteProfile
              }
            >
              {renderStepContent()}

              {/* Action buttons */}
              <div className="flex gap-3 mt-8">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    submitLabel[step]
                  )}
                </button>
              </div>
            </form>

            {/* Footer link */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Already registered?{' '}
              <Link to="/login" className="text-accent font-semibold hover:underline">
                Sign in to your account
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  </div>
);
};

export default ProviderRegistration;
