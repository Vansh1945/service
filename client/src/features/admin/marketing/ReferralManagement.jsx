import React, { useState, useEffect } from 'react';
import { FiUsers, FiAward, FiAlertTriangle, FiList, FiTrash2, FiPlus, FiCheck, FiTrendingUp, FiDollarSign, FiPercent, FiUserCheck, FiFilter } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  getAdminDashboard,
  getMilestones,
  addMilestone,
  deleteMilestone,
  getFraudReferralsFiltered,
  getRewardLogsFiltered,
  releaseHeldReward,
  getAdminReferralsList,
  getSettings
} from '../../../services/referralApi';
import LoadingSpinner from '../../../components/ui/Loader';
import { normalizeStatus } from '../../../utils/status';
import StatCard from '../../../components/ui/StatCard';
import Button from '../../../components/ui/Button';

const ReferralManagement = () => {
  // 5 Top-Level Tabs: overview, provider, customer, fraud, ledger
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Overall & Financial Data from Backend
  const [dashboardData, setDashboardData] = useState(null);
  const [systemConfig, setSystemConfig] = useState(null);

  // Milestones Data
  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState({ bookingsCount: '', rewardAmount: '', description: '' });

  // Referrals List Data (Provider / Customer)
  const [referralsList, setReferralsList] = useState([]);

  // Fraud List Data & Filters
  const [fraudList, setFraudList] = useState([]);
  const [fraudProgramFilter, setFraudProgramFilter] = useState('all');
  const [fraudRoleFilter, setFraudRoleFilter] = useState('all');

  // Reward Ledger Logs & Filters
  const [logs, setLogs] = useState([]);
  const [ledgerProgramFilter, setLedgerProgramFilter] = useState('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [activeTab, fraudProgramFilter, fraudRoleFilter, ledgerProgramFilter, ledgerStatusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await getAdminDashboard();
        if (res.data.success) {
          setDashboardData(res.data.data);
        }
      } else if (activeTab === 'provider') {
        const [mRes, rRes, sRes] = await Promise.all([
          getMilestones(),
          getAdminReferralsList('provider', 'all'),
          getSettings()
        ]);
        if (mRes.data.success) setMilestones(mRes.data.data);
        if (rRes.data.success) setReferralsList(rRes.data.data);
        if (sRes.data.success) setSystemConfig(sRes.data.data?.referralSettings);
      } else if (activeTab === 'customer') {
        const [rRes, sRes] = await Promise.all([
          getAdminReferralsList('customer', 'all'),
          getSettings()
        ]);
        if (rRes.data.success) setReferralsList(rRes.data.data);
        if (sRes.data.success) setSystemConfig(sRes.data.data?.referralSettings);
      } else if (activeTab === 'fraud') {
        const res = await getFraudReferralsFiltered(fraudProgramFilter, fraudRoleFilter);
        if (res.data.success) setFraudList(res.data.data);
      } else if (activeTab === 'ledger') {
        const res = await getRewardLogsFiltered(ledgerProgramFilter, ledgerStatusFilter, 'all');
        if (res.data.success) setLogs(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch data from server');
    } finally {
      setLoading(false);
    }
  };

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

  const stats = dashboardData?.stats || {};
  const providerFin = stats?.providerFinancialSummary || {};
  const customerFin = stats?.customerFinancialSummary || {};

  return (
    <div className="w-full px-2 sm:px-4 py-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-5 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary tracking-tight font-poppins">Referral &amp; Rewards Management</h1>
          <p className="text-xs text-gray-500 mt-1 font-inter">Unified Console for Provider Milestones, Customer Sharing, Fraud Audit, and Reward Ledgers.</p>
        </div>

        {/* 5 Top-Level Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 md:mt-0 bg-gray-100 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'overview' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiTrendingUp className="w-3.5 h-3.5" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('provider')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'provider' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiUserCheck className="w-3.5 h-3.5" /> Provider Referral
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'customer' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiUsers className="w-3.5 h-3.5" /> Customer Referral
          </button>
          <button
            onClick={() => setActiveTab('fraud')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'fraud' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiAlertTriangle className="w-3.5 h-3.5" /> Fraud &amp; Risk
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'ledger' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            <FiList className="w-3.5 h-3.5" /> Reward Ledger
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* ==================== 1. OVERVIEW TAB ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Referrals"
                  value={stats.totalReferrals || 0}
                  icon={FiUsers}
                  subtext={`${stats.providerReferrals || 0} Provider | ${stats.customerReferrals || 0} Customer`}
                />
                <StatCard
                  title="Released Rewards"
                  value={`₹${(stats.providerReleasedRewards || 0) + (stats.customerReleasedRewards || 0)}`}
                  icon={FiAward}
                  iconColor="text-green-600"
                  iconBg="bg-green-50"
                  subtext={`₹${stats.providerReleasedRewards || 0} Provider | ₹${stats.customerReleasedRewards || 0} Customer`}
                />
                <StatCard
                  title="Pending Rewards"
                  value={`₹${(stats.providerPendingRewards || 0) + (stats.customerPendingRewards || 0)}`}
                  icon={FiDollarSign}
                  iconColor="text-amber-600"
                  iconBg="bg-amber-50"
                  subtext={`₹${stats.providerPendingRewards || 0} Provider | ₹${stats.customerPendingRewards || 0} Customer`}
                />
                <StatCard
                  title="Referred Revenue"
                  value={`₹${(stats.providerReferredRevenue || 0) + (stats.customerReferredRevenue || 0)}`}
                  icon={FiTrendingUp}
                  iconColor="text-indigo-600"
                  iconBg="bg-indigo-50"
                  subtext={`₹${stats.providerReferredRevenue || 0} Provider | ₹${stats.customerReferredRevenue || 0} Customer`}
                />
              </div>

              {/* Separate Financial Summaries */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Provider Referral Financial Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                    <FiUserCheck className="w-5 h-5 text-primary" />
                    <h3 className="text-base font-bold text-secondary font-poppins">Provider Referral Financial Summary</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Platform Commission Generated</span>
                      <span className="font-bold text-secondary">₹{providerFin.platformCommissionGenerated?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Referral Rewards Released</span>
                      <span className="font-bold text-red-500">₹{providerFin.referralRewardsReleased || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600 border-t border-gray-100 pt-2 font-semibold">
                      <span>Company Retained Commission</span>
                      <span className="font-bold text-green-600">₹{providerFin.companyRetainedCommission?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Referred Booking Revenue</span>
                      <span>₹{providerFin.referredRevenue || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Referral Financial Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                    <FiUsers className="w-5 h-5 text-accent" />
                    <h3 className="text-base font-bold text-secondary font-poppins">Customer Referral Financial Summary</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Customer Marketing Spend</span>
                      <span className="font-bold text-secondary">₹{customerFin.customerReferralMarketingSpend || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Cash Rewards Released</span>
                      <span className="font-bold text-secondary">₹{customerFin.cashRewards || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600 border-t border-gray-100 pt-2 font-semibold">
                      <span>Total Customer Referral Cost</span>
                      <span className="font-bold text-red-500">₹{customerFin.totalCustomerReferralCost || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Referred Booking Revenue</span>
                      <span>₹{customerFin.referredRevenue || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 2. PROVIDER REFERRAL TAB ==================== */}
          {activeTab === 'provider' && (
            <div className="space-y-8 animate-fade-in">
              {/* Sub-section: Milestones */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-bold text-secondary mb-4 font-poppins">Add Provider Milestone Rule</h3>
                  <form onSubmit={handleAddMilestone} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Bookings Count Target</label>
                      <input
                        type="number"
                        value={newMilestone.bookingsCount}
                        onChange={(e) => setNewMilestone({ ...newMilestone, bookingsCount: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Reward Amount (₹)</label>
                      <input
                        type="number"
                        value={newMilestone.rewardAmount}
                        onChange={(e) => setNewMilestone({ ...newMilestone, rewardAmount: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                      <input
                        type="text"
                        value={newMilestone.description}
                        onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none mt-1"
                        placeholder="e.g. 5 Bookings Milestone"
                        required
                      />
                    </div>
                    <Button type="submit" variant="secondary" size="lg" className="w-full font-bold" leftIcon={<FiPlus />}>
                      Add Milestone
                    </Button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-bold text-secondary mb-4 font-poppins">Provider Milestone Performance Rules</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 font-bold text-gray-500 uppercase">
                          <th className="py-3 px-3">Jobs Target</th>
                          <th className="py-3 px-3">Reward Value</th>
                          <th className="py-3 px-3">Description</th>
                          <th className="py-3 px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {milestones.length === 0 ? (
                          <tr><td colSpan="4" className="text-center py-6 text-gray-400">No milestones set up yet</td></tr>
                        ) : (
                          milestones.map((m) => (
                            <tr key={m._id} className="hover:bg-gray-50">
                              <td className="py-3 px-3 font-bold text-secondary">{m.bookingsCount} Jobs</td>
                              <td className="py-3 px-3 text-green-600 font-bold">₹{m.rewardAmount}</td>
                              <td className="py-3 px-3 text-gray-500">{m.description}</td>
                              <td className="py-3 px-3">
                                <button onClick={() => handleDeleteMilestone(m._id)} className="text-red-500 hover:text-red-700 p-1">
                                  <FiTrash2 className="w-4 h-4" />
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

              {/* Sub-section: Provider Referrals Table */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-base font-bold text-secondary font-poppins">Referred Providers List</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 font-bold text-gray-500 uppercase">
                        <th className="py-3 px-3">Referrer Partner</th>
                        <th className="py-3 px-3">Referred Provider</th>
                        <th className="py-3 px-3">Referral Code</th>
                        <th className="py-3 px-3">Reg Date</th>
                        <th className="py-3 px-3">Reward Type</th>
                        <th className="py-3 px-3">Benefit Received</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {referralsList.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-6 text-gray-400">No provider referrals recorded</td></tr>
                      ) : (
                        referralsList.map((r) => (
                          <tr key={r._id} className="hover:bg-gray-50">
                            <td className="py-3 px-3 font-bold text-secondary">{r.referrer?.name || 'N/A'}</td>
                            <td className="py-3 px-3 text-gray-600">{r.referredUser?.name || 'N/A'}</td>
                            <td className="py-3 px-3 font-mono text-primary font-bold">{r.referralCode || 'N/A'}</td>
                            <td className="py-3 px-3 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                            <td className="py-3 px-3 font-semibold text-secondary uppercase">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${r.rewardType === 'FIXED CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {r.rewardType || 'COMMISSION SHARE'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-1.5 py-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 uppercase tracking-wider shrink-0">
                                    Existing Partner (Referrer)
                                  </span>
                                  <span className="font-bold text-gray-900 text-xs">
                                    {r.referrerBenefit}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider shrink-0">
                                    New Provider (Referred)
                                  </span>
                                  <span className="text-xs font-semibold text-emerald-900">
                                    {r.referredUserBenefit}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] capitalize ${r.status === 'released' ? 'bg-green-100 text-green-700' : normalizeStatus(r.status) === 'fraudflagged' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {r.status}
                              </span>
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

          {/* ==================== 3. CUSTOMER REFERRAL TAB ==================== */}
          {activeTab === 'customer' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-base font-bold text-secondary font-poppins">Customer Referrals List</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 font-bold text-gray-500 uppercase">
                        <th className="py-3 px-3">Referrer Customer</th>
                        <th className="py-3 px-3">Referred Customer</th>
                        <th className="py-3 px-3">Referral Code</th>
                        <th className="py-3 px-3">Reg Date</th>
                        <th className="py-3 px-3">Reward Type</th>
                        <th className="py-3 px-3">Benefit Received</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {referralsList.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-6 text-gray-400">No customer referrals recorded</td></tr>
                      ) : (
                        referralsList.map((r) => {
                          const isCoupon = r.rewardType === 'COUPON';

                          return (
                            <tr key={r._id} className="hover:bg-gray-50">
                              <td className="py-3 px-3 font-bold text-secondary">{r.referrer?.name || 'N/A'}</td>
                              <td className="py-3 px-3 text-gray-600">{r.referredUser?.name || 'N/A'}</td>
                              <td className="py-3 px-3 font-mono text-accent font-bold">{r.referralCode || 'N/A'}</td>
                              <td className="py-3 px-3 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-3 font-semibold text-secondary uppercase">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${isCoupon ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {r.rewardType || 'CASH'}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex flex-col gap-1.5 py-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 uppercase tracking-wider shrink-0">
                                      Existing Customer (Referrer)
                                    </span>
                                    <span className="font-bold text-gray-900 text-xs">
                                      {r.referrerBenefit}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 text-purple-800 uppercase tracking-wider shrink-0">
                                      New Customer (Referred)
                                    </span>
                                    <span className="text-xs font-semibold text-purple-900">
                                      {r.referredUserBenefit}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] capitalize ${r.status === 'released' ? 'bg-green-100 text-green-700' : normalizeStatus(r.status) === 'fraudflagged' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 4. FRAUD & RISK TAB ==================== */}
          {activeTab === 'fraud' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-secondary font-poppins flex items-center gap-2">
                  <FiAlertTriangle className="text-red-500" /> Fraud Flags &amp; Suspicious Referrals
                </h3>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <FiFilter className="text-gray-400" />
                    <span className="font-semibold text-gray-500">Program:</span>
                    <select
                      value={fraudProgramFilter}
                      onChange={(e) => setFraudProgramFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    >
                      <option value="all">All Programs</option>
                      <option value="provider">Provider Referral</option>
                      <option value="customer">Customer Referral</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500">Role:</span>
                    <select
                      value={fraudRoleFilter}
                      onChange={(e) => setFraudRoleFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    >
                      <option value="all">All Roles</option>
                      <option value="provider">Provider</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 font-bold text-gray-500 uppercase">
                      <th className="py-3 px-2">Referrer</th>
                      <th className="py-3 px-2">Referred Signup</th>
                      <th className="py-3 px-2">Abuse Flags</th>
                      <th className="py-3 px-2">Score</th>
                      <th className="py-3 px-2">IP &amp; Device ID</th>
                      <th className="py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fraudList.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400">No flagged fraud transactions found</td></tr>
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
                          <td className="py-3 px-2 font-bold text-red-600">{f.fraudScore}</td>
                          <td className="py-3 px-2 font-mono text-gray-500">
                            <p>{f.deviceInfo?.ip || 'N/A'}</p>
                            <p className="text-[9px] truncate max-w-[120px]">{f.deviceInfo?.deviceId || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              onClick={() => handleManualRelease(f._id)}
                              variant="success"
                              size="sm"
                              className="font-bold text-[11px]"
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

          {/* ==================== 5. REWARD LEDGER TAB ==================== */}
          {activeTab === 'ledger' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-secondary font-poppins flex items-center gap-2">
                  <FiList className="text-primary" /> Reward Release Ledger &amp; Audit Logs
                </h3>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <FiFilter className="text-gray-400" />
                    <span className="font-semibold text-gray-500">Program:</span>
                    <select
                      value={ledgerProgramFilter}
                      onChange={(e) => setLedgerProgramFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    >
                      <option value="all">All Programs</option>
                      <option value="provider">Provider Referral</option>
                      <option value="customer">Customer Referral</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500">Status:</span>
                    <select
                      value={ledgerStatusFilter}
                      onChange={(e) => setLedgerStatusFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    >
                      <option value="all">All Statuses</option>
                      <option value="released">Released</option>
                      <option value="held">Held</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 font-bold text-gray-500 uppercase">
                      <th className="py-3 px-3">Recipient</th>
                      <th className="py-3 px-3">Program Type</th>
                      <th className="py-3 px-3">Paid Amount</th>
                      <th className="py-3 px-3">Funding Source</th>
                      <th className="py-3 px-3">Release Date</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-6 text-gray-400">No reward logs recorded</td></tr>
                    ) : (
                      logs.map((l) => {
                        const isCustomer = l.recipientType === 'customer' || l.rewardType === 'customerreferral';
                        const fundingSource = isCustomer ? 'Marketing / Referral Budget' : 'Platform Commission';
                        return (
                          <tr key={l._id} className="hover:bg-gray-50">
                            <td className="py-3 px-3">
                              <p className="font-semibold text-secondary">{l.recipient?.name || 'N/A'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">{l.recipientType}</p>
                            </td>
                            <td className="py-3 px-3 font-semibold text-secondary capitalize">
                              {isCustomer ? 'Customer Promo' : 'Provider Milestone'}
                            </td>
                            <td className="py-3 px-3 text-green-600 font-bold">₹{l.amount}</td>
                            <td className="py-3 px-3 font-medium text-gray-600">{fundingSource}</td>
                            <td className="py-3 px-3 text-gray-400">{new Date(l.createdAt).toLocaleString()}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${l.status === 'released' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
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
