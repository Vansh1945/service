import { useState, useEffect } from 'react';
import { FiCopy, FiShare2, FiUsers, FiGift, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { getCustomerReferralDetails } from '../../services/referralApi';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/Error';
import { useAuth } from '../../context/auth';

const ReferEarn = () => {
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
      const res = await getCustomerReferralDetails();
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
    navigator.clipboard.writeText(details.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!details?.referralCode) return;
    const text = `Join ${companyName} using my referral code: ${details.referralCode} and book certified electricians for home/commercial electrical jobs!`;
    if (navigator.share) {
      navigator.share({
        title: 'Refer & Earn',
        text: text,
        url: window.location.origin
      }).catch(console.error);
    } else {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + window.location.origin)}`;
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
            <FiGift className="w-10 h-10 animate-bounce" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-secondary">Referral Program is Locked</h1>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            To prevent spam and ensure genuine user referrals, our referral program unlocks after you complete at least {details.eligibility.requiredBookings} booking{details.eligibility.requiredBookings > 1 ? 's' : ''}.
          </p>

          <div className="mt-8 max-w-md mx-auto bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span className="text-gray-500">Completed Bookings</span>
              <span className="text-primary">{details.eligibility.completedBookings} / {details.eligibility.requiredBookings}</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${details.eligibility.progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {details.eligibility.requiredBookings - details.eligibility.completedBookings} more booking{details.eligibility.requiredBookings - details.eligibility.completedBookings > 1 ? 's' : ''} to go!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register?ref=${details?.referralCode}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Banner Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-2xl mb-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl transform translate-x-20 -translate-y-20"></div>
        <div className="relative z-10 max-w-2xl">
          <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Invite Friends</span>
          <h1 className="text-lg md:text-xl font-bold mt-2.5 tracking-tight leading-tight">
            Invite Friends & Earn {details?.programRules?.rewardCalculationMode === 'fixed' ? `₹${details?.programRules?.fixedRewardAmount}` : `${details?.programRules?.commissionPercentage}% Commission`}
          </h1>
          <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed">
            {details?.programRules?.rewardCalculationMode === 'fixed' 
              ? `Share the convenience of booking verified electricians. You will get ₹${details?.programRules?.fixedRewardAmount} directly credited to your wallet for each friend you refer who completes their first booking!` 
              : `Share the convenience of booking verified electricians. You will get ${details?.programRules?.commissionPercentage}% of the booking commission amount credited directly to your wallet when your referred friend completes their first job!`}
            {details?.programRules?.welcomeRewardEnabled && details?.programRules?.welcomeRewardValue > 0 && 
              ` Plus, your friend gets a welcome reward of ₹${details?.programRules?.welcomeRewardValue} instantly!`}
          </p>
        </div>
      </div>

      {/* Referral Info & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Referral Code Share Box */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col">
          <div>
            <h2 className="text-xl font-bold text-secondary">Your Referral Link & Code</h2>
            <p className="text-gray-500 text-xs mt-1">Copy your unique link or share it directly with friends</p>

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

            <div className="mt-4 flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl p-4">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Your Referral Code:</span>
              <span className="text-base font-bold text-secondary tracking-widest">{details?.referralCode}</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-gray-100 pt-6">
            <Button
              onClick={handleShare}
              variant="primary"
              className="w-full font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-5"
              leftIcon={<FiShare2 className="w-4 h-4 shrink-0" />}
            >
              Share Link
            </Button>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ${companyName} with my code: ${details?.referralCode} at ${window.location.origin}`)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-5 bg-green-600 hover:bg-green-700 text-white active:scale-95 gap-1.5"
            >
              <FaWhatsapp className="w-4 h-4 shrink-0" />
              WhatsApp Share
            </a>
          </div>
        </div>

        {/* Earning Stats */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
          <h2 className="text-xl font-bold text-secondary">Referral Balance</h2>

          <div className="my-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                  <FiGift className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Released Rewards</p>
                  <p className="text-xs text-gray-500">Credited to Wallet</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600">₹{details?.releasedRewards || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <FiClock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Pending Rewards</p>
                  <p className="text-xs text-gray-500">Awaiting Friend's Booking</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600">₹{details?.pendingRewards || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FiUsers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Total Friends Invited</p>
                  <p className="text-xs text-gray-500">Signed Up</p>
                </div>
              </div>
              <span className="text-xl font-bold text-indigo-600">{details?.referralsCount || 0}</span>
            </div>
          </div>

          <div className="text-center bg-gray-50 rounded-xl p-3 text-xs text-gray-500 border border-gray-100">
            Rewards are automatically credited on booking success.
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
              {details?.programRules?.rewardCalculationMode === 'fixed' 
                ? `₹${details?.programRules?.fixedRewardAmount} Fixed Wallet Cash` 
                : `${details?.programRules?.commissionPercentage}% Commission Share`}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Earned on friend's first successful booking</span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Friend's Benefit</span>
            <span className="text-sm font-bold text-secondary mt-1 block">
              {details?.programRules?.welcomeRewardEnabled && details?.programRules?.welcomeRewardValue > 0 
                ? `₹${details?.programRules?.welcomeRewardValue} Welcome Bonus` 
                : `Verified Electrician Access`}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Released on signup/first booking completion</span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Referral Expiry Duration</span>
            <span className="text-sm font-bold text-secondary mt-1 block">
              {details?.programRules?.referralExpiryDays || 90} Days
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Friend must complete first booking within this time</span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">Your Code Validity</span>
            <span className="text-sm font-bold text-green-600 mt-1 block flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span> Active & Valid
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">Available for sharing with new friends</span>
          </div>
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left">
        <h2 className="text-xl font-bold text-secondary mb-6">Referral History</h2>

        {(!details?.referrals || details.referrals.length === 0) ? (
          <div className="text-center py-12 text-gray-500">
            <FiUsers className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No referrals yet</p>
            <p className="text-xs">Invite your friends to earn cashback rewards!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-4">Friend Name</th>
                  <th className="py-4 px-4">Join Date</th>
                  <th className="py-4 px-4">Expiry Date</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Reward Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {details.referrals.map((ref) => {
                  const isExpired = ref.status === 'expired' || (ref.expiryDate && new Date() > new Date(ref.expiryDate) && ref.status === 'pending');
                  return (
                    <tr key={ref._id} className="hover:bg-gray-50 transition">
                      <td className="py-4 px-4 font-semibold text-secondary">{ref.referredName}</td>
                      <td className="py-4 px-4 text-gray-500">
                        {ref.referredJoined ? new Date(ref.referredJoined).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-gray-500">
                        {ref.expiryDate ? new Date(ref.expiryDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-4">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700">
                            <FiAlertCircle /> Expired
                          </span>
                        ) : (
                          <>
                            {ref.status === 'completed' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700">
                                <FiCheckCircle /> First Booking Completed
                              </span>
                            )}
                            {ref.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                                <FiClock /> Signup Successful
                              </span>
                            )}
                            {ref.status === 'fraud_flagged' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700">
                                <FiAlertCircle /> Under Verification
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {isExpired ? (
                          <span className="text-red-500 font-semibold">Expired (No Reward)</span>
                        ) : ref.status === 'completed' ? (
                          <span className="text-green-600 font-bold">Reward Credited</span>
                        ) : ref.status === 'fraud_flagged' ? (
                          <span className="text-red-500 font-semibold">Held for Review</span>
                        ) : (
                          <span className="text-gray-500">Pending Booking Completion</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferEarn;
