import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { register } from '../../services/AuthService';
import {
  User, Mail, Phone, Lock, MapPin, Home,
  ArrowLeft, ArrowRight, CheckCircle, Shield, Zap,
  Sparkles, Award, HeadphonesIcon, Info, Navigation
} from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import LocationPickerModal from '../../components/LocationPickerModal';
import { detectCurrentLocation, toLegacyAddressFields, smartAddressBuilder } from '../../utils/format';
import { latLngToS2CellId } from '../../utils/s2Helper';

// ─── Static sub-components (defined OUTSIDE to avoid remount) ──────────────

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-secondary bg-background placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1 w-full">
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

// ─── Step progress configuration ───────────────────────────────────────────
const STEP_LABELS = ['Personal', 'Location', 'Security'];
const STEP_ICONS = [User, MapPin, Lock];

const CustomerRegistration = () => {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const autocompleteInputRef = useRef(null);
  const [detecting, setDetecting] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  useEffect(() => {
    // Autocomplete disabled for Nominatim. Can type directly.
  }, [currentStep]);

  const handleDetectAddress = async () => {
    setDetecting(true);
    try {
      const { latitude, longitude, address } = await detectCurrentLocation();
      // address already contains s2CellId/s2CellIdPrecise from detectCurrentLocation
      const fields = toLegacyAddressFields({ ...address, lat: latitude, lng: longitude });
      setFormData((prev) => ({
        ...prev,
        address: fields
      }));
      showToast('Address auto-detected successfully!');
    } catch (error) {
      showToast(error.message || 'Failed to detect location', 'error');
    } finally {
      setDetecting(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      houseNumber: '',
      road: '',
      landmark: '',
      area: '',
      pincode: '',
      formattedAddress: '',
      lat: null,
      lng: null,
      s2CellId: null,
      s2CellIdPrecise: null
    }
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const totalSteps = 3;

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => {
        const updatedAddress = {
          ...prev.address,
          [addressField]: value
        };

        // Keep postalCode and pincode in sync
        if (addressField === 'postalCode') {
          updatedAddress.pincode = value;
        } else if (addressField === 'pincode') {
          updatedAddress.postalCode = value;
        }

        // Auto-construct street if houseNumber and road are updated
        const houseNum = updatedAddress.houseNumber || '';
        const rd = updatedAddress.road || '';
        updatedAddress.street = houseNum && rd ? `${houseNum}, ${rd}` : (houseNum || rd);

        // Re-build formattedAddress based on the changed inputs
        updatedAddress.formattedAddress = smartAddressBuilder(
          {
            house_number: updatedAddress.houseNumber,
            road: updatedAddress.road,
            residential: updatedAddress.area,
            neighbourhood: updatedAddress.area,
            suburb: updatedAddress.area,
            city: updatedAddress.city,
            state: updatedAddress.state,
            postcode: updatedAddress.pincode
          },
          ""
        );

        return {
          ...prev,
          address: updatedAddress
        };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleStateCityChange = (state, city) => {
    setFormData(prev => {
      const updatedAddress = { ...prev.address };
      if (state !== undefined) updatedAddress.state = state;
      if (city !== undefined) updatedAddress.city = city;

      updatedAddress.formattedAddress = smartAddressBuilder(
        {
          house_number: updatedAddress.houseNumber,
          road: updatedAddress.road,
          residential: updatedAddress.area,
          neighbourhood: updatedAddress.area,
          suburb: updatedAddress.area,
          city: updatedAddress.city,
          state: updatedAddress.state,
          postcode: updatedAddress.pincode
        },
        ""
      );

      return {
        ...prev,
        address: updatedAddress
      };
    });
  };

  const handleValidationErrors = (backendErrors) => {
    if (backendErrors && typeof backendErrors === 'object') {
      setErrors(backendErrors);
      const errorValues = Object.values(backendErrors);
      const firstError = errorValues[0];
      const msg = typeof firstError === 'string' ? firstError : (firstError?.message || 'Check your inputs');
      showToast(msg, 'error');
    } else {
      showToast('Validation failed. Please check form.', 'error');
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await register(formData);
      showToast(response.data.message || 'Registration successful! Welcome to SafeVolt.');
      navigate('/login');
    } catch (err) {
      const errorData = err.response?.data;
      const errorMsg = errorData?.message || err.message || 'Registration failed';

      if (errorData?.errors) {
        handleValidationErrors(errorData.errors);
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === totalSteps) {
      handleSubmit();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // ── Progress indicator ────────────────────────────────────────────────────
  const ProgressIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center">
        {[1, 2, 3].map((s, idx) => {
          const StepIcon = STEP_ICONS[idx];
          const done = s < currentStep;
          const active = s === currentStep;
          return (
            <div key={s} className="flex-1 last:flex-none flex items-center">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    done
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
                  className={`text-[10px] font-semibold whitespace-nowrap ${
                    active ? 'text-accent font-bold' : done ? 'text-secondary' : 'text-gray-400'
                  }`}
                >
                  {STEP_LABELS[idx]}
                </span>
              </div>
              {s < 3 && (
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

  // ── Benefits sidebar ──────────────────────────────────────────────────────
  const BenefitsSection = () => (
    <div className="space-y-6">
      <div className="text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full mb-4 mt-6">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">Trusted by 10,000+ Customers</span>
        </div>
        <h1 className="text-4xl font-bold text-secondary leading-tight">
          Join <span className="text-primary">SafeVolt</span> today
        </h1>
        <p className="mt-3 text-sm text-secondary/60 leading-relaxed max-w-sm mx-auto">
          Experience premium electrical services with verified professionals at your doorstep.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Zap, title: 'Super Fast', desc: 'Same-day service', color: 'primary' },
          { icon: Shield, title: 'Verified Pros', desc: 'Secure & Safe', color: 'accent' },
          { icon: Award, title: 'Top Quality', desc: '100% Satisfaction', color: 'primary' },
          { icon: HeadphonesIcon, title: '24/7 Support', desc: 'Always available', color: 'accent' },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div
            key={title}
            className={`rounded-xl border p-4 transition-all hover:shadow-sm ${
              color === 'primary'
                ? 'border-primary/20 bg-primary/5 hover:border-primary/30'
                : 'border-accent/20 bg-accent/5 hover:border-accent/30'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                color === 'primary' ? 'bg-primary/15' : 'bg-accent/15'
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
        <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Why Customers Trust Us
        </h3>
        <div className="space-y-2.5">
          {[
            'Professional & background-checked electricians',
            'Upfront, transparent pricing with no hidden costs',
            'Full insurance coverage for your peace of mind',
          ].map((text) => (
            <div key={text} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-xs text-secondary/80">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-secondary">Personal Information</h2>
              <p className="text-sm text-gray-500 mt-1">Let's start with your basic details</p>
            </div>
            <Section title="Basic Details" icon={User}>
              <div className="space-y-4">
                <Field label="Full Name *" error={errors.name}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Email Address *" error={errors.email}>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Phone Number *" error={errors.phone}>
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
              </div>
            </Section>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-secondary">Address Information</h2>
              <p className="text-sm text-gray-500 mt-1">Where can we reach you for services?</p>
            </div>
            <Section title="Location Details" icon={MapPin}>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Address Details</span>
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(true)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2.5 shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center"
                    title="Select Location on Map"
                  >
                    <MapPin className="w-5 h-5" />
                  </button>
                </div>

                {/* Row 1: House No. & Road Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="House / Flat / Shop No. *" error={errors['address.houseNumber']}>
                    <input
                      type="text"
                      name="address.houseNumber"
                      value={formData.address.houseNumber || ''}
                      onChange={handleChange}
                      placeholder="e.g. House No. 349, Flat 4B"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Road / Street / Lane *" error={errors['address.road']}>
                    <input
                      type="text"
                      name="address.road"
                      value={formData.address.road || ''}
                      onChange={handleChange}
                      placeholder="e.g. MG Road, Phase 1"
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>

                {/* Row 2: Landmark & Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Landmark (Optional)" error={errors['address.landmark']}>
                    <input
                      type="text"
                      name="address.landmark"
                      value={formData.address.landmark || ''}
                      onChange={handleChange}
                      placeholder="e.g. Near Shiv Temple"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Area / Locality / Sector" error={errors['address.area']}>
                    <input
                      type="text"
                      name="address.area"
                      value={formData.address.area || ''}
                      onChange={handleChange}
                      placeholder="e.g. Sector 15, Vasant Kunj"
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Row 3: State & City Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <AddressSelector
                      selectedState={formData.address.state}
                      selectedCity={formData.address.city}
                      onStateChange={(state) => handleStateCityChange(state, '')}
                      onCityChange={(city) => handleStateCityChange(undefined, city)}
                    />
                  </div>
                  <Field label="Pincode *" error={errors['address.pincode'] || errors['address.postalCode']}>
                    <input
                      type="text"
                      name="address.pincode"
                      value={formData.address.pincode || formData.address.postalCode || ''}
                      onChange={handleChange}
                      placeholder="6-digit Pincode"
                      className={`${inputCls} font-mono`}
                      maxLength="6"
                      required
                    />
                  </Field>
                </div>

                {/* Row 4: Calculated Address Preview */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address Preview</label>
                  <div className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-lg text-secondary font-medium leading-relaxed shadow-inner min-h-[48px] flex items-center">
                    {formData.address.formattedAddress || 'Please fill House No. and Road name to construct preview...'}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-secondary">Account Security</h2>
              <p className="text-sm text-gray-500 mt-1">Protect your account with a password</p>
            </div>
            <Section title="Security" icon={Lock} accent tooltip="Use at least 8 characters with a mix of letters and numbers for a strong password.">
              <div className="space-y-4">
                <Field label="Create Password *" error={errors.password}>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </Field>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-secondary/70 leading-relaxed">
                    Your privacy is our priority. We use industry-standard encryption to protect your data and never share it with unauthorized third parties.
                  </p>
                </div>
              </div>
            </Section>

            <div className="flex items-start gap-3 mt-4 px-1">
              <input
                type="checkbox"
                id="terms"
                required
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
              />
              <label htmlFor="terms" className="text-xs text-gray-400 leading-relaxed cursor-pointer select-none">
                I agree to the <Link to="/terms" className="text-primary font-bold hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-primary font-bold hover:underline">Privacy Policy</Link>
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-14 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Mobile Header (Hidden on LG) */}
        <div className="lg:hidden text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">Join 10,000+ Happy Customers</span>
          </div>
          <h1 className="text-2xl font-bold text-secondary leading-tight">
            Join <span className="text-primary">SafeVolt</span> today
          </h1>
        </div>

        <div className="lg:flex lg:flex-row lg:gap-14 lg:items-start">
          {/* Left: Benefits */}
          <div className="hidden lg:block lg:flex-1">
            <BenefitsSection />
          </div>

          {/* Right: Form Card */}
          <div className="w-full lg:flex-1 mt-6 lg:mt-8">
            <div className="bg-background rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <ProgressIndicator />
              
              <div className="mt-8">
                {renderStepContent()}

                <div className="flex gap-3 mt-10">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {currentStep === totalSteps ? 'Complete Registration' : 'Continue'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center mt-6">
                  <p className="text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link to="/login" className="text-accent font-semibold hover:underline">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isMapModalOpen && (
        <LocationPickerModal
          isOpen={isMapModalOpen}
          onClose={() => setIsMapModalOpen(false)}
          onLocationSelect={(loc) => {
            // loc already contains s2CellId, s2CellIdPrecise from LocationPickerModal
            setFormData(prev => ({
              ...prev,
              address: {
                ...prev.address,
                ...loc
              }
            }));
            showToast('Address picked from map!');
          }}
        />
      )}
    </div>
  );
};

export default CustomerRegistration;
