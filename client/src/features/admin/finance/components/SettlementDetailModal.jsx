import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiCheckCircle, FiDollarSign, FiCreditCard, FiUser, FiRefreshCw } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate } from '../../../../utils/format';

const InfoRow = ({ label, value, mono = false, badge }) => (
  <div className="flex items-start justify-between py-2 border-b border-neutral-100 last:border-0 gap-4 text-xs">
    <span className="text-neutral-500 font-medium shrink-0">{label}</span>
    <span className={`font-semibold text-secondary text-right ${mono ? 'font-mono break-all' : ''}`}>
      {badge || value || '—'}
    </span>
  </div>
);

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
      {Icon && <Icon className="w-4 h-4 text-primary" />}
      <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'default' }) => {
  const types = {
    success: 'bg-success-light text-success border-success/30',
    warning: 'bg-warning-light text-warning border-warning/30',
    danger: 'bg-danger-light text-danger border-danger/30',
    info: 'bg-info/10 text-info border-info/30',
    default: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border rounded-full ${types[type] || types.default}`}>
      {label}
    </span>
  );
};

const SettlementDetailModal = ({ isOpen, onClose, entityData, settlementId }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || settlementId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('settlement', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local settlement record data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, settlementId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const settlement = data.settlement || entityData || {};
  const gateway = data.gateway || {};
  const payment = data.payment || {};
  const provider = data.provider || {};

  const paymentMethod = String(
    payment.paymentMethod || settlement.paymentMethod || entityData?.paymentMethod || 'online'
  ).toLowerCase();
  const isCash = paymentMethod === 'cash' || paymentMethod === 'cod';

  // Gross, Gateway Fee, Gateway Tax, Net Settlement
  const grossAmount = settlement.grossAmount ?? entityData?.grossAmount ?? payment.amountPaid ?? entityData?.amount ?? 0;
  const gatewayFee = isCash ? 0 : (settlement.gatewayFee ?? gateway.gatewayFee ?? entityData?.gatewayFee ?? 0);
  const gatewayTax = isCash ? 0 : (settlement.gatewayTax ?? gateway.gatewayTax ?? entityData?.gatewayTax ?? 0);
  const netSettlement = isCash
    ? grossAmount
    : (settlement.netPlatformAmount ?? settlement.settlementAmount ?? (grossAmount - gatewayFee - gatewayTax));

  // Settlement Identification & Gateway Details
  const sId = settlement.settlementId || entityData?.settlementId || (entityData?._id ? `#${entityData._id.slice(-8)}` : 'N/A');
  const sDate = settlement.settlementDate || entityData?.settlementDate || entityData?.updatedAt || entityData?.createdAt;
  const gatewayName = isCash ? 'CASH (Direct Collection)' : (gateway.gateway || 'Razorpay');
  const gatewaySettlementId = isCash ? 'N/A' : (gateway.settlementId || entityData?.razorpaySettlementId || 'N/A');
  const bankReference = isCash ? 'N/A' : (gateway.bankReference || entityData?.bankReference || 'N/A');
  
  const rawStatus = (settlement.settlementStatus || entityData?.settlementStatus || 'Settled').toLowerCase();
  const statusLabel = isCash ? 'COLLECTED (CASH)' : (settlement.settlementStatus || entityData?.settlementStatus || 'Settled');
  const reconciliationStatus = isCash ? 'N/A (Cash Collection)' : (settlement.reconciliationStatus || 'Reconciled');

  // Payment Details
  const pId = payment.paymentId || gateway.paymentId || entityData?.paymentId || entityData?.transactionId || (entityData?._id ? `#${entityData._id.slice(-8)}` : 'N/A');
  const pStatus = payment.paymentStatus || entityData?.paymentStatus || 'Success';

  // Provider Settlement Details
  const providerName = provider.name || entityData?.provider?.name || null;
  const providerGross = provider.providerEarnings || entityData?.providerEarnings || grossAmount;
  const commission = provider.commission ?? entityData?.commission ?? entityData?.platformCommission ?? 0;
  const providerNet = provider.netShare ?? entityData?.providerNetShare ?? (providerGross - commission);
  const providerPayoutStatus = provider.payoutStatus || entityData?.payoutStatus || 'Processed';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-secondary/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-secondary text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-lg text-primary">
              <FiCheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Settlement Details</h2>
                <StatusChip
                  label={String(statusLabel).toUpperCase()}
                  type={['settled', 'success', 'completed', 'collected (cash)'].includes(String(statusLabel).toLowerCase()) ? 'success' : 'warning'}
                />
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                Settlement ID: {sId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Refresh"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-neutral-50/50">

          {/* Settlement Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Gross Settlement</span>
              <span className="text-base font-black text-secondary mt-0.5 block">
                <PriceDisplay amount={grossAmount} />
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Gateway Fee</span>
              <span className="text-base font-bold text-warning mt-0.5 block">
                <PriceDisplay amount={gatewayFee} />
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Gateway Tax</span>
              <span className="text-base font-bold text-warning mt-0.5 block">
                <PriceDisplay amount={gatewayTax} />
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Net Settlement</span>
              <span className="text-base font-black text-success mt-0.5 block">
                <PriceDisplay amount={netSettlement} />
              </span>
            </div>
          </div>

          {/* Settlement Information & Payment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Settlement Information" icon={FiCheckCircle}>
              <InfoRow label="Settlement ID" value={sId} mono />
              <InfoRow label="Settlement Date" value={fmtDate(sDate)} />
              <InfoRow label="Gateway" value={gatewayName} />
              <InfoRow label="Gateway Settlement ID" value={gatewaySettlementId} mono />
              <InfoRow label="Bank Reference" value={bankReference} mono />
              <InfoRow label="Settlement Status" badge={<StatusChip label={String(statusLabel).toUpperCase()} type="success" />} />
              <InfoRow label="Reconciliation Status" value={reconciliationStatus} />
            </SectionCard>

            <SectionCard title="Payment Information" icon={FiCreditCard}>
              <InfoRow label="Payment ID" value={pId} mono />
              <InfoRow label="Payment Method" value={paymentMethod.toUpperCase()} />
              <InfoRow label="Payment Status" badge={<StatusChip label={String(pStatus).toUpperCase()} type="success" />} />
              <InfoRow label="Gross Payment Amount" badge={<span className="font-bold text-secondary"><PriceDisplay amount={grossAmount} /></span>} />
              {isCash && (
                <InfoRow label="Collection Method" badge={<StatusChip label="CASH" type="warning" />} />
              )}
            </SectionCard>
          </div>

          {/* Provider Settlement (if provider info available) */}
          {providerName && (
            <SectionCard title="Provider Settlement" icon={FiUser}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoRow label="Provider Name" value={providerName} />
                <InfoRow label="Provider Gross Amount" badge={<span className="font-bold text-secondary"><PriceDisplay amount={providerGross} /></span>} />
                <InfoRow label="Commission" badge={<span className="font-bold text-danger"><PriceDisplay amount={commission} /></span>} />
                <InfoRow label="Provider Net Amount" badge={<span className="font-black text-success"><PriceDisplay amount={providerNet} /></span>} />
                <InfoRow label="Provider Payout Status" badge={<StatusChip label={String(providerPayoutStatus).toUpperCase()} type="info" />} />
              </div>
            </SectionCard>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-neutral-200 flex justify-between items-center shrink-0">
          <span className="text-xs text-neutral-500 font-medium">Settlement Details</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettlementDetailModal;

