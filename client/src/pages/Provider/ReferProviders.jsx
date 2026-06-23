import React, { useState, useEffect } from 'react';
import { FiCopy, FiShare2, FiUsers, FiAward, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../../context/auth';
import { getProviderReferralDetails } from '../../services/referralApi';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/Error';

const ReferProviders = () => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { systemSettings } = useAuth();
  const companyName = systemSettings?.companyName || 'Raj Electrical Service';

  useEffect(() => {
    fetchReferralDetails();
  }, []);

  const fetchReferralDetails = async () => {
    try {
      setLoading(true);
      const res = await getProviderReferralDetails();
      if (res.data.success) {
        setDetails(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load referral details');
      }
    } catch (err) {
      console.error(err);
      setError('Network error loading details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!details?.referralCode) return;
    const registrationLink = `${window.location.origin}/register-provider?ref=${details.referralCode}`;
    navigator.clipboard.writeText(registrationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!details?.referralCode) return;
    const text = `Join ${companyName} as a certified partner electrician! Register using my code: ${details.referralCode} and unlock extra earnings:`;
    const link = `${window.location.origin}/register-provider?ref=${details.referralCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Refer Partners',
        text: text,
        url: link
      }).catch(console.error);
    } else {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + link)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorState 
        title="Failed to load referral details" 
        message={error} 
        onRetry={fetchReferralDetails} 
      />
    );
  }

  if (details && details.paused) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-md border border-gray-100 text-center">
          <div className="w-20 h-20 mx-auto bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
            <FiAlertCircle className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-secondary">Program Temporarily Paused</h1>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Referral program is temporarily unavailable.
          </p>
        </div>
      </div>
    );
  }

  if (details && details.eligibility && !details.eligibility.eligible) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-md border border-gray-100 text-center">
          <div className="w-20 h-20 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6">
            <FiAward className="w-10 h-10 animate-bounce" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-secondary">Referral Program is Locked</h1>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            To prevent spam and ensure genuine partner referrals, our referral program unlocks after you complete at least {details.eligibility.requiredBookings} job{details.eligibility.requiredBookings > 1 ? 's' : ''}.
          </p>

          <div className="mt-8 max-w-md mx-auto bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span className="text-gray-500">Completed Jobs</span>
              <span className="text-accent">{details.eligibility.completedBookings} / {details.eligibility.requiredBookings}</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-accent h-3 rounded-full transition-all duration-500" 
                style={{ width: `${details.eligibility.progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {details.eligibility.requiredBookings - details.eligibility.completedBookings} more job{details.eligibility.requiredBookings - details.eligibility.completedBookings > 1 ? 's' : ''} to go!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register-provider?ref=${details?.referralCode}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-2xl mb-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl transform translate-x-20 -translate-y-20"></div>
        <div className="relative z-10 max-w-2xl">
          <span className="bg-accent/20 text-accent border border-accent/30 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Partner Referrals</span>
          <h1 className="text-lg md:text-xl font-bold mt-2.5 tracking-tight leading-tight">
            Refer Electricians & Earn Up To {details?.milestones?.reduce((sum, m) => sum + m.rewardAmount, 0) ? `₹${details.milestones.reduce((sum, m) => sum + m.rewardAmount, 0)}` : 'Rewards'}
          </h1>
          <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed text-left">
            Invite professional electricians to join {companyName} as partners. You will earn milestone payouts (up to ₹{details?.milestones?.reduce((sum, m) => sum + m.rewardAmount, 0) || 750}) credited directly to your wallet as they complete jobs!
            {details?.programRules?.commissionPercentage > 0 && 
              ` Plus, your referred partner gets a ${details.programRules.commissionPercentage}% commission discount for their first ${details.programRules.expiryDays || 30} days!`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Share Box */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col">
          <div>
            <h2 className="text-xl font-bold text-secondary">Share Your Partner Invitation Link</h2>
            <p className="text-gray-500 text-xs mt-1">Send this link to electricians to register as partners</p>
            
            <div className="mt-6 flex flex-col md:flex-row items-stretch gap-3">
              <div className="flex-1 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-mono select-all overflow-x-auto truncate">
                {referralLink}
              </div>
              <Button 
                onClick={handleCopy}
                variant="secondary"
                size="lg"
                className="whitespace-nowrap font-bold"
                leftIcon={<FiCopy />}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-xl p-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Your Referral Code:</span>
              <span className="text-base font-bold text-secondary tracking-widest">{details?.referralCode}</span>
            </div>
            {details?.referredBy && (
              <div className="mt-3 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs">
                <span className="font-semibold text-gray-500 uppercase tracking-wider">Registered Using Code:</span>
                <span className="font-bold text-secondary font-mono bg-gray-200 px-2.5 py-1 rounded-md">{details.referredBy}</span>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-gray-100 pt-6">
            <Button 
              onClick={handleShare}
              variant="primary"
              className="w-full font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-5"
              leftIcon={<FiShare2 className="w-4 h-4 shrink-0" />}
            >
              Share Invitation
            </Button>
            <a 
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ${companyName} as an electrician partner with my code: ${details?.referralCode} at ${referralLink}`)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-5 bg-green-600 hover:bg-green-700 text-white active:scale-95 gap-1.5"
            >
              <FaWhatsapp className="w-4 h-4 shrink-0" />
              WhatsApp Share
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
          <h2 className="text-xl font-bold text-secondary">Milestone Earnings</h2>
          
          <div className="my-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                  <FiAward className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Rewards Released</p>
                  <p className="text-xs text-gray-500">Credited to Wallet</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600">₹{details?.totalEarnings || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FiUsers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Partners Referred</p>
                  <p className="text-xs text-gray-500">Signed Up</p>
                </div>
              </div>
              <span className="text-xl font-bold text-indigo-600">{details?.referralsCount || 0}</span>
            </div>
          </div>

          <div className="text-center bg-gray-50 rounded-xl p-3 text-xs text-gray-500 border border-gray-100">
            Unlock bonus payouts for each target milestone.
          </div>
        </div>
      </div>

      {/* Program Validity & Rules Transparency */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 text-left">
        <h2 className="text-xl font-bold text-secondary mb-4">Program Rules & Validity</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Your Referral Benefit</span>
            <span className="text-sm font-bold text-secondary mt-1 block">
              Milestone Payouts (Up to ₹{details?.milestones?.reduce((sum, m) => sum + m.rewardAmount, 0) || 750})
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Released as referred partner completes job milestones</span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Partner Onboarding Benefit</span>
            <span className="text-sm font-bold text-secondary mt-1 block">
              {details?.programRules?.commissionPercentage > 0 
                ? `${details.programRules.commissionPercentage}% Commission Discount` 
                : `Priority Electrician Onboarding`}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Valid for referred provider's first {details?.programRules?.expiryDays || 30} days</span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Referral Expiry Duration</span>
            <span className="text-sm font-bold text-secondary mt-1 block">
              {details?.programRules?.referralExpiryDays || 90} Days
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Referred partner must register and complete milestones within this time</span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Your Code Validity</span>
            <span className="text-sm font-bold text-green-600 mt-1 block flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span> Active & Valid
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Available for sharing with new electrician partners</span>
          </div>
        </div>
      </div>

      {/* Milestones Progress Bars */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 text-left">
        <h2 className="text-xl font-bold text-secondary mb-6">Referred Partner Progress</h2>
        
        {(!details?.referrals || details.referrals.length === 0) ? (
          <div className="text-center py-12 text-gray-500">
            <FiUsers className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No referred partners yet</p>
            <p className="text-xs">Invite electricians to sign up and start earning.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {details.referrals.map((ref) => {
              const isExpired = ref.status === 'expired' || (ref.expiryDate && new Date() > new Date(ref.expiryDate) && ref.status === 'pending');
              return (
                <div key={ref._id} className="border border-gray-100 rounded-xl p-6 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-secondary text-base flex flex-wrap items-center gap-2">
                        {ref.referredName}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                            <FiAlertCircle /> Expired
                          </span>
                        )}
                        {ref.status === 'fraud_flagged' && !isExpired && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                            <FiAlertCircle /> Under Verification
                          </span>
                        )}
                        {ref.status === 'released' && !isExpired && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">
                            <FiCheckCircle /> Active / Released
                          </span>
                        )}
                        {ref.status === 'pending' && !isExpired && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                            <FiClock /> Pending Milestones
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                        <span>Joined: {new Date(ref.referredJoined).toLocaleDateString()}</span>
                        <span>Expiry Date: {ref.expiryDate ? new Date(ref.expiryDate).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="bg-gray-100 text-secondary text-xs font-bold px-3 py-1.5 rounded-full shrink-0">
                      Completed Bookings: {ref.completedBookingsCount}
                    </div>
                  </div>

                {/* Milestones Progress Bars */}
                <div className="space-y-4">
                  {ref.milestones.map((m) => {
                    const percent = Math.min(100, Math.round((ref.completedBookingsCount / m.bookingsCount) * 100));
                    return (
                      <div key={m.bookingsCount} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-600">{m.description} (Reward: ₹{m.rewardAmount})</span>
                          <span className={`${m.isUnlocked ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                            {ref.completedBookingsCount} / {m.bookingsCount} bookings ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${m.isUnlocked ? 'bg-green-500' : 'bg-primary'}`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        {m.isUnlocked && (
                          <div className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-0.5">
                            <FiCheckCircle /> Reward Unlocked
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferProviders;
