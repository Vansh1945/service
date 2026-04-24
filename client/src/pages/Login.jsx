import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  Zap,
  Shield,
  Award,
  Sparkles,
  HeadphonesIcon,
  CheckCircle,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { login } from '../services/AuthService';

// ─── Static sub-components (defined OUTSIDE to avoid remount) ──────────────

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-secondary bg-background placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-xs font-semibold text-secondary uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const Section = ({ title, icon: Icon, accent = false, children }) => (
  <div className={`rounded-xl border p-5 space-y-4 ${accent ? 'border-accent/20 bg-accent/5' : 'border-gray-200 bg-background'}`}>
    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
      {Icon && <Icon className={`w-4 h-4 ${accent ? 'text-accent' : 'text-primary'}`} />}
      <span className="text-sm font-bold text-secondary">{title}</span>
    </div>
    {children}
  </div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginUser, showToast, isAuthenticated, role, user } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      if (role === 'admin' || user?.isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'provider') {
        navigate(user?.approved ? '/provider/dashboard' : '/provider/profile-completion', { replace: true });
      } else {
        navigate('/customer/services', { replace: true });
      }
    }
  }, [isAuthenticated, role, user, navigate]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await login(formData);
      const data = response.data;

      if (data.token && data.user) {
        showToast(data.message || 'Login successful', 'success');
        loginUser(data.token, data.user.role || 'customer', data.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const errorData = err.response?.data;
      const errorMsg = errorData?.message || err.message;
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Benefits sidebar ──────────────────────────────────────────────────────
  const BenefitsSection = () => (
    <div className="space-y-6">
      <div className="text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full mb-4 mt-6">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">Welcome Back to SafeVolt</span>
        </div>
        <h1 className="text-4xl font-bold text-secondary leading-tight">
          Login to <span className="text-primary">SafeVolt</span>
        </h1>
        <p className="mt-3 text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
          Access your dashboard, manage bookings, and stay connected with our premium services.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Zap, title: 'Instant Access', desc: 'Secure login', color: 'primary' },
          { icon: Shield, title: 'Safe & Secure', desc: 'Encrypted data', color: 'accent' },
          { icon: Activity, title: 'Real-time Updates', desc: 'Stay notified', color: 'primary' },
          { icon: HeadphonesIcon, title: 'Support', desc: '24/7 Assistance', color: 'accent' },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div
            key={title}
            className={`rounded-xl border p-4 transition-all hover:shadow-sm ${color === 'primary'
              ? 'border-primary/20 bg-primary/5 hover:border-primary/40'
              : 'border-accent/20 bg-accent/5 hover:border-accent/40'
              }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color === 'primary' ? 'bg-primary/15' : 'bg-accent/15'
                }`}
            >
              <Icon className={`w-4 h-4 ${color === 'primary' ? 'text-primary' : 'text-accent'}`} />
            </div>
            <p className="text-sm font-bold text-secondary">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-background border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" /> Premium Benefits
        </h3>
        <div className="space-y-2.5">
          {[
            'Manage service bookings with one click',
            'Safe & secure payment tracking',
            'Verified professionals at your doorstep',
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

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-14 px-4 flex items-center">
      <div className="max-w-7xl mx-auto w-full">

        {/* Mobile Header (Hidden on LG) */}
        <div className="lg:hidden text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">Secure Access</span>
          </div>
          <h1 className="text-2xl font-bold text-secondary leading-tight">
            Login to <span className="text-primary">SafeVolt</span>
          </h1>
        </div>

        <div className="lg:flex lg:flex-row lg:gap-14 lg:items-center">
          {/* Left: Benefits - Visible on desktop */}
          <div className="hidden lg:block lg:flex-1">
            <BenefitsSection />
          </div>

          {/* Right: Login Card */}
          <div className="w-full lg:flex-1 mt-6 lg:mt-12">
            <div className="bg-background rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">

              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-secondary">Sign In</h2>
                  <p className="text-sm text-secondary/50 mt-1">Please enter your credentials to access your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Section title="Authentication" icon={Lock}>
                    <div className="space-y-4">
                      <Field label="Email Address">
                        <div className="relative">
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            className={inputCls}
                            required
                          />
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/30 pointer-events-none" />
                        </div>
                      </Field>

                      <Field label="Password">
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className={inputCls}
                            required
                          />
                          <button
                            type="button"
                            onClick={togglePasswordVisibility}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/40 hover:text-primary transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </Field>
                    </div>
                  </Section>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={() => setRememberMe(!rememberMe)}
                        className="w-4 h-4 rounded border-secondary/30 text-primary focus:ring-primary cursor-pointer transition-all"
                      />
                      <span className="text-xs text-secondary/70 font-medium group-hover:text-primary transition-colors">Remember me</span>
                    </label>
                    <Link to="/forgot-password" title="Recover Password" className="text-xs font-bold text-accent hover:underline">
                      Forgot Password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <p className="text-sm text-gray-500">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-accent font-semibold hover:underline">
                      Create an account
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

export default React.memo(LoginPage);