import React from 'react';
import { Flag } from 'lucide-react';
import { ToggleSwitch } from './SharedComponents';

const FeaturesTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
        <Flag className="w-5 h-5 text-primary" /> Feature Switches
      </h3>
      <p className="text-xs text-gray-500 mt-1 font-inter">Enable or disable major platform capabilities without changing the application code.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ToggleSwitch
        label="SaaS Wallet Integration"
        description="Allow user transaction credits, payouts, and in-app balances."
        checked={systemSettings.featureFlags.walletEnabled}
        onChange={(val) => handleNestedChange('featureFlags', 'walletEnabled', val)}
      />
    </div>
  </div>
);

export default FeaturesTab;
