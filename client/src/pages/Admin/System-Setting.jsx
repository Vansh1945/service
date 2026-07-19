import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as SystemService from '../../services/SystemService';
import * as ZoneService from '../../services/ZoneService';
import { writeSystemSettingsCache } from '../../utils/systemSettingsCache';
import {
  Settings, Calendar, Wallet, Percent, Bell, Shield, Flag, AlertTriangle, Save, Gift
} from 'lucide-react';

// Sub-tabs imported from clean components
import GeneralTab from '../../components/Admin/SystemSettings/GeneralTab';
import BookingTab from '../../components/Admin/SystemSettings/BookingTab';
import WalletTab from '../../components/Admin/SystemSettings/WalletTab';
import CommissionTab from '../../components/Admin/SystemSettings/CommissionTab';
import NotificationsTab from '../../components/Admin/SystemSettings/NotificationsTab';
import SecurityTab from '../../components/Admin/SystemSettings/SecurityTab';
import FeaturesTab from '../../components/Admin/SystemSettings/FeaturesTab';
import ReferralTab from '../../components/Admin/SystemSettings/ReferralTab';
import MaintenanceTab from '../../components/Admin/SystemSettings/MaintenanceTab';

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
      <div className="mb-8 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-medium transition-all border ${isActive ? 'bg-primary text-white border-primary shadow-md shadow-primary/10' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-[11px] font-semibold">{tab.name}</span>
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
