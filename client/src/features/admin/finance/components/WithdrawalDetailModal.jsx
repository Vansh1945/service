import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiDollarSign, FiUser, FiBriefcase, FiCreditCard, FiShield,
  FiFileText, FiClock, FiRefreshCw, FiExternalLink, FiCopy, FiCheck,
  FiCheckCircle, FiAlertTriangle
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate, fmtDateOnly } from '../../../../utils/format';
import Loader from '../../../../components/ui/Loader';

const maskAccNo = (acc) => {
  if (!acc) return '••••••••';
  const str = String(acc);
  return str.length > 4 ? `•••• ${str.slice(-4)}` : str;
};

const InfoRow = ({ label, value, mono = false, badge, onClick }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0 gap-4">
    <span className="text-xs text-slate-500 font-medium shrink-0 pt-0.5">{label}</span>
    {onClick ? (
      <button
        onClick={onClick}
        className={`text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 text-right ${mono ? 'font-mono' : ''}`}
      >
        {value} <FiExternalLink className="w-3 h-3 inline shrink-0" />
      </button>
    ) : (
      <span className={`text-xs font-semibold text-slate-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
        {badge || value || '—'}
      </span>
    )}
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-blue-600', children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'default' }) => {
  const types = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    default: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border rounded-full ${types[type]}`}>
      {label}
    </span>
  );
};

const WithdrawalDetailModal = ({ isOpen, onClose, entityData, withdrawalId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [copiedUTR, setCopiedUTR] = useState(false);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || withdrawalId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('payout', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local withdrawal data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, withdrawalId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const withdrawal = data.withdrawal || entityData || {};
  const provider = data.provider || withdrawal.provider || {};
  const walletSummary = data.walletSummary || {
    availableBalance: provider.wallet?.availableBalance ?? 0,
    pendingPayout: provider.wallet?.pendingPayout ?? 0,
    escrowBalance: provider.wallet?.escrowBalance ?? 0,
    alreadyWithdrawn: provider.wallet?.totalWithdrawn ?? 0,
    currentWithdrawalAmount: withdrawal.amount || 0,
    remainingBalanceAfterWithdrawal: Math.max(0, (provider.wallet?.availableBalance ?? 0) - (withdrawal.amount || 0))
  };

  const bank = withdrawal.paymentDetails || withdrawal.bankDetails || {};
  const settlement = data.settlement || {};
  const transaction = data.transaction || {};
  const audit = data.audit || {};

  const handleCopyUTR = () => {
    const utr = withdrawal.utrNo || withdrawal.transactionReference || 'N/A';
    navigator.clipboard.writeText(utr);
    setCopiedUTR(true);
    setTimeout(() => setCopiedUTR(false), 2000);
  };



  const getStatusType = (st) => {
    const clean = (st || '').toLowerCase();
    if (['completed', 'transferred', 'approved'].includes(clean)) return 'success';
    if (['rejected', 'failed'].includes(clean)) return 'danger';
    if (['requested', 'under_review', 'processing'].includes(clean)) return 'warning';
    return 'info';
  };

  const tabs = [
    { id: 'overview',    label: 'Overview',     icon: FiDollarSign },
    { id: 'provider',    label: 'Provider',     icon: FiUser },
    { id: 'wallet',      label: 'Wallet',       icon: FiBriefcase },
    { id: 'bank',        label: withdrawal.paymentMethod === 'upi' ? 'UPI Details' : 'Bank Details', icon: FiCreditCard },
    { id: 'settlement',  label: 'Settlement',   icon: FiShield },
    { id: 'transaction', label: 'Transaction',  icon: FiFileText },
    { id: 'audit',       label: 'Audit Log',    icon: FiFileText },
    { id: 'timeline',    label: 'Timeline',     icon: FiClock },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiDollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Withdrawal Request Console</h2>
                <StatusChip label={(withdrawal.status || 'requested').replace('_', ' ')} type={getStatusType(withdrawal.status)} />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Ref ID: <span className="font-mono font-bold text-white">{withdrawal.transactionReference || `#${(withdrawal._id || '').slice(-6)}`}</span>
                {` | UTR: ${withdrawal.utrNo || 'Not available'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {withdrawal.utrNo && (
              <button
                onClick={handleCopyUTR}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedUTR ? <FiCheck className="w-4 h-4 text-emerald-400" /> : <FiCopy className="w-4 h-4" />}
                {copiedUTR ? 'Copied' : 'Copy UTR'}
              </button>
            )}
            <button
              onClick={fetchDetail}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs font-bold cursor-pointer"
              title="Refresh"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs Navigation Bar */}
        <div className="bg-neutral-50/90 border-b border-neutral-200 px-6 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-3.5 px-4 font-extrabold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-primary text-primary bg-white shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-slate-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <Loader text="Loading withdrawal details..." />
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="p-5 bg-gradient-to-r from-teal-50 via-emerald-50 to-slate-50 rounded-2xl border border-teal-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">Withdrawal Amount Requested</p>
                      <p className="text-3xl font-black text-slate-900 mt-1">
                        <PriceDisplay amount={withdrawal.amount || 0} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip label={(withdrawal.status || 'requested').toUpperCase()} type={getStatusType(withdrawal.status)} />
                      <span className="text-xs font-semibold text-slate-500">
                        Mode: <strong className="text-slate-800 font-mono uppercase">{withdrawal.paymentMethod || withdrawal.withdrawalType || 'Bank Transfer'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard title="Withdrawal Overview" icon={FiDollarSign}>
                      <InfoRow label="Withdrawal ID" value={withdrawal.transactionReference || `#${(withdrawal._id || '').slice(-6)}`} mono />
                      <InfoRow label="Requested Date" value={fmtDate(withdrawal.createdAt)} />
                      <InfoRow label="Approved Date" value={fmtDate(withdrawal.processedAt || withdrawal.approvedAt || withdrawal.updatedAt)} />
                      <InfoRow label="Transferred Date" value={withdrawal.completedAt ? fmtDate(withdrawal.completedAt) : 'Pending Transfer'} />
                      <InfoRow label="UTR / Ref Number" value={withdrawal.utrNo || 'Not available'} mono />
                    </SectionCard>

                    <SectionCard title="Key Provider & Wallet Summary" icon={FiUser}>
                      <InfoRow
                        label="Provider Name"
                        value={provider.name || 'Provider'}
                        onClick={() => openInvestigationDrawer('provider', provider._id)}
                      />
                      <InfoRow
                        label="Available Wallet Balance"
                        value={<PriceDisplay amount={walletSummary.availableBalance} freeText={null} className="text-blue-600 font-bold" />}
                        onClick={() => openInvestigationDrawer('provider_wallet', provider._id)}
                      />
                      <InfoRow
                        label="Remaining Balance After Payout"
                        badge={<span className="font-black text-slate-900"><PriceDisplay amount={walletSummary.remainingBalanceAfterWithdrawal} freeText={null} /></span>}
                      />
                      {withdrawal.paymentMethod === 'upi' ? (
                        <InfoRow 
                          label="UPI ID / VPA" 
                          value={
                            bank.upiId 
                              ? bank.upiId 
                              : (provider.bankDetails?.upiId 
                                ? `${provider.bankDetails.upiId} (Fallback)` 
                                : 'Destination unavailable in historical record')
                          } 
                          mono 
                        />
                      ) : (
                        <InfoRow 
                          label="Bank Name" 
                          value={
                            bank.bankName 
                              ? bank.bankName 
                              : (provider.bankDetails?.bankName 
                                ? `${provider.bankDetails.bankName} (Fallback)` 
                                : 'Destination unavailable in historical record')
                          } 
                        />
                      )}
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* TAB 2: PROVIDER */}
              {activeTab === 'provider' && (
                <SectionCard title="Provider Details & Profile" icon={FiUser}>
                  <InfoRow
                    label="Provider Name"
                    value={provider.name || 'N/A'}
                    onClick={() => openInvestigationDrawer('provider', provider._id)}
                  />
                  <InfoRow label="Provider ID" value={provider.providerId || provider._id} mono />
                  <InfoRow label="Phone Number" value={provider.phone || 'N/A'} />
                  <InfoRow label="Email Address" value={provider.email || 'N/A'} />
                  <InfoRow 
                    label="Rating" 
                    value={data.providerRating || 'N/A'} 
                  />
                  <InfoRow
                    label="Current Status"
                    badge={<StatusChip label={provider.status || (provider.payoutHold ? 'HOLD ACTIVE' : 'ACTIVE')} type={provider.payoutHold ? 'danger' : 'success'} />}
                  />
                </SectionCard>
              )}

              {/* TAB 3: WALLET */}
              {activeTab === 'wallet' && (
                <SectionCard title="Provider Wallet Breakup (Single Source Backend)" icon={FiBriefcase}>
                  <InfoRow
                    label="Available Wallet Balance"
                    value={<PriceDisplay amount={walletSummary.availableBalance} freeText={null} className="text-blue-600 font-bold" />}
                    onClick={() => openInvestigationDrawer('provider_wallet', provider._id)}
                  />
                  <InfoRow
                    label="Pending Payout Balance"
                    badge={<span className="font-bold text-purple-600"><PriceDisplay amount={walletSummary.pendingPayout} freeText={null} /></span>}
                  />
                  <InfoRow
                    label="Escrow Reserve Balance"
                    value={walletSummary.escrowBalance ? undefined : 'N/A'}
                    badge={walletSummary.escrowBalance ? <span className="font-bold text-amber-600"><PriceDisplay amount={walletSummary.escrowBalance} freeText={null} /></span> : null}
                  />
                  <InfoRow
                    label="Total Already Withdrawn"
                    badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={walletSummary.alreadyWithdrawn} freeText={null} /></span>}
                  />
                  <InfoRow
                    label="Current Withdrawal Amount"
                    badge={<span className="font-black text-rose-600">- <PriceDisplay amount={walletSummary.currentWithdrawalAmount} freeText={null} /></span>}
                  />
                  <InfoRow
                    label="Remaining Balance After Withdrawal"
                    badge={<span className="font-black text-slate-900 text-sm"><PriceDisplay amount={walletSummary.remainingBalanceAfterWithdrawal} freeText={null} /></span>}
                  />
                </SectionCard>
              )}

              {/* TAB 4: BANK DETAILS */}
              {activeTab === 'bank' && (
                <SectionCard title={withdrawal.paymentMethod === 'upi' ? "UPI Details" : "Beneficiary Bank Account Details"} icon={FiCreditCard}>
                  {withdrawal.paymentMethod === 'upi' ? (
                    <>
                      <InfoRow 
                        label="Account Holder Name" 
                        value={bank.accountName || provider.bankDetails?.accountName || provider.name || 'N/A'} 
                      />
                      <InfoRow 
                        label="UPI ID / VPA" 
                        value={
                          bank.upiId 
                            ? bank.upiId 
                            : (provider.bankDetails?.upiId 
                              ? `${provider.bankDetails.upiId} (Fallback)` 
                              : 'Destination unavailable in historical record')
                        } 
                        mono 
                      />
                      <InfoRow 
                        label="UPI Verification Status" 
                        value={provider.bankDetails?.upiVerificationStatus || 'N/A'} 
                      />
                      <InfoRow label="Payment Mode" value="UPI" />
                    </>
                  ) : (
                    <>
                      <InfoRow 
                        label="Account Holder Name" 
                        value={bank.accountName || provider.bankDetails?.accountName || provider.name || 'N/A'} 
                      />
                      <InfoRow 
                        label="Bank Name" 
                        value={bank.bankName || provider.bankDetails?.bankName || 'N/A'} 
                      />
                      <InfoRow 
                        label="Branch Name" 
                        value={bank.branchName || provider.bankDetails?.branchName || 'Main Branch'} 
                      />
                      <InfoRow 
                        label="IFSC Code" 
                        value={bank.ifscCode || provider.bankDetails?.ifsc || provider.bankDetails?.ifscCode || 'N/A'} 
                        mono 
                      />
                      <InfoRow 
                        label="Account Number" 
                        value={
                          bank.accountNumber 
                            ? String(bank.accountNumber) 
                            : ((provider.bankDetails?.accountNo || provider.bankDetails?.accountNumber)
                              ? `${String(provider.bankDetails.accountNo || provider.bankDetails.accountNumber)} (Fallback)` 
                              : 'Destination unavailable in historical record')
                        } 
                        mono 
                      />
                      <InfoRow 
                        label="Bank Verification Status" 
                        value={provider.bankDetails?.bankVerificationStatus || 'N/A'} 
                      />
                      <InfoRow label="Payment Mode" value={(withdrawal.paymentMethod || 'banktransfer').toUpperCase()} />
                    </>
                  )}
                </SectionCard>
              )}

              {/* TAB 5: SETTLEMENT */}
              {activeTab === 'settlement' && (
                <SectionCard title="Settlement Information" icon={FiShield}>
                  {settlement && settlement._id ? (
                    <>
                      <InfoRow
                        label="Provider Total Earnings"
                        badge={<span className="font-bold text-slate-900"><PriceDisplay amount={settlement.providerEarnings || provider.earnings || 0} /></span>}
                      />
                      <InfoRow
                        label="Settlement Amount"
                        badge={<span className="font-black text-emerald-700"><PriceDisplay amount={settlement.settlementAmount || withdrawal.amount || 0} /></span>}
                      />
                      <InfoRow label="Settlement Date" value={fmtDate(settlement.settlementDate || withdrawal.updatedAt)} />
                      <InfoRow label="Settlement Status" badge={<StatusChip label={(settlement.settlementStatus || 'settled').toUpperCase()} type={getStatusType(settlement.settlementStatus)} />} />
                      <InfoRow
                        label="Related Settlement Record"
                        value={settlement._id}
                        onClick={() => openInvestigationDrawer('settlement', settlement._id)}
                      />
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400 italic">
                      No settlement linked
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 6: TRANSACTION */}
              {activeTab === 'transaction' && (
                <SectionCard title="Ledger Transaction Information" icon={FiFileText}>
                  {transaction && transaction._id ? (
                    <>
                      <InfoRow
                        label="Transaction ID"
                        value={transaction.transactionId || `#${(transaction._id || '').slice(-6)}`}
                        mono
                        onClick={() => openInvestigationDrawer('payment', transaction._id)}
                      />
                      <InfoRow label="Reference / UTR Number" value={transaction.referenceNumber || transaction.bankReference || withdrawal.utrNo || 'N/A'} mono />
                      <InfoRow
                        label="Transaction Amount"
                        badge={<span className="font-black text-slate-900"><PriceDisplay amount={transaction.amount || withdrawal.amount || 0} /></span>}
                      />
                      <InfoRow label="Transaction Status" badge={<StatusChip label={(transaction.paymentStatus || transaction.status || withdrawal.status || 'completed').toUpperCase()} type={getStatusType(transaction.paymentStatus || transaction.status || withdrawal.status)} />} />
                      <InfoRow label="Created Date" value={fmtDate(transaction.createdAt || withdrawal.createdAt)} />
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400 italic">
                      No transaction linked
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 7: AUDIT LOG */}
              {activeTab === 'audit' && (
                <SectionCard title="Audit History & Admin Actions" icon={FiFileText}>
                  <InfoRow label="Requested By" value={audit.requestedBy || provider.name || 'Provider'} />
                  <InfoRow label="Approved By" value={audit.approvedBy || 'Admin'} />
                  {audit.rejectedBy && <InfoRow label="Rejected By" value={audit.rejectedBy} />}
                  <InfoRow label="Processed By" value={audit.processedBy || 'System Administrator'} />
                  <InfoRow label="Admin Remark / Reason" value={audit.reason || 'Standard withdrawal request processing.'} />
                  <InfoRow label="Audit Timestamp" value={fmtDate(audit.timestamp || withdrawal.updatedAt)} />
                </SectionCard>
              )}

              {/* TAB 8: TIMELINE */}
              {activeTab === 'timeline' && (
                <SectionCard title="Withdrawal Request Lifecycle" icon={FiClock}>
                  <div className="space-y-4 relative before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:bg-slate-200">
                    {(data.timeline || []).map((item, idx) => {
                      const done = item.status === 'completed';
                      const current = item.status === 'current';
                      return (
                        <div key={idx} className="flex gap-4 relative items-start">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white z-10 font-bold text-[10px] shrink-0 ${
                            done ? 'border-teal-500 text-teal-600' : (current ? 'border-amber-500 text-amber-600 animate-pulse' : 'border-slate-200 text-slate-400')
                          }`}>
                            {done ? '✓' : idx + 1}
                          </div>
                          <div className="flex-1 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800 text-xs">{item.title}</span>
                              {item.time && <span className="text-[10px] text-slate-400 font-medium">{item.time}</span>}
                            </div>
                            {item.description && <p className="text-[11px] text-slate-500 mt-1 font-medium">{item.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Withdrawal / Payout Console &bull; Backend Single Source
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Console
          </button>
        </div>

      </div>
    </div>
  );
};

export default WithdrawalDetailModal;
