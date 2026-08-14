import React from 'react';
import { Wallet, ShieldCheck, RefreshCw, Clock } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';
import { formatTime } from '../../../../utils/format';

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
        <ToggleSwitch
          label="Force Refund to Wallet Only"
          description="Global override forcing all booking refunds strictly to customer wallet, bypassing payment gateways."
          checked={systemSettings.walletSettings?.refundToWalletOnly ?? false}
          onChange={(val) => handleNestedChange('walletSettings', 'refundToWalletOnly', val)}
        />
      </div>

      {/* Payout Engine Configuration Section */}
      <div className="pt-4 border-t border-gray-100 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" /> Future Payout Engine & Rules Configuration
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 font-inter">Configure payout processing modes, automated frequency, withdrawal limits, approval thresholds, operating days, and retry rules.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payout Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Payout Operation Mode</label>
            <select
              value={systemSettings.payoutSettings?.mode || 'manual'}
              onChange={(e) => handleNestedChange('payoutSettings', 'mode', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="manual">Manual Mode (Default - Admin Approval & Bulk Export)</option>
              <option value="razorpayx">RazorpayX Mode (Direct Automated Transfers)</option>
            </select>
            <p className="text-[11px] text-gray-500">Operation mode for handling provider withdrawal payouts.</p>
          </div>

          {/* Auto Withdrawal Frequency */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Automated Withdrawal Frequency</label>
            <select
              value={systemSettings.payoutSettings?.autoWithdrawalFrequency || 'daily'}
              onChange={(e) => handleNestedChange('payoutSettings', 'autoWithdrawalFrequency', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="realtime">Realtime (Instant Execution)</option>
              <option value="daily">Daily (Batched Once Per Day)</option>
              <option value="weekly">Weekly (Batched Once Per Week)</option>
              <option value="monthly">Monthly (Batched End of Month)</option>
            </select>
            <p className="text-[11px] text-gray-500">Schedule frequency when automated payouts run.</p>
          </div>

          <ToggleSwitch
            label="Enable Auto Withdrawal Processing"
            description="Automatically queue and process approved payouts according to the configured frequency."
            checked={systemSettings.payoutSettings?.autoWithdrawalEnabled ?? false}
            onChange={(val) => handleNestedChange('payoutSettings', 'autoWithdrawalEnabled', val)}
          />

          <SettingInput
            label="Instant Withdrawal Limit (₹)"
            value={systemSettings.payoutSettings?.instantWithdrawalLimit ?? 5000}
            onChange={(e) => handleNestedChange('payoutSettings', 'instantWithdrawalLimit', Number(e.target.value))}
            type="number"
            min="0"
            description="Maximum threshold allowed for instant automated processing without delays."
          />

          <SettingInput
            label="Approval Required Above Amount (₹)"
            value={systemSettings.payoutSettings?.approvalRequiredAboveAmount ?? 10000}
            onChange={(e) => handleNestedChange('payoutSettings', 'approvalRequiredAboveAmount', Number(e.target.value))}
            type="number"
            min="0"
            description="Withdrawal requests exceeding this amount will always require explicit Admin review."
          />

          <SettingInput
            label="Minimum Withdrawal Limit (₹)"
            value={systemSettings.payoutSettings?.minWithdrawalAmount ?? 500}
            onChange={(e) => handleNestedChange('payoutSettings', 'minWithdrawalAmount', Number(e.target.value))}
            type="number"
            min="1"
            description="Minimum amount required for a provider to initiate a withdrawal request."
          />

          <SettingInput
            label="Maximum Withdrawal Limit (₹)"
            value={systemSettings.payoutSettings?.maxWithdrawalAmount ?? 100000}
            onChange={(e) => handleNestedChange('payoutSettings', 'maxWithdrawalAmount', Number(e.target.value))}
            type="number"
            min="1"
            description="Maximum single transaction withdrawal limit permitted per request."
          />

          {(systemSettings.payoutSettings?.mode || 'manual') !== 'manual' && (
            <SettingInput
              label="Settlement Cut-off Time (24h)"
              value={systemSettings.payoutSettings?.settlementTime || '17:00'}
              onChange={(e) => handleNestedChange('payoutSettings', 'settlementTime', e.target.value)}
              type="text"
              placeholder="HH:MM (e.g. 17:00)"
              description="Daily cut-off time for automated payout batch settlement in 24-hour format."
            />
          )}

          <ToggleSwitch
            label="Auto Retry Failed Payouts"
            description="Automatically retry failed transfer attempts according to system retry policies."
            checked={systemSettings.payoutSettings?.retryFailedPayout ?? true}
            onChange={(val) => handleNestedChange('payoutSettings', 'retryFailedPayout', val)}
          />

          <ToggleSwitch
            label="Enable Withdrawal Safety Cooldown"
            description="Enforce a waiting period cooldown between successive provider withdrawal requests."
            checked={systemSettings.payoutSettings?.safetyCooldownEnabled ?? true}
            onChange={(val) => handleNestedChange('payoutSettings', 'safetyCooldownEnabled', val)}
          />

          {(systemSettings.payoutSettings?.safetyCooldownEnabled ?? true) && (
            <SettingInput
              label="Cooldown Duration (Hours)"
              value={systemSettings.payoutSettings?.safetyCooldownHours ?? 24}
              onChange={(e) => handleNestedChange('payoutSettings', 'safetyCooldownHours', Number(e.target.value))}
              type="number"
              min="1"
              max="168"
              description="Minimum hours a provider must wait before submitting another withdrawal request."
            />
          )}
          <SettingInput
            label="Retry Attempts Count"
            value={systemSettings.payoutSettings?.retryCount ?? 3}
            onChange={(e) => handleNestedChange('payoutSettings', 'retryCount', Number(e.target.value))}
            type="number"
            min="0"
            max="10"
            description="Maximum number of automated retry attempts before marking payout as permanently failed."
          />
        </div>
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
