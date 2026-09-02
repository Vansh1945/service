import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../../components/ui/Pagination';
import Processing from '../../../components/ui/Processing';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import StatCard from '../../../components/ui/StatCard';
import { useAuth } from '../../../context/auth';
import * as PaymentService from '../../../services/PaymentService';
import { toast } from '../../../components/ui/Toast';
import DatePicker from 'react-datepicker';
import TimePicker from 'react-time-picker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-time-picker/dist/TimePicker.css';

import {
  DollarSign, Clock, CheckCircle, BarChart3,
  Eye, Check, X, RefreshCw, ChevronLeft, ChevronRight,
  User, CreditCard, FileText, Calendar, Filter, Send
} from 'lucide-react';
import { formatDate, formatDateTime, formatTime, formatCurrency } from '../../../utils/format';
import { getWithdrawalStatusBadge } from '../../../utils/status';
import { AdminLocalFilterBar } from '../../../components/AdminFilterBar';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import * as AdminService from '../../../services/AdminService';
import * as SystemService from '../../../services/SystemService';
import PayoutViewDetailModal from './components/PayoutViewDetailModal';
import PdfPreviewModal from '../../../components/modals/PdfPreviewModal';
import Badge from '../../../components/ui/Badge';
import StatusBadge from '../../../components/ui/StatusBadge';


const PayoutModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  isDirectPayout,
  submitting,
  onSubmit,
  formData,
  setFormData,
  providers,
  selectedWithdrawal,
  formatCurrency
}) => {
  if (!isOpen) return null;

  const selectedProvider = isDirectPayout && providers?.find(p => p._id === formData.providerId);
  const bank = selectedProvider?.bankDetails || {};
  const preferred = bank.preferredMethod || 'bank_account';
  const isVerified = bank.bankVerificationStatus === 'verified' && bank.verified && bank.payoutEnabled;
  const hasDetails = preferred === 'upi' ? !!bank.upiId : (!!bank.accountNo && !!bank.ifsc);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-secondary">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1 text-slate-600">
          {isDirectPayout ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Select Provider *</label>
                <select
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer"
                  value={formData.providerId}
                  onChange={e => {
                    const p = providers?.find(pr => pr._id === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      providerId: e.target.value,
                      amount: p ? (p.wallet?.availableBalance || 0).toString() : '',
                      paymentMethod: p?.bankDetails?.preferredMethod === 'upi' ? 'upi' : 'banktransfer'
                    }));
                  }}
                >
                  <option value="">Choose a provider...</option>
                  {providers?.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Wallet: {formatCurrency(p.wallet?.availableBalance || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {formData.providerId && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-600 font-medium">
                  <div className="flex justify-between items-center font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    <span>Payout Destination</span>
                    <span className={isVerified && hasDetails ? 'text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 font-bold' : 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 font-bold'}>
                      {isVerified && hasDetails ? 'Verified ✓' : 'Unverified ⚠'}
                    </span>
                  </div>
                  {!hasDetails ? (
                    <div className="text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">No payout destination configured.</div>
                  ) : !isVerified ? (
                    <div className="text-amber-600 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">Pending verification or disabled.</div>
                  ) : preferred === 'upi' ? (
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-slate-400">Type:</span><strong className="text-slate-800">UPI / VPA</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account Holder:</span><strong className="text-slate-800">{bank.accountName || selectedProvider?.name}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">UPI ID:</span><strong className="text-slate-800 font-mono">{bank.upiId}</strong></div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-slate-400">Type:</span><strong className="text-slate-800">Bank Account</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account Holder:</span><strong className="text-slate-800">{bank.accountName || selectedProvider?.name}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">Bank Name:</span><strong className="text-slate-800">{bank.bankName || 'N/A'}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">IFSC:</span><strong className="text-slate-800 font-mono">{bank.ifsc}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account Number:</span><strong className="text-slate-800 font-mono">{bank.accountNo}</strong></div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Payout Amount (₹) *</label>
                <input
                  type="number" step="any" min="0.01" required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  value={formData.amount}
                  onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                />
                {selectedProvider && formData.amount && parseFloat(formData.amount) > (selectedProvider.wallet?.availableBalance || 0) && (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">Amount exceeds available balance</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Payment Method *</label>
                <select
                  disabled={preferred === 'upi'}
                  className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm ${preferred === 'upi' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 text-slate-800 cursor-pointer'}`}
                  value={formData.paymentMethod}
                  onChange={e => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                >
                  {preferred === 'upi' ? (
                    <option value="upi">UPI</option>
                  ) : (
                    <>
                      <option value="banktransfer">Bank Transfer</option>
                      <option value="neft">NEFT</option>
                      <option value="rtgs">RTGS</option>
                      <option value="imps">IMPS</option>
                      <option value="other">Other</option>
                    </>
                  )}
                </select>
              </div>
            </>
          ) : (
            selectedWithdrawal && (
              <div className="space-y-3">
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center text-sm font-semibold">
                  <span>{formatCurrency(selectedWithdrawal.amount)}</span>
                  <span className="text-xs text-gray-500">{selectedWithdrawal.provider?.name}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Payment Method *</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer text-slate-800"
                    value={formData.paymentMethod || 'banktransfer'}
                    onChange={e => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                  >
                    <option value="banktransfer">Bank Transfer</option>
                    <option value="neft">NEFT</option>
                    <option value="rtgs">RTGS</option>
                    <option value="imps">IMPS</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            )
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">UTR Number {isDirectPayout ? '(optional)' : '*'}</label>
            <input type="text" required={!isDirectPayout} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="Enter UTR reference" value={formData.utrNo} onChange={e => setFormData(p => ({ ...p, utrNo: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Transfer Date *</label>
              <input type="date" required className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer" value={formData.transferDate} onChange={e => setFormData(p => ({ ...p, transferDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Transfer Time *</label>
              <input type="time" required className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer" value={formData.transferTime} onChange={e => setFormData(p => ({ ...p, transferTime: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Remark / Notes</label>
            <textarea rows={2} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none" placeholder="Notes..." value={isDirectPayout ? formData.notes : formData.adminRemark} onChange={e => setFormData(p => ({ ...p, [isDirectPayout ? 'notes' : 'adminRemark']: e.target.value }))} />
          </div>

          <div className="flex gap-3 pb-2 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer">
              Cancel
            </button>
            <Processing
              type="submit"
              loading={submitting}
              disabled={isDirectPayout ? (!hasDetails || !isVerified || !formData.amount || parseFloat(formData.amount) <= 0 || parseFloat(formData.amount) > (selectedProvider?.wallet?.availableBalance || 0) || submitting) : (!formData.utrNo || submitting)}
              className="flex-1 py-2 bg-primary hover:bg-teal-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isDirectPayout ? "Confirm Payout" : "Approve Payment"}
            </Processing>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminPayout = () => {

  const { user, API } = useAuth();
  const { searchQuery, openInvestigationDrawer, getMergedQuery, refresh, reset } = useAdminFilter();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDirectPayoutModal, setShowDirectPayoutModal] = useState(false);
  const [providers, setProviders] = useState([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [approveForm, setApproveForm] = useState({ utrNo: '', paymentMethod: 'banktransfer', transferDate: new Date().toISOString().split('T')[0], transferTime: new Date().toTimeString().split(' ')[0].slice(0, 5), adminRemark: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [directPayoutForm, setDirectPayoutForm] = useState({ providerId: '', amount: '', paymentMethod: 'banktransfer', utrNo: '', notes: '', transferDate: new Date().toISOString().split('T')[0], transferTime: new Date().toTimeString().split(' ')[0].slice(0, 5) });
  const [submitting, setSubmitting] = useState(false);
  const [payoutMode, setPayoutMode] = useState('manual');

  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '', providerSearch: urlSearch || searchQuery || '', sortBy: '' });

  useEffect(() => {
    fetchPayoutSettings();
  }, []);

  const fetchPayoutSettings = async () => {
    try {
      const response = await SystemService.getSystemSettingAdmin();
      const data = response.data;
      if (data.success && data.data?.payoutSettings) {
        setPayoutMode(data.data.payoutSettings.mode || 'manual');
      }
    } catch {
      toast.error('Failed to load payout settings');
    }
  };

  useEffect(() => {
    setFilters(prev => ({ ...prev, providerSearch: urlSearch || searchQuery || '' }));
    setPage(1);
  }, [urlSearch, searchQuery]);

  const fetchAbortControllerRef = useRef(null);

  const fetchWithdrawals = useCallback(async () => {
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    fetchAbortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const params = getMergedQuery({
        page: page,
        limit: limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      });

      const response = await PaymentService.getAllWithdrawalRequests(params, { signal: fetchAbortControllerRef.current.signal });
      const data = response.data;

      if (data.success) {
        setWithdrawals(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        toast.error(err.message || 'Failed to load withdrawal requests');
      }
    } finally {
      setLoading(false);
    }
  }, [getMergedQuery, page, limit, filters]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleView = (w) => {
    setSelectedDetails(w);
    setShowDetailsModal(true);
  };

  const handleFilterChange = (newFilters) => { setFilters(newFilters); setPage(1); };
  const clearFilters = () => {
    reset(() => {
      setFilters({ status: '', startDate: '', endDate: '', providerSearch: '', sortBy: '' });
      setPage(1);
    }, () => fetchWithdrawals());
  };

  const maskAccNo = (acc) => {
    if (!acc) return '••••••••';
    const str = String(acc);
    return str.length > 4 ? `•••• ${str.slice(-4)}` : str;
  };

  const getDestinationDisplay = (w) => {
    const bank = w.paymentDetails || w.bankDetails || {};
    const isUpi = w.paymentMethod === 'upi';

    if (isUpi) {
      if (bank.upiId) {
        return bank.upiId;
      }
      // Snapshot missing for UPI! Check provider fallback
      const providerUpi = w.provider?.bankDetails?.upiId;
      if (providerUpi) {
        return (
          <span className="text-amber-600 font-medium" title="Historical destination snapshot missing. Using provider's current profile as fallback.">
            {providerUpi} (Fallback)
          </span>
        );
      }
      return <span className="text-red-500 italic text-[11px]">Destination unavailable in historical record</span>;
    } else {
      if (bank.accountNumber) {
        return bank.accountNumber;
      }
      // Snapshot missing for Bank! Check provider fallback
      const providerAcc = w.provider?.bankDetails?.accountNo || w.provider?.bankDetails?.accountNumber;
      if (providerAcc) {
        return (
          <span className="text-amber-600 font-mono font-medium" title="Historical destination snapshot missing. Using provider's current profile as fallback.">
            {providerAcc} (Fallback)
          </span>
        );
      }
      return <span className="text-red-500 italic text-[11px]">Destination unavailable in historical record</span>;
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) { toast.error('Please enter a rejection reason'); return; }
    setSubmitting(true);
    try {
      await PaymentService.rejectWithdrawalRequest(selectedWithdrawal._id, {
        rejectionReason: rejectReason,
        adminRemark: 'Rejected via admin dashboard'
      });
      toast.success('Withdrawal rejected successfully');
      setShowRejectModal(false); setSelectedWithdrawal(null); fetchWithdrawals();
    } catch (err) { toast.error(err.message || 'Failed to reject withdrawal'); }
    finally { setSubmitting(false); }
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approveForm.utrNo) { toast.error('Please enter UTR Number'); return; }
    setSubmitting(true);

    try {
      await PaymentService.approveWithdrawalRequest(selectedWithdrawal._id, {
        transactionReference: approveForm.utrNo,
        utrNo: approveForm.utrNo,
        paymentMethod: approveForm.paymentMethod || 'banktransfer',
        transferDate: approveForm.transferDate,
        transferTime: approveForm.transferTime,
        notes: approveForm.adminRemark
      });
      toast.success('Withdrawal approved successfully');
      setShowApproveModal(false); setSelectedWithdrawal(null); fetchWithdrawals();
    } catch (err) { toast.error("The payout could not be processed. Review the payout details and try again."); }
    finally { setSubmitting(false); }
  };

  const fetchProviders = async () => {
    try {
      const response = await AdminService.getAllProviders({ limit: 1000, status: 'approved' });
      if (response.data?.success) {
        setProviders(response.data.providers || []);
      }
    } catch (err) {
      toast.error("Unable to load the requested record. Please refresh and try again.");
    }
  };

  const handleOpenDirectPayout = () => {
    fetchProviders();
    setDirectPayoutForm({
      providerId: '',
      amount: '',
      paymentMethod: 'banktransfer',
      utrNo: '',
      notes: '',
      transferDate: new Date().toISOString().split('T')[0],
      transferTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
    });
    setShowDirectPayoutModal(true);
  };

  const handleDirectPayoutSubmit = async (e) => {
    e.preventDefault();
    if (!directPayoutForm.providerId || !directPayoutForm.amount) {
      toast.error('Please select a provider and enter amount');
      return;
    }
    setSubmitting(true);
    try {
      const response = await PaymentService.adminDirectPayout({
        providerId: directPayoutForm.providerId,
        amount: parseFloat(directPayoutForm.amount),
        paymentMethod: directPayoutForm.paymentMethod,
        utrNo: directPayoutForm.utrNo,
        notes: directPayoutForm.notes,
        transferDate: directPayoutForm.transferDate,
        transferTime: directPayoutForm.transferTime
      });
      if (response.data?.success) {
        toast.success(response.data.message || 'Direct payout completed successfully!');
        setShowDirectPayoutModal(false);
        fetchWithdrawals();
      }
    } catch (err) {
      toast.error("The payout could not be processed. Review the payout details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badge = getWithdrawalStatusBadge(status);
    return (
      <span className={badge.className}>
        {badge.label}
      </span>
    );
  };


  const totalPages = Math.ceil(total / limit);





  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-secondary flex items-center gap-3">
                <DollarSign className="text-primary" size={30} />
                Payout Management
              </h1>
              <p className="text-gray-555 mt-1 text-sm">Review and process provider withdrawal requests</p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-3">
              <button
                onClick={handleOpenDirectPayout}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm shadow-md"
              >
                <Send size={16} /> Direct Payout
              </button>
              <button
                onClick={fetchWithdrawals}
                className="flex items-center gap-2 px-4 py-2 bg-primary bg-opacity-10 text-primary rounded-lg hover:bg-opacity-20 transition-colors font-medium text-sm"
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <StatCard
              title="Total Requests"
              value={total}
              icon={BarChart3}
              iconBg="bg-primary bg-opacity-10"
              iconColor="text-primary"
            />
            <StatCard
              title="Pending"
              value={withdrawals.filter(w => w.status === 'requested').length}
              icon={Clock}
              iconBg="bg-yellow-500 bg-opacity-10"
              iconColor="text-yellow-600"
            />
            <StatCard
              title="Completed"
              value={withdrawals.filter(w => w.status === 'completed').length}
              icon={CheckCircle}
              iconBg="bg-green-500 bg-opacity-10"
              iconColor="text-green-600"
            />
            <StatCard
              title="This Page"
              value={withdrawals.length}
              icon={FileText}
              iconBg="bg-blue-500 bg-opacity-10"
              iconColor="text-blue-600"
            />
          </div>
        </div>

        {/* ── Filters ── */}
        <AdminLocalFilterBar
          isInline={true}
          searchValue={filters.providerSearch || ''}
          onSearchChange={(e) => handleFilterChange({ ...filters, providerSearch: e.target.value })}
          onSearchClear={() => {
            handleFilterChange({ ...filters, providerSearch: '' });
            const params = new URLSearchParams(window.location.search);
            if (params.has('search')) {
              params.delete('search');
              const qs = params.toString();
              navigate(qs ? `?${qs}` : window.location.pathname, { replace: true });
            }
          }}
          searchPlaceholder="Search payout by provider name, email, phone, ID, UTR..."
          filters={filters}
          onChange={(key, val) => handleFilterChange({ ...filters, [key]: val })}
          onClear={clearFilters}
          fields={[
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: '', label: 'All Status' },
                { value: 'requested', label: 'Requested' },
                { value: 'under_review', label: 'Under Review' },
                { value: 'approved', label: 'Approved' },
                { value: 'processing', label: 'Processing' },
                { value: 'completed', label: 'Completed' },
                { value: 'rejected', label: 'Rejected' }
              ]
            },
            {
              key: 'startDate',
              label: 'Start Date',
              type: 'date'
            },
            {
              key: 'endDate',
              label: 'End Date',
              type: 'date'
            },
            {
              key: 'sortBy',
              label: 'Sort By',
              type: 'select',
              options: [
                { value: '', label: 'Sort: Default' },
                { value: 'amount_desc', label: 'Amount ↓' },
                { value: 'amount_asc', label: 'Amount ↑' },
                { value: 'createdAt_desc', label: 'Newest First' },
                { value: 'createdAt_asc', label: 'Oldest First' }
              ]
            }
          ]}
        />

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary">Withdrawal Requests</h2>
            <span className="text-sm text-gray-400">{total} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1000px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Withdrawal ID</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payout Method</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Requested Date</th>
                  <th className="p-3">Processed Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <TableSkeleton rows={8} cols={9} />
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-800 font-medium">No withdrawal requests found</p>
                      <p className="text-sm text-slate-400 mt-1">Try adjusting your search filters</p>
                    </td>
                  </tr>
                ) : withdrawals.map(w => {
                  return (
                    <tr key={w._id} className="hover:bg-slate-50 transition-colors">

                      {/* 1. Withdrawal ID (Clickable Drawer) */}
                      <td className="p-3 font-mono font-bold text-teal-700">
                        <button
                          type="button"
                          onClick={() => handleView(w)}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {w.transactionReference || `#${w._id.slice(-6)}`}
                        </button>
                      </td>

                      {/* 2. Provider (Clickable Drawer) */}
                      <td className="p-3 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => openInvestigationDrawer('provider', w.provider?._id || w.provider, w.provider)}
                          className="text-teal-700 hover:underline cursor-pointer text-left"
                        >
                          {w.provider?.name || 'Provider'}
                        </button>
                      </td>

                      {/* 3. Amount */}
                      <td className="p-3 font-black text-slate-900 text-sm">
                        {formatCurrency(w.amount || 0)}
                      </td>

                      {/* 4. Payout Method */}
                      <td className="p-3">
                        <Badge variant={w.paymentMethod === 'upi' ? 'info' : 'primary'}>
                          {w.paymentMethod === 'upi' ? 'UPI' : 'BANK ACCOUNT'}
                        </Badge>
                      </td>

                      {/* 5. Destination */}
                      <td className="p-3 font-mono text-slate-700">
                        {getDestinationDisplay(w)}
                      </td>

                      {/* 6. Status */}
                      <td className="p-3">
                        <StatusBadge status={w.status} module="withdrawal" />
                      </td>

                      {/* 7. Requested Date */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatDate(w.createdAt)}
                      </td>

                      {/* 8. Processed Date */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {w.approvedAt || w.processedAt || w.completedAt ? formatDate(w.approvedAt || w.processedAt || w.completedAt) : 'Pending'}
                      </td>

                      {/* 9. Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleView(w)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-700 hover:text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <Eye size={13} className="mr-1" /> View Details
                          </button>
                          {['requested', 'processing', 'under_review'].includes(w.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setSelectedWithdrawal(w); setApproveForm({ utrNo: w.utrNo || w.transactionReference || '', transferDate: new Date().toISOString().split('T')[0], transferTime: new Date().toTimeString().split(' ')[0].slice(0, 5), adminRemark: '' }); setShowApproveModal(true); }}
                                className="inline-flex items-center px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                              >
                                <Check size={13} className="mr-1" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => { setSelectedWithdrawal(w); setRejectReason(''); setShowRejectModal(true); }}
                                className="inline-flex items-center px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                              >
                                <X size={13} className="mr-1" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-100">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              limit={limit}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      {/* ══ APPROVE MODAL ══ */}
      <PayoutModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Withdrawal"
        subtitle="Enter transaction details below"
        isDirectPayout={false}
        submitting={submitting}
        onSubmit={handleApproveSubmit}
        formData={approveForm}
        setFormData={setApproveForm}
        selectedWithdrawal={selectedWithdrawal}
        formatCurrency={formatCurrency}
      />

      {/* ══ REJECT MODAL ══ */}
      {showRejectModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-secondary">Reject Withdrawal</h2>
                <p className="text-xs text-gray-400 mt-0.5">Provide a reason for the provider</p>
              </div>
              <button onClick={() => setShowRejectModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mx-6 mt-4 p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                <X className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary">{formatCurrency(selectedWithdrawal.amount)}</p>
                <p className="text-xs text-gray-500">{selectedWithdrawal.provider?.name}</p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Rejection Reason <span className="text-red-400">*</span></label>
                <textarea required rows={4}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm resize-none"
                  placeholder="Provide a clear reason for rejection…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)} />
              </div>
              <div className="flex gap-3 pb-2">
                <button type="button" onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-secondary bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <Processing type="submit" loading={submitting} loadingText="Processing…"
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  Reject Withdrawal
                </Processing>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ DETAILS MODAL ══ */}
      <PayoutViewDetailModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        entityData={selectedDetails}
        payoutMode={payoutMode}
        openInvestigationDrawer={openInvestigationDrawer}
      />

      {/* ══ DIRECT PAYOUT MODAL ══ */}
      <PayoutModal
        isOpen={showDirectPayoutModal}
        onClose={() => setShowDirectPayoutModal(false)}
        title="Initiate Direct Payout"
        subtitle="Pay out provider without a withdrawal request"
        isDirectPayout={true}
        submitting={submitting}
        onSubmit={handleDirectPayoutSubmit}
        formData={directPayoutForm}
        setFormData={setDirectPayoutForm}
        providers={providers}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

export default AdminPayout;