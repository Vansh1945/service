import React from 'react';
import { Shield } from 'lucide-react';
import { SettingInput } from './SharedComponents';

const SecurityTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" /> Platform Vetting & Security
      </h3>
      <p className="text-xs text-gray-500 mt-1 font-inter">Configure login protection, OTP expiry, session timeout, and account security rules.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SettingInput
        label="Max Login Failures"
        value={systemSettings.securitySettings.maxLoginAttempts}
        onChange={(e) => handleNestedChange('securitySettings', 'maxLoginAttempts', Number(e.target.value))}
        type="number"
        min="1"
        description="Number of failed passcode attempts before locking an account IP block."
      />
      <SettingInput
        label="OTP Expiry Limit (Minutes)"
        value={systemSettings.securitySettings.otpExpiryMinutes}
        onChange={(e) => handleNestedChange('securitySettings', 'otpExpiryMinutes', Number(e.target.value))}
        type="number"
        min="1"
        description="Minutes before generated OTP tokens expire."
      />
      <SettingInput
        label="Session Validity Period (Hours)"
        value={systemSettings.securitySettings.sessionTimeoutHours}
        onChange={(e) => handleNestedChange('securitySettings', 'sessionTimeoutHours', Number(e.target.value))}
        type="number"
        min="1"
        description="Session token persistence duration (in hours)."
      />
    </div>
  </div>
);

export default SecurityTab;
