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
              <p className="font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">⚠️ IMPORTANT WARNING: This is a legally binding contract. Any breach, misconduct, or unlawful activity will result in immediate termination, holding of payouts, and immediate criminal prosecution/police complaints.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: {lastUpdated}
              </div>
              
              <h4 className="font-bold text-secondary text-sm mt-3">1. Scope of Services</h4>
              <p>As a verified provider on the platform, you agree to offer high-quality services matching your chosen categories. You will receive booking requests, and it is your responsibility to respond to them promptly, safely, and professionally.</p>
              
              <h4 className="font-bold text-secondary text-sm">2. SLA, Reliability & Cancellation Penalties</h4>
              <p>You agree to adhere strictly to booking timings. Unannounced cancellations, delays, or no-shows (failure to arrive within 30 minutes of scheduled time) will lower your reliability rating, lead to fines deducted from your balance, or result in temporary/permanent account suspension.</p>
              
              <h4 className="font-bold text-secondary text-sm">3. Platform Fees & Commission</h4>
              <p>The platform charges a percentage commission on each completed booking as defined in the fee structure. The remainder of the payment, including any convenience fees collected, will be processed and transferred to your registered bank account weekly or instantly depending on terms.</p>
              
              <h4 className="font-bold text-secondary text-sm">4. Independent Contractor & Personal Liability</h4>
              <p>You are registered strictly as an independent professional and NOT an employee of the platform. You are personally, financially, and criminally liable under Indian Law for your actions, behavior, negligence, misconduct, or civil/criminal offenses while providing services. The platform is not responsible for your acts.</p>

              <h4 className="font-bold text-secondary text-sm">5. Zero Tolerance for Criminal Activities</h4>
              <p>The platform enforces a zero-tolerance policy. Any illegal or criminal acts—including theft, robbery, burglary, assault, physical violence, sexual harassment, property damage, fraud, extortion, intimidation, or any other offenses—committed during or in connection with a service will result in an immediate permanent ban. The platform will file an FIR with local police authorities, surrender your identity, location history, and documents, and fully cooperate with the investigation.</p>

              <h4 className="font-bold text-secondary text-sm">6. KYC and Identity Verification (Aadhaar & PAN)</h4>
              <p>You must provide genuine, valid, and un-tampered identity documents, including PAN card, Aadhaar card, current address proof, and active bank account details. Submitting fake, forged, or altered documents is a serious criminal offense under Indian Law. Discovery of fake details will lead to immediate account termination, withholding of all pending payouts, and referral to cyber/police cells.</p>

              <h4 className="font-bold text-secondary text-sm">7. Customer Safety & On-site Conduct</h4>
              <p>You must maintain professional, respectful, and non-intrusive behavior. Any form of harassment, unauthorized entry into rooms, misuse of customer property, or contact of customers post-service (via call or messaging) is strictly prohibited and constitutes grounds for an immediate permanent ban.</p>

              <h4 className="font-bold text-secondary text-sm">8. Account Suspension, Payout Holds & Evidence Preservation</h4>
              <p>If a safety or fraud incident is reported, the platform reserves the right to immediately suspend your account, hold all pending payouts/earnings during the investigation, and preserve chat histories, device details, and location tracking information to assist law enforcement.</p>

              <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-400 text-center mt-6">
                --- End of Provider Agreement ---
              </div>
            </div>
          )}

          {type === 'terms' && (
            <div className="space-y-4">
              <p className="font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">⚠️ TERMS OF USE: Strict penalties apply for platform bypass, fraud, or violations of code of conduct.</p>
              <div className="border-l-4 border-primary/40 pl-3 italic text-gray-500 my-2">
                Last Updated: {lastUpdated}
              </div>

              <h4 className="font-bold text-secondary text-sm mt-3">1. Account Registration & Security</h4>
              <p>You are solely responsible for all activities occurring under your registered account. You agree to provide true and accurate documents, including PAN and Aadhaar card details. Lending your account to unverified third parties is strictly banned and results in an immediate lifetime ban.</p>

              <h4 className="font-bold text-secondary text-sm">2. Fair Usage & Platform Bypass Warning</h4>
              <p>You agree not to bypass the platform by arranging direct, offline payments or soliciting customers for direct service leads. Offline transactions are highly unsafe, bypass safety monitoring, and will lead to an immediate ban and forfeiture of all platform credits.</p>

              <h4 className="font-bold text-secondary text-sm">3. Platform Role & Dispute Resolution</h4>
              <p>The platform acts solely as a digital matching marketplace and does not authorize, direct, or encourage any illegal or negligent acts. Disputes arising under these terms are governed by the laws of India, subject to exclusive court jurisdiction.</p>

              <h4 className="font-bold text-secondary text-sm">4. Mandatory Auditing & Background Verification</h4>
              <p>We reserve the right to audit, inspect, and run background/police verification on any provider profile. The submission of false documentation or refusal to undergo verification will result in instant termination of platform access.</p>

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

              <h4 className="font-bold text-secondary text-sm mt-3">1. Data We Collect & Store</h4>
              <p>We collect and securely store personal information, including your name, email, contact number, real-time location history (to match you with local customer jobs), bank details (for payout processing), and KYC verification documents (PAN, Aadhaar cards, and profile pictures/selfies).</p>

              <h4 className="font-bold text-secondary text-sm">2. Location Tracking for Dispatch & Safety</h4>
              <p>Your location coordinates are tracked to locate and assign jobs near you, as well as to ensure customer safety and live tracking during active bookings. Disabling location permissions will restrict your ability to receive bookings.</p>

              <h4 className="font-bold text-secondary text-sm">3. Direct Data Sharing with Law Enforcement</h4>
              <p>We work closely with law enforcement. In the event of a safety incident, threat, fraud, or criminal report, we will immediately share provider identification documents, contact logs, location records, and bank accounts with police and legal authorities without requiring prior notice to you.</p>

              <h4 className="font-bold text-secondary text-sm">4. Data Security & Encryption</h4>
              <p>All sensitive documents and data transactions are fully encrypted in transit and at rest using modern secure protocols to protect information from unauthorized access.</p>

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
