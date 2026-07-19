import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { register } from '../../services/AuthService';
import {
  User, Lock, MapPin,
  ArrowLeft, ArrowRight, CheckCircle, Shield, Zap,
  Sparkles, Award, HeadphonesIcon, Info, Eye, EyeOff
} from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import Processing from '../../components/ui-skeletons/Processing';

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

// ── Progress indicator ────────────────────────────────────────────────────
const ProgressIndicator = ({ currentStep }) => (
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
const BenefitsSection = ({ systemSettings = {} }) => (
  <div className="space-y-6">
    <div className="text-center flex flex-col items-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full mb-4 mt-6">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">Trusted by 10,000+ Customers</span>
      </div>
      <h1 className="text-4xl font-bold text-secondary leading-tight">
        Join <span className="text-primary">{systemSettings.companyName || "Raj Electrical Services"}</span> today
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

const CustomerRegistration = () => {
  const navigate = useNavigate();
  const { showToast, systemSettings = {}, API } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (localStorage.getItem("installRole") === "provider") {
      navigate("/register-provider", { replace: true });
    }
  }, [navigate]);


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
        updatedAddress.formattedAddress = buildAddressPreview(updatedAddress) || smartAddressBuilder(
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

      updatedAddress.formattedAddress = buildAddressPreview(updatedAddress) || smartAddressBuilder(
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
      let msg = 'Check your inputs';
      if (typeof firstError === 'string') {
        msg = firstError;
      } else if (Array.isArray(firstError)) {
        msg = firstError.map(err => typeof err === 'string' ? err : (err?.message || err?.msg || JSON.stringify(err))).join(', ');
      } else if (firstError && typeof firstError === 'object') {
        msg = firstError.message || firstError.msg || firstError.error || JSON.stringify(firstError);
      }
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
      showToast(response.data.message || 'Registration successful! Welcome to ' + (systemSettings.companyName || 'Raj Electrical Services') + '.');
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

  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralFeedback, setReferralFeedback] = useState('');
  const [isReferralValid, setIsReferralValid] = useState(null);

  // Prefill referral code from URL query parameter or session storage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || sessionStorage.getItem('referralCode');
    if (ref) {
      setReferralCode(ref);
      setFormData(prev => ({ ...prev, referralCode: ref }));
    }
  }, []);

  // Debounced/instant verification on referral code change
  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralFeedback('');
      setIsReferralValid(null);
      return;
    }

    const verifyCode = async () => {
      setReferralValidating(true);
      try {
        const response = await fetch(`${API}/referral/verify?code=${encodeURIComponent(referralCode.trim())}&role=customer`);
        const data = await response.json();
        if (data.success) {
          setReferralFeedback(data.message);
          setIsReferralValid(true);
        } else {
          setReferralFeedback('Invalid Referral Code');
          setIsReferralValid(false);
        }
      } catch (err) {
        console.error(err);
        setReferralFeedback('Error validating code');
        setIsReferralValid(false);
      } finally {
        setReferralValidating(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      verifyCode();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [referralCode, API]);

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
                <Field label="Referral Code (Optional)">
                  <div className="relative">
                    <input
                      type="text"
                      id="referralCode"
                      name="referralCode"
                      value={referralCode}
                      onChange={(e) => {
                        setReferralCode(e.target.value);
                        setFormData(prev => ({ ...prev, referralCode: e.target.value }));
                      }}
                      placeholder="Enter referral code"
                      className={inputCls}
                    />
                    {referralValidating && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Verifying...</div>
                    )}
                  </div>
                  {referralFeedback && (
                    <p className={`text-xs mt-1 font-bold ${isReferralValid ? 'text-green-600' : 'text-red-500'}`}>
                      {referralFeedback}
                    </p>
                  )}
                </Field>
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
              <AddressSelector
                address={formData.address}
                onChange={(updatedAddress) => setFormData(prev => ({ ...prev, address: updatedAddress }))}
                errors={errors}
              />
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
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-secondary focus:outline-none transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
            Join <span className="text-primary">{systemSettings.companyName || "Raj Electrical Services"}</span> today
          </h1>
        </div>

        <div className="lg:flex lg:flex-row lg:gap-14 lg:items-start">
          {/* Left: Benefits */}
          <div className="hidden lg:block lg:flex-1">
            <BenefitsSection systemSettings={systemSettings} />
          </div>

          {/* Right: Form Card */}
          <div className="w-full lg:flex-1 mt-6 lg:mt-8">
            <div className="bg-background rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <ProgressIndicator currentStep={currentStep} />

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

                  <Processing
                    type="button"
                    onClick={nextStep}
                    loading={isLoading}
                    loadingText="Processing..."
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {currentStep === totalSteps ? 'Complete Registration' : 'Continue'}
                    <ArrowRight className="w-4 h-4" />
                  </Processing>
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

    </div>
  );
};

export default CustomerRegistration;
