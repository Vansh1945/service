import React from 'react';
import { Wallet, ShieldCheck, RefreshCw } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';

const WalletTab = ({ systemSettings, handleNestedChange }) => {
  const refundSettings = systemSettings?.refundSettings || {
    autoRefundEnabled: true,
    maxAutoRefundAmount: 5000,
    defaultDestination: 'wallet',
    allowHybridRefund: true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Wallet & Withdrawals
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-inter">Manage withdrawal limits, refund behavior, and provider wallet policies.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingInput
          label="Minimum Payout Request (INR)"
          value={systemSettings.walletSettings?.minWithdrawal || 500}
          onChange={(e) => handleNestedChange('walletSettings', 'minWithdrawal', Number(e.target.value))}
          type="number"
          min="1"
          description="Minimum amount required to allow a provider to request payout withdrawals."
        />
        <ToggleSwitch
          label="Force Refund to Wallet"
          description="Force booking cancellation refunds directly to client wallets instead of banking gateways."
          checked={systemSettings.walletSettings?.refundToWalletOnly ?? true}
          onChange={(val) => handleNestedChange('walletSettings', 'refundToWalletOnly', val)}
        />
      </div>

      {/* Centralized Refund Engine Rules */}
      <div className="pt-4 border-t border-gray-100 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Centralized Refund Engine Rules
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 font-inter">Configure automatic refund rules, maximum limits, and default refund destinations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ToggleSwitch
            label="Enable Automated Instant Refunds"
            description="Automatically process refunds for unstarted / pending bookings matching policy criteria without manual admin review."
            checked={refundSettings.autoRefundEnabled ?? true}
            onChange={(val) => handleNestedChange('refundSettings', 'autoRefundEnabled', val)}
          />

          <SettingInput
            label="Maximum Auto Refund Amount (₹)"
            value={refundSettings.maxAutoRefundAmount ?? 5000}
            onChange={(e) => handleNestedChange('refundSettings', 'maxAutoRefundAmount', Number(e.target.value))}
            type="number"
            min="0"
            description="Refund requests exceeding this threshold will automatically require manual Admin approval."
          />

          <ToggleSwitch
            label="Allow Hybrid Refunds"
            description="Enable splitting refunds between customer wallet and original payment source if paid in combination."
            checked={refundSettings.allowHybridRefund ?? true}
            onChange={(val) => handleNestedChange('refundSettings', 'allowHybridRefund', val)}
          />
        </div>
      </div>
    </div>
  );
};

export default WalletTab;
