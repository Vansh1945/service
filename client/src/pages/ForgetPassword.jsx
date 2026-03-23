import React, { useState, useEffect } from 'react';
import { FaEnvelope, FaShieldAlt, FaLock, FaArrowLeft, FaCheck, FaSpinner } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { forgetpassword, verifyotp, resendotp, resetpassword } from '../services/AuthService';

const ForgotPassword = () => {
  const { API } = useAuth();
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
      const errorMsg = err.response?.data?.message || err.message || 'Failed to send OTP. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }

  };

  // Verify OTP
  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await verifyotp({ email, otp });

      setStep(3);
      toast.success('OTP verified successfully');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to verify OTP. Please try again.';
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
      const errorMsg = err.response?.data?.message || err.message || 'Failed to resend OTP. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }

  };

  // Reset password - UPDATED TO INCLUDE OTP
  const resetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      await resetpassword({ email, otp, newPassword });

      toast.success('Password reset successfully! Redirecting to login...');

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to reset password. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }

  };

  // Countdown timer for OTP
  useEffect(() => {
    let interval;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="w-full">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              {step === 1 ? 'Forgot Password' :
                step === 2 ? 'Verify Your Email' : 'Reset Password'}
            </h1>

            <p className="text-secondary">
              {step === 1 ? 'Enter your email to receive a verification code' :
                step === 2 ? `We sent a code to ${email}` :
                  'Create a new password for your account'}
            </p>

          </div>

          {/* Progress Steps */}
          <div className="flex justify-between items-center mb-8 relative">
            <div className="absolute top-1/4 left-0 right-0 h-1.5 bg-primary/20 -z-10 rounded-full"></div>
            {[1, 2, 3].map((stepNumber) => (
              <div
                key={stepNumber}
                className="flex flex-col items-center"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${step >= stepNumber ?
                    'bg-accent text-secondary shadow-md' :
                    'bg-background text-secondary/60 border-2 border-primary/30'}`}>
                  {step > stepNumber ? <FaCheck className="text-sm" /> : stepNumber}
                </div>
                <span className={`text-xs mt-1 ${step >= stepNumber ? 'text-secondary' : 'text-secondary/70'}`}>
                  {stepNumber === 1 ? 'Email' : stepNumber === 2 ? 'Verify' : 'Reset'}
                </span>
              </div>
            ))}
          </div>


          {/* Step 1: Enter Email */}
          {step === 1 && (
            <div className="bg-background rounded-2xl shadow-xl p-8">

              <div className="mb-5">
                <label htmlFor="emailInput" className="block text-secondary mb-2 font-medium">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary">
                    <FaEnvelope className="text-lg" />
                  </div>
                  <input
                    type="email"
                    id="emailInput"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-primary/20 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <button
                onClick={sendOTP}
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 text-secondary font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Sending OTP...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </button>

            </div>

          )}

          {/* Step 2: Verify OTP */}
          {step === 2 && (
            <div className="bg-background rounded-2xl shadow-xl p-8">

              <button
                onClick={() => setStep(1)}
                className="flex items-center text-primary hover:text-primary/80 mb-6 font-medium"
              >
                <FaArrowLeft className="mr-2" /> Back
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaShieldAlt className="text-2xl" />
                </div>
                <h2 className="text-xl font-bold text-secondary mb-2">Enter Verification Code</h2>
                <p className="text-secondary/70">
                  We've sent a 6-digit code to <span className="font-medium text-secondary">{email}</span>
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="otpInput" className="block text-secondary mb-2">Verification Code</label>
                <div className="flex justify-center space-x-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      type="text"
                      maxLength="1"
                      value={otp[i] || ''}
                      onChange={(e) => {
                        const newOtp = otp.split('');
                        newOtp[i] = e.target.value.replace(/\D/g, '');
                        setOtp(newOtp.join('').slice(0, 6));
                        // Auto-focus next input
                        if (e.target.value && i < 5) {
                          document.getElementById(`otpInput-${i + 1}`)?.focus();
                        }
                      }}
                      id={`otpInput-${i}`}
                      className="w-12 h-14 text-2xl text-center font-mono rounded-lg border-2 border-primary/30 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                {isTimerActive ? (
                  <span className="text-secondary/70">Resend code in {timer}s</span>
                ) : (
                  <button
                    onClick={resendOTP}
                    disabled={loading}
                    className="text-primary hover:text-primary/80 font-medium"
                  >
                    {loading ? 'Resending...' : "Didn't receive code? Resend"}
                  </button>
                )}
                <button
                  onClick={verifyOTP}
                  disabled={otp.length !== 6 || loading}
                  className="bg-accent hover:bg-accent/90 text-secondary font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>
              </div>
            </div>

          )}

          {/* Step 3: Reset Password */}
          {step === 3 && (
            <div className="bg-background rounded-2xl shadow-xl p-8">

              <button
                onClick={() => setStep(2)}
                className="flex items-center text-primary hover:text-primary/80 mb-6 font-medium"
              >
                <FaArrowLeft className="mr-2" /> Back
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaLock className="text-2xl" />
                </div>
                <h2 className="text-xl font-bold text-secondary mb-2">Create New Password</h2>
                <p className="text-secondary/70">
                  Your new password must be different from previously used passwords
                </p>
              </div>

              <div className="mb-5">
                <label htmlFor="newPasswordInput" className="block text-secondary mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary">
                    <FaLock className="text-lg" />
                  </div>
                  <input
                    type="password"
                    id="newPasswordInput"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-primary/20 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    placeholder="At least 8 characters"
                    required
                    minLength="8"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="confirmPasswordInput" className="block text-secondary mb-2">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary">
                    <FaLock className="text-lg" />
                  </div>
                  <input
                    type="password"
                    id="confirmPasswordInput"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-primary/20 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    placeholder="Confirm your password"
                    required
                    minLength="8"
                  />
                </div>
              </div>

              <button
                onClick={resetPassword}
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 text-secondary font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>

          )}

          {/* Back to Login Link */}
          <div className="text-center mt-6">
            <p className="text-secondary">
              Remember your password?{' '}
              <Link to="/login" className="text-primary hover:text-primary/80 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;