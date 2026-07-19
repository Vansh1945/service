import React from 'react';
import { Percent } from 'lucide-react';
import { SettingInput } from './SharedComponents';

const CommissionTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
        <Percent className="w-5 h-5 text-primary" /> Commissions & Fees
      </h3>
      <p className="text-xs text-gray-500 mt-1 font-inter">Configure platform commission, payout holding period, and revenue distribution.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SettingInput
        label="Default Commission Fee (%)"
        value={systemSettings.commissionSettings.defaultCommission}
        onChange={(e) => handleNestedChange('commissionSettings', 'defaultCommission', Number(e.target.value))}
        type="number"
        min="0"
        max="100"
        description="Platform take-rate percentage deducted from every completed booking."
      />
      <SettingInput
        label="Payout Hold Duration (Hours)"
        value={systemSettings.commissionSettings.payoutHoldHours}
        onChange={(e) => handleNestedChange('commissionSettings', 'payoutHoldHours', Number(e.target.value))}
        type="number"
        min="0"
        description="Escrow security hold period (in hours) before provider earnings are marked for release."
      />
    </div>
  </div>
);

export default CommissionTab;
