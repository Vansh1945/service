import React from 'react';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';

const ReferralTab = ({
  systemSettings, handleNestedChange,
  categories, zones, addMilestone, removeMilestone, handleMilestoneChange
}) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins">Referral & Rewards Settings</h3>
      <p className="text-xs text-gray-500 mt-1 font-inter">Manage referral programs, reward limits, eligibility, budgets, milestones, and fraud protection.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-100 pb-6">
      <ToggleSwitch
        label="Customer Referral Scheme"
        description="Unlock sharing commission incentives for clients."
        checked={systemSettings.referralSettings.customerProgramEnabled}
        onChange={(val) => handleNestedChange('referralSettings', 'customerProgramEnabled', val)}
      />
      <ToggleSwitch
        label="Provider Referral Scheme"
        description="Unlock incentive structures for provider growth onboarding."
        checked={systemSettings.referralSettings.providerProgramEnabled}
        onChange={(val) => handleNestedChange('referralSettings', 'providerProgramEnabled', val)}
      />
      <ToggleSwitch
        label="Global Pause Referrals"
        description="Instantly freeze referral reward calculations."
        checked={systemSettings.referralSettings.referralProgramPaused}
        onChange={(val) => handleNestedChange('referralSettings', 'referralProgramPaused', val)}
      />
      <ToggleSwitch
        label="Welcome Registration Reward"
        description="Enable reward wallet cash credits for new profile setups."
        checked={systemSettings.referralSettings.welcomeRewardEnabled}
        onChange={(val) => handleNestedChange('referralSettings', 'welcomeRewardEnabled', val)}
      />
    </div>

    {/* Financial Constraints */}
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" /> Financial Limits
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SettingInput
          label="Welcome Reward Value (INR)"
          value={systemSettings.referralSettings.welcomeRewardValue}
          onChange={(e) => handleNestedChange('referralSettings', 'welcomeRewardValue', Number(e.target.value))}
          type="number"
          min="0"
        />
        <SettingInput
          label="Min Booking for Eligibility"
          value={systemSettings.referralSettings.minBookingAmount}
          onChange={(e) => handleNestedChange('referralSettings', 'minBookingAmount', Number(e.target.value))}
          type="number"
          min="0"
        />
        <SettingInput
          label="Monthly Marketing Budget (INR)"
          value={systemSettings.referralSettings.monthlyBudget}
          onChange={(e) => handleNestedChange('referralSettings', 'monthlyBudget', Number(e.target.value))}
          type="number"
          min="0"
        />
        <SettingInput
          label="User Monthly Reward Cap"
          value={systemSettings.referralSettings.monthlyCapPerUser}
          onChange={(e) => handleNestedChange('referralSettings', 'monthlyCapPerUser', Number(e.target.value))}
          type="number"
          min="0"
        />
        <SettingInput
          label="User Daily Reward Cap"
          value={systemSettings.referralSettings.dailyCapPerUser}
          onChange={(e) => handleNestedChange('referralSettings', 'dailyCapPerUser', Number(e.target.value))}
          type="number"
          min="0"
        />
        <SettingInput
          label="Reward Expiry Duration (Days)"
          value={systemSettings.referralSettings.expiryDays}
          onChange={(e) => handleNestedChange('referralSettings', 'expiryDays', Number(e.target.value))}
          type="number"
          min="1"
        />
      </div>
    </div>

    {/* Milestone Incentives */}
    <div className="space-y-4 pt-6 border-t border-gray-150">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-sm font-bold text-secondary font-poppins">Milestone Performance Incentives</h4>
          <p className="text-xs text-gray-500 mt-1 font-inter">Allows setting target completed booking counts to reward partners with cash incentives.</p>
        </div>
        <button onClick={addMilestone} className="flex items-center gap-1.5 bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-teal-600 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Milestone Rule
        </button>
      </div>

      <div className="space-y-4">
        {systemSettings.referralSettings.providerMilestones.length === 0 ? (
          <p className="text-xs text-gray-400 font-inter">No milestones defined. Add rules below.</p>
        ) : (
          systemSettings.referralSettings.providerMilestones.map((ms, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 relative">
              <button onClick={() => removeMilestone(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
              <SettingInput 
                label="Target Jobs" 
                value={ms.targetBookings} 
                onChange={(e) => handleMilestoneChange(index, 'targetBookings', Number(e.target.value))} 
                type="number" 
                min="1" 
              />
              <SettingInput 
                label="Cash Incentive (INR)" 
                value={ms.rewardAmount} 
                onChange={(e) => handleMilestoneChange(index, 'rewardAmount', Number(e.target.value))} 
                type="number" 
                min="1" 
              />
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-2">Category Filter</label>
                <select value={ms.targetCategory || ''} onChange={(e) => handleMilestoneChange(index, 'targetCategory', e.target.value || null)} className="w-full px-3 py-2 text-xs border rounded-lg bg-white">
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-2">Zone Scope</label>
                <select value={ms.targetZone || ''} onChange={(e) => handleMilestoneChange(index, 'targetZone', e.target.value || null)} className="w-full px-3 py-2 text-xs border rounded-lg bg-white">
                  <option value="">All Zones</option>
                  {zones.map(z => <option key={z._id} value={z._id}>{z.name}</option>)}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

export default ReferralTab;
