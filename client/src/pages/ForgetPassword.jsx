import React, { useState, useEffect } from 'react';
import {
  Mail, Shield, Lock, ArrowLeft, ArrowRight, CheckCircle,
  Sparkles, Award, Zap, HeadphonesIcon, Info, RotateCcw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { forgetpassword, verifyotp, resendotp, resetpassword } from '../services/AuthService';

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

const STEP_LABELS = ['Email', 'Verify', 'Reset'];
const STEP_ICONS = [Mail, Shield, Lock];

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timer, setTimer] = useState(60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Send OTP to email
  const sendOTP = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await forgetpassword({ email });
      setIsTimerActive(true);
      setTimer(60);
      setStep(2);
      toast.success('OTP sent to your email');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to send OTP';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      await verifyotp({ email, otp });
      setStep(3);
      toast.success('OTP verified successfully');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Verification failed';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const resendOTP = async () => {
    setLoading(true);
    try {
      await resendotp({ email });
      setTimer(60);
      setIsTimerActive(true);
      setOtp('');
      toast.success('New OTP sent successfully');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to resend';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Min 8 characters required');
      return;
    }
    setLoading(true);
    try {
      await resetpassword({ email, otp, newPassword });
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to reset';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer]);

  // ── Progress indicator ────────────────────────────────────────────────────
  const ProgressIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center">
        {[1, 2, 3].map((s, idx) => {
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
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">Secure Account Recovery</span>
        </div>
        <h1 className="text-4xl font-bold text-secondary leading-tight">
          Recover <span className="text-primary">SafeVolt</span>
        </h1>
        <p className="mt-3 text-sm text-secondary/60 leading-relaxed max-w-sm mx-auto">
          Quickly reset your password and regain access to your account with our secure OTP verification.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Zap, title: 'Super Fast', desc: 'Secure OTP reset', color: 'primary' },
          { icon: Shield, title: 'Safe & Secure', desc: 'Encrypted recovery', color: 'accent' },
          { icon: Lock, title: 'Stay Protected', desc: 'High security', color: 'primary' },
          { icon: HeadphonesIcon, title: 'Need Help?', desc: '24/7 Support', color: 'accent' },
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
          <Award className="w-4 h-4 text-primary" /> Why SafeVolt?
        </h3>
        <div className="space-y-2.5">
          {[
            'Two-factor authentication for recovery',
            'Instant email notifications',
            'Advanced encryption standards',
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

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-secondary">Forgot Password</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your email to receive a verification code</p>
            </div>
            <Section title="Step 1: Email Recovery" icon={Mail}>
              <Field label="Email Address">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={inputCls}
                />
              </Field>
            </Section>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline group mb-2">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Change Email
            </button>
            <div>
              <h2 className="text-2xl font-bold text-secondary">Verify OTP</h2>
              <p className="text-sm text-gray-500 mt-1">Check <span className="font-semibold text-primary">{email}</span> for the code</p>
            </div>
            <Section title="Step 2: Verification" icon={Shield}>
              <div className="space-y-4">
                <Field label="Enter 6-Digit Code">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className={`${inputCls} text-center tracking-[0.5em] text-xl font-bold flex-1`}
                    />
                    <button
                      type="button"
                      onClick={resendOTP}
                      disabled={isTimerActive || loading}
                      className={`px-4 rounded-lg border transition-all flex items-center justify-center ${!isTimerActive
                        ? 'bg-primary border-primary text-background hover:bg-primary/90'
                        : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </Field>
                <div className="text-center">
                  {isTimerActive ? (
                    <p className="text-xs text-gray-400">Resend in <span className="font-bold text-secondary">{timer}s</span></p>
                  ) : (
                    <button onClick={resendOTP} className="text-xs font-bold text-accent hover:underline">Resend code now</button>
                  )}
                </div>
              </div>
            </Section>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-secondary">Reset Password</h2>
              <p className="text-sm text-gray-500 mt-1">Create a strong new password</p>
            </div>
            <Section title="Step 3: New Password" icon={Lock}>
              <div className="space-y-4">
                <Field label="New Password">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </Field>
                <Field label="Confirm New Password">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </Field>
              </div>
            </Section>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-14 px-4 flex items-center">
      <div className="max-w-7xl mx-auto w-full">

        {/* Mobile Header */}
        <div className="lg:hidden text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">Secure Recovery</span>
          </div>
          <h1 className="text-2xl font-bold text-secondary leading-tight">
            Recover <span className="text-primary">SafeVolt</span>
          </h1>
        </div>

        <div className="lg:flex lg:flex-row lg:gap-14 lg:items-center">
          {/* Left: Benefits */}
          <div className="hidden lg:block lg:flex-1">
            <BenefitsSection />
          </div>

          {/* Right: Card */}
          <div className="w-full lg:flex-1 mt-6 lg:mt-12">
            <div className="bg-background rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <ProgressIndicator />

              <div className="mt-8">
                {renderStepContent()}

                <div className="mt-10">
                  <button
                    onClick={step === 1 ? sendOTP : step === 2 ? verifyOTP : resetPassword}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {step === 1 ? 'Send OTP' : step === 2 ? 'Verify OTP' : 'Reset Password'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center mt-6">
                  <Link to="/login" className="text-sm font-semibold text-accent hover:underline flex items-center justify-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
