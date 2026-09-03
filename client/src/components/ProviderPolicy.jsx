import React, { useState, useEffect } from 'react';
import { FileText, X, AlertCircle, CheckCircle } from 'lucide-react';

export const ProviderPolicy = ({ isOpen, type, onClose, onAccept }) => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const lastUpdated = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Reset scroll state when modal opens or type changes
  useEffect(() => {
    if (isOpen) {
      setHasScrolled(false);
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const handleModalScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight <= 25) {
      setHasScrolled(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-secondary/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-2xl rounded-2xl border border-gray-200 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-gray-50/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-secondary text-base md:text-lg">
              {type === 'agreement' && 'Provider Agreement & SLAs'}
              {type === 'terms' && 'Terms and Conditions'}
              {type === 'privacy' && 'Privacy Policy'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-secondary hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div
          onScroll={handleModalScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm text-secondary/85 leading-relaxed font-normal"
        >
          {type === 'agreement' && (
            <div className="space-y-4">
              <p className="font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">⚠️ IMPORTANT LEGAL AGREEMENT: This contract governs provider onboarding, KYC verification, earnings payouts, and service standards.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: {lastUpdated}
              </div>
              
              <h4 className="font-bold text-secondary text-sm mt-3">1. Registration & Verification Requirements</h4>
              <p>You must complete 4-step registration: OTP verification, Live Selfie photo, identity documents (Aadhaar/PAN), address, and active Bank Account / UPI details. Providing forged documents will lead to immediate rejection and account termination.</p>
              
              <h4 className="font-bold text-secondary text-sm">2. Admin Approval & Payout Activation</h4>
              <p>Only Admin-approved providers with complete profiles and verified bank details can receive booking dispatches and direct earnings payouts. Incomplete accounts are restricted from dashboard access.</p>
              
              <h4 className="font-bold text-secondary text-sm">3. Service SLAs & Booking Execution</h4>
              <p>You agree to arrive promptly at scheduled customer locations. Unannounced no-shows or last-minute cancellations without valid reasons will lower your reliability score and may lead to temporary account suspension.</p>
              
              <h4 className="font-bold text-secondary text-sm">4. Independent Partner & Personal Liability</h4>
              <p>You operate strictly as an independent service partner, not an employee. You are personally and legally responsible for executing quality work and maintaining professional conduct under Indian Law.</p>

              <h4 className="font-bold text-secondary text-sm">5. Zero Tolerance & Legal Compliance</h4>
              <p>Zero tolerance for theft, fraud, harassment, property damage, or offline payment bypass. Any safety incident will result in immediate account ban, payout hold, and FIR submission to police authorities with complete device and location logs.</p>

              <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-400 text-center mt-6">
                --- End of Provider Agreement ---
              </div>
            </div>
          )}

          {type === 'terms' && (
            <div className="space-y-4">
              <p className="font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">⚠️ TERMS OF SERVICE: Rules governing platform usage, account security, and fair partner policies.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: {lastUpdated}
              </div>

              <h4 className="font-bold text-secondary text-sm mt-3">1. Account Security & Verification</h4>
              <p>Your provider account is personal to you. Lending your account or dispatching unverified third parties to customer sites is strictly prohibited and results in permanent account ban.</p>

              <h4 className="font-bold text-secondary text-sm">2. Platform Bypass Prohibition</h4>
              <p>All bookings, work extensions, and customer transactions must be recorded through the platform. Off-platform cash deals or soliciting customers directly is grounds for instant termination and forfeiture of pending credits.</p>

              <h4 className="font-bold text-secondary text-sm">3. Automated Notifications & Reminders</h4>
              <p>You consent to receive transactional SMS, push notifications via FCM, and 12-hour onboarding reminders to complete missing profile or bank details.</p>

              <h4 className="font-bold text-secondary text-sm">4. Account Suspension & Investigation</h4>
              <p>The platform reserves the right to suspend accounts, audit KYC files, and hold pending payouts during active complaint or fraud investigations.</p>

              <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-400 text-center mt-6">
                --- End of Terms and Conditions ---
              </div>
            </div>
          )}

          {type === 'privacy' && (
            <div className="space-y-4">
              <p className="font-medium text-secondary">Please read the Privacy Policy below carefully. Scroll to the bottom to accept.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: {lastUpdated}
              </div>

              <h4 className="font-bold text-secondary text-sm mt-3">1. Data Collected for Onboarding</h4>
              <p>We collect your mobile number (OTP verified), Live camera selfie, identity documents (Aadhaar/PAN), residential address, and bank/UPI payout credentials to perform KYC verification and process automated earnings transfers.</p>

              <h4 className="font-bold text-secondary text-sm">2. Live Location Tracking During Service</h4>
              <p>Real-time GPS location is tracked during active booking dispatches to route you to customer locations, provide customer ETA tracking, and ensure safety. Disabling location services will prevent job dispatches.</p>

              <h4 className="font-bold text-secondary text-sm">3. Document Security & Encryption</h4>
              <p>All uploaded KYC documents and payment credentials are encrypted and accessible only by authorized Admin personnel for verification purposes.</p>

              <h4 className="font-bold text-secondary text-sm">4. Law Enforcement & Safety Disclosure</h4>
              <p>In case of criminal incidents, fraud, or serious safety complaints, we will cooperate fully with police authorities by sharing identity docs, location logs, and contact records.</p>

              <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-400 text-center mt-6">
                --- End of Privacy Policy ---
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-150 bg-gray-50/50 rounded-b-2xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            {!hasScrolled ? (
              <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Please scroll to the bottom to enable acceptance.
              </span>
            ) : (
              <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Ready to accept
              </span>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-semibold text-secondary transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasScrolled}
              onClick={() => onAccept(type)}
              className="px-4 py-2 bg-primary text-background rounded-lg text-xs font-bold hover:bg-primary/95 disabled:opacity-50 transition-all"
            >
              I Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
