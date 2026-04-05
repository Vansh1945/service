import React from 'react';
import { MdError, MdRefresh, MdArrowBack } from 'react-icons/md';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ErrorState = ({ 
  title = "Something went wrong", 
  message = "We encountered an unexpected error. Please try again.", 
  onRetry, 
  retryText = "Try Again",
  onBack,
  backText = "Go Back",
  showBack = true
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-premium border border-gray-100">
        <div className="relative mb-6">
          {/* Animated Glow Background */}
          <div className="absolute inset-0 bg-red-100 rounded-full blur-2xl opacity-20 scale-150 animate-pulse" />
          
          <div className="relative w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto transform -rotate-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          </div>
        </div>

        <h3 className="text-2xl font-black text-secondary mb-3 tracking-tight">
          {title}
        </h3>
        <p className="text-gray-500 leading-relaxed mb-8 font-medium">
          {message}
        </p>

        <div className="flex flex-col gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <MdRefresh className="text-lg" />
              {retryText}
            </button>
          )}
          
          {showBack && (
            <button
              onClick={onBack || (() => navigate(-1))}
              className="w-full py-4 bg-gray-50 text-gray-500 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-100 hover:text-secondary transition-all flex items-center justify-center gap-2 border border-gray-100"
            >
              <MdArrowBack className="text-lg" />
              {onBack ? backText : "Go Back"}
            </button>
          )}
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-50">
          <p className="text-[10px] uppercase font-bold text-gray-300 tracking-[0.2em]">
            Error Code: 404_NOT_FOUND
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;
