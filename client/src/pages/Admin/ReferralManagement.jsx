import React, { useState, useEffect } from 'react';
import { FiUsers, FiAward, FiSettings, FiAlertTriangle, FiList, FiTrash2, FiPlus, FiCheck, FiTrendingUp, FiDollarSign, FiPercent } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  getAdminDashboard,
  getSettings,
  updateSettings,
  getMilestones,
  addMilestone,
  deleteMilestone,
  getFraudReferrals,
  getRewardLogs,
  releaseHeldReward
} from '../../services/referralApi';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import StatsCard from '../../components/ui/StatsCard';
import Button from '../../components/ui/Button';

const ReferralManagement = () => {
  // Tabs: dashboard, settings, milestones, fraud, logs
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Dashboard Stats
  const [stats, setStats] = useState({
    stats: {
      totalReferrals: 0,
      totalPaidRewards: 0,
      completedReferrals: 0,
      flaggedReferrals: 0,
      customerReferrals: 0,
      providerReferrals: 0,
      customerRewardsSum: 0,
      providerRewardsSum: 0,
      referralRevenue: 0,
      totalReferralCommission: 0,
      netProfit: 0,
      roiPercentage: 0
    }
  });

  // Settings
  const [settings, setSettings] = useState({
    customerProgramEnabled: false,
    providerProgramEnabled: false,
    minBookingAmount: 0,
    commissionPercentage: 0,
    payoutHoldHours: 0,
    monthlyBudget: 50000,
    monthlyCapPerUser: 5000,
    dailyCapPerUser: 500,
    expiryDays: 30,
    fraudScoreThreshold: 50,
    programVersion: 1,
    walletUsagePercentage: 20,
    rewardCalculationMode: 'commission',
    rewardThresholdAmount: 1000,
    fixedRewardAmount: 50
  });
  
  // Milestones
  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState({ bookingsCount: '', rewardAmount: '', description: '' });
  
  // Fraud
  const [fraudList, setFraudList] = useState([]);
  
  // Logs
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await getAdminDashboard();
        if (res.data.success) {
          const dashboardData = res.data.data;
          const allTime = dashboardData.stats?.analytics?.allTime || {};
          setStats({
            stats: {
              totalReferrals: dashboardData.stats?.totalReferrals || 0,
              completedReferrals: dashboardData.stats?.completedReferrals || 0,
              flaggedReferrals: dashboardData.stats?.flaggedReferrals || 0,
              customerReferrals: dashboardData.stats?.customerReferrals || 0,
              providerReferrals: dashboardData.stats?.providerReferrals || 0,
              totalPaidRewards: allTime.totalRewardsPaid || 0,
              customerRewardsSum: allTime.totalRewardsPaid || 0,
              providerRewardsSum: allTime.totalWelcomeRewards || 0,
              referralRevenue: allTime.totalReferralRevenue || 0,
              totalReferralCommission: allTime.totalReferralCommission || 0,
              netProfit: allTime.netProfit || 0,
              roiPercentage: allTime.roiPercentage || 0
            }
          });
        }
      } else if (activeTab === 'settings') {
        const res = await getSettings();
        if (res.data.success) setSettings(res.data.data);
      } else if (activeTab === 'milestones') {
        const res = await getMilestones();
        if (res.data.success) setMilestones(res.data.data);
      } else if (activeTab === 'fraud') {
        const res = await getFraudReferrals();
        if (res.data.success) setFraudList(res.data.data);
      } else if (activeTab === 'logs') {
        const res = await getRewardLogs();
        if (res.data.success) setLogs(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch data from server');
    } finally {
      setLoading(false);
    }
  };

  // Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await updateSettings(settings);
      if (res.data.success) {
        toast.success(`Configurations saved! Program Version is now ${res.data.data.programVersion}`);
        setSettings(res.data.data);
      } else {
        toast.error(res.data.message || 'Failed to save settings');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    }
  };

  // Milestone actions
  const handleAddMilestone = async (e) => {
    e.preventDefault();
    try {
      const res = await addMilestone(newMilestone);
      if (res.data.success) {
        toast.success('Milestone added successfully');
        setNewMilestone({ bookingsCount: '', rewardAmount: '', description: '' });
        loadData();
      } else {
        toast.error(res.data.message || 'Failed to add milestone');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add milestone');
    }
  };

  const handleDeleteMilestone = async (id) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      const res = await deleteMilestone(id);
      if (res.data.success) {
        toast.success('Milestone deleted successfully');
        loadData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete milestone');
    }
  };

  // Override Release held fraud referral
  const handleManualRelease = async (referralId) => {
    if (!window.confirm('Are you sure you want to dismiss the fraud warning and manually release the reward(s)?')) return;
    try {
      const res = await releaseHeldReward(referralId);
      if (res.data.success) {
        toast.success('Reward released successfully!');
        loadData();
      } else {
        toast.error(res.data.message || 'Failed to release reward');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release reward');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-5 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary tracking-tight">Referral & Rewards</h1>
          <p className="text-xs text-gray-500 mt-1">Configure program rules, check budgets, audit fraud logs, and monitor ROI.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 bg-gray-100 p-1.5 rounded-xl">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'dashboard' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiUsers /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('milestones')} 
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'milestones' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiAward /> Milestones
          </button>
          <button 
            onClick={() => setActiveTab('fraud')} 
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'fraud' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiAlertTriangle /> Fraud Alerts
          </button>
          <button 
            onClick={() => setActiveTab('logs')} 
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'logs' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiList /> Reward Logs
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-8 animate-fade-in">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Invites"
                  value={stats.stats.totalReferrals}
                  icon={FiUsers}
                  subtext={`${stats.stats.customerReferrals} Customers | ${stats.stats.providerReferrals} Partners`}
                />

                <StatsCard
                  title="Rewards Distributed"
                  value={`₹${stats.stats.totalPaidRewards}`}
                  icon={FiAward}
                  iconColor="text-green-600"
                  iconBg="bg-green-50"
                  subtext={`₹${stats.stats.customerRewardsSum} Customers | ₹${stats.stats.providerRewardsSum} Partners`}
                />

                <StatsCard
                  title="Referred Qualified Revenue"
                  value={`₹${stats.stats.referralRevenue}`}
                  icon={FiTrendingUp}
                  iconColor="text-indigo-600"
                  iconBg="bg-indigo-50"
                  subtext="Total completed orders from invites"
                />

                <StatsCard
                  title="Campaign ROI"
                  value={`${stats.stats.roiPercentage}%`}
                  icon={FiPercent}
                  iconColor="text-teal-600"
                  iconBg="bg-teal-50"
                  subtext={`Net Profit from campaign: ₹${stats.stats.netProfit}`}
                />
              </div>

              {/* Breakdown split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-bold text-secondary mb-4 flex items-center gap-2">
                    <FiUsers className="text-primary" /> Referrals Breakdown
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Total Referrals Registered</span>
                      <span className="font-bold text-secondary">{stats.stats.totalReferrals}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Successful Invites</span>
                      <span className="font-bold text-green-600">{stats.stats.completedReferrals}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Fraud Flagged Warning Cases</span>
                      <span className="font-bold text-red-500">{stats.stats.flaggedReferrals}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-bold text-secondary mb-4 flex items-center gap-2">
                    <FiTrendingUp className="text-accent" /> Campaign Profitability
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Qualified Commission Collected</span>
                      <span className="font-bold text-secondary">₹{stats.stats.totalReferralCommission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Total Reward Payout Cost</span>
                      <span className="font-bold text-red-500">₹{stats.stats.totalPaidRewards}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3">
                      <span className="font-bold text-secondary">Campaign Net Profit</span>
                      <span className={`font-black text-base ${stats.stats.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ₹{stats.stats.netProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )

          }

          {activeTab === 'milestones' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
              {/* Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-secondary mb-4">Add Milestone Reward</h3>
                <form onSubmit={handleAddMilestone} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Bookings Count Target</label>
                    <input 
                      type="number" 
                      value={newMilestone.bookingsCount} 
                      onChange={(e) => setNewMilestone({ ...newMilestone, bookingsCount: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Reward Amount (₹)</label>
                    <input 
                      type="number" 
                      value={newMilestone.rewardAmount} 
                      onChange={(e) => setNewMilestone({ ...newMilestone, rewardAmount: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                    <input 
                      type="text" 
                      value={newMilestone.description} 
                      onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="e.g. 5 Bookings Milestone"
                      required
                    />
                  </div>

                  <Button type="submit" variant="secondary" size="lg" className="w-full font-bold" leftIcon={<FiPlus />}>
                    Add Campaign Milestone
                  </Button>
                </form>
              </div>

              {/* Milestones List */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-secondary mb-4">Milestone Campaigns</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                        <th className="py-3 px-2">Bookings Count</th>
                        <th className="py-3 px-2">Reward Amount</th>
                        <th className="py-3 px-2">Description</th>
                        <th className="py-3 px-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {milestones.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-6 text-gray-400">No milestones set up yet</td>
                        </tr>
                      ) : (
                        milestones.map((m) => (
                          <tr key={m._id} className="hover:bg-gray-50">
                            <td className="py-3 px-2 font-bold text-secondary">{m.bookingsCount}</td>
                            <td className="py-3 px-2 text-green-600 font-bold">₹{m.rewardAmount}</td>
                            <td className="py-3 px-2 text-gray-500">{m.description}</td>
                            <td className="py-3 px-2">
                              <button onClick={() => handleDeleteMilestone(m._id)} className="text-red-500 hover:text-red-700 p-1.5">
                                <FiTrash2 />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fraud' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
              <h3 className="text-lg font-bold text-secondary mb-4">Fraud Flags & Suspicious Signup Referrals</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                      <th className="py-3 px-2">Referrer</th>
                      <th className="py-3 px-2">Referred Signup</th>
                      <th className="py-3 px-2">Abuse Flags</th>
                      <th className="py-3 px-2">Score</th>
                      <th className="py-3 px-2">IP & Device ID</th>
                      <th className="py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {fraudList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-gray-400">No flagged transactions found</td>
                      </tr>
                    ) : (
                      fraudList.map((f) => (
                        <tr key={f._id} className="hover:bg-gray-50 transition">
                          <td className="py-3 px-2">
                            <p className="font-semibold text-secondary">{f.referrer?.name || 'N/A'}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{f.referrerType}</p>
                          </td>
                          <td className="py-3 px-2">
                            <p className="font-semibold text-secondary">{f.referredUser?.name || 'N/A'}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{f.referredUserType}</p>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {f.abuseFlags.map((flag, idx) => (
                                <span key={idx} className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100">
                                  {flag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-red-600">
                            {f.fraudScore}
                          </td>
                          <td className="py-3 px-2 text-xs font-mono text-gray-500">
                            <p>{f.deviceInfo?.ip || 'N/A'}</p>
                            <p className="text-[9px] truncate max-w-[120px]">{f.deviceInfo?.deviceId || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-2">
                            <Button 
                              onClick={() => handleManualRelease(f._id)}
                              variant="success"
                              size="sm"
                              className="font-bold"
                              leftIcon={<FiCheck />}
                            >
                              Approve Override
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
              <h3 className="text-lg font-bold text-secondary mb-4">Referral Reward Release Logs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                      <th className="py-3 px-2">Recipient</th>
                      <th className="py-3 px-2">Relationship</th>
                      <th className="py-3 px-2">Program Type</th>
                      <th className="py-3 px-2">Paid Amount</th>
                      <th className="py-3 px-2">Release Date</th>
                      <th className="py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-6 text-gray-400">No rewards paid out yet</td>
                      </tr>
                    ) : (
                      logs.map((l) => (
                        <tr key={l._id} className="hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <p className="font-semibold text-secondary">{l.recipient?.name || 'N/A'}</p>
                            <p className="text-[10px] text-gray-400 uppercase">{l.recipientType}</p>
                          </td>
                          <td className="py-3 px-2 text-xs text-gray-600">
                            <p>Referrer: {l.referral?.referrer?.name || 'N/A'}</p>
                            <p>Referred: {l.referral?.referredUser?.name || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-2 text-xs font-semibold text-secondary capitalize">
                            {l.rewardType === 'customer_referral' ? 'Customer Promo' : 'Partner Milestone'}
                          </td>
                          <td className="py-3 px-2 text-green-600 font-bold">₹{l.amount}</td>
                          <td className="py-3 px-2 text-gray-500 text-xs">
                            {new Date(l.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${l.status === 'released' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReferralManagement;
