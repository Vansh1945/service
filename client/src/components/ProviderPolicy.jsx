import React, { useState, useEffect } from 'react';
import { FileText, X, AlertCircle, CheckCircle } from 'lucide-react';

export const ProviderPolicy = ({ isOpen, type, onClose, onAccept }) => {
  const [hasScrolled, setHasScrolled] = useState(false);

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
              <p className="font-medium text-secondary">Please read the Provider Agreement and platform SLAs below carefully. Scroll to the bottom to accept.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: June 2026
              </div>
              
              <h4 className="font-bold text-secondary text-sm mt-3">1. Scope of Services</h4>
              <p>As a verified provider on the platform, you agree to offer high-quality services matching your chosen categories. You will receive booking requests, and it is your responsibility to respond to them promptly and professionally.</p>
              
              <h4 className="font-bold text-secondary text-sm">2. SLA & Booking Guarantees</h4>
              <p>You agree to adhere to the booking timings. Cancellations or no-shows without prior notifications of at least 2 hours before the scheduled job time will affect your reliability rating and could lead to fines or temporary account suspension.</p>
              
              <h4 className="font-bold text-secondary text-sm">3. Platform Fees & Commission</h4>
              <p>The platform charges a percentage commission on each completed booking as defined in the fee structure. The remainder of the payment, including any convenience fees collected, will be processed and transferred to your registered bank account weekly or instantly depending on terms.</p>
              
              <h4 className="font-bold text-secondary text-sm">4. Standard of Conduct</h4>
              <p>You must maintain a professional and respectful attitude with clients. Misbehavior, demand for direct payment bypassing the platform, or safety violations will result in permanent removal from the platform.</p>

              <h4 className="font-bold text-secondary text-sm">5. Independent Contractor Status</h4>
              <p>You acknowledge that you are registered as an independent professional and not an employee of the platform. You are solely responsible for your own taxes, work tools, and general liability.</p>

              <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-400 text-center mt-6">
                --- End of Provider Agreement ---
              </div>
            </div>
          )}

          {type === 'terms' && (
            <div className="space-y-4">
              <p className="font-medium text-secondary">Please read the Terms and Conditions below carefully. Scroll to the bottom to accept.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: June 2026
              </div>

              <h4 className="font-bold text-secondary text-sm mt-3">1. Account Registration & Security</h4>
              <p>You must keep your credentials secure. Any activity occurring under your registered account is your responsibility. You agree to provide true and accurate documents, including PAN and Aadhaar card details.</p>

              <h4 className="font-bold text-secondary text-sm">2. Fair Usage Policy</h4>
              <p>You agree not to bypass the platform by directly taking customer details or arranging payments offline. All service leads provided through the platform must be processed on-platform.</p>

              <h4 className="font-bold text-secondary text-sm">3. Direct Liability Limitations</h4>
              <p>The platform acts as a digital matching service. We are not liable for any direct, indirect, incidental, or consequential damages resulting from transactions, work quality, or interactions between users and providers.</p>

              <h4 className="font-bold text-secondary text-sm">4. Account Verification & Auditing</h4>
              <p>We reserve the right to verify, audit, or background-check any user or provider profile. Providing falsified identity documents, bank accounts, or credentials is a serious breach of terms.</p>

              <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-400 text-center mt-6">
                --- End of Terms and Conditions ---
              </div>
            </div>
          )}

          {type === 'privacy' && (
            <div className="space-y-4">
              <p className="font-medium text-secondary">Please read the Privacy Policy below carefully. Scroll to the bottom to accept.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: June 2026
              </div>

              <h4 className="font-bold text-secondary text-sm mt-3">1. Data We Collect</h4>
              <p>We collect personal information such as your name, email address, phone number, location history (for routing jobs), bank account details (for payouts), and KYC verification files (PAN/Aadhaar/selfie).</p>

              <h4 className="font-bold text-secondary text-sm">2. Data Usage & Location Tracking</h4>
              <p>Your location coordinates may be requested to check local availability and dispatch customer requests near you. Your bank details are securely processed only to transfer payments for services you perform.</p>

              <h4 className="font-bold text-secondary text-sm">3. Information Sharing</h4>
              <p>We share necessary verification files with background-check agencies and payment providers. We do not sell or lease your personal information to third-party advertisers.</p>

              <h4 className="font-bold text-secondary text-sm">4. Retention and Security</h4>
              <p>We retain your profile data while your account is active. All communication and personal data details are encrypted in transit and at rest using standard security protocols.</p>

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
