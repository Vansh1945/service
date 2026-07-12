import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as SystemService from '../../services/SystemService';
import * as ZoneService from '../../services/ZoneService';
import { writeSystemSettingsCache } from '../../utils/systemSettingsCache';
import {
  MapPin, Phone, Mail, Facebook, Instagram, Twitter, Linkedin, Youtube,
  Settings, Calendar, Wallet, Percent, Bell, Shield, Flag, AlertTriangle,
  Save, Upload, Sparkles, DollarSign, Globe, ShieldAlert, Coins, HelpCircle,
  Smartphone, Monitor, MessageSquare, User, Zap, Plus, Trash2, Check, X,
  ChevronDown, Gift
} from 'lucide-react';

const ToggleSwitch = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-all duration-200">
    <div className="space-y-0.5 pr-4">
      <label className="text-sm font-semibold text-secondary font-inter">{label}</label>
      {description && <p className="text-xs text-gray-500 font-inter">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 outline-none ${checked ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

const SettingInput = ({ label, name, value, onChange, placeholder, type = 'text', icon: Icon = null, description = null, min = null, max = null }) => {
  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-semibold text-secondary mb-2 font-inter">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          min={min}
          max={max}
          className={`w-full ${Icon ? 'pl-10' : 'px-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary`}
        />
      </div>
      {description && <p className="text-xs text-gray-500 mt-1.5 font-inter">{description}</p>}
    </div>
  );
};

// ─── LOCAL TAB COMPONENTS ──────────────────────────────────────────────────

const GeneralTab = ({
  systemSettings, handleSystemSettingsChange, setSystemSettings,
  logoFile, setLogoFile, faviconFile, setFaviconFile,
  signatureFile, setSignatureFile, sealFile, setSealFile,
  previewLogo, previewFavicon, previewSignature, previewSeal
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 space-y-6">
      <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
        <Globe className="w-5 h-5 text-primary" /> Basic Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingInput
          label="Company Name *"
          name="companyName"
          value={systemSettings.companyName}
          onChange={handleSystemSettingsChange}
          placeholder="e.g. Raj Electricals"
        />
        <SettingInput
          label="Tagline"
          name="tagline"
          value={systemSettings.tagline}
          onChange={handleSystemSettingsChange}
          placeholder="e.g. Lighting up your lives"
        />
        <SettingInput
          label="Phone Number"
          name="phone"
          value={systemSettings.phone}
          onChange={handleSystemSettingsChange}
          placeholder="e.g. +91 9876543210"
          type="tel"
          icon={Phone}
        />
        <SettingInput
          label="Email Address"
          name="email"
          value={systemSettings.email}
          onChange={handleSystemSettingsChange}
          placeholder="e.g. support@company.com"
          type="email"
          icon={Mail}
        />

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Default Currency</label>
          <select
            name="defaultCurrency"
            value={systemSettings.defaultCurrency}
            onChange={handleSystemSettingsChange}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
          >
            <option value="INR">INR (₹) - Indian Rupee</option>
            <option value="USD">USD ($) - US Dollar</option>
            <option value="EUR">EUR (€) - Euro</option>
            <option value="GBP">GBP (£) - British Pound</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2 font-inter">System Timezone</label>
          <select
            name="timezone"
            value={systemSettings.timezone}
            onChange={handleSystemSettingsChange}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
          >
            <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
            <option value="UTC">UTC (GMT+0:00)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Time Format</label>
          <select
            name="timeFormat"
            value={systemSettings.timeFormat}
            onChange={handleSystemSettingsChange}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
          >
            <option value="12h">12-Hour Format (AM/PM)</option>
            <option value="24h">24-Hour Format</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Company Address</label>
        <div className="relative">
          <MapPin className="absolute left-3.5 top-3.5 text-gray-400 w-4 h-4" />
          <textarea
            name="address"
            value={systemSettings.address}
            onChange={handleSystemSettingsChange}
            rows="2"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
            placeholder="Full physical headquarters address"
          />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <h4 className="text-sm font-bold text-secondary pb-1 border-b border-gray-100 font-poppins">Social Media Connections</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Facebook className="text-blue-600 w-5 h-5 flex-shrink-0" />
            <input
              type="url"
              value={systemSettings.socialLinks.facebook || ''}
              onChange={(e) => setSystemSettings({
                ...systemSettings,
                socialLinks: { ...systemSettings.socialLinks, facebook: e.target.value }
              })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs font-inter"
              placeholder="https://facebook.com/company"
            />
          </div>
          <div className="flex items-center gap-2">
            <Instagram className="text-pink-600 w-5 h-5 flex-shrink-0" />
            <input
              type="url"
              value={systemSettings.socialLinks.instagram || ''}
              onChange={(e) => setSystemSettings({
                ...systemSettings,
                socialLinks: { ...systemSettings.socialLinks, instagram: e.target.value }
              })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs font-inter"
              placeholder="https://instagram.com/company"
            />
          </div>
          <div className="flex items-center gap-2">
            <Twitter className="text-blue-400 w-5 h-5 flex-shrink-0" />
            <input
              type="url"
              value={systemSettings.socialLinks.twitter || ''}
              onChange={(e) => setSystemSettings({
                ...systemSettings,
                socialLinks: { ...systemSettings.socialLinks, twitter: e.target.value }
              })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs font-inter"
              placeholder="https://twitter.com/company"
            />
          </div>
          <div className="flex items-center gap-2">
            <Linkedin className="text-blue-700 w-5 h-5 flex-shrink-0" />
            <input
              type="url"
              value={systemSettings.socialLinks.linkedin || ''}
              onChange={(e) => setSystemSettings({
                ...systemSettings,
                socialLinks: { ...systemSettings.socialLinks, linkedin: e.target.value }
              })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs font-inter"
              placeholder="https://linkedin.com/company/yourcompany"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Youtube className="text-red-600 w-5 h-5 flex-shrink-0" />
            <input
              type="url"
              value={systemSettings.socialLinks.youtube || ''}
              onChange={(e) => setSystemSettings({
                ...systemSettings,
                socialLinks: { ...systemSettings.socialLinks, youtube: e.target.value }
              })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs font-inter"
              placeholder="https://youtube.com/c/company"
            />
          </div>
        </div>
      </div>
    </div>

    {/* Branding Uploads Column */}
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Branding Assets
      </h3>

      <div className="border border-gray-200 rounded-2xl p-5 text-center bg-gray-50">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Company Logo</label>
        {previewLogo && <img src={previewLogo} className="mx-auto w-24 h-24 object-contain bg-white rounded-xl p-1 mb-3" />}
        <label className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Select Logo
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setLogoFile(e.target.files[0])} className="hidden" />
        </label>
      </div>

      <div className="border border-gray-200 rounded-2xl p-5 text-center bg-gray-50">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Browser Favicon</label>
        {previewFavicon && <img src={previewFavicon} className="mx-auto w-12 h-12 object-contain bg-white rounded-lg p-1 mb-3" />}
        <label className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Select Favicon
          <input type="file" accept="image/*,.ico" onChange={(e) => e.target.files?.[0] && setFaviconFile(e.target.files[0])} className="hidden" />
        </label>
      </div>

      <div className="border border-gray-200 rounded-2xl p-5 text-center bg-gray-50">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Digital Signature</label>
        {previewSignature && <img src={previewSignature} className="mx-auto w-24 h-12 object-contain bg-white rounded-xl p-1 mb-3" />}
        <label className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Select Signature
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setSignatureFile(e.target.files[0])} className="hidden" />
        </label>
      </div>

      <div className="border border-gray-200 rounded-2xl p-5 text-center bg-gray-50">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Company Seal</label>
        {previewSeal && <img src={previewSeal} className="mx-auto w-16 h-16 object-contain bg-white rounded-xl p-1 mb-3" />}
        <label className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Select Seal
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setSealFile(e.target.files[0])} className="hidden" />
        </label>
      </div>
    </div>
  </div>
);

const BookingTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <Calendar className="w-5 h-5 text-primary" /> Booking Rules & Allocations
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ToggleSwitch
        label="Auto Assign Provider"
        description={systemSettings.bookingSettings.autoAssignProvider ? "Nearest provider auto assignment enabled" : "Providers can manually accept bookings"}
        checked={systemSettings.bookingSettings.autoAssignProvider}
        onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignProvider', val)}
      />
      <ToggleSwitch
        label="Enable Provider Acceptance Timeout"
        description="Automatically unassign booking if provider does not accept within the timeout window."
        checked={systemSettings.bookingSettings.enableProviderAcceptTimeout}
        onChange={(val) => handleNestedChange('bookingSettings', 'enableProviderAcceptTimeout', val)}
      />

      {systemSettings.bookingSettings.enableProviderAcceptTimeout && (
        <SettingInput
          label="Provider Acceptance Timeout (Minutes)"
          value={systemSettings.bookingSettings.providerAcceptTimeoutMinutes}
          onChange={(e) => handleNestedChange('bookingSettings', 'providerAcceptTimeoutMinutes', Number(e.target.value))}
          type="number"
          min="1"
          description="Time in minutes after which an unaccepted auto-assigned booking is released back to pending."
        />
      )}

      <ToggleSwitch
        label="Allow Pay after Service (COD)"
        description="Enable customers to pay with physical cash directly to the provider upon service completion."
        checked={systemSettings.bookingSettings.allowCOD}
        onChange={(val) => handleNestedChange('bookingSettings', 'allowCOD', val)}
      />
      <ToggleSwitch
        label="Live GPS Tracking"
        description="Enable dynamic real-time provider location tracking on Leaflet map for customers."
        checked={systemSettings.bookingSettings.trackingEnabled}
        onChange={(val) => handleNestedChange('bookingSettings', 'trackingEnabled', val)}
      />

      <SettingInput
        label="Live Tracking Interval (Seconds)"
        value={systemSettings.bookingSettings.trackingInterval}
        onChange={(e) => handleNestedChange('bookingSettings', 'trackingInterval', Number(e.target.value))}
        type="number"
        min="1"
        description="Interval (in seconds) between successive live telemetry coordinate packets sent from en-route providers."
      />
      <SettingInput
        label="Auto-Assign Search Radius (KM)"
        value={systemSettings.bookingSettings.autoAssignRadius}
        onChange={(e) => handleNestedChange('bookingSettings', 'autoAssignRadius', Number(e.target.value))}
        type="number"
        min="1"
        description="Maximum radius distance (in kilometers) scanned around a booking to match nearby online Providers."
      />
      <SettingInput
        label="Cancellation Window (Minutes)"
        value={systemSettings.bookingSettings.cancellationWindowMinutes}
        onChange={(e) => handleNestedChange('bookingSettings', 'cancellationWindowMinutes', Number(e.target.value))}
        type="number"
        min="0"
        description="Period during which a customer can cancel a booking without penalty charges."
      />
      <SettingInput
        label="Refund Review Period (Hours)"
        value={systemSettings.bookingSettings.refundReviewHours}
        onChange={(e) => handleNestedChange('bookingSettings', 'refundReviewHours', Number(e.target.value))}
        type="number"
        min="0"
        description="Maximum hours after which a disputed refund request is automatically reviewed."
      />
      <SettingInput
        label="Provider Response SLA (Hours)"
        value={systemSettings.bookingSettings.providerResponseSlaHours}
        onChange={(e) => handleNestedChange('bookingSettings', 'providerResponseSlaHours', Number(e.target.value))}
        type="number"
        min="1"
        description="Time limit for providers to submit test results or updates before trigger warnings."
      />
      <SettingInput
        label="Refund Processing SLA (Hours)"
        value={systemSettings.bookingSettings.refundProcessingSlaHours}
        onChange={(e) => handleNestedChange('bookingSettings', 'refundProcessingSlaHours', Number(e.target.value))}
        type="number"
        min="1"
        description="Required timeframe for processing refund requests to customer wallets/gateways."
      />
      <SettingInput
        label="Max Bookings per Provider"
        value={systemSettings.bookingSettings.maxBookingsPerProvider}
        onChange={(e) => handleNestedChange('bookingSettings', 'maxBookingsPerProvider', Number(e.target.value))}
        type="number"
        min="1"
        description="Maximum concurrent active bookings a single service provider is permitted to hold."
      />
      <SettingInput
        label="Max Future Booking Scope (Days)"
        value={systemSettings.bookingSettings.maxBookingDays}
        onChange={(e) => handleNestedChange('bookingSettings', 'maxBookingDays', Number(e.target.value))}
        type="number"
        min="1"
        description="Number of days in the future customers can schedule appointments."
      />
      <SettingInput
        label="Booking Time Slot Interval (Minutes)"
        value={systemSettings.bookingSettings.slotInterval}
        onChange={(e) => handleNestedChange('bookingSettings', 'slotInterval', Number(e.target.value))}
        type="number"
        min="5"
        description="Time division sizing (in minutes) for scheduling calendars."
      />
      <SettingInput
        label="Daily Start Time (HH:MM)"
        value={systemSettings.bookingSettings.startTime}
        onChange={(e) => handleNestedChange('bookingSettings', 'startTime', e.target.value)}
        placeholder="09:00"
        description="Daily start time limit for booking appointments."
      />
      <SettingInput
        label="Daily End Time (HH:MM)"
        value={systemSettings.bookingSettings.endTime}
        onChange={(e) => handleNestedChange('bookingSettings', 'endTime', e.target.value)}
        placeholder="21:00"
        description="Daily deadline time limit for final booking slots."
      />

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Booking Mode</label>
        <select
          value={systemSettings.bookingSettings.bookingMode || 'hybrid'}
          onChange={(e) => handleNestedChange('bookingSettings', 'bookingMode', e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
        >
          <option value="flexible">Flexible</option>
          <option value="slot-based">Slot Based</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <p className="text-xs text-gray-500 mt-1.5 font-inter">Determine how appointment times are matched and resolved.</p>
      </div>


      <ToggleSwitch
        label="Emergency Booking"
        description="Allow system to dispatch emergency bookings."
        checked={systemSettings.bookingSettings?.emergencyAssignment !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'emergencyAssignment', val)}
      />

      <ToggleSwitch
        label="Instant Booking Option"
        description="Allow customers to select instant booking options."
        checked={systemSettings.bookingSettings?.instantBooking !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'instantBooking', val)}
      />

      <ToggleSwitch
        label="Auto Assignment"
        description="Enable auto assignment globally."
        checked={systemSettings.bookingSettings?.autoAssignProvider !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignProvider', val)}
      />

      <ToggleSwitch
        label="Manual Assignment"
        description="Allow admin manual assignment."
        checked={systemSettings.bookingSettings?.manualAssignment !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'manualAssignment', val)}
      />

      <ToggleSwitch
        label="Offer Queue"
        description="Enable provider job offer queueing."
        checked={systemSettings.bookingSettings?.offerQueue !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'offerQueue', val)}
      />

      <ToggleSwitch
        label="Slot Based Mode"
        description="Enable slot based appointment matching."
        checked={systemSettings.bookingSettings?.slotBased !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'slotBased', val)}
      />

      <ToggleSwitch
        label="Flexible Mode"
        description="Enable flexible appointment scheduling."
        checked={systemSettings.bookingSettings?.flexible !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'flexible', val)}
      />

      <ToggleSwitch
        label="Hybrid Mode"
        description="Enable hybrid matching strategy."
        checked={systemSettings.bookingSettings?.hybrid !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'hybrid', val)}
      />

      <ToggleSwitch
        label="Auto Assign Scheduled"
        description="Auto assign for scheduled bookings."
        checked={systemSettings.bookingSettings?.autoAssignScheduled !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignScheduled', val)}
      />

      <ToggleSwitch
        label="Auto Assign Instant"
        description="Auto assign for instant bookings."
        checked={systemSettings.bookingSettings?.autoAssignInstant !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignInstant', val)}
      />

      <ToggleSwitch
        label="Auto Assign Emergency"
        description="Auto assign for emergency bookings."
        checked={systemSettings.bookingSettings?.autoAssignEmergency !== false}
        onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignEmergency', val)}
      />

      <div>
        <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Emergency Response Time</label>
        <select
          value={systemSettings.bookingSettings?.emergencyResponseTime || 60}
          onChange={(e) => handleNestedChange('bookingSettings', 'emergencyResponseTime', Number(e.target.value))}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
        >
          <option value={30}>30 sec</option>
          <option value={60}>60 sec</option>
          <option value={90}>90 sec</option>
          <option value={120}>120 sec</option>
        </select>
        <p className="text-xs text-gray-500 mt-1.5 font-inter">Time provider has to accept before escalating.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Admin Response Time</label>
        <select
          value={systemSettings.bookingSettings?.adminResponseTime || 30}
          onChange={(e) => handleNestedChange('bookingSettings', 'adminResponseTime', Number(e.target.value))}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
        >
          <option value={10}>10 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hour</option>
          <option value={120}>2 hour</option>
          <option value={360}>6 hour</option>
          <option value={720}>12 hour</option>
        </select>
        <p className="text-xs text-gray-500 mt-1.5 font-inter">Timeout for admin reassignment before cancellation.</p>
      </div>




      <SettingInput
        label="Minimum Completion Images Required"
        value={systemSettings.bookingSettings.minCompletedImages || 1}
        onChange={(e) => handleNestedChange('bookingSettings', 'minCompletedImages', Number(e.target.value))}
        type="number"
        min="1"
        description="The minimum number of completion proof photos a provider must upload to resolve a job."
      />

      <div className="md:col-span-2 border border-gray-100 rounded-2xl p-6 bg-gray-50/50 space-y-4">
        <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 text-primary" /> Trusted Provider Rules
        </h4>
        <p className="text-xs text-gray-500 font-inter">
          Criteria that a provider must satisfy to be automatically designated as a trusted provider.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingInput
            label="Minimum Average Rating"
            value={systemSettings.bookingSettings.trustedProviderRules?.minRating || 4.0}
            onChange={(e) => {
              const rules = systemSettings.bookingSettings.trustedProviderRules || {};
              handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, minRating: Number(e.target.value) });
            }}
            type="number"
            min="0"
            max="5"
            step="0.1"
          />
          <SettingInput
            label="Minimum Completed Jobs"
            value={systemSettings.bookingSettings.trustedProviderRules?.minCompletedJobs || 5}
            onChange={(e) => {
              const rules = systemSettings.bookingSettings.trustedProviderRules || {};
              handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, minCompletedJobs: Number(e.target.value) });
            }}
            type="number"
            min="0"
          />
          <SettingInput
            label="Maximum Cancellation Rate (%)"
            value={systemSettings.bookingSettings.trustedProviderRules?.maxCancellationRate || 15}
            onChange={(e) => {
              const rules = systemSettings.bookingSettings.trustedProviderRules || {};
              handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, maxCancellationRate: Number(e.target.value) });
            }}
            type="number"
            min="0"
            max="100"
          />
          <SettingInput
            label="Emergency Provider Response Time (Minutes)"
            value={systemSettings.bookingSettings.trustedProviderRules?.providerResponseTimeMinutes || 5}
            onChange={(e) => {
              const rules = systemSettings.bookingSettings.trustedProviderRules || {};
              handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, providerResponseTimeMinutes: Number(e.target.value) });
            }}
            type="number"
            min="1"
          />
        </div>
      </div>
    </div>
  </div>
);

const WalletTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <Wallet className="w-5 h-5 text-primary" /> Wallet & Withdrawals
    </h3>

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

const CommissionTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <Percent className="w-5 h-5 text-primary" /> Commissions & Fees
    </h3>

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

const NotificationsTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <Bell className="w-5 h-5 text-primary" /> Global Alert Switches
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ToggleSwitch
        label="Push Notifications"
        description="Enable real-time push alerts via Google Firebase Cloud Messaging."
        checked={systemSettings.notificationSettings.pushEnabled}
        onChange={(val) => handleNestedChange('notificationSettings', 'pushEnabled', val)}
      />
      <ToggleSwitch
        label="Email Alerts"
        description="Enable system emails, receipts, verification codes, and statements."
        checked={systemSettings.notificationSettings.emailEnabled}
        onChange={(val) => handleNestedChange('notificationSettings', 'emailEnabled', val)}
      />
      <ToggleSwitch
        label="SMS Gateway"
        description="Allow text messages for mission-critical notifications."
        checked={systemSettings.notificationSettings.smsEnabled}
        onChange={(val) => handleNestedChange('notificationSettings', 'smsEnabled', val)}
      />
      <ToggleSwitch
        label="Provider Dashboard Alerts"
        description="Enable real-time job booking dashboard notification banners for providers."
        checked={systemSettings.notificationSettings.providerAlerts}
        onChange={(val) => handleNestedChange('notificationSettings', 'providerAlerts', val)}
      />
      <ToggleSwitch
        label="Customer Dashboard Alerts"
        description="Enable support feedback and status alert popups on customer dashboards."
        checked={systemSettings.notificationSettings.customerAlerts}
        onChange={(val) => handleNestedChange('notificationSettings', 'customerAlerts', val)}
      />
    </div>
  </div>
);

const SecurityTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <Shield className="w-5 h-5 text-primary" /> Platform Vetting & Security
    </h3>

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

const FeaturesTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <Flag className="w-5 h-5 text-primary" /> Feature Switches
    </h3>

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

const ReferralTab = ({
  systemSettings, handleNestedChange, handleTripleNestedChange,
  categories, zones, addMilestone, removeMilestone, handleMilestoneChange
}) => (
  <div className="space-y-8">
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
        <h4 className="text-sm font-bold text-secondary font-poppins">Milestone Performance Incentives</h4>
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
              <SettingInput label="Target Jobs" value={ms.targetBookings} onChange={(e) => handleMilestoneChange(index, 'targetBookings', Number(e.target.value))} type="number" min="1" />
              <SettingInput label="Cash Incentive (INR)" value={ms.rewardAmount} onChange={(e) => handleMilestoneChange(index, 'rewardAmount', Number(e.target.value))} type="number" min="1" />
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

const MaintenanceTab = ({ systemSettings, handleTripleNestedChange }) => (
  <div className="space-y-6">
    <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
      <AlertTriangle className="w-5 h-5 text-red-500" /> Maintenance Control Desk
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-red-50/20 border border-red-100 p-6 rounded-2xl">
      <ToggleSwitch
        label="Freeze Customer App"
        description="Prevent customers from making bookings or viewing details."
        checked={systemSettings.maintenanceMode.customer.enabled}
        onChange={(val) => handleTripleNestedChange('maintenanceMode', 'customer', 'enabled', val)}
      />
      <ToggleSwitch
        label="Freeze Provider App"
        description="Block provider portal checkouts and job actions."
        checked={systemSettings.maintenanceMode.provider.enabled}
        onChange={(val) => handleTripleNestedChange('maintenanceMode', 'provider', 'enabled', val)}
      />

      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Global Notice Message</label>
        <textarea
          value={systemSettings.maintenanceMode.globalMessage}
          onChange={(e) => handleTripleNestedChange('maintenanceMode', 'globalMessage', null, e.target.value)}
          rows="3"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-200 outline-none text-secondary font-inter"
          placeholder="e.g. Server migration in progress..."
        />
      </div>
    </div>
  </div>
);

// ─── MAIN SYSTEM SETTINGS CONTAINER ────────────────────────────────────────

const SystemSetting = () => {
  const [systemSettings, setSystemSettings] = useState({
    companyName: '',
    tagline: '',
    logo: '',
    favicon: '',
    address: '',
    phone: '',
    email: '',
    digitalSignature: '',
    companySeal: '',
    defaultCurrency: 'INR',
    timezone: 'Asia/Kolkata',
    timeFormat: '12h',
    socialLinks: { facebook: '', instagram: '', twitter: '', linkedin: '', youtube: '' },
    bookingSettings: {
      autoAssignProvider: false,
      cancellationWindowMinutes: 60,
      refundReviewHours: 48,
      providerResponseSlaHours: 24,
      refundProcessingSlaHours: 72,
      maxBookingsPerProvider: 10,
      allowCOD: true,
      bookingBufferTime: 30,
      trackingEnabled: true,
      trackingInterval: 5,
      autoAssignRadius: 15,
      maxBookingDays: 3,
      slotInterval: 30,
      startTime: '09:00',
      endTime: '21:00',
      enableProviderAcceptTimeout: true,
      providerAcceptTimeoutMinutes: 5,
      bookingMode: 'hybrid',
      emergencyAssignment: true,
      instantBooking: true,
      emergencySurgeCharge: 0,
      minCompletedImages: 1,
      trustedProviderRules: {
        minRating: 4.0,
        minCompletedJobs: 5,
        maxCancellationRate: 15,
        providerResponseTimeMinutes: 5
      }
    },
    walletSettings: { minWithdrawal: 500, refundToWalletOnly: true },
    commissionSettings: { defaultCommission: 10, payoutHoldHours: 48 },
    surgeSplitSettings: { visiting: 60, rain: 70, traffic: 70, night: 70, demand: 50, emergency: 85 },
    notificationSettings: { pushEnabled: true, emailEnabled: true, smsEnabled: false, providerAlerts: true, customerAlerts: true },
    maintenanceMode: {
      customer: { enabled: false, message: 'Customer services are under maintenance.' },
      provider: { enabled: false, message: 'Provider services are under maintenance.' },
      globalMessage: 'System is under maintenance.'
    },
    featureFlags: { walletEnabled: true },
    securitySettings: { maxLoginAttempts: 5, otpExpiryMinutes: 10, sessionTimeoutHours: 24 },
    uploadSettings: { maxImageSizeMB: 5, allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif'] },
    referralSettings: {
      referralProgramPaused: false,
      welcomeRewardEnabled: false,
      welcomeRewardType: 'wallet',
      welcomeRewardValue: 0,
      maxWelcomeRewardValue: 0,
      customerProgramEnabled: true,
      providerProgramEnabled: true,
      minBookingAmount: 0,
      commissionPercentage: 10,
      payoutHoldHours: 48,
      monthlyBudget: 50000,
      monthlyCapPerUser: 5000,
      dailyCapPerUser: 500,
      expiryDays: 30,
      referralExpiryDays: 90,
      fraudScoreThreshold: 50,
      walletUsagePercentage: 20,
      rewardCalculationMode: 'commission',
      rewardThresholdAmount: 1000,
      fixedRewardAmount: 50,
      customerReferralEligibilityBookings: 1,
      providerReferralEligibilityBookings: 1,
      dailyReferralLimitPerUser: 5,
      monthlyReferralLimitPerUser: 20,
      systemReferralOwner: '',
      providerMilestones: []
    }
  });

  const [activeTab, setActiveTab] = useState('general');
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [sealFile, setSealFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [previewLogo, setPreviewLogo] = useState('');
  const [previewFavicon, setPreviewFavicon] = useState('');
  const [previewSignature, setPreviewSignature] = useState('');
  const [previewSeal, setPreviewSeal] = useState('');

  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const { showToast } = useAuth();

  useEffect(() => {
    fetchSystemSettings();
    fetchCategoriesAndZones();
  }, []);

  const fetchCategoriesAndZones = async () => {
    try {
      const catRes = await SystemService.getCategoriesAdmin();
      if (catRes.data?.success) setCategories(catRes.data.data || []);
      const zoneRes = await ZoneService.getAllZones();
      if (zoneRes.data?.success) setZones(zoneRes.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setPreviewLogo(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoFile]);

  useEffect(() => {
    if (faviconFile) {
      const url = URL.createObjectURL(faviconFile);
      setPreviewFavicon(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [faviconFile]);

  useEffect(() => {
    if (signatureFile) {
      const url = URL.createObjectURL(signatureFile);
      setPreviewSignature(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [signatureFile]);

  useEffect(() => {
    if (sealFile) {
      const url = URL.createObjectURL(sealFile);
      setPreviewSeal(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [sealFile]);

  const fetchSystemSettings = async () => {
    try {
      const response = await SystemService.getSystemSettingAdmin();
      const settingsData = response.data;
      if (settingsData.success && settingsData.data) {
        setSystemSettings(settingsData.data);
        if (settingsData.data.logo) setPreviewLogo(settingsData.data.logo);
        if (settingsData.data.favicon) setPreviewFavicon(settingsData.data.favicon);
        if (settingsData.data.digitalSignature) setPreviewSignature(settingsData.data.digitalSignature);
        if (settingsData.data.companySeal) setPreviewSeal(settingsData.data.companySeal);
      }
    } catch (error) {
      showToast('Error fetching system settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSettingsChange = (e) => {
    setSystemSettings({ ...systemSettings, [e.target.name]: e.target.value });
  };

  const handleNestedChange = (group, key, value) => {
    setSystemSettings(prev => ({
      ...prev,
      [group]: { ...prev[group], [key]: value }
    }));
  };

  const handleTripleNestedChange = (group, subGroup, key, value) => {
    setSystemSettings(prev => {
      if (key === null) {
        return { ...prev, [group]: { ...prev[group], [subGroup]: value } };
      }
      return {
        ...prev,
        [group]: {
          ...prev[group],
          [subGroup]: { ...(prev[group]?.[subGroup] || {}), [key]: value }
        }
      };
    });
  };

  const handleMilestoneChange = (index, field, value) => {
    const list = [...systemSettings.referralSettings.providerMilestones];
    list[index][field] = value;
    handleNestedChange('referralSettings', 'providerMilestones', list);
  };

  const addMilestone = () => {
    const list = [...systemSettings.referralSettings.providerMilestones, { targetBookings: 10, rewardAmount: 500, targetCategory: null, targetZone: null }];
    handleNestedChange('referralSettings', 'providerMilestones', list);
  };

  const removeMilestone = (index) => {
    const list = systemSettings.referralSettings.providerMilestones.filter((_, i) => i !== index);
    handleNestedChange('referralSettings', 'providerMilestones', list);
  };

  const saveSystemSettings = async () => {
    try {
      if (!systemSettings.companyName.trim()) {
        showToast('Company name is required', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('companyName', systemSettings.companyName);
      formData.append('tagline', systemSettings.tagline);
      formData.append('address', systemSettings.address);
      formData.append('phone', systemSettings.phone);
      formData.append('email', systemSettings.email);
      formData.append('defaultCurrency', systemSettings.defaultCurrency);
      formData.append('timezone', systemSettings.timezone);
      formData.append('timeFormat', systemSettings.timeFormat);

      formData.append('socialLinks', JSON.stringify(systemSettings.socialLinks));
      formData.append('bookingSettings', JSON.stringify(systemSettings.bookingSettings));
      formData.append('walletSettings', JSON.stringify(systemSettings.walletSettings));
      formData.append('commissionSettings', JSON.stringify(systemSettings.commissionSettings));
      formData.append('surgeSplitSettings', JSON.stringify(systemSettings.surgeSplitSettings));
      formData.append('notificationSettings', JSON.stringify(systemSettings.notificationSettings));
      formData.append('maintenanceMode', JSON.stringify(systemSettings.maintenanceMode));
      formData.append('featureFlags', JSON.stringify(systemSettings.featureFlags));
      formData.append('securitySettings', JSON.stringify(systemSettings.securitySettings));
      formData.append('uploadSettings', JSON.stringify(systemSettings.uploadSettings));
      formData.append('referralSettings', JSON.stringify(systemSettings.referralSettings));

      if (logoFile) formData.append('logo', logoFile);
      if (faviconFile) formData.append('favicon', faviconFile);
      if (signatureFile) formData.append('digitalSignature', signatureFile);
      if (sealFile) formData.append('companySeal', sealFile);

      const response = await SystemService.updateSystemSetting(formData);
      if (response.data?.success) {
        showToast('System settings saved successfully');
        writeSystemSettingsCache(response.data.data);
        setLogoFile(null);
        setFaviconFile(null);
        setSignatureFile(null);
        setSealFile(null);
        fetchSystemSettings();
      } else {
        throw new Error(response.data?.message || 'Failed to save');
      }
    } catch (e) {
      showToast('Error saving system settings: ' + e.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  const tabs = [
    { id: 'general', name: 'General', icon: Settings, desc: 'Identity, branding, currencies, timezone, and social channels' },
    { id: 'booking', name: 'Booking', icon: Calendar, desc: 'Auto-allocation, cancel windows, buffer and provider limitations' },
    { id: 'wallet', name: 'Wallet', icon: Wallet, desc: 'Withdrawal thresholds and balance refunds' },
    { id: 'commission', name: 'Commission', icon: Percent, desc: 'Default commission rules, taxes, and payout hold policies' },
    { id: 'notifications', name: 'Notifications', icon: Bell, desc: 'Toggle alerts for push notifications, emails, and SMS integrations' },
    { id: 'security', name: 'Security', icon: Shield, desc: 'Lockouts, authentication expirations, and OTP active times' },
    { id: 'features', name: 'Features', icon: Flag, desc: 'Unlock or restrict core platform features and capabilities' },
    { id: 'referral', name: 'Referral & Rewards', icon: Gift, desc: 'Configure customer & provider referral programs, budgets, caps, and safety limits' },
    { id: 'maintenance', name: 'Maintenance', icon: AlertTriangle, desc: 'Put site offline for general maintenance with role overrides' }
  ];

  const activeTabDetails = tabs.find(t => t.id === activeTab);

  return (
    <div className="font-roboto max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-poppins">System Configuration</h1>
          <p className="text-gray-600 mt-2 font-inter text-xs md:text-sm">Manage SaaS dynamic configurations, system variables, maintenance windows, and settings.</p>
        </div>
        <button onClick={saveSystemSettings} className="flex items-center gap-2 bg-primary hover:bg-teal-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all">
          <Save className="w-4 h-4" /> Save Configuration
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium transition-all border ${isActive ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-xs">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-8 flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          {activeTabDetails && React.createElement(activeTabDetails.icon, { className: "w-5 h-5" })}
        </div>
        <div>
          <h2 className="text-lg font-bold text-secondary font-poppins capitalize">{activeTabDetails?.name} Settings</h2>
          <p className="text-xs text-gray-500 font-inter mt-0.5">{activeTabDetails?.desc}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 md:p-8">
        {activeTab === 'general' && (
          <GeneralTab
            systemSettings={systemSettings}
            handleSystemSettingsChange={handleSystemSettingsChange}
            setSystemSettings={setSystemSettings}
            logoFile={logoFile}
            setLogoFile={setLogoFile}
            faviconFile={faviconFile}
            setFaviconFile={setFaviconFile}
            signatureFile={signatureFile}
            setSignatureFile={setSignatureFile}
            sealFile={sealFile}
            setSealFile={setSealFile}
            previewLogo={previewLogo}
            previewFavicon={previewFavicon}
            previewSignature={previewSignature}
            previewSeal={previewSeal}
          />
        )}
        {activeTab === 'booking' && <BookingTab systemSettings={systemSettings} handleNestedChange={handleNestedChange} />}
        {activeTab === 'wallet' && <WalletTab systemSettings={systemSettings} handleNestedChange={handleNestedChange} />}
        {activeTab === 'commission' && <CommissionTab systemSettings={systemSettings} handleNestedChange={handleNestedChange} />}
        {activeTab === 'notifications' && <NotificationsTab systemSettings={systemSettings} handleNestedChange={handleNestedChange} />}
        {activeTab === 'security' && <SecurityTab systemSettings={systemSettings} handleNestedChange={handleNestedChange} />}
        {activeTab === 'features' && <FeaturesTab systemSettings={systemSettings} handleNestedChange={handleNestedChange} />}
        {activeTab === 'referral' && (
          <ReferralTab
            systemSettings={systemSettings}
            handleNestedChange={handleNestedChange}
            handleTripleNestedChange={handleTripleNestedChange}
            categories={categories}
            zones={zones}
            addMilestone={addMilestone}
            removeMilestone={removeMilestone}
            handleMilestoneChange={handleMilestoneChange}
          />
        )}
        {activeTab === 'maintenance' && <MaintenanceTab systemSettings={systemSettings} handleTripleNestedChange={handleTripleNestedChange} />}
      </div>
    </div>
  );
};

export default SystemSetting;
