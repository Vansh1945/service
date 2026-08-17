import React from 'react';
import { DollarSign, Plus, Trash2, Users, UserCheck } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';

const ReferralTab = ({
  systemSettings, handleNestedChange, handleTripleNestedChange,
  categories, zones, addMilestone, removeMilestone, handleMilestoneChange
}) => {
  const currentMode = systemSettings.referralSettings.rewardCalculationMode || 'commission';
  const isCommissionMode = ['commission', 'commissionshare'].includes(currentMode);
  const isFixedMode = ['fixed', 'cashincentive'].includes(currentMode);

  const customerRef = systemSettings.referralSettings || {};
  const customerCouponConfig = customerRef.customerReferrerCouponConfig || {};
  const newCustCouponConfig = customerRef.newCustomerCouponConfig || {};

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-lg font-bold text-secondary pb-2 border-b border-gray-100 font-poppins">Referral &amp; Rewards Settings</h3>
        <p className="text-xs text-gray-500 mt-1 font-inter">Manage Provider Referral &amp; Customer Referral programs independently with custom rewards, budgets, caps, and fraud rules.</p>
      </div>

      {/* ==================================================
          SECTION A: PROVIDER REFERRAL & REWARDS
      ================================================== */}
      <div className="bg-gray-50/50 border border-gray-200/80 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-secondary font-poppins">A. Provider Referral &amp; Rewards</h4>
            <p className="text-xs text-gray-500 font-inter">Provider-to-Provider onboarding incentives, milestone rules, and platform commission discounts.</p>
          </div>
        </div>

        {/* Provider Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-200 pb-6">
          <ToggleSwitch
            label="Enable Provider Referral"
            description="Unlock incentive structures for provider growth onboarding."
            checked={systemSettings.referralSettings.providerProgramEnabled}
            onChange={(val) => {
              handleNestedChange('referralSettings', 'providerProgramEnabled', val);
              handleNestedChange('referralSettings', 'referralProgramPaused', !val);
            }}
          />
          <ToggleSwitch
            label="Global Pause Provider Referrals"
            description="Instantly freeze provider referral reward calculations."
            checked={systemSettings.referralSettings.referralProgramPaused}
            onChange={(val) => {
              handleNestedChange('referralSettings', 'referralProgramPaused', val);
              handleNestedChange('referralSettings', 'providerProgramEnabled', !val);
            }}
          />
        </div>

        {/* Referrer Reward Calculation Mode */}
        <div className="space-y-4 border-b border-gray-200 pb-6">
          <h5 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Referrer Reward Calculation Mode
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-secondary font-inter">Referrer Reward Mode</label>
              <select
                value={currentMode}
                onChange={(e) => handleNestedChange('referralSettings', 'rewardCalculationMode', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
              >
                <option value="commission">Commission Share (% of platform commission)</option>
                <option value="fixed">Fixed Cash Payout (Fixed milestone cash amount)</option>
                <option value="conditional">Conditional Rules</option>
              </select>
              <p className="text-xs text-gray-500 font-inter">Controls how the referrer's milestone reward amount is calculated.</p>
            </div>

            {isCommissionMode && (
              <SettingInput
                label="Commission Share % (Referrer Reward %)"
                value={systemSettings.referralSettings.commissionPercentage}
                onChange={(e) => handleNestedChange('referralSettings', 'commissionPercentage', Number(e.target.value))}
                type="number"
                min="0"
                max="100"
                description="% of platform commission shared as referrer reward for eligible bookings."
              />
            )}

            {isFixedMode && (
              <SettingInput
                label="Fixed Reward Amount (₹)"
                value={systemSettings.referralSettings.fixedRewardAmount ?? 50}
                onChange={(e) => handleNestedChange('referralSettings', 'fixedRewardAmount', Number(e.target.value))}
                type="number"
                min="0"
                description="Fixed cash reward (₹) paid to referrer per qualified milestone/booking."
              />
            )}
          </div>
        </div>

        {/* Provider Caps & Limits */}
        <div className="space-y-4 border-b border-gray-200 pb-6">
          <h5 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Provider Referral Caps &amp; Budget
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SettingInput
              label="Monthly Marketing Budget (₹)"
              value={systemSettings.referralSettings.monthlyBudget}
              onChange={(e) => handleNestedChange('referralSettings', 'monthlyBudget', Number(e.target.value))}
              type="number"
              min="0"
              description="Total platform-wide monthly provider referral spend cap."
            />
            <SettingInput
              label="Max Reward Per Referral (₹)"
              value={systemSettings.referralSettings.maxRewardPerReferral ?? 1000}
              onChange={(e) => handleNestedChange('referralSettings', 'maxRewardPerReferral', Number(e.target.value))}
              type="number"
              min="0"
              description="Lifetime cap on total rewards paid out per single referral."
            />
            <SettingInput
              label="User Monthly Reward Cap (₹)"
              value={systemSettings.referralSettings.monthlyCapPerUser}
              onChange={(e) => handleNestedChange('referralSettings', 'monthlyCapPerUser', Number(e.target.value))}
              type="number"
              min="0"
              description="Maximum reward a referrer can earn in a calendar month."
            />
            <SettingInput
              label="User Daily Reward Cap (₹)"
              value={systemSettings.referralSettings.dailyCapPerUser}
              onChange={(e) => handleNestedChange('referralSettings', 'dailyCapPerUser', Number(e.target.value))}
              type="number"
              min="0"
              description="Maximum reward a referrer can earn in a single day."
            />
            <SettingInput
              label="Min Eligible Booking Amount (₹)"
              value={systemSettings.referralSettings.minBookingAmount}
              onChange={(e) => handleNestedChange('referralSettings', 'minBookingAmount', Number(e.target.value))}
              type="number"
              min="0"
              description="Bookings below this value are not counted toward referral milestones."
            />
            <SettingInput
              label="Referral Relationship Expiry (Days)"
              value={systemSettings.referralSettings.referralExpiryDays ?? 90}
              onChange={(e) => handleNestedChange('referralSettings', 'referralExpiryDays', Number(e.target.value))}
              type="number"
              min="1"
              description="Days within which the referred provider must complete their first milestone."
            />
          </div>
        </div>

        {/* Referred Provider Onboarding Commission Discount */}
        <div className="space-y-4 border-b border-gray-200 pb-6">
          <h5 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Referred Provider — Commission Discount Benefit
          </h5>
          <p className="text-xs text-gray-500 font-inter">
            The referred (new) provider receives a discounted commission rate for their first few bookings as an onboarding incentive.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SettingInput
              label="Commission Discount % (for Referred Provider)"
              value={systemSettings.referralSettings.providerCommissionDiscountPercent ?? 10}
              onChange={(e) => handleNestedChange('referralSettings', 'providerCommissionDiscountPercent', Number(e.target.value))}
              type="number"
              min="0"
              max="100"
              description="% reduction on normal commission rate for the new referred provider."
            />
            <SettingInput
              label="Discount Valid Bookings Limit"
              value={systemSettings.referralSettings.providerCommissionDiscountLimitBookings ?? 5}
              onChange={(e) => handleNestedChange('referralSettings', 'providerCommissionDiscountLimitBookings', Number(e.target.value))}
              type="number"
              min="1"
              description="After this many completed bookings, the discount expires."
            />
            <SettingInput
              label="Max Monetary Discount Cap (₹)"
              value={systemSettings.referralSettings.providerCommissionDiscountMaxBenefit ?? 1000}
              onChange={(e) => handleNestedChange('referralSettings', 'providerCommissionDiscountMaxBenefit', Number(e.target.value))}
              type="number"
              min="0"
              description="Total ₹ discount the referred provider can receive."
            />
          </div>
        </div>
      </div>

      {/* ==================================================
          SECTION B: CUSTOMER REFERRAL & REWARDS
      ================================================== */}
      <div className="bg-gray-50/50 border border-gray-200/80 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
          <div className="p-2 bg-accent/10 text-accent rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-secondary font-poppins">B. Customer Referral &amp; Rewards</h4>
            <p className="text-xs text-gray-500 font-inter">Customer-to-Customer viral sharing incentives, referrer rewards, new customer welcome bonuses, and caps.</p>
          </div>
        </div>

        {/* Customer Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-200 pb-6">
          <ToggleSwitch
            label="Enable Customer Referral"
            description="Unlock referral code sharing and rewards for customers."
            checked={customerRef.customerReferralEnabled ?? customerRef.customerProgramEnabled}
            onChange={(val) => {
              handleNestedChange('referralSettings', 'customerReferralEnabled', val);
              handleNestedChange('referralSettings', 'customerProgramEnabled', val);
              handleNestedChange('referralSettings', 'customerReferralPaused', !val);
            }}
          />
          <ToggleSwitch
            label="Customer Global Pause"
            description="Temporarily freeze customer referral reward calculations."
            checked={customerRef.customerReferralPaused ?? false}
            onChange={(val) => {
              handleNestedChange('referralSettings', 'customerReferralPaused', val);
              handleNestedChange('referralSettings', 'customerReferralEnabled', !val);
              handleNestedChange('referralSettings', 'customerProgramEnabled', !val);
            }}
          />
        </div>

        {/* Customer Referrer Reward Config */}
        <div className="space-y-4 border-b border-gray-200 pb-6">
          <h5 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Referrer Reward (Customer A)
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-secondary font-inter">Referrer Reward Type</label>
              <select
                value={customerRef.customerReferrerRewardType || 'CASH'}
                onChange={(e) => handleNestedChange('referralSettings', 'customerReferrerRewardType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
              >
                <option value="CASH">CASH — Wallet Credit (₹)</option>
                <option value="COUPON">COUPON — Discount Voucher</option>
              </select>
            </div>

            <SettingInput
              label="Referrer Reward Value (₹)"
              value={customerRef.customerReferrerRewardAmount ?? 100}
              onChange={(e) => handleNestedChange('referralSettings', 'customerReferrerRewardAmount', Number(e.target.value))}
              type="number"
              min="0"
              description="Cash or coupon value awarded to Referrer Customer."
            />
          </div>

          {/* If Referrer Reward Type is COUPON */}
          {customerRef.customerReferrerRewardType === 'COUPON' && (
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
              <h6 className="text-xs font-bold text-secondary uppercase font-poppins">Referrer Coupon Configuration</h6>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discount Type</label>
                  <select
                    value={customerCouponConfig.discountType || 'flat'}
                    onChange={(e) => handleTripleNestedChange && handleTripleNestedChange('referralSettings', 'customerReferrerCouponConfig', 'discountType', e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <SettingInput
                  label={customerCouponConfig.discountType === 'percentage' ? "Discount Percentage (%)" : "Discount Amount (₹)"}
                  value={customerCouponConfig.discountValue ?? 100}
                  onChange={(e) => handleTripleNestedChange && handleTripleNestedChange('referralSettings', 'customerReferrerCouponConfig', 'discountValue', Number(e.target.value))}
                  type="number"
                  min="0"
                  max={customerCouponConfig.discountType === 'percentage' ? "100" : undefined}
                />
                <SettingInput
                  label="Min Booking Amount (₹)"
                  value={customerCouponConfig.minBookingAmount ?? 300}
                  onChange={(e) => handleTripleNestedChange && handleTripleNestedChange('referralSettings', 'customerReferrerCouponConfig', 'minBookingAmount', Number(e.target.value))}
                  type="number"
                  min="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* New Customer Welcome Reward Config */}
        <div className="space-y-4 border-b border-gray-200 pb-6">
          <h5 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> New Customer Benefit (Customer B)
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-secondary font-inter">New Customer Reward Trigger</label>
              <select
                value={customerRef.newCustomerRewardTrigger || 'FIRST_COMPLETED_BOOKING'}
                onChange={(e) => handleNestedChange('referralSettings', 'newCustomerRewardTrigger', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
              >
                <option value="FIRST_COMPLETED_BOOKING">FIRST_COMPLETED_BOOKING (Prevents Fake Registrations)</option>
                <option value="REGISTRATION">REGISTRATION (Upon Signup)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-secondary font-inter">Reward Type</label>
              <select
                value={customerRef.newCustomerRewardType || 'CASH'}
                onChange={(e) => handleNestedChange('referralSettings', 'newCustomerRewardType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
              >
                <option value="CASH">CASH — Wallet Credit (₹)</option>
                <option value="COUPON">COUPON — Discount Voucher</option>
              </select>
            </div>

            <SettingInput
              label="Reward Amount (₹)"
              value={customerRef.newCustomerRewardAmount ?? 50}
              onChange={(e) => handleNestedChange('referralSettings', 'newCustomerRewardAmount', Number(e.target.value))}
              type="number"
              min="0"
              description="Welcome reward value for referred customer."
            />
          </div>

          {/* If New Customer Reward Type is COUPON */}
          {customerRef.newCustomerRewardType === 'COUPON' && (
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
              <h6 className="text-xs font-bold text-secondary uppercase font-poppins">New Customer Coupon Configuration</h6>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discount Type</label>
                  <select
                    value={newCustCouponConfig.discountType || 'flat'}
                    onChange={(e) => handleTripleNestedChange && handleTripleNestedChange('referralSettings', 'newCustomerCouponConfig', 'discountType', e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <SettingInput
                  label={newCustCouponConfig.discountType === 'percentage' ? "Discount Percentage (%)" : "Discount Amount (₹)"}
                  value={newCustCouponConfig.discountValue ?? 50}
                  onChange={(e) => handleTripleNestedChange && handleTripleNestedChange('referralSettings', 'newCustomerCouponConfig', 'discountValue', Number(e.target.value))}
                  type="number"
                  min="0"
                  max={newCustCouponConfig.discountType === 'percentage' ? "100" : undefined}
                />
                <SettingInput
                  label="Min Booking Amount (₹)"
                  value={newCustCouponConfig.minBookingAmount ?? 200}
                  onChange={(e) => handleTripleNestedChange && handleTripleNestedChange('referralSettings', 'newCustomerCouponConfig', 'minBookingAmount', Number(e.target.value))}
                  type="number"
                  min="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Customer Caps & Limits */}
        <div className="space-y-4">
          <h5 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Customer Referral Caps &amp; Budget
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SettingInput
              label="Customer Monthly Budget (₹)"
              value={customerRef.customerMonthlyBudget ?? 20000}
              onChange={(e) => handleNestedChange('referralSettings', 'customerMonthlyBudget', Number(e.target.value))}
              type="number"
              min="0"
              description="Platform-wide monthly customer referral budget cap."
            />
            <SettingInput
              label="Max Reward Per Referral (₹)"
              value={customerRef.customerMaxRewardPerReferral ?? 500}
              onChange={(e) => handleNestedChange('referralSettings', 'customerMaxRewardPerReferral', Number(e.target.value))}
              type="number"
              min="0"
              description="Lifetime reward limit per customer referral."
            />
            <SettingInput
              label="User Monthly Reward Cap (₹)"
              value={customerRef.customerMonthlyRewardCap ?? 3000}
              onChange={(e) => handleNestedChange('referralSettings', 'customerMonthlyRewardCap', Number(e.target.value))}
              type="number"
              min="0"
              description="Maximum customer reward earned per month."
            />
            <SettingInput
              label="User Daily Reward Cap (₹)"
              value={customerRef.customerDailyRewardCap ?? 500}
              onChange={(e) => handleNestedChange('referralSettings', 'customerDailyRewardCap', Number(e.target.value))}
              type="number"
              min="0"
              description="Maximum customer reward earned per day."
            />
            <SettingInput
              label="Minimum Booking Amount (₹)"
              value={customerRef.customerMinimumBookingAmount ?? 100}
              onChange={(e) => handleNestedChange('referralSettings', 'customerMinimumBookingAmount', Number(e.target.value))}
              type="number"
              min="0"
              description="Qualifying first booking minimum amount."
            />
            <SettingInput
              label="Reward Validity (Days)"
              value={customerRef.customerRewardValidityDays ?? 30}
              onChange={(e) => handleNestedChange('referralSettings', 'customerRewardValidityDays', Number(e.target.value))}
              type="number"
              min="1"
              description="Days within which referral reward or coupon must be used."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralTab;
