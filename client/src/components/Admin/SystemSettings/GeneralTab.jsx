import React from 'react';
import { Globe, Phone, Mail, MapPin, Facebook, Instagram, Twitter, Linkedin, Youtube, Sparkles, Upload } from 'lucide-react';
import { SettingInput } from './SharedComponents';

const GeneralTab = ({
  systemSettings, handleSystemSettingsChange, setSystemSettings,
  logoFile, setLogoFile, setFaviconFile,
  signatureFile, setSignatureFile, setSealFile,
  previewLogo, previewFavicon, previewSignature, previewSeal
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 space-y-6">
      <div>
        <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" /> Basic Information
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-inter">Manage company information, contact details, timezone, currency, and business identity.</p>
      </div>

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
        <div>
          <h4 className="text-sm font-bold text-secondary pb-1 border-b border-gray-100 font-poppins">Social Media Connections</h4>
          <p className="text-xs text-gray-500 mt-1 font-inter">Configure official business social media profiles displayed across the platform.</p>
        </div>
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
      <div>
        <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Branding Assets
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-inter">Customize application names, logos, browser titles, icons, and branding assets.</p>
      </div>

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

export default GeneralTab;
