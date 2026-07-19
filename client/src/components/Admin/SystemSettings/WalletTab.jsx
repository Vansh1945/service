import React from 'react';
import { Wallet } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';

const WalletTab = ({ systemSettings, handleNestedChange }) => (
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
        value={systemSettings.walletSettings.minWithdrawal}
        onChange={(e) => handleNestedChange('walletSettings', 'minWithdrawal', Number(e.target.value))}
        type="number"
        min="1"
        description="Minimum amount required to allow a provider to request payout withdrawals."
      />
      <ToggleSwitch
        label="Force Refund to Wallet"
        description="Force booking cancellation refunds directly to client wallets instead of banking gateways."
        checked={systemSettings.walletSettings.refundToWalletOnly}
        onChange={(val) => handleNestedChange('walletSettings', 'refundToWalletOnly', val)}
      />
    </div>
  </div>
);

export default WalletTab;
