import { useState, useEffect } from 'react';
import { FiCopy, FiShare2, FiUsers, FiGift, FiClock, FiCreditCard, FiChevronDown, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { getCustomerReferralDetails } from '../../services/referralApi';
import { getProfile as getCustomerProfile } from '../../services/CustomerService';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import { useAuth } from '../../context/auth';

const ReferEarn = () => {
  const [details, setDetails] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState('');
  const [activeRules, setActiveRules] = useState(null);
  const { systemSettings } = useAuth();
  const companyName = systemSettings?.companyName || 'Raj Electrical Service';

  useEffect(() => {
    Promise.all([getCustomerReferralDetails(), getCustomerProfile().catch(() => null)])
      .then(([res, profileRes]) => {
        if (res.data.success) setDetails(res.data.data);
        if (profileRes?.data?.success) setProfile(profileRes.data.user || profileRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${details?.referralCode}`;

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(''), 2000);
  };

  const handleShare = () => {
    const text = `Join ${companyName} using my referral code: ${details?.referralCode} at ${referralLink}`;
    if (navigator.share) {
      navigator.share({ title: 'Refer & Earn', text, url: referralLink }).catch(console.error);
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!details || details.paused) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center bg-white rounded-2xl shadow-sm border border-neutral-100">
        <FiAlertCircle className="w-12 h-12 text-danger mx-auto mb-4 animate-pulse" />
        <h1 className="text-lg font-bold text-neutral-800 font-poppins">Program Temporarily Paused</h1>
        <p className="text-neutral-500 text-xs mt-2 font-medium">Referral program is temporarily unavailable. Check back later.</p>
      </div>
    );
  }

  if (details.eligibility && !details.eligibility.eligible) {
    return (
      <div className="max-w-md mx-auto px-6 py-8 text-center bg-white rounded-2xl shadow-sm border border-neutral-100 mt-10">
        <FiGift className="w-12 h-12 text-warning mx-auto mb-4 animate-bounce" />
        <h1 className="text-lg font-bold text-neutral-800 font-poppins">Program is Locked</h1>
        <p className="text-neutral-500 text-xs mt-2 font-medium">Unlocks after completing {details.eligibility.requiredBookings} bookings.</p>
        <div className="mt-6 bg-neutral-100/30 p-4 rounded-xl border border-neutral-100">
          <div className="flex justify-between text-xs font-bold mb-2 text-neutral-600">
            <span>Completed</span>
            <span>{details.eligibility.completedBookings} / {details.eligibility.requiredBookings}</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${details.eligibility.progress}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  const rewardText = details.programRules?.rewardCalculationMode === 'fixed' 
    ? `₹${details.programRules?.fixedRewardAmount}` 
    : `${details.programRules?.commissionPercentage}%`;

  const pendingCount = details.referrals?.filter(ref => ref.status === 'pending')?.length || 0;
  const calculatedPending = details.programRules?.rewardCalculationMode === 'fixed' ? (pendingCount * (details.programRules?.fixedRewardAmount || 0)) : 0;
  const displayPending = details.pendingRewards || calculatedPending;

  const processedReferrals = (details.referrals || []).map(ref => {
    const isCompleted = ['released', 'completed'].includes(ref.status);
    const isExpired = ref.status === 'expired' || (ref.expiryDate && new Date() > new Date(ref.expiryDate) && ref.status === 'pending');
    const displayAmount = isExpired ? '—' : (details.programRules?.rewardCalculationMode === 'fixed' ? `₹${details.programRules?.fixedRewardAmount || 0}` : `${details.programRules?.commissionPercentage || 0}%`);
    return { ...ref, isCompleted, isExpired, displayAmount };
  });

  const rules = [
    { title: 'How Referral Works', desc: `1. Share link or code. 2. Friend signs up. 3. Friend completes first booking (min ₹${details.programRules?.minBookingAmount || 0}). 4. You receive wallet reward!` },
    { title: 'Reward Details', desc: `Earn ${rewardText} on friend's first job. Friend gets ₹${details.programRules?.welcomeRewardValue || 0} welcome cash.` },
    { title: 'Referral Validity', desc: `Validity duration is ${details.programRules?.referralExpiryDays || 90} days from signup.` },
    { title: 'Terms & Conditions', desc: `Self-referrals are prohibited. Rewards credited after first job completion.` }
  ];

  return (
    <div className="bg-neutral-100/30 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 font-inter">
        
        {/* Hero Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white rounded-2xl p-6 shadow-md shadow-neutral-950/20 border border-neutral-800/80 text-left">
          <div className="relative z-10 max-w-2xl flex flex-col items-start gap-3">
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-poppins">Referral Program</span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight font-poppins">Invite Friends & Earn <span className="text-primary font-black">{rewardText}</span> Reward</h1>
              <p className="text-neutral-400 text-xs mt-2 leading-relaxed max-w-xl font-medium">
                Share the convenience of booking verified electricians. You will get {rewardText} directly credited to your wallet for each friend who completes their first booking!
                {details.programRules?.welcomeRewardEnabled && ` Friend gets welcome reward of ₹${details.programRules?.welcomeRewardValue} instantly!`}
              </p>
            </div>
            <div className="flex flex-row items-center gap-3 w-full sm:max-w-md mt-2">
              <button 
                onClick={handleShare} 
                className="flex-1 h-10 inline-flex items-center justify-center font-bold rounded-xl text-xs px-4 bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-sm hover:scale-[0.98] transition-transform duration-200 whitespace-nowrap"
              >
                <FiShare2 className="w-3.5 h-3.5" /> Invite Friends
              </button>
              <a 
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ${companyName} with code: ${details.referralCode} at ${referralLink}`)}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex-1 h-10 inline-flex items-center justify-center font-bold rounded-xl text-xs px-4 bg-success hover:bg-success/90 text-white gap-1.5 shadow-sm hover:scale-[0.98] transition-transform duration-200 whitespace-nowrap"
              >
                <FaWhatsapp className="w-4 h-4" /> WhatsApp Share
              </a>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            systemSettings?.featureFlags?.walletEnabled !== false && { title: 'Wallet Balance', value: `₹${profile?.wallet?.availableBalance ?? 0}`, sub: 'Available to spend', icon: <FiCreditCard className="w-4.5 h-4.5" />, colorBg: 'bg-primary/10', colorText: 'text-primary' },
            systemSettings?.featureFlags?.walletEnabled !== false && { title: 'Released Rewards', value: `₹${details.releasedRewards ?? 0}`, sub: 'Credited successfully', icon: <FiGift className="w-4.5 h-4.5" />, colorBg: 'bg-success/10', colorText: 'text-success' },
            systemSettings?.featureFlags?.walletEnabled !== false && { title: 'Pending Rewards', value: `₹${displayPending}`, sub: 'Awaiting first booking', icon: <FiClock className="w-4.5 h-4.5" />, colorBg: 'bg-warning/10', colorText: 'text-warning' },
            { title: 'Friends Invited', value: `${details.referralsCount ?? 0}`, sub: 'Signed up users', icon: <FiUsers className="w-4.5 h-4.5" />, colorBg: 'bg-info/10', colorText: 'text-info' }
          ].filter(Boolean).map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm flex flex-col justify-between text-left hover:scale-[0.98] transition-transform duration-200 h-28">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-poppins">{stat.title}</span>
                <div className={`p-2 rounded-xl ${stat.colorBg} ${stat.colorText}`}>{stat.icon}</div>
              </div>
              <div>
                <p className="text-xl font-black text-neutral-800 leading-tight font-poppins">{stat.value}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Credentials */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100 space-y-6 text-left">
          <h2 className="text-sm font-bold text-neutral-800 font-poppins">Share Your Referral Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Referral Link */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-poppins">Referral Link</span>
              <div className="flex items-center gap-2">
                <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-2.5 text-xs font-mono text-neutral-600 truncate select-all flex-1 h-10 flex items-center">
                  {referralLink}
                </div>
                <button 
                  onClick={() => handleCopy(referralLink, 'link')}
                  className={`px-4 h-10 text-xs font-bold rounded-xl transition-all hover:scale-[0.98] shrink-0 ${copiedType === 'link' ? 'bg-success text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/50'}`}
                >
                  {copiedType === 'link' ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-poppins">Referral Code</span>
              <div className="flex items-center gap-2">
                <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-2.5 text-xs font-extrabold text-neutral-800 tracking-widest uppercase flex-1 h-10 flex items-center">
                  {details?.referralCode}
                </div>
                <button 
                  onClick={() => handleCopy(details?.referralCode || '', 'code')}
                  className={`px-4 h-10 text-xs font-bold rounded-xl transition-all hover:scale-[0.98] shrink-0 ${copiedType === 'code' ? 'bg-success text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/50'}`}
                >
                  {copiedType === 'code' ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Program Transparency */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100 space-y-4 text-left">
          <h2 className="text-sm font-bold text-neutral-800 font-poppins">Program Details & Transparency</h2>
          
          {/* Desktop Grid */}
          <div className="hidden sm:grid grid-cols-2 gap-4">
            {rules.map((rule, idx) => (
              <div key={idx} className="p-4 bg-neutral-100/30 border border-neutral-100 rounded-2xl hover:bg-neutral-100/50 transition-all duration-200">
                <h4 className="text-[10px] font-bold text-neutral-800 uppercase tracking-wider mb-1.5 font-poppins">{rule.title}</h4>
                <p className="text-xs text-neutral-500 font-medium leading-relaxed">{rule.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile Accordion */}
          <div className="block sm:hidden border border-neutral-100 rounded-2xl overflow-hidden divide-y divide-neutral-100">
            {rules.map((item, idx) => {
              const isOpen = activeRules === idx;
              return (
                <div key={idx} className="transition-all bg-white">
                  <button onClick={() => setActiveRules(isOpen ? null : idx)} className="w-full px-4 py-3 flex items-center justify-between text-left font-bold text-xs text-neutral-700 hover:bg-neutral-100/30 transition-colors">
                    <span className="font-poppins">{item.title}</span>
                    <FiChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-neutral-400'}`} />
                  </button>
                  {isOpen && <div className="px-4 pb-3.5 pt-1 text-xs text-neutral-500 bg-neutral-100/10 leading-relaxed font-medium">{item.desc}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100 text-left space-y-4">
          <h2 className="text-sm font-bold text-neutral-800 font-poppins">Referral History</h2>
          {processedReferrals.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-neutral-100 p-6">
              <FiUsers className="w-10 h-10 mx-auto mb-3 text-neutral-350 stroke-[1.5]" />
              <h3 className="font-bold text-xs text-neutral-700 font-poppins">No referrals yet</h3>
              <p className="text-neutral-500 text-[11px] mt-1">Start inviting friends to earn wallet rewards.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-hidden border border-neutral-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-100/50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-100">
                      <th className="py-3 px-4">Friend Name</th>
                      <th className="py-3 px-4">Join Date</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Progress Tracker</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-600">
                    {processedReferrals.map((ref) => (
                      <tr key={ref._id} className="hover:bg-neutral-100/10 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-neutral-800">{ref.referredName}</td>
                        <td className="py-3.5 px-4 text-neutral-500">{ref.referredJoined ? new Date(ref.referredJoined).toLocaleDateString() : 'N/A'}</td>
                        <td className="py-3.5 px-4 text-neutral-500">{ref.expiryDate ? new Date(ref.expiryDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-success/10 text-success border border-success/20 flex items-center justify-center text-[8px]">✓</span>
                            <span className="w-1.5 h-px bg-neutral-250"></span>
                            <span className="w-4 h-4 rounded-full bg-success/10 text-success border border-success/20 flex items-center justify-center text-[8px]">✓</span>
                            <span className="w-1.5 h-px bg-neutral-250"></span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${ref.isCompleted ? 'bg-success/10 text-success border border-success/20' : ref.isExpired ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-warning/10 text-warning border border-warning/20'}`}>{ref.isCompleted ? '✓' : ref.isExpired ? '✕' : '⏳'}</span>
                            <span className="w-1.5 h-px bg-neutral-250"></span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${ref.isCompleted ? 'bg-success/10 text-success border border-success/20' : ref.isExpired ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning border border-warning/20'}`}>{ref.isCompleted ? '✓' : ref.isExpired ? '✕' : '⏳'}</span>
                            <span className="w-1.5 h-px bg-neutral-250"></span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${ref.isCompleted ? 'bg-success/10 text-success border border-success/20' : ref.isExpired ? 'bg-danger/10 text-danger' : 'bg-neutral-50 text-neutral-400 border border-neutral-200'}`}>{ref.isCompleted ? '₹' : ref.isExpired ? '✕' : '⏳'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            ref.isCompleted ? 'bg-success/10 text-success' :
                            ref.isExpired ? 'bg-danger/10 text-danger' :
                            ref.status === 'fraud_flagged' ? 'bg-danger/10 text-danger' :
                            'bg-warning/10 text-warning'
                          }`}>
                            {ref.isCompleted ? 'Credited' : ref.isExpired ? 'Expired' : ref.status === 'fraud_flagged' ? 'Held' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-neutral-850">{ref.displayAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden space-y-3">
                {processedReferrals.map((ref) => {
                  const initials = ref.referredName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                  return (
                    <div key={ref._id} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-2">
                            <h4 className="text-xs font-bold text-neutral-800 truncate">{ref.referredName}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              ref.isCompleted ? 'bg-success/10 text-success' :
                              ref.isExpired ? 'bg-danger/10 text-danger' :
                              ref.status === 'fraud_flagged' ? 'bg-danger/10 text-danger' :
                              'bg-warning/10 text-warning'
                            }`}>
                              {ref.isCompleted ? 'Credited' : ref.isExpired ? 'Expired' : ref.status === 'fraud_flagged' ? 'Held' : 'Pending'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-[10px] text-neutral-500 font-medium">
                            <span>Joined: {ref.referredJoined ? new Date(ref.referredJoined).toLocaleDateString() : 'N/A'}</span>
                            <span className="font-bold text-neutral-800">{ref.displayAmount}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-neutral-200/50 pt-3">
                        <div className="grid grid-cols-5 gap-1 text-center relative">
                          <div className="absolute top-2 left-[10%] right-[10%] h-px bg-neutral-200 -z-0"></div>
                          {[
                            { label: 'Invite', done: true, icon: '✓' },
                            { label: 'Register', done: true, icon: '✓' },
                            { label: 'Booking', done: ref.isCompleted, icon: ref.isCompleted ? '✓' : (ref.isExpired ? '✕' : '⏳') },
                            { label: 'Pending', done: ref.isCompleted, icon: ref.isCompleted ? '✓' : (ref.isExpired ? '✕' : '⏳') },
                            { label: 'Reward', done: ref.isCompleted, icon: ref.isCompleted ? '₹' : (ref.isExpired ? '✕' : '⏳') }
                          ].map((step, idx) => (
                            <div key={idx} className="relative z-10 flex flex-col items-center">
                              <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold ${step.done ? 'bg-success/10 text-success border border-success/20' : 'bg-white text-neutral-450 border border-neutral-200'}`}>{step.icon}</div>
                              <span className="text-[8px] font-bold text-neutral-450 mt-1 block truncate w-full">{step.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferEarn;
