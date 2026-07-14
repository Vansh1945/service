import { useState, useEffect } from 'react';
import { FiCopy, FiShare2, FiUsers, FiGift, FiClock, FiCreditCard, FiChevronDown, FiChevronUp, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { getCustomerReferralDetails } from '../../services/referralApi';
import { getProfile as getCustomerProfile } from '../../services/CustomerService';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/Error';
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
      <div className="max-w-4xl mx-auto px-4 py-8 text-center bg-white rounded-3xl shadow border border-neutral-100">
        <FiAlertCircle className="w-12 h-12 text-danger mx-auto mb-4 animate-pulse" />
        <h1 className="text-xl font-bold text-secondary font-poppins">Program Temporarily Paused</h1>
        <p className="text-neutral-500 text-xs mt-2">Referral program is temporarily unavailable. Check back later.</p>
      </div>
    );
  }

  if (details.eligibility && !details.eligibility.eligible) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center bg-white rounded-3xl shadow border border-neutral-100 mt-10">
        <FiGift className="w-12 h-12 text-warning mx-auto mb-4 animate-bounce" />
        <h1 className="text-xl font-bold text-secondary font-poppins">Program is Locked</h1>
        <p className="text-neutral-500 text-xs mt-2">Unlocks after completing {details.eligibility.requiredBookings} bookings.</p>
        <div className="mt-6 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
          <div className="flex justify-between text-xs font-semibold mb-2 text-neutral-600">
            <span>Completed</span>
            <span>{details.eligibility.completedBookings} / {details.eligibility.requiredBookings}</span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2">
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 font-inter space-y-6">
      
      {/* Hero Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 md:py-5 md:px-6 shadow border border-white/5">
        <div className="relative z-10 max-w-2xl flex flex-col items-start gap-2.5">
          <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">Referral Program</span>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight font-poppins">Invite Friends & Earn <span className="text-primary font-black">{rewardText}</span> Reward</h1>
            <p className="text-neutral-300 text-[11px] md:text-xs mt-1.5 leading-relaxed max-w-xl">
              Share the convenience of booking verified electricians. You will get {rewardText} directly credited to your wallet for each friend who completes their first booking!
              {details.programRules?.welcomeRewardEnabled && ` Friend gets welcome reward of ₹${details.programRules?.welcomeRewardValue} instantly!`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-1">
            <Button onClick={handleShare} variant="primary" className="font-bold text-xs px-5 py-2.5 rounded-lg shadow-lg" leftIcon={<FiShare2 className="w-3.5 h-3.5" />}>Invite Friends</Button>
            <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ${companyName} with code: ${details.referralCode} at ${referralLink}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center font-bold rounded-lg text-xs px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white gap-1.5 shadow-lg active:scale-95"><FaWhatsapp className="w-4.5 h-4.5" /> WhatsApp Share</a>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Wallet Balance', value: `₹${profile?.wallet?.availableBalance ?? 0}`, sub: 'Available to spend', icon: <FiCreditCard className="w-4 h-4" />, color: 'text-primary bg-primary/10 border-primary/20' },
          { title: 'Released Rewards', value: `₹${details.releasedRewards ?? 0}`, sub: 'Credited successfully', icon: <FiGift className="w-4 h-4" />, color: 'text-success bg-success/10 border-success/20' },
          { title: 'Pending Rewards', value: `₹${displayPending}`, sub: 'Awaiting first booking', icon: <FiClock className="w-4 h-4" />, color: 'text-warning bg-warning/10 border-warning/20' },
          { title: 'Friends Invited', value: `${details.referralsCount ?? 0}`, sub: 'Signed up users', icon: <FiUsers className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-3.5 border border-neutral-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{stat.title}</span>
              <div className={`p-1.5 rounded-lg ${stat.color.split(' ')[1]} ${stat.color.split(' ')[0]}`}>{stat.icon}</div>
            </div>
            <div>
              <p className="text-lg font-black text-secondary leading-tight font-poppins">{stat.value}</p>
              <p className="text-[9px] text-neutral-400 mt-0.5">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-100 p-2 rounded-lg">
          <div className="flex-1 min-w-0 text-xs font-mono text-neutral-600 px-2 truncate select-all">{referralLink}</div>
          <button onClick={() => handleCopy(referralLink, 'link')} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${copiedType === 'link' ? 'bg-success text-white' : 'bg-white text-secondary border border-neutral-200'}`}><FiCopy className="w-3.5 h-3.5" />{copiedType === 'link' ? 'Copied!' : 'Copy Link'}</button>
        </div>
        <div className="flex items-center justify-between gap-3 bg-neutral-50 border border-neutral-100 p-2 rounded-lg">
          <div className="flex pl-2"><span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-2">CODE:</span><span className="text-xs font-extrabold text-secondary tracking-widest">{details.referralCode}</span></div>
          <button onClick={() => handleCopy(details.referralCode, 'code')} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${copiedType === 'code' ? 'bg-success text-white' : 'bg-white text-secondary border border-neutral-200'}`}><FiCopy className="w-3.5 h-3.5" />{copiedType === 'code' ? 'Copied!' : 'Copy Code'}</button>
        </div>
      </div>

      {/* Accordion Rules */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-100 space-y-2">
        <h2 className="text-xs font-bold text-secondary font-poppins">Program Details & Transparency</h2>
        <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
          {rules.map((item, idx) => {
            const isOpen = activeRules === idx;
            return (
              <div key={idx} className="transition-all">
                <button onClick={() => setActiveRules(isOpen ? null : idx)} className="w-full px-3.5 py-2.5 flex items-center justify-between text-left font-semibold text-xs text-secondary hover:bg-neutral-50 transition-colors">
                  <span className="font-poppins">{item.title}</span>
                  {isOpen ? <FiChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" /> : <FiChevronDown className="w-3.5 h-3.5 transition-transform" />}
                </button>
                {isOpen && <div className="px-3.5 pb-3 pt-1 text-[11px] text-neutral-500 bg-neutral-50/50 whitespace-pre-line leading-relaxed">{item.desc}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-100 text-left">
        <h2 className="text-xs font-bold text-secondary font-poppins mb-3">Referral History</h2>
        {processedReferrals.length === 0 ? (
          <div className="text-center py-6 text-neutral-400">
            <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-xs text-secondary">No referrals yet</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">
                    <th className="pb-2 px-2">Friend Name</th>
                    <th className="pb-2 px-2">Join Date</th>
                    <th className="pb-2 px-2">Expiry Date</th>
                    <th className="pb-2 px-2">Progress Tracker</th>
                    <th className="pb-2 px-2">Status</th>
                    <th className="pb-2 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {processedReferrals.map((ref) => (
                    <tr key={ref._id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-2.5 px-2 font-semibold text-secondary">{ref.referredName}</td>
                      <td className="py-2.5 px-2 text-neutral-500">{ref.referredJoined ? new Date(ref.referredJoined).toLocaleDateString() : 'N/A'}</td>
                      <td className="py-2.5 px-2 text-neutral-500">{ref.expiryDate ? new Date(ref.expiryDate).toLocaleDateString() : 'N/A'}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full bg-success/15 text-success border border-success/30 flex items-center justify-center text-[7px]">✅</span>
                          <span className="w-1 h-px bg-neutral-200"></span>
                          <span className="w-3.5 h-3.5 rounded-full bg-success/15 text-success border border-success/30 flex items-center justify-center text-[7px]">✅</span>
                          <span className="w-1 h-px bg-neutral-200"></span>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${ref.isCompleted ? 'bg-success/15 text-success border border-success/30' : ref.isExpired ? 'bg-danger/15 text-danger border border-danger/30' : 'bg-warning/15 text-warning border border-warning/30'}`}>{ref.isCompleted ? '✅' : ref.isExpired ? '❌' : '⏳'}</span>
                          <span className="w-1 h-px bg-neutral-200"></span>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${ref.isCompleted ? 'bg-success/15 text-success border border-success/30' : ref.isExpired ? 'bg-danger/15 text-danger border border-danger/30' : 'bg-warning/15 text-warning border border-warning/30'}`}>{ref.isCompleted ? '✅' : ref.isExpired ? '❌' : '⏳'}</span>
                          <span className="w-1 h-px bg-neutral-200"></span>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${ref.isCompleted ? 'bg-success/15 text-success border border-success/30' : ref.isExpired ? 'bg-danger/15 text-danger border border-danger/30' : 'bg-neutral-50 text-neutral-450 border border-neutral-200'}`}>{ref.isCompleted ? '💰' : ref.isExpired ? '❌' : '⏳'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`font-semibold ${ref.isCompleted ? 'text-success' : ref.isExpired ? 'text-danger' : 'text-neutral-500'}`}>
                          {ref.isCompleted ? 'Credited' : ref.isExpired ? 'Expired' : ref.status === 'fraud_flagged' ? 'Held' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-secondary">{ref.displayAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="block md:hidden space-y-2">
              {processedReferrals.map((ref) => {
                const initials = ref.referredName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                return (
                  <div key={ref._id} className="bg-neutral-50 rounded-lg p-3 border border-neutral-100 flex flex-col gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">{initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2">
                          <h4 className="text-xs font-bold text-secondary truncate">{ref.referredName}</h4>
                          <span className="text-[9px] text-neutral-400">{ref.referredJoined ? new Date(ref.referredJoined).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center mt-0.5 text-[9px] text-neutral-400">
                          <span>Expiry: {ref.expiryDate ? new Date(ref.expiryDate).toLocaleDateString() : 'N/A'}</span>
                          <span className="font-bold text-secondary">Val: {ref.displayAmount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-neutral-200/50 pt-2">
                      <div className="grid grid-cols-5 gap-0.5 text-center relative">
                        <div className="absolute top-2 left-[10%] right-[10%] h-px bg-neutral-200 -z-0"></div>
                        {[
                          { label: 'Invite', done: true, icon: '✅' },
                          { label: 'Register', done: true, icon: '✅' },
                          { label: 'Booking', done: ref.isCompleted, icon: ref.isCompleted ? '✅' : (ref.isExpired ? '❌' : '⏳') },
                          { label: 'Pending', done: ref.isCompleted, icon: ref.isCompleted ? '✅' : (ref.isExpired ? '❌' : '⏳') },
                          { label: 'Reward', done: ref.isCompleted, icon: ref.isCompleted ? '💰' : (ref.isExpired ? '❌' : '⏳') }
                        ].map((step, idx) => (
                          <div key={idx} className="relative z-10 flex flex-col items-center">
                            <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold ${step.done ? 'bg-success/15 text-success border border-success/30' : 'bg-white text-neutral-400 border border-neutral-200'}`}>{step.icon}</div>
                            <span className="text-[7px] font-bold text-neutral-500 mt-0.5 block truncate w-full">{step.label}</span>
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
  );
};

export default ReferEarn;
