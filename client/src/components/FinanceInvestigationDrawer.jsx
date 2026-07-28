import React from 'react';
import { useAdminFilter } from '../context/AdminFilterContext';
import PaymentViewDetailModal from '../features/admin/finance/components/PaymentViewDetailModal';
import PayoutViewDetailModal from '../features/admin/finance/components/PayoutViewDetailModal';
import FraudRiskViewDetailModal from '../features/admin/finance/components/FraudRiskViewDetailModal';
import SettlementViewDetailModal from '../features/admin/finance/components/SettlementViewDetailModal';
import WalletViewDetailModal from '../features/admin/finance/components/WalletViewDetailModal';
import AuditLogViewDetailModal from '../features/admin/finance/components/AuditLogViewDetailModal';
import FinanceDashboardViewDetailModal from '../features/admin/finance/components/FinanceDashboardViewDetailModal';
import CashPaymentDetailModal from '../features/admin/finance/components/CashPaymentDetailModal';
import CustomerWalletDetailModal from '../features/admin/finance/components/CustomerWalletDetailModal';
import ProviderWalletDetailModal from '../features/admin/finance/components/ProviderWalletDetailModal';
import ProviderEarningDetailModal from '../features/admin/finance/components/ProviderEarningDetailModal';
import WithdrawalDetailModal from '../features/admin/finance/components/WithdrawalDetailModal';
import SettlementDetailModal from '../features/admin/finance/components/SettlementDetailModal';
import RazorpayPaymentDetailModal from '../features/admin/finance/components/RazorpayPaymentDetailModal';
import FailedPaymentDetailModal from '../features/admin/finance/components/FailedPaymentDetailModal';
import AuditLogDetailModal from '../features/admin/finance/components/AuditLogDetailModal';

export default function FinanceInvestigationDrawer() {
  const { drawerConfig, closeInvestigationDrawer } = useAdminFilter();

  if (!drawerConfig || !drawerConfig.isOpen) return null;

  const { entityType, entityData } = drawerConfig;

  switch (entityType) {
    case 'cash':
    case 'cash_payment':
    case 'cod':
      return <CashPaymentDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'customer_wallet':
    case 'customer':
      return <CustomerWalletDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'provider_wallet':
      return <ProviderWalletDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'provider_earning':
    case 'provider_earnings':
    case 'earning':
      return <ProviderEarningDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'payout':
    case 'withdrawal':
      return <WithdrawalDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'razorpay':
    case 'razorpay_payment':
    case 'gateway_payment':
      return <RazorpayPaymentDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'failed_payment':
    case 'failed':
      return <FailedPaymentDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'risk_audit':
    case 'fraud':
      return <FraudRiskViewDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'settlement':
      return <SettlementDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'wallet':
      return <WalletViewDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'audit':
    case 'audit_log':
      return <AuditLogDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
    case 'dashboard':
    case 'kpi':
      return <FinanceDashboardViewDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityType={entityType} entityData={entityData} />;
    case 'payment':
    case 'transaction':
    default:
      return <PaymentViewDetailModal isOpen={true} onClose={closeInvestigationDrawer} entityData={entityData} />;
  }
}
