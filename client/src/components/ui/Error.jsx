import React from 'react';
import { MdRefresh, MdArrowBack, MdHome } from 'react-icons/md';
import { AlertCircle, WifiOff, ShieldAlert, ServerCrash, FileQuestion, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { normalizeApiError } from '../../utils/messages';

const Error = ({ 
  error,
  title, 
  message, 
  onRetry, 
  retryText = "Try Again",
  onBack,
  backText = "Go Back",
  showBack = true,
  onHome,
  homeText = "Go to Home",
  showHome = false,
  code
}) => {
  const navigate = useNavigate();

  // Normalize error if error prop object or string is provided
  const normalized = error ? normalizeApiError(error) : null;

  const displayTitle = title || normalized?.title || "Something went wrong";
  const displayMessage = message || normalized?.message || "We encountered an unexpected error. Please try again.";
  const displayCode = code || normalized?.code || "ERROR_UNEXPECTED";

  // Dynamic icon based on error classification
  let Icon = AlertCircle;
  if (normalized?.isNetworkError) {
    Icon = WifiOff;
  } else if (normalized?.isForbidden) {
    Icon = ShieldAlert;
  } else if (normalized?.isServerError) {
    Icon = ServerCrash;
  } else if (normalized?.isNotFound) {
    Icon = FileQuestion;
  } else if (normalized?.isTimeout) {
    Icon = Clock;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8 animate-fade-in">
      <div className="max-w-sm w-full bg-white rounded-2xl p-5 sm:p-8 text-center shadow-lg border border-neutral-100">
        <div className="relative mb-5">
          {/* Animated Glow Background */}
          <div className="absolute inset-0 bg-danger/10 rounded-full blur-2xl opacity-20 scale-150 animate-pulse" />
          
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto transform -rotate-6">
            <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-danger" />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-danger rounded-full border-2 border-white" />
          </div>
        </div>

        <h3 className="text-lg sm:text-2xl font-black text-secondary mb-2 tracking-tight leading-snug">
          {displayTitle}
        </h3>
        <p className="text-sm text-neutral-500 leading-relaxed mb-6 font-medium">
          {displayMessage}
        </p>

        <div className="flex flex-col gap-2.5">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-3 sm:py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <MdRefresh className="text-base sm:text-lg" />
              {retryText}
            </button>
          )}
          
          {showBack && (
            <button
              onClick={onBack || (() => navigate(-1))}
              className="w-full py-3 sm:py-4 bg-neutral-50 text-neutral-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-neutral-100 hover:text-secondary transition-all flex items-center justify-center gap-2 border border-neutral-200"
            >
              <MdArrowBack className="text-base sm:text-lg" />
              {onBack ? backText : "Go Back"}
            </button>
          )}

          {(showHome || onHome) && (
            <button
              onClick={onHome || (() => navigate('/'))}
              className="w-full py-3 sm:py-3.5 bg-white text-neutral-500 rounded-xl font-semibold uppercase tracking-widest text-xs hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 border border-neutral-200"
            >
              <MdHome className="text-base sm:text-lg" />
              {homeText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ErrorState = Error;

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[AppErrorBoundary] Component rendering crash caught:", error, errorInfo);
    try {
      import("@sentry/react").then((Sentry) => {
        Sentry.captureException(error, { extra: errorInfo });
      }).catch(() => {});
    } catch (e) {}
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 bg-neutral-50/50 animate-fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-lg border border-neutral-100">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-danger/10 rounded-full blur-2xl opacity-20 scale-150 animate-pulse" />
              
              <div className="relative w-20 h-20 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto transform -rotate-6">
                <AlertCircle className="w-10 h-10 text-danger" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full border-2 border-white" />
              </div>
            </div>

            <h3 className="text-2xl font-black text-secondary mb-3 tracking-tight">
              Temporary Display Issue
            </h3>
            <p className="text-neutral-500 leading-relaxed mb-8 font-medium">
              We encountered a temporary display issue. Please try reloading the page or return to home.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <MdRefresh className="text-lg" />
                Reload Page
              </button>
              
              <button
                onClick={this.handleHome}
                className="w-full py-4 bg-neutral-50 text-neutral-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-neutral-100 hover:text-secondary transition-all flex items-center justify-center gap-2 border border-neutral-200"
              >
                <MdHome className="text-lg" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = AppErrorBoundary;
export default Error;


