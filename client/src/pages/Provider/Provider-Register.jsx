import React, { useState, useEffect, useRef } from 'react';
import {
  User, Mail, Lock,
  ArrowLeft, CheckCircle, Shield, Zap,
  Sparkles, Award, Users,
  DollarSign, Calendar, FileText, Camera, CreditCard,
  Briefcase, RotateCcw, AlertCircle, X, Info, ChevronDown, Eye, EyeOff
} from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import { IfscBankDetails } from '../../components/IfscBankDetails';
import { ProviderPolicy } from '../../components/ProviderPolicy';
import Processing from '../../components/ui-skeletons/Processing';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-toastify/dist/ReactToastify.css';
import useCategory from '../../hooks/useCategory';
import * as ProviderService from '../../services/ProviderService';
import { formatTime, compressImage, buildStreetAddress, smartAddressBuilder } from '../../utils/format';

const setCookie = (name, value, days = 7) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax${secure}`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      } catch (e) {
        return c.substring(nameEQ.length, c.length);
      }
    }
  }
  return null;
};


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

const KycFileField = ({ label, fieldName, accept, placeholder, icon: Icon, value, onChange, onRemove, progress }) => {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    if (typeof value === 'string') {
      setPreview(value);
      return;
    }
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [value]);

  return (
    <Field label={label}>
      {preview ? (
        <div className="relative border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src={preview} alt={label} className="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-sm flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-secondary truncate">{value.name || 'Uploaded Document'}</p>
              {value.size && <p className="text-[10px] text-gray-400 mt-0.5">{(value.size / (1024 * 1024)).toFixed(2)} MB</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <label htmlFor={fieldName} className="px-2.5 py-1.5 bg-background border border-gray-200 rounded-lg text-[10px] font-bold text-secondary hover:border-primary hover:text-primary transition-all cursor-pointer">
              Replace
            </label>
            <button type="button" onClick={onRemove} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="file"
            id={fieldName}
            name={fieldName}
            onChange={onChange}
            accept={accept}
            className="hidden"
          />
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            id={fieldName}
            name={fieldName}
            onChange={onChange}
            accept={accept}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 bg-background hover:border-primary hover:bg-primary/5 transition-all text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-bold text-secondary">{placeholder}</span>
            <span className="text-[10px] text-gray-400 mt-1">PNG, JPG, JPEG, WEBP up to 5MB</span>
          </div>
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
          <div className="bg-primary h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </Field>
  );
};

const SelfieCaptureField = ({ value, onChange, onRemove, progress }) => {
  const [stream, setStream] = useState(null);
  const [active, setActive] = useState(false);
  const videoRef = React.useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    if (typeof value === 'string') {
      setPreview(value);
      return;
    }
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [value]);

  const startCamera = async () => {
    try {
      setActive(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: 'user' } });
      setStream(mediaStream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      toast.error('Could not access camera. Please upload file instead.');
      setActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setActive(false);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.translate(480, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, 480, 480);
    canvas.toBlob((blob) => {
      const file = new File([blob], `selfie_${Date.now()}.png`, { type: 'image/png' });
      onChange(file);
      stopCamera();
    }, 'image/png');
  };

  return (
    <Field label="Live Selfie Image *">
      {preview ? (
        <div className="relative border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={preview} alt="Live Selfie" className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-secondary truncate">{value.name || 'Live Selfie'}</p>
              {value.size && <p className="text-[10px] text-gray-400 mt-0.5">{(value.size / (1024 * 1024)).toFixed(2)} MB</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={startCamera} className="px-3 py-1.5 bg-background border border-gray-200 rounded-lg text-[10px] font-bold text-secondary hover:border-primary hover:text-primary transition-all">
              Re-Capture
            </button>
            <button type="button" onClick={onRemove} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : active ? (
        <div className="relative border border-gray-200 rounded-xl p-4 bg-black flex flex-col items-center gap-4 overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-64 h-64 object-cover rounded-lg scale-x-[-1] border border-gray-700"
          />
          <div className="flex gap-2">
            <button type="button" onClick={capture} className="px-4 py-2 bg-primary text-background rounded-lg text-xs font-bold hover:bg-primary/95 transition-all">
              Capture Photo
            </button>
            <button type="button" onClick={stopCamera} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-700 transition-all">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 rounded-xl p-6 bg-white hover:border-primary/50 transition-all text-center">
          <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-3">
            <User className="w-7 h-7 text-primary" />
          </div>
          <h4 className="text-xs font-bold text-secondary mb-1">Live Selfie Verification</h4>
          <p className="text-[10px] text-gray-400 mb-4 max-w-xs mx-auto">Please capture a clear photo of your face, or upload a portrait photo from your device.</p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center max-w-xs mx-auto">
            <button
              type="button"
              onClick={startCamera}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-background rounded-lg text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              Take Live Photo
            </button>

            <div className="relative w-full sm:w-auto">
              <input
                type="file"
                id="liveSelfie"
                name="liveSelfie"
                onChange={(e) => onChange(e.target.files[0])}
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-secondary rounded-lg text-xs font-bold hover:bg-gray-200 transition-all"
              >
                Upload from Files
              </button>
            </div>
          </div>
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
          <div className="bg-primary h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </Field>
  );
};

// ─── Step progress labels ─
const STEP_LABELS = ['Email', 'Details', 'Login', 'Profile'];
const STEP_ICONS = [Mail, User, Lock, Briefcase];

// Hoisted Benefits sidebar Component
const BenefitsSection = ({ systemSettings }) => (
  <div className="space-y-6">
    <div className="text-center flex flex-col items-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full mb-4 mt-6">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">Join 2,000+ Trusted Providers</span>
      </div>
      <h1 className="text-4xl font-bold text-secondary leading-tight">
        Become a{' '}
        <span className="text-primary">{systemSettings.companyName || "Raj Electrical Services"}</span>{' '}
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
        <Users className="w-4 h-4 text-accent" /> Why Providers Trust {systemSettings.companyName || "Raj Electrical Services"}
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

// Hoisted Progress indicator Component
const ProgressIndicator = ({ step }) => (
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

// ─── Main Component ──────────────────────────────────────────────────────────

const ProviderRegistration = () => {
  const navigate = useNavigate();
  const { API, loginUser, systemSettings = {} } = useAuth();

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
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    liveSelfie: null,
    addressSame: false,
    currentAddress: {
      houseNumber: '',
      road: '',
      street: '',
      landmark: '',
      area: '',
      villageCity: '',
      district: '',
      state: '',
      pincode: ''
    },
    permanentAddress: {
      houseNumber: '',
      road: '',
      street: '',
      landmark: '',
      area: '',
      villageCity: '',
      district: '',
      state: '',
      pincode: ''
    },
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    lat: null,
    lng: null,
    s2CellId: null,
    s2CellIdPrecise: null,
    houseNumber: '',
    road: '',
    landmark: '',
    area: '',
    pincode: '',
    formattedAddress: '',
    bankName: '',
    accountName: '',
    accountNo: '',
    ifsc: '',
    passbookImage: null,
    profilePic: null,
    referralCode: '',
    selfDeclaration: false,
    agreementAccepted: false,
    termsAccepted: false,
    privacyAccepted: false,
    signedName: '',
    signatureMethod: 'type',
    signatureImage: ''
  });


  const [step, setStep] = useState(1);
  const [profileSubStep, setProfileSubStep] = useState(1);
  const [uploadProgresses, setUploadProgresses] = useState({
    aadhaarFront: 0,
    aadhaarBack: 0,
    panCard: 0,
    liveSelfie: 0,
    passbookImage: 0,
    profilePic: 0
  });
  const [otpSentTime, setOtpSentTime] = useState(null);
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [otpExpiryTime, setOtpExpiryTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const { categories: providerServices, loading: providerServicesLoading, error: providerServicesError } = useCategory();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [documentType, setDocumentType] = useState('aadhaar');
  const [isBankValid, setIsBankValid] = useState(false);

  // Signature state for step 5
  const [typedSig, setTypedSig] = useState(formData.signedName || '');

  const handleTypeSignature = (val) => {
    setTypedSig(val);
    setFormData(prev => ({ ...prev, signedName: val }));

    // Render typed signature to a virtual canvas to save as base64 png
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 32px Georgia';
    ctx.fillText(val, 20, 70);

    setFormData(prev => ({
      ...prev,
      signatureImage: canvas.toDataURL('image/png')
    }));
  };

  const [agreementModal, setAgreementModal] = useState({
    isOpen: false,
    type: '', // 'agreement', 'terms', 'privacy'
    hasScrolled: false
  });

  const openAgreementModal = (type) => {
    setAgreementModal({
      isOpen: true,
      type,
      hasScrolled: false
    });
  };

  const acceptAgreement = (type) => {
    setFormData(prev => {
      const updated = { ...prev };
      if (type === 'agreement') updated.agreementAccepted = true;
      if (type === 'terms') updated.termsAccepted = true;
      if (type === 'privacy') updated.privacyAccepted = true;
      return updated;
    });
    setAgreementModal({ isOpen: false, type: '', hasScrolled: false });
  };

  const [referralCode, setReferralCode] = useState('');
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
        const response = await fetch(`${API}/referral/verify?code=${encodeURIComponent(referralCode.trim())}&role=provider`);
        const data = await response.json();
        if (data.success) {
          setReferralFeedback(data.message);
          setIsReferralValid(true);
        } else {
          setReferralFeedback('Invalid Referral Code');
          setIsReferralValid(false);
        }
      } catch (err) {
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

  useEffect(() => {
    if (localStorage.getItem("installRole") === "customer") {
      navigate("/register", { replace: true });
    }
  }, [navigate]);

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
    const addressFields = ['houseNumber', 'road', 'landmark', 'area', 'pincode', 'postalCode', 'city', 'state'];

    if (addressFields.includes(name)) {
      setFormData((prev) => {
        const updated = { ...prev, [name]: value };

        // Keep pincode and postalCode synchronized
        if (name === 'postalCode') {
          updated.pincode = value;
        } else if (name === 'pincode') {
          updated.postalCode = value;
        }

        // Auto-construct street if houseNumber and road are updated
        updated.street = buildStreetAddress(updated.houseNumber, updated.road);

        // Re-build formattedAddress based on the changed inputs
        updated.formattedAddress = smartAddressBuilder(
          {
            house_number: updated.houseNumber,
            road: updated.road,
            residential: updated.area,
            neighbourhood: updated.area,
            suburb: updated.area,
            city: updated.city,
            state: updated.state,
            postcode: updated.pincode || updated.postalCode
          },
          ""
        );

        return updated;
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };


  const handleFileChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.files[0] }));
  };

  const handleKycFileChange = (field) => (file) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, and WEBP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must not exceed 5 MB');
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: file }));
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
    const promise = (async () => {
      try {
        const response = await ProviderService.registerInitiate({ email: formData.email });
        const data = response.data;
        if (data.profileComplete) {
          setStep(3);
          return data.message || 'Incomplete profile found. Please login to complete.';
        } else {
          const sentTime = Date.now();
          setOtpSentTime(sentTime);
          setOtpExpiryTime(new Date(sentTime + 300000));
          setCanResendOtp(false);
          setResendCountdown(60);
          setStep(2);
          return 'OTP sent successfully! Check your email.';
        }
      } catch (err) {
        throw err.response?.data?.message || err.message;
      } finally {
        setIsSubmitting(false);
      }
    })();
    toast.promise(promise, {
      pending: 'Sending OTP...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = (async () => {
      try {
        const response = await ProviderService.registerComplete({
          email: formData.email,
          otp: formData.otp,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          referralCode: formData.referralCode,
        });
        const data = response.data;

        // Store the token in the correct 'token' key for axiosInstance to pick up
        setCookie('token', data.token, 7);

        setStep(3);
        return 'Registration successful! Please login to complete your profile.';
      } catch (err) {
        throw err.response?.data?.message || err.message;
      } finally {
        setIsSubmitting(false);
      }
    })();
    toast.promise(promise, {
      pending: 'Registering...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = (async () => {
      try {
        const response = await ProviderService.loginForCompletion({
          email: formData.email,
          password: formData.password
        });
        const data = response.data;

        // Use loginUser from AuthContext to set state and cookies correctly
        await loginUser(data.token, 'provider', data.provider);

        setStep(4);
        return 'Login successful! Please complete your profile.';
      } catch (err) {
        throw err.response?.data?.message || err.message;
      } finally {
        setIsSubmitting(false);
      }
    })();
    toast.promise(promise, {
      pending: 'Logging in...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };

  const handleCompleteProfile = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    const promise = (async () => {
      try {
        // Validate KYC documents based on documentType selection
        if (documentType === 'aadhaar') {
          if (!formData.aadhaarFront || !formData.aadhaarBack || !formData.liveSelfie) {
            throw new Error('Aadhaar Front, Aadhaar Back, and Live Selfie are required');
          }
        } else {
          if (!formData.panCard || !formData.liveSelfie) {
            throw new Error('PAN Card and Live Selfie are required');
          }
        }

        // Validate Bank details verification
        if (!isBankValid) {
          throw new Error('Please enter valid bank details and verify your IFSC code');
        }

        // Validate Legal Acceptance & Signature fields
        if (!formData.selfDeclaration || !formData.agreementAccepted || !formData.termsAccepted || !formData.privacyAccepted || !formData.signedName || !formData.signatureImage) {
          throw new Error('You must accept all declarations/agreements and sign before submitting');
        }

        // Compress registration files on the client side before packaging
        let profilePicFile = formData.profilePic;
        if (profilePicFile) {
          profilePicFile = await compressImage(profilePicFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
        }

        let aadhaarFrontFile = formData.aadhaarFront;
        if (aadhaarFrontFile) {
          aadhaarFrontFile = await compressImage(aadhaarFrontFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        }

        let aadhaarBackFile = formData.aadhaarBack;
        if (aadhaarBackFile) {
          aadhaarBackFile = await compressImage(aadhaarBackFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        }

        let panCardFile = formData.panCard;
        if (panCardFile) {
          panCardFile = await compressImage(panCardFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        }

        let liveSelfieFile = formData.liveSelfie;
        if (liveSelfieFile && liveSelfieFile instanceof File) {
          liveSelfieFile = await compressImage(liveSelfieFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        }

        let passbookImageFile = formData.passbookImage;
        if (passbookImageFile) {
          passbookImageFile = await compressImage(passbookImageFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        }

        const formDataWithServices = {
          ...formData,
          services: selectedServices,
          profilePic: profilePicFile,
          aadhaarFront: aadhaarFrontFile,
          aadhaarBack: aadhaarBackFile,
          panCard: panCardFile,
          liveSelfie: liveSelfieFile,
          passbookImage: passbookImageFile,
          currentAddress: JSON.stringify(formData.currentAddress),
          permanentAddress: JSON.stringify(formData.addressSame ? formData.currentAddress : formData.permanentAddress)
        };

        const fd = new FormData();
        Object.entries(formDataWithServices).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            if (['aadhaarFront', 'aadhaarBack', 'panCard', 'liveSelfie', 'passbookImage', 'profilePic'].includes(key)) {
              if (value) fd.append(key, value);
            } else if (key === 'services') {
              value.forEach((s) => fd.append('services', s));
            } else {
              fd.append(key, value);
            }
          }
        });

        const config = {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgresses({
              aadhaarFront: percentCompleted,
              aadhaarBack: percentCompleted,
              panCard: percentCompleted,
              liveSelfie: percentCompleted,
              passbookImage: percentCompleted,
              profilePic: percentCompleted
            });
          }
        };

        const response = await ProviderService.completeProfile(fd, config);
        const data = response.data;

        // Clear all auth cookies before navigating to prevent stale auth state
        setCookie('token', '', -1);
        setCookie('role', '', -1);
        setCookie('user', '', -1);
        setCookie('refreshToken', '', -1);

        // Navigate to login after a short delay so the success toast is visible
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1500);

        return 'Profile completed successfully!\nYour account is pending approval. Please contact support for assistance.';
      } catch (err) {
        throw err.response?.data?.message || err.message;
      } finally {
        setIsSubmitting(false);
      }
    })();
    toast.promise(promise, {
      pending: 'Completing profile...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 2000 },
    });
  };

  const handleResendOTP = async () => {
    if (!canResendOtp) return;
    setIsSubmitting(true);
    const promise = (async () => {
      try {
        const response = await ProviderService.registerInitiate({ email: formData.email });
        const data = response.data;
        if (data.profileComplete) {
          setStep(3);
          return data.message || 'Incomplete profile found. Please login to complete.';
        } else {
          const sentTime = Date.now();
          setOtpSentTime(sentTime);
          setOtpExpiryTime(new Date(sentTime + 300000));
          setCanResendOtp(false);
          setResendCountdown(60);
          return 'New OTP sent successfully!';
        }
      } catch (err) {
        throw err.response?.data?.message || err.message;
      } finally {
        setIsSubmitting(false);
      }
    })();
    toast.promise(promise, {
      pending: 'Resending OTP...',
      success: { render({ data }) { return data; }, autoClose: 3000 },
      error: { render({ data }) { return data; }, autoClose: 3000 },
    });
  };


  // ── Step content ─────────────────────

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
                      <span className="font-medium text-secondary">{formatTime(otpExpiryTime)}</span>
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
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password *">
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat password"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </div>
            </Section>

            {/* Referral Section */}
            <Section title="Referral" icon={Award}>
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password-login"
                  name="password"
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </div>
        );

      // ── Step 4 : Professional Profile (KYC & Address Sub-steps) ──
      case 4:
        if (profileSubStep === 1) {
          return (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-secondary">Step 1 of 4: Identity Verification</h2>
                <p className="text-sm text-gray-500 mt-1">Upload clear images of your identity documents</p>
              </div>

              <Field label="Select Identity Document Type *">
                <div className="relative">
                  <select
                    value={documentType}
                    onChange={(e) => {
                      const type = e.target.value;
                      setDocumentType(type);
                      // Clear the other document's uploads when changing type
                      if (type === 'aadhaar') {
                        setFormData(prev => ({ ...prev, panCard: null }));
                      } else {
                        setFormData(prev => ({ ...prev, aadhaarFront: null, aadhaarBack: null }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                  >
                    <option value="aadhaar">Aadhaar Card (Front & Back)</option>
                    <option value="pan">PAN Card</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </Field>

              {documentType === 'aadhaar' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <KycFileField
                    label="Aadhaar Front Image *"
                    fieldName="aadhaarFront"
                    accept="image/*"
                    placeholder="Upload Aadhaar Front..."
                    icon={Camera}
                    value={formData.aadhaarFront}
                    onChange={(e) => handleKycFileChange('aadhaarFront')(e.target.files[0])}
                    onRemove={() => setFormData(prev => ({ ...prev, aadhaarFront: null }))}
                    progress={uploadProgresses.aadhaarFront}
                  />
                  <KycFileField
                    label="Aadhaar Back Image *"
                    fieldName="aadhaarBack"
                    accept="image/*"
                    placeholder="Upload Aadhaar Back..."
                    icon={Camera}
                    value={formData.aadhaarBack}
                    onChange={(e) => handleKycFileChange('aadhaarBack')(e.target.files[0])}
                    onRemove={() => setFormData(prev => ({ ...prev, aadhaarBack: null }))}
                    progress={uploadProgresses.aadhaarBack}
                  />
                </div>
              ) : (
                <KycFileField
                  label="PAN Card Image *"
                  fieldName="panCard"
                  accept="image/*"
                  placeholder="Upload PAN Card..."
                  icon={Camera}
                  value={formData.panCard}
                  onChange={(e) => handleKycFileChange('panCard')(e.target.files[0])}
                  onRemove={() => setFormData(prev => ({ ...prev, panCard: null }))}
                  progress={uploadProgresses.panCard}
                />
              )}

              <SelfieCaptureField
                value={formData.liveSelfie}
                onChange={(file) => handleKycFileChange('liveSelfie')(file)}
                onRemove={() => setFormData(prev => ({ ...prev, liveSelfie: null }))}
                progress={uploadProgresses.liveSelfie}
              />

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (documentType === 'aadhaar') {
                      if (!formData.aadhaarFront || !formData.aadhaarBack || !formData.liveSelfie) {
                        toast.error('Aadhaar Front, Back, and Live Selfie are required');
                        return;
                      }
                    } else {
                      if (!formData.panCard || !formData.liveSelfie) {
                        toast.error('PAN Card and Live Selfie are required');
                        return;
                      }
                    }
                    setProfileSubStep(2);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  Next Step
                </button>
              </div>
            </div>
          );
        }

        if (profileSubStep === 2) {
          return (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-secondary">Step 2 of 4: Current Address</h2>
                <p className="text-sm text-gray-500 mt-1">Please enter your current residential address</p>
              </div>

              <AddressSelector
                address={{
                  houseNumber: formData.currentAddress.houseNumber,
                  road: formData.currentAddress.road || '',
                  landmark: formData.currentAddress.landmark,
                  area: formData.currentAddress.area || '',
                  city: formData.currentAddress.villageCity || formData.currentAddress.city || '',
                  state: formData.currentAddress.state,
                  pincode: formData.currentAddress.pincode || formData.currentAddress.postalCode || '',
                  postalCode: formData.currentAddress.pincode || formData.currentAddress.postalCode || '',
                  street: formData.currentAddress.street,
                  formattedAddress: formData.currentAddress.formattedAddress,
                  isManuallyEdited: formData.currentAddress.isManuallyEdited,
                }}
                onChange={(updatedAddress) => {
                  setFormData((prev) => {
                    const mapped = {
                      ...prev.currentAddress,
                      houseNumber: updatedAddress.houseNumber || '',
                      road: updatedAddress.road || '',
                      landmark: updatedAddress.landmark || '',
                      area: updatedAddress.area || '',
                      city: updatedAddress.city || '',
                      state: updatedAddress.state || '',
                      pincode: updatedAddress.pincode || updatedAddress.postalCode || '',
                      postalCode: updatedAddress.postalCode || updatedAddress.pincode || '',
                      street: updatedAddress.street || '',
                      villageCity: updatedAddress.city || '',
                      district: updatedAddress.area || '', // Map area to district
                      formattedAddress: updatedAddress.formattedAddress || '',
                      isManuallyEdited: updatedAddress.isManuallyEdited || false,
                    };
                    const updated = {
                      ...prev,
                      currentAddress: mapped
                    };
                    if (prev.addressSame) {
                      updated.permanentAddress = { ...mapped };
                    }
                    return updated;
                  });
                }}
              />

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="addressSame"
                  checked={formData.addressSame}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => {
                      const updated = { ...prev, addressSame: checked };
                      if (checked) {
                        updated.permanentAddress = { ...prev.currentAddress };
                      }
                      return updated;
                    });
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
                />
                <label htmlFor="addressSame" className="text-xs font-bold text-secondary cursor-pointer select-none">
                  Permanent Address same as Current Address
                </label>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setProfileSubStep(1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = formData.currentAddress;
                    if (!c.houseNumber || (!c.street && !c.road) || !c.landmark || (!c.villageCity && !c.city) || !c.state || !c.pincode) {
                      toast.error('All Current Address fields are required');
                      return;
                    }
                    if (!/^\d{6}$/.test(c.pincode)) {
                      toast.error('Pincode must be 6 digits');
                      return;
                    }

                    // Copy currentAddress to top-level of formData for backend compatibility
                    setFormData(prev => ({
                      ...prev,
                      houseNumber: c.houseNumber,
                      road: c.road || '',
                      street: c.street || '',
                      landmark: c.landmark || '',
                      area: c.area || '',
                      city: c.villageCity || c.city || '',
                      state: c.state || '',
                      pincode: c.pincode || '',
                      postalCode: c.pincode || '',
                      formattedAddress: c.formattedAddress || '',
                      lat: c.lat || prev.lat,
                      lng: c.lng || prev.lng,
                      s2CellId: c.s2CellId || prev.s2CellId,
                      s2CellIdPrecise: c.s2CellIdPrecise || prev.s2CellIdPrecise,
                      serviceArea: c.villageCity || c.city || prev.serviceArea
                    }));

                    if (formData.addressSame) {
                      setProfileSubStep(4);
                    } else {
                      setProfileSubStep(3);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  Next Step
                </button>
              </div>
            </div>
          );
        }

        if (profileSubStep === 3) {
          return (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-secondary">Step 3 of 4: Permanent Address</h2>
                <p className="text-sm text-gray-500 mt-1">Please enter your permanent residential address</p>
              </div>

              <AddressSelector
                address={{
                  houseNumber: formData.permanentAddress.houseNumber,
                  road: formData.permanentAddress.road || '',
                  landmark: formData.permanentAddress.landmark,
                  area: formData.permanentAddress.area || '',
                  city: formData.permanentAddress.villageCity || formData.permanentAddress.city || '',
                  state: formData.permanentAddress.state,
                  pincode: formData.permanentAddress.pincode || formData.permanentAddress.postalCode || '',
                  postalCode: formData.permanentAddress.pincode || formData.permanentAddress.postalCode || '',
                  street: formData.permanentAddress.street,
                  formattedAddress: formData.permanentAddress.formattedAddress,
                  isManuallyEdited: formData.permanentAddress.isManuallyEdited,
                }}
                onChange={(updatedAddress) => {
                  setFormData((prev) => ({
                    ...prev,
                    permanentAddress: {
                      ...prev.permanentAddress,
                      houseNumber: updatedAddress.houseNumber || '',
                      road: updatedAddress.road || '',
                      landmark: updatedAddress.landmark || '',
                      area: updatedAddress.area || '',
                      city: updatedAddress.city || '',
                      state: updatedAddress.state || '',
                      pincode: updatedAddress.pincode || updatedAddress.postalCode || '',
                      postalCode: updatedAddress.postalCode || updatedAddress.pincode || '',
                      street: updatedAddress.street || '',
                      villageCity: updatedAddress.city || '',
                      district: updatedAddress.area || '',
                      formattedAddress: updatedAddress.formattedAddress || '',
                      isManuallyEdited: updatedAddress.isManuallyEdited || false,
                    }
                  }));
                }}
              />

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setProfileSubStep(2)}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = formData.permanentAddress;
                    if (!p.houseNumber || (!p.street && !p.road) || !p.landmark || (!p.villageCity && !p.city) || !p.state || !p.pincode) {
                      toast.error('All Permanent Address fields are required');
                      return;
                    }
                    if (!/^\d{6}$/.test(p.pincode)) {
                      toast.error('Pincode must be 6 digits');
                      return;
                    }
                    setProfileSubStep(4);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/95 transition-all"
                >
                  Next Step
                </button>
              </div>
            </div>
          );
        }

        // Substep 4: Professional & Bank Details
        if (profileSubStep === 4) {
          return (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-secondary">Step 4 of 4: Professional & Bank Details</h2>
                <p className="text-sm text-gray-500 mt-1">Complete your service details and bank information</p>
              </div>

              {/* Professional Info */}
              <Section title="Professional Information" icon={Briefcase}>
                <Field label="Service Categories (Select 1–3) *">
                  {providerServicesLoading ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                      <div className=" rounded-full h-4 w-4 border-2 border-primary border-t-transparent animate-spin" />
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
                                    <X className="w-3.5 h-3.5" />
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



              {/* Bank Details */}
              <Section
                title="Bank Details"
                icon={CreditCard}
                accent
                tooltip="Your bank details are used for secure payment transfers after each completed job. All information is encrypted and never shared. Provide the account where you want to receive your earnings."
              >
                <div className="space-y-4">
                  <IfscBankDetails
                    value={{
                      ifsc: formData.ifsc,
                      accountNo: formData.accountNo,
                      bankName: formData.bankName,
                      branch: formData.branch,
                      district: formData.district,
                      state: formData.state,
                      city: formData.city,
                      address: formData.address,
                    }}
                    onChange={(updated) => {
                      setFormData((prev) => ({
                        ...prev,
                        ifsc: updated.ifsc || '',
                        accountNo: updated.accountNo || '',
                        bankName: updated.bankName || '',
                        branch: updated.branch || '',
                        district: updated.district || '',
                        state: updated.state || '',
                        city: updated.city || '',
                        address: updated.address || '',
                      }));
                    }}
                    onValidityChange={setIsBankValid}
                    showAccountName={true}
                    accountNameValue={formData.accountName || ''}
                    onAccountNameChange={(name) => setFormData((prev) => ({ ...prev, accountName: name }))}
                  />

                  <KycFileField
                    label="Bank Passbook Image *"
                    fieldName="passbookImage"
                    accept="image/*"
                    placeholder="Upload passbook image..."
                    icon={Camera}
                    value={formData.passbookImage}
                    onChange={(e) => handleKycFileChange('passbookImage')(e.target.files[0])}
                    onRemove={() => setFormData(prev => ({ ...prev, passbookImage: null }))}
                    progress={uploadProgresses.passbookImage}
                  />
                </div>
              </Section>

              {/* Documents */}
              <Section
                title="Profile Picture"
                icon={FileText}
                tooltip="Upload a clear face photo. This helps build trust with customers."
              >
                <KycFileField
                  label="Profile Picture *"
                  fieldName="profilePic"
                  accept="image/*"
                  placeholder="Upload profile photo..."
                  icon={Camera}
                  value={formData.profilePic}
                  onChange={(e) => handleKycFileChange('profilePic')(e.target.files[0])}
                  onRemove={() => setFormData(prev => ({ ...prev, profilePic: null }))}
                  progress={uploadProgresses.profilePic}
                />
              </Section>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setProfileSubStep(formData.addressSame ? 2 : 3)}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedServices.length === 0) {
                      toast.error('Please select at least one service category');
                      return;
                    }
                    if (!formData.experience || formData.experience < 0) {
                      toast.error('Please enter valid years of experience');
                      return;
                    }
                    if (!formData.serviceArea) {
                      toast.error('Please enter your service area');
                      return;
                    }
                    if (!formData.accountNo || !formData.ifsc) {
                      toast.error('Bank account number and IFSC code are required');
                      return;
                    }
                    if (!formData.passbookImage) {
                      toast.error('Bank passbook image is required');
                      return;
                    }
                    if (!formData.profilePic) {
                      toast.error('Profile picture is required');
                      return;
                    }
                    setProfileSubStep(5);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  Next Step
                </button>
              </div>
            </div>
          );
        }

        // Substep 5: Legal Acceptance & Digital Signature
        if (profileSubStep === 5) {
          return (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-secondary">Step 5 of 5: Legal Agreements</h2>
                <p className="text-sm text-gray-500 mt-1">Please review the declarations and sign below to complete registration</p>
              </div>

              {/* Declarations */}
              <div className="space-y-3.5 bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="selfDeclaration"
                    checked={formData.selfDeclaration}
                    onChange={(e) => setFormData(prev => ({ ...prev, selfDeclaration: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
                  />
                  <label htmlFor="selfDeclaration" className="text-xs text-secondary/80 leading-relaxed cursor-pointer select-none">
                    <strong>Self Declaration:</strong> I hereby declare that all the information, identity documents (Aadhaar, PAN), and bank details provided are true and correct to the best of my knowledge. I understand that any false statements may result in account termination.
                  </label>
                </div>

                <div className="flex items-start gap-3 border-t border-gray-200 pt-3">
                  <input
                    type="checkbox"
                    id="agreementAccepted"
                    checked={formData.agreementAccepted}
                    onChange={() => {
                      if (!formData.agreementAccepted) {
                        openAgreementModal('agreement');
                      } else {
                        setFormData(prev => ({ ...prev, agreementAccepted: false }));
                      }
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
                  />
                  <label htmlFor="agreementAccepted" className="text-xs text-secondary/80 leading-relaxed cursor-pointer select-none">
                    I have read and agree to the <button type="button" onClick={() => openAgreementModal('agreement')} className="text-primary font-bold hover:underline">Provider Agreement</button> and platform SLAs.
                  </label>
                </div>

                <div className="flex items-start gap-3 border-t border-gray-200 pt-3">
                  <input
                    type="checkbox"
                    id="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={() => {
                      if (!formData.termsAccepted) {
                        openAgreementModal('terms');
                      } else {
                        setFormData(prev => ({ ...prev, termsAccepted: false }));
                      }
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
                  />
                  <label htmlFor="termsAccepted" className="text-xs text-secondary/80 leading-relaxed cursor-pointer select-none">
                    I accept the general <button type="button" onClick={() => openAgreementModal('terms')} className="text-primary font-bold hover:underline">Terms and Conditions</button> of service.
                  </label>
                </div>

                <div className="flex items-start gap-3 border-t border-gray-200 pt-3">
                  <input
                    type="checkbox"
                    id="privacyAccepted"
                    checked={formData.privacyAccepted}
                    onChange={() => {
                      if (!formData.privacyAccepted) {
                        openAgreementModal('privacy');
                      } else {
                        setFormData(prev => ({ ...prev, privacyAccepted: false }));
                      }
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all"
                  />
                  <label htmlFor="privacyAccepted" className="text-xs text-secondary/80 leading-relaxed cursor-pointer select-none">
                    I acknowledge and accept the <button type="button" onClick={() => openAgreementModal('privacy')} className="text-primary font-bold hover:underline">Privacy Policy</button> for data handling.
                  </label>
                </div>
              </div>

              {/* Digital Signature */}
              <div className="border border-gray-200 rounded-xl p-5 bg-background">
                <div className="space-y-4">
                  <Field label="Full Name for Signature *">
                    <input
                      type="text"
                      value={typedSig}
                      onChange={(e) => handleTypeSignature(e.target.value)}
                      placeholder="Type your name to sign..."
                      className={inputCls}
                    />
                  </Field>
                  {typedSig && (
                    <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 flex items-center justify-center">
                      <span className="text-3xl font-normal italic text-secondary tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>
                        {typedSig}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signed Name */}
              <Field label="Printed Name of Signatory *">
                <input
                  type="text"
                  value={formData.signedName}
                  onChange={(e) => setFormData(prev => ({ ...prev, signedName: e.target.value }))}
                  placeholder="Verify your printed name..."
                  className={inputCls}
                />
              </Field>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setProfileSubStep(4)}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-secondary text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <Processing
                  type="submit"
                  loading={isSubmitting}
                  loadingText="Submitting..."
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Sign & Submit Application
                </Processing>
              </div>
            </div>
          );
        }

      default:
        return null;
    }
  };

  // BenefitsSection and ProgressIndicator are hoisted to module scope

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
              Become a <span className="text-primary">{systemSettings.companyName || "Raj Electrical Services"}</span> Provider
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
            <BenefitsSection systemSettings={systemSettings} />
          </div>

          {/* Right: Form card */}
          <div className="w-full lg:flex-1 mt-6 lg:mt-8">
            <div className="bg-background rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <ProgressIndicator step={step} />

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
                {step !== 4 && (
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

                    <Processing
                      type="submit"
                      loading={isSubmitting}
                      loadingText="Submitting..."
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitLabel[step]}
                    </Processing>
                  </div>
                )}
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

        <ProviderPolicy
          isOpen={agreementModal.isOpen}
          type={agreementModal.type}
          onClose={() => setAgreementModal({ isOpen: false, type: '', hasScrolled: false })}
          onAccept={acceptAgreement}
        />
      </div>
    </div>
  );
};

export default ProviderRegistration;
