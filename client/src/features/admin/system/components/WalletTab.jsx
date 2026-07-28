import React from 'react';
import { Wallet, ShieldCheck, RefreshCw } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';

const WalletTab = ({ systemSettings, handleNestedChange }) => {
  const refundSettings = systemSettings?.refundSettings || {
    autoRefundEnabled: true,
    maxAutoRefundAmount: 5000,
    defaultDestination: 'customer_choice',
    allowWalletRefund: true,
    allowOriginalPaymentRefund: true,
    allowedDestinations: 'both',
    allowWalletFallback: true,
    allowHybridRefund: true,
  };

  return (
    <div className="space-y-6 font-inter">
      <div>
        <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Wallet & Payout Configuration
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-inter">Manage withdrawal limits, refund behavior, and customer wallet policies.</p>
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
          label="Force Refund to Wallet Only"
          description="Global override forcing all booking refunds strictly to customer wallet, bypassing payment gateways."
          checked={systemSettings.walletSettings?.refundToWalletOnly ?? false}
          onChange={(val) => handleNestedChange('walletSettings', 'refundToWalletOnly', val)}
        />
      </div>

      {/* Centralized Refund Engine Rules */}
      <div className="pt-4 border-t border-gray-100 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Enterprise Refund Engine & Destination Controls
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 font-inter">Configure automatic refund policies, customer choice permissions, and gateway error fallback rules.</p>
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

          {/* Refund Destination Policy */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Allowed Refund Destination Policy</label>
            <select
              value={refundSettings.allowedDestinations || 'both'}
              onChange={(e) => handleNestedChange('refundSettings', 'allowedDestinations', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="both">Allow Both (Customer Choice Enabled)</option>
              <option value="wallet_only">Wallet Only (Instant Credit Only)</option>
              <option value="gateway_only">Gateway Only (Original Payment Method Only)</option>
            </select>
            <p className="text-[11px] text-gray-500">Restricts which refund methods are available to customers during cancellation.</p>
          </div>

          {/* Default Refund Destination */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Default Refund Destination</label>
            <select
              value={refundSettings.defaultDestination || 'customer_choice'}
              onChange={(e) => handleNestedChange('refundSettings', 'defaultDestination', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="customer_choice">Customer Selectable Choice (Recommended)</option>
              <option value="original_payment">Original Payment Method (Razorpay Gateway)</option>
              <option value="wallet">Customer Wallet (App Balance)</option>
            </select>
            <p className="text-[11px] text-gray-500">Default pre-selected option presented to customers upon cancellation.</p>
          </div>

          <ToggleSwitch
            label="Allow Wallet Fallback on Gateway Error"
            description="Rule 5 Safeguard: Automatically credit customer wallet if Razorpay payment gateway refund fails."
            checked={refundSettings.allowWalletFallback ?? true}
            onChange={(val) => handleNestedChange('refundSettings', 'allowWalletFallback', val)}
          />

          <ToggleSwitch
            label="Allow Hybrid Split Refunds"
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
