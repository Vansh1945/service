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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 outline-none ${checked ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-gray-300'
        }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  </div>
);

const SystemSetting = () => {
  const [systemSettings, setSystemSettings] = useState({
    companyName: '',
    tagline: '',
    logo: '',
    favicon: '',
    address: '',
    phone: '',
    email: '',
    defaultCurrency: 'INR',
    timezone: 'Asia/Kolkata',
    timeFormat: '12h',
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: ''
    },
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
      providerAcceptTimeoutMinutes: 5
    },
    walletSettings: {
      minWithdrawal: 500,
      refundToWalletOnly: true
    },
    commissionSettings: {
      defaultCommission: 10,
      payoutHoldHours: 48
    },
    surgeSplitSettings: {
      visiting: 60,
      rain: 70,
      traffic: 70,
      night: 70,
      demand: 50
    },
    notificationSettings: {
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      providerAlerts: true,
      customerAlerts: true
    },
    maintenanceMode: {
      customer: {
        enabled: false,
        message: 'System is under maintenance. Please try again later.'
      },
      provider: {
        enabled: false,
        message: 'System is under maintenance. Please try again later.'
      },
      globalMessage: 'System is under maintenance. Please try again later.'
    },
    featureFlags: {
      walletEnabled: true
    },
    securitySettings: {
      maxLoginAttempts: 5,
      otpExpiryMinutes: 10,
      sessionTimeoutHours: 24
    },
    uploadSettings: {
      maxImageSizeMB: 5,
      allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif']
    },
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
  const [loading, setLoading] = useState(true);

  const [previewLogo, setPreviewLogo] = useState('');
  const [previewFavicon, setPreviewFavicon] = useState('');

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
      if (catRes.data && catRes.data.success) {
        setCategories(catRes.data.data || []);
      }
      const zoneRes = await ZoneService.getAllZones();
      if (zoneRes.data && zoneRes.data.success) {
        setZones(zoneRes.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories/zones:', error);
    }
  };



  useEffect(() => {
    if (logoFile) {
      const objectUrl = URL.createObjectURL(logoFile);
      setPreviewLogo(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [logoFile]);

  useEffect(() => {
    if (faviconFile) {
      const objectUrl = URL.createObjectURL(faviconFile);
      setPreviewFavicon(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [faviconFile]);

  const fetchSystemSettings = async () => {
    try {
      const response = await SystemService.getSystemSettingAdmin();
      const settingsData = response.data;

      if (settingsData.success && settingsData.data) {
        setSystemSettings({
          companyName: settingsData.data.companyName || '',
          tagline: settingsData.data.tagline || '',
          logo: settingsData.data.logo || '',
          favicon: settingsData.data.favicon || '',
          address: settingsData.data.address || '',
          phone: settingsData.data.phone || '',
          email: settingsData.data.email || '',
          defaultCurrency: settingsData.data.defaultCurrency || 'INR',
          timezone: settingsData.data.timezone || 'Asia/Kolkata',
          timeFormat: settingsData.data.timeFormat || '12h',
          socialLinks: {
            facebook: settingsData.data.socialLinks?.facebook || '',
            instagram: settingsData.data.socialLinks?.instagram || '',
            twitter: settingsData.data.socialLinks?.twitter || '',
            linkedin: settingsData.data.socialLinks?.linkedin || '',
            youtube: settingsData.data.socialLinks?.youtube || '',
          },
          bookingSettings: {
            autoAssignProvider: settingsData.data.bookingSettings?.autoAssignProvider ?? false,
            cancellationWindowMinutes: settingsData.data.bookingSettings?.cancellationWindowMinutes ?? 60,
            refundReviewHours: settingsData.data.bookingSettings?.refundReviewHours ?? 48,
            providerResponseSlaHours: settingsData.data.bookingSettings?.providerResponseSlaHours ?? 24,
            refundProcessingSlaHours: settingsData.data.bookingSettings?.refundProcessingSlaHours ?? 72,
            maxBookingsPerProvider: settingsData.data.bookingSettings?.maxBookingsPerProvider ?? 10,
            allowCOD: settingsData.data.bookingSettings?.allowCOD ?? true,
            bookingBufferTime: settingsData.data.bookingSettings?.bookingBufferTime ?? 30,
            trackingEnabled: settingsData.data.bookingSettings?.trackingEnabled ?? true,
            trackingInterval: settingsData.data.bookingSettings?.trackingInterval ?? 5,
            autoAssignRadius: settingsData.data.bookingSettings?.autoAssignRadius ?? 15,
            maxBookingDays: settingsData.data.bookingSettings?.maxBookingDays ?? 3,
            slotInterval: settingsData.data.bookingSettings?.slotInterval ?? 30,
            startTime: settingsData.data.bookingSettings?.startTime || "09:00",
            endTime: settingsData.data.bookingSettings?.endTime || "21:00",
            enableProviderAcceptTimeout: settingsData.data.bookingSettings?.enableProviderAcceptTimeout ?? true,
            providerAcceptTimeoutMinutes: settingsData.data.bookingSettings?.providerAcceptTimeoutMinutes ?? 5,
          },
          walletSettings: {
            minWithdrawal: settingsData.data.walletSettings?.minWithdrawal ?? 500,
            refundToWalletOnly: settingsData.data.walletSettings?.refundToWalletOnly ?? true,
          },
          commissionSettings: {
            defaultCommission: settingsData.data.commissionSettings?.defaultCommission ?? 10,
            payoutHoldHours: settingsData.data.commissionSettings?.payoutHoldHours ?? 48,
          },
          surgeSplitSettings: {
            visiting: settingsData.data.surgeSplitSettings?.visiting ?? 60,
            rain: settingsData.data.surgeSplitSettings?.rain ?? 70,
            traffic: settingsData.data.surgeSplitSettings?.traffic ?? 70,
            night: settingsData.data.surgeSplitSettings?.night ?? 70,
            demand: settingsData.data.surgeSplitSettings?.demand ?? 50,
          },
          notificationSettings: {
            pushEnabled: settingsData.data.notificationSettings?.pushEnabled ?? true,
            emailEnabled: settingsData.data.notificationSettings?.emailEnabled ?? true,
            smsEnabled: settingsData.data.notificationSettings?.smsEnabled ?? false,
            providerAlerts: settingsData.data.notificationSettings?.providerAlerts ?? true,
            customerAlerts: settingsData.data.notificationSettings?.customerAlerts ?? true,
          },
          maintenanceMode: {
            customer: {
              enabled: settingsData.data.maintenanceMode?.customer?.enabled ?? false,
              message: settingsData.data.maintenanceMode?.customer?.message || 'Customer services are under maintenance.'
            },
            provider: {
              enabled: settingsData.data.maintenanceMode?.provider?.enabled ?? false,
              message: settingsData.data.maintenanceMode?.provider?.message || 'Provider services are under maintenance.'
            },
            globalMessage: settingsData.data.maintenanceMode?.globalMessage || 'System is under maintenance.'
          },
          featureFlags: {
            walletEnabled: settingsData.data.featureFlags?.walletEnabled ?? true,
          },
          securitySettings: {
            maxLoginAttempts: settingsData.data.securitySettings?.maxLoginAttempts ?? 5,
            otpExpiryMinutes: settingsData.data.securitySettings?.otpExpiryMinutes ?? 10,
            sessionTimeoutHours: settingsData.data.securitySettings?.sessionTimeoutHours ?? 24,
          },
          uploadSettings: {
            maxImageSizeMB: settingsData.data.uploadSettings?.maxImageSizeMB ?? 5,
            allowedImageFormats: settingsData.data.uploadSettings?.allowedImageFormats || ['jpg', 'jpeg', 'png', 'gif'],
          },
          referralSettings: {
            referralProgramPaused: settingsData.data.referralSettings?.referralProgramPaused ?? false,
            welcomeRewardEnabled: settingsData.data.referralSettings?.welcomeRewardEnabled ?? false,
            welcomeRewardType: settingsData.data.referralSettings?.welcomeRewardType || 'wallet',
            welcomeRewardValue: settingsData.data.referralSettings?.welcomeRewardValue ?? 0,
            maxWelcomeRewardValue: settingsData.data.referralSettings?.maxWelcomeRewardValue ?? 0,
            customerProgramEnabled: settingsData.data.referralSettings?.customerProgramEnabled ?? true,
            providerProgramEnabled: settingsData.data.referralSettings?.providerProgramEnabled ?? true,
            minBookingAmount: settingsData.data.referralSettings?.minBookingAmount ?? 0,
            commissionPercentage: settingsData.data.referralSettings?.commissionPercentage ?? 10,
            payoutHoldHours: settingsData.data.referralSettings?.payoutHoldHours ?? 48,
            monthlyBudget: settingsData.data.referralSettings?.monthlyBudget ?? 50000,
            monthlyCapPerUser: settingsData.data.referralSettings?.monthlyCapPerUser ?? 5000,
            dailyCapPerUser: settingsData.data.referralSettings?.dailyCapPerUser ?? 500,
            expiryDays: settingsData.data.referralSettings?.expiryDays ?? 30,
            referralExpiryDays: settingsData.data.referralSettings?.referralExpiryDays ?? 90,
            fraudScoreThreshold: settingsData.data.referralSettings?.fraudScoreThreshold ?? 50,
            walletUsagePercentage: settingsData.data.referralSettings?.walletUsagePercentage ?? 20,
            rewardCalculationMode: settingsData.data.referralSettings?.rewardCalculationMode ?? 'commission',
            rewardThresholdAmount: settingsData.data.referralSettings?.rewardThresholdAmount ?? 1000,
            fixedRewardAmount: settingsData.data.referralSettings?.fixedRewardAmount ?? 50,
            customerReferralEligibilityBookings: settingsData.data.referralSettings?.customerReferralEligibilityBookings ?? 1,
            providerReferralEligibilityBookings: settingsData.data.referralSettings?.providerReferralEligibilityBookings ?? 1,
            dailyReferralLimitPerUser: settingsData.data.referralSettings?.dailyReferralLimitPerUser ?? 5,
            monthlyReferralLimitPerUser: settingsData.data.referralSettings?.monthlyReferralLimitPerUser ?? 20,
            systemReferralOwner: settingsData.data.referralSettings?.systemReferralOwner ?? '',
            providerMilestones: settingsData.data.referralSettings?.providerMilestones || []
          }
        });

        if (settingsData.data.logo) setPreviewLogo(settingsData.data.logo);
        if (settingsData.data.favicon) setPreviewFavicon(settingsData.data.favicon);
      }
    } catch (error) {
      showToast('Error fetching system settings', 'error');
      console.error('Fetch error:', error);
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
      [group]: {
        ...prev[group],
        [key]: value
      }
    }));
  };

  const handleTripleNestedChange = (group, subGroup, key, value) => {
    setSystemSettings(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [subGroup]: {
          ...(prev[group]?.[subGroup] || {}),
          [key]: value
        }
      }
    }));
  };

  const saveSystemSettings = async () => {
    try {
      // 1. Basic Form Validation
      if (!systemSettings.companyName.trim()) {
        showToast('Company name is required', 'error');
        return;
      }

      // Email validation
      if (systemSettings.email && !/\S+@\S+\.\S+/.test(systemSettings.email)) {
        showToast('Invalid email address format', 'error');
        return;
      }

      // Phone validation
      if (systemSettings.phone && !/^\+?[0-9\s-]{7,15}$/.test(systemSettings.phone)) {
        showToast('Invalid phone number format', 'error');
        return;
      }

      // Commission percentages validation
      if (systemSettings.commissionSettings.defaultCommission < 0 || systemSettings.commissionSettings.defaultCommission > 100) {
        showToast('Default Commission must be between 0% and 100%', 'error');
        return;
      }

      // Numbers checks
      if (systemSettings.bookingSettings.cancellationWindowMinutes < 0 ||
        systemSettings.bookingSettings.refundReviewHours < 0 ||
        (systemSettings.bookingSettings.providerResponseSlaHours !== undefined && systemSettings.bookingSettings.providerResponseSlaHours < 0) ||
        (systemSettings.bookingSettings.refundProcessingSlaHours !== undefined && systemSettings.bookingSettings.refundProcessingSlaHours < 0) ||
        systemSettings.bookingSettings.bookingBufferTime < 0 ||
        systemSettings.bookingSettings.maxBookingsPerProvider < 1 ||
        systemSettings.bookingSettings.maxBookingDays < 1 ||
        systemSettings.bookingSettings.slotInterval < 5) {
        showToast('Booking configuration values must be valid positive numbers', 'error');
        return;
      }

      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(systemSettings.bookingSettings.startTime) ||
        !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(systemSettings.bookingSettings.endTime)) {
        showToast('Start and End Times must be in valid 24h format (HH:MM)', 'error');
        return;
      }

      if (systemSettings.walletSettings.minWithdrawal < 0) {
        showToast('Wallet thresholds must be non-negative', 'error');
        return;
      }

      // Image size validation (based on current uploads)
      const allowedFormats = systemSettings.uploadSettings.allowedImageFormats || ['jpg', 'jpeg', 'png', 'gif'];
      const maxLogoSize = (systemSettings.uploadSettings.maxImageSizeMB || 5) * 1024 * 1024;

      if (logoFile) {
        if (logoFile.size > maxLogoSize) {
          showToast(`Logo file size exceeds limit of ${systemSettings.uploadSettings.maxImageSizeMB}MB`, 'error');
          return;
        }
        const fileExt = logoFile.name.split('.').pop().toLowerCase();
        if (!allowedFormats.includes(fileExt)) {
          showToast(`Logo file format not supported. Allowed: ${allowedFormats.join(', ')}`, 'error');
          return;
        }
      }

      if (faviconFile) {
        if (faviconFile.size > 1 * 1024 * 1024) {
          showToast('Favicon file size must be less than 1MB', 'error');
          return;
        }
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

      // Append JSON strings for nested objects
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

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (faviconFile) {
        formData.append('favicon', faviconFile);
      }

      const response = await SystemService.updateSystemSetting(formData);
      const data = response.data;

      if (data.success) {
        showToast('System settings saved successfully');
        writeSystemSettingsCache(data.data);
        setLogoFile(null);
        setFaviconFile(null);
        fetchSystemSettings(); // Refresh data
      } else {
        throw new Error(data.message || 'Failed to save system settings');
      }
    } catch (error) {
      showToast('Error saving system settings: ' + error.message, 'error');
      console.error('Save error:', error);
    }
  };

  // Modern Loading Skeletons
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-roboto p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <div className="h-10 w-48 bg-gray-200 animate-pulse rounded-lg"></div>
            <div className="h-4 w-72 bg-gray-200 animate-pulse rounded-lg"></div>
          </div>

          <div className="flex gap-2 overflow-x-auto py-2 border-b border-gray-200">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 w-28 bg-gray-200 animate-pulse rounded-xl flex-shrink-0"></div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 animate-pulse rounded-xl"></div>
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 animate-pulse rounded"></div>
                <div className="h-4 w-64 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-12 w-full bg-gray-200 animate-pulse rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
    <div className="font-roboto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-poppins">
            System Configuration
          </h1>
          <p className="text-gray-600 mt-2 font-inter text-sm md:text-base">
            Manage your SaaS dynamic configurations, system variables, maintenance windows, and settings groups.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="mb-8 border-b border-gray-200 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 min-w-max pb-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3.5 rounded-xl font-medium font-inter transition-all duration-200 border ${isActive
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-secondary'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span className="text-sm">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Details Title */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-8 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary flex-shrink-0">
            {activeTabDetails && React.createElement(activeTabDetails.icon, { className: "w-6 h-6" })}
          </div>
          <div>
            <h2 className="text-xl font-bold text-secondary font-poppins capitalize">{activeTabDetails?.name} Configuration</h2>
            <p className="text-sm text-gray-500 font-inter mt-0.5">{activeTabDetails?.desc}</p>
          </div>
        </div>

        {/* Tab Content Cards */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 md:p-8">

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Text fields */}
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" /> Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Company Name *</label>
                    <input
                      type="text"
                      name="companyName"
                      value={systemSettings.companyName}
                      onChange={handleSystemSettingsChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                      placeholder="e.g. Raj Electricals"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Tagline</label>
                    <input
                      type="text"
                      name="tagline"
                      value={systemSettings.tagline}
                      onChange={handleSystemSettingsChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                      placeholder="e.g. Lighting up your lives"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="tel"
                        name="phone"
                        value={systemSettings.phone}
                        onChange={handleSystemSettingsChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                        placeholder="e.g. +91 9876543210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="email"
                        name="email"
                        value={systemSettings.email}
                        onChange={handleSystemSettingsChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                        placeholder="e.g. support@company.com"
                      />
                    </div>
                  </div>

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

                {/* Social links */}
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

              {/* Branding uploads */}
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Branding Assets
                </h3>

                {/* Logo Upload */}
                <div className="border border-gray-200 rounded-2xl p-5 text-center bg-gray-50 hover:bg-gray-100/50 transition-colors">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Company Logo</label>
                  {previewLogo ? (
                    <div className="space-y-4">
                      <div className="relative mx-auto w-36 h-36 bg-white p-2 border border-gray-150 rounded-xl flex items-center justify-center">
                        <img
                          src={previewLogo}
                          alt="Logo preview"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/150x150?text=Branding+Logo';
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 font-inter">Supported: JPEG, PNG, GIF</p>
                    </div>
                  ) : (
                    <div className="py-6">
                      <Upload className="text-3xl text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No logo uploaded yet</p>
                    </div>
                  )}
                  <label className="mt-4 inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    Select Logo File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setLogoFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Favicon Upload */}
                <div className="border border-gray-200 rounded-2xl p-5 text-center bg-gray-50 hover:bg-gray-100/50 transition-colors">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Browser Favicon</label>
                  {previewFavicon ? (
                    <div className="space-y-4">
                      <div className="relative mx-auto w-16 h-16 bg-white p-2 border border-gray-150 rounded-lg flex items-center justify-center">
                        <img
                          src={previewFavicon}
                          alt="Favicon preview"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/50x50?text=Favicon';
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 font-inter">Supported: ICO, PNG up to 1MB</p>
                    </div>
                  ) : (
                    <div className="py-6">
                      <Upload className="text-2xl text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No favicon uploaded yet</p>
                    </div>
                  )}
                  <label className="mt-4 inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/95 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    Select Favicon File
                    <input
                      type="file"
                      accept="image/*,.ico"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setFaviconFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

              </div>

            </div>
          )}

          {/* BOOKING SETTINGS TAB */}
          {activeTab === 'booking' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Booking Rules & Allocations
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                 <ToggleSwitch
                  label="Auto Assign Provider"
                  description={
                    systemSettings.bookingSettings.autoAssignProvider
                      ? "Nearest provider auto assignment enabled"
                      : "Providers can manually accept bookings"
                  }
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
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Provider Acceptance Timeout (Minutes)</label>
                    <input
                      type="number"
                      value={systemSettings.bookingSettings.providerAcceptTimeoutMinutes}
                      onChange={(e) => handleNestedChange('bookingSettings', 'providerAcceptTimeoutMinutes', Number(e.target.value))}
                      min="1"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                    />
                    <p className="text-xs text-gray-500 mt-1.5 font-inter">Time in minutes after which an unaccepted auto-assigned booking is released back to pending.</p>
                  </div>
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

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Live Tracking Interval (Seconds)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.trackingInterval}
                    onChange={(e) => handleNestedChange('bookingSettings', 'trackingInterval', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Interval (in seconds) between successive live telemetry coordinate packets sent from en-route providers.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Auto-Assign Search Radius (KM)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.autoAssignRadius}
                    onChange={(e) => handleNestedChange('bookingSettings', 'autoAssignRadius', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Maximum radius distance (in kilometers) scanned around a booking to match nearby online Providers.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Cancellation Window (Minutes)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.cancellationWindowMinutes}
                    onChange={(e) => handleNestedChange('bookingSettings', 'cancellationWindowMinutes', Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Period during which a customer can cancel a booking without penalty charges.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Refund Review Period (Hours)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.refundReviewHours}
                    onChange={(e) => handleNestedChange('bookingSettings', 'refundReviewHours', Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Maximum hours after which a disputed refund request is automatically reviewed.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Provider Response SLA (Hours)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.providerResponseSlaHours ?? 24}
                    onChange={(e) => handleNestedChange('bookingSettings', 'providerResponseSlaHours', Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Hours within which provider must respond to a complaint.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Refund Processing SLA (Hours)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.refundProcessingSlaHours ?? 72}
                    onChange={(e) => handleNestedChange('bookingSettings', 'refundProcessingSlaHours', Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Hours within which resolved refund must be processed.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Booking Buffer Time (Minutes)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.bookingBufferTime}
                    onChange={(e) => handleNestedChange('bookingSettings', 'bookingBufferTime', Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Buffer period between successive client bookings to allow providers travel time.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Max Parallel Bookings per Provider</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.maxBookingsPerProvider}
                    onChange={(e) => handleNestedChange('bookingSettings', 'maxBookingsPerProvider', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Caps the number of active/accepted jobs a provider can process simultaneously.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Max Booking Days Ahead</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.maxBookingDays}
                    onChange={(e) => handleNestedChange('bookingSettings', 'maxBookingDays', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Maximum number of days in advance a customer is allowed to book a service.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Slot Interval (Minutes)</label>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings.slotInterval}
                    onChange={(e) => handleNestedChange('bookingSettings', 'slotInterval', Number(e.target.value))}
                    min="5"
                    step="5"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Minutes between consecutive time slots generated for bookings (e.g. 30 for half-hourly).</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Business Start Time (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="09:00"
                    value={systemSettings.bookingSettings.startTime}
                    onChange={(e) => handleNestedChange('bookingSettings', 'startTime', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Daily time when bookings can start, in 24-hour format (e.g. 09:00).</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Business End Time (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="21:00"
                    value={systemSettings.bookingSettings.endTime}
                    onChange={(e) => handleNestedChange('bookingSettings', 'endTime', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Daily time when bookings must end, in 24-hour format (e.g. 21:00).</p>
                </div>

              </div>
            </div>
          )}

          {/* WALLET SETTINGS TAB */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> Wallet & Financial Rules
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <ToggleSwitch
                  label="Refund to Wallet Only"
                  description="Enforce that customer cancellations or dispute refunds are exclusively credited as wallet balances."
                  checked={systemSettings.walletSettings.refundToWalletOnly}
                  onChange={(val) => handleNestedChange('walletSettings', 'refundToWalletOnly', val)}
                />



                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Minimum Withdrawal Threshold ({systemSettings.defaultCurrency})</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold font-inter text-sm">{systemSettings.defaultCurrency}</span>
                    <input
                      type="number"
                      value={systemSettings.walletSettings.minWithdrawal}
                      onChange={(e) => handleNestedChange('walletSettings', 'minWithdrawal', Number(e.target.value))}
                      min="0"
                      className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Minimum wallet earnings a provider must accrue before initiating a bank withdrawal.</p>
                </div>



              </div>
            </div>
          )}

          {/* COMMISSION SETTINGS TAB */}
          {activeTab === 'commission' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" /> Commissions & Fees
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Default Commission Percentage (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={systemSettings.commissionSettings.defaultCommission}
                      onChange={(e) => handleNestedChange('commissionSettings', 'defaultCommission', Number(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                    />
                    <span className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold font-inter text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">The default service transaction fee percentage retained by the platform from bookings.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Earnings Payout Hold Time (Hours)</label>
                  <input
                    type="number"
                    value={systemSettings.commissionSettings.payoutHoldHours}
                    onChange={(e) => handleNestedChange('commissionSettings', 'payoutHoldHours', Number(e.target.value))}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Security cooling-off hours before completed booking earnings transition from "Held" to "Available" for provider withdrawal request.</p>
                </div>
              </div>
            </div>
          )}



          {/* NOTIFICATION SETTINGS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> Global Notification Delivery Channels
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <ToggleSwitch
                  label="Enable Push Notifications"
                  description="Deliver instant, rich Web/Mobile app push notifications on key booking changes."
                  checked={systemSettings.notificationSettings.pushEnabled}
                  onChange={(val) => handleNestedChange('notificationSettings', 'pushEnabled', val)}
                />

                <ToggleSwitch
                  label="Enable Email System"
                  description="Trigger transactional email updates for confirmations, invoices, and payouts."
                  checked={systemSettings.notificationSettings.emailEnabled}
                  onChange={(val) => handleNestedChange('notificationSettings', 'emailEnabled', val)}
                />

                <ToggleSwitch
                  label="Enable SMS System"
                  description="Distribute crucial OTP codes, reminders, and notifications via carrier cellular SMS."
                  checked={systemSettings.notificationSettings.smsEnabled}
                  onChange={(val) => handleNestedChange('notificationSettings', 'smsEnabled', val)}
                />

                <ToggleSwitch
                  label="Provider Lifecycle Alerts"
                  description="Forward crucial status reports, pending disputes, and payout updates to providers."
                  checked={systemSettings.notificationSettings.providerAlerts}
                  onChange={(val) => handleNestedChange('notificationSettings', 'providerAlerts', val)}
                />

                <ToggleSwitch
                  label="Customer Order Alerts"
                  description="Send real-time updates regarding accepted jobs, provider travel status, and completions to customers."
                  checked={systemSettings.notificationSettings.customerAlerts}
                  onChange={(val) => handleNestedChange('notificationSettings', 'customerAlerts', val)}
                />

              </div>
            </div>
          )}

          {/* SECURITY SETTINGS TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Application Security Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Max Permitted Login Attempts</label>
                  <input
                    type="number"
                    value={systemSettings.securitySettings.maxLoginAttempts}
                    onChange={(e) => handleNestedChange('securitySettings', 'maxLoginAttempts', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Account gets temporarily locked/blocked once incorrect password attempt reaches this ceiling limit.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">OTP Code Expiration Window (Minutes)</label>
                  <input
                    type="number"
                    value={systemSettings.securitySettings.otpExpiryMinutes}
                    onChange={(e) => handleNestedChange('securitySettings', 'otpExpiryMinutes', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Lifetime duration of standard login, verification, or password reset OTP verification code tokens.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-secondary mb-2 font-inter">JWT Session Timeout (Hours)</label>
                  <input
                    type="number"
                    value={systemSettings.securitySettings.sessionTimeoutHours}
                    onChange={(e) => handleNestedChange('securitySettings', 'sessionTimeoutHours', Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 font-inter">Total valid duration before a logged-in user session expires, requiring fresh re-authentication.</p>
                </div>

              </div>
            </div>
          )}

          {/* FEATURE FLAGS TAB */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <Flag className="w-5 h-5 text-primary" /> Platform Module Feature Flags
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <ToggleSwitch
                  label="Digital Wallet System"
                  description="Toggle the entire customer and provider financial wallet, payout, and in-app balances modules globally."
                  checked={systemSettings.featureFlags.walletEnabled}
                  onChange={(val) => handleNestedChange('featureFlags', 'walletEnabled', val)}
                />



              </div>
            </div>
          )}

          {/* MAINTENANCE MODE TAB */}
          {activeTab === 'maintenance' && (
            <div className="space-y-8">
              <h3 className="text-base font-semibold text-secondary pb-2 border-b border-gray-100 font-poppins flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" /> Maintenance Window Controls
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* CUSTOMER MAINTENANCE */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-secondary font-poppins text-base">Customer Maintenance</h4>
                      <p className="text-xs text-gray-400 font-inter">Offline controls for customer-facing interfaces.</p>
                    </div>
                  </div>

                  <ToggleSwitch
                    label="Enable Customer Maintenance"
                    description="Block access to logins and customer dashboard features immediately."
                    checked={systemSettings.maintenanceMode.customer?.enabled}
                    onChange={(val) => handleNestedChange('maintenanceMode', 'customer', {
                      ...systemSettings.maintenanceMode.customer,
                      enabled: val
                    })}
                  />

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider font-inter">Customer Maintenance Message</label>
                    <textarea
                      value={systemSettings.maintenanceMode.customer?.message}
                      onChange={(e) => handleNestedChange('maintenanceMode', 'customer', {
                        ...systemSettings.maintenanceMode.customer,
                        message: e.target.value
                      })}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary text-sm"
                      placeholder="Customer services are under maintenance."
                    />
                  </div>
                </div>

                {/* PROVIDER MAINTENANCE */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <div className="p-2 bg-accent/10 rounded-xl text-accent">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-secondary font-poppins text-base">Provider Maintenance</h4>
                      <p className="text-xs text-gray-400 font-inter">Offline controls for provider-facing interfaces.</p>
                    </div>
                  </div>

                  <ToggleSwitch
                    label="Enable Provider Maintenance"
                    description="Block access to logins and provider dashboard features immediately."
                    checked={systemSettings.maintenanceMode.provider?.enabled}
                    onChange={(val) => handleNestedChange('maintenanceMode', 'provider', {
                      ...systemSettings.maintenanceMode.provider,
                      enabled: val
                    })}
                  />

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider font-inter">Provider Maintenance Message</label>
                    <textarea
                      value={systemSettings.maintenanceMode.provider?.message}
                      onChange={(e) => handleNestedChange('maintenanceMode', 'provider', {
                        ...systemSettings.maintenanceMode.provider,
                        message: e.target.value
                      })}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary text-sm"
                      placeholder="Provider services are under maintenance."
                    />
                  </div>
                </div>

              </div>

              {/* GLOBAL MESSAGE */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-secondary font-poppins text-base">Global Maintenance Settings</h4>
                    <p className="text-xs text-gray-400 font-inter">General fallback message for all roles.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider font-inter">Global Maintenance Message</label>
                  <textarea
                    value={systemSettings.maintenanceMode.globalMessage}
                    onChange={(e) => handleNestedChange('maintenanceMode', 'globalMessage', e.target.value)}
                    rows="2"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary text-sm"
                    placeholder="System is under maintenance."
                  />
                  <p className="text-xs text-gray-400 font-inter">This message will act as a generic fallback if role-specific messages are empty.</p>
                </div>
              </div>
            </div>
          )}

          {/* REFERRAL TAB */}
          {activeTab === 'referral' && (
            <div className="space-y-8 animate-fade-in text-left">
              {/* Section 1: Customer Referral Settings */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-3 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-secondary font-poppins text-base">Customer Referral Settings</h4>
                    <p className="text-xs text-gray-400 font-inter">Rules for customers referring other customers. Rewards are calculated dynamically from order commissions.</p>
                  </div>
                </div>

                {/* Emergency Pause Toggle */}
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-red-800 block">Emergency Program Pause</span>
                    <span className="text-xs text-red-600">Instantly pauses all validation, registrations, and reward generation.</span>
                  </div>
                  <select
                    value={systemSettings.referralSettings.referralProgramPaused}
                    onChange={(e) => handleNestedChange('referralSettings', 'referralProgramPaused', e.target.value === 'true')}
                    className="bg-white border border-red-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500 text-red-800 font-semibold"
                  >
                    <option value="false">Active / Running</option>
                    <option value="true">PAUSED</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Program Switch */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Customer Referral Program</label>
                    <select 
                      value={systemSettings.referralSettings.customerProgramEnabled} 
                      onChange={(e) => handleNestedChange('referralSettings', 'customerProgramEnabled', e.target.value === 'true')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                    >
                      <option value="true">Active / Enabled</option>
                      <option value="false">Inactive / Disabled</option>
                    </select>
                    <p className="text-[11px] text-gray-500 font-inter">Enable or disable the entire referral system for customers.</p>
                  </div>

                  {/* Min Booking Amount */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Min Friend Booking Amount (₹)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.minBookingAmount} 
                      onChange={(e) => handleNestedChange('referralSettings', 'minBookingAmount', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">The referred friend's first booking bill must be at least this amount to trigger referral rewards.</p>
                  </div>

                  {/* Reward Type / Calculation Mode */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Referral Reward Calculation Method</label>
                    <select 
                      value={systemSettings.referralSettings.rewardCalculationMode || 'commission'} 
                      onChange={(e) => handleNestedChange('referralSettings', 'rewardCalculationMode', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter font-semibold"
                    >
                      <option value="commission">Commission Based (Recommended)</option>
                      <option value="fixed">Fixed Reward Amount</option>
                    </select>
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-inter">
                      {systemSettings.referralSettings.rewardCalculationMode === 'commission' ? (
                        <div>
                          <strong>Live Example:</strong> If our platform takes ₹100 commission from a job, a {systemSettings.referralSettings.commissionPercentage || 0}% reward share earns the referrer <strong>₹{((100 * (systemSettings.referralSettings.commissionPercentage || 0)) / 100).toFixed(2)}</strong> in wallet balance.
                        </div>
                      ) : (
                        <div>
                          <strong>Live Example:</strong> The referrer earns a flat <strong>₹{systemSettings.referralSettings.fixedRewardAmount || 0}</strong> directly to their wallet for every qualified booking made by the referred friend, regardless of the job value.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reward Percentage - conditional */}
                  {systemSettings.referralSettings.rewardCalculationMode === 'commission' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Referrer Reward Share (%)</label>
                      <input 
                        type="number" 
                        value={systemSettings.referralSettings.commissionPercentage} 
                        onChange={(e) => handleNestedChange('referralSettings', 'commissionPercentage', Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                        min="0"
                        max="100"
                      />
                      <p className="text-[11px] text-gray-500 font-inter">Percentage of our platform earnings given to the person who shared the referral code.</p>
                    </div>
                  )}

                  {/* Fixed Reward Amount — conditional */}
                  {systemSettings.referralSettings.rewardCalculationMode === 'fixed' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Referrer Flat Reward (₹)</label>
                      <input 
                        type="number" 
                        value={systemSettings.referralSettings.fixedRewardAmount || 50} 
                        onChange={(e) => handleNestedChange('referralSettings', 'fixedRewardAmount', Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                        min="0"
                      />
                      <p className="text-[11px] text-gray-500 font-inter">The fixed rupees amount paid to the referrer's wallet when a friend completes their booking.</p>
                    </div>
                  )}
                  
                  {/* Customer Eligibility Bookings */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Min Completed Bookings required to Refer</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.customerReferralEligibilityBookings} 
                      onChange={(e) => handleNestedChange('referralSettings', 'customerReferralEligibilityBookings', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Number of successful bookings a customer must complete themselves before they can share their code.</p>
                  </div>

                  {/* Welcome Reward Enabled Toggle */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Customer Welcome Reward</label>
                    <select
                      value={systemSettings.referralSettings.welcomeRewardEnabled}
                      onChange={(e) => handleNestedChange('referralSettings', 'welcomeRewardEnabled', e.target.value === 'true')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                    >
                      <option value="true">Active / Enabled</option>
                      <option value="false">Inactive / Disabled</option>
                    </select>
                    <p className="text-[11px] text-gray-500 font-inter">Give a special bonus/discount to the referred friend when they complete their first booking.</p>
                  </div>

                  {/* Welcome Reward Type */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Welcome Reward Format</label>
                    <select
                      value={systemSettings.referralSettings.welcomeRewardType || 'wallet'}
                      onChange={(e) => handleNestedChange('referralSettings', 'welcomeRewardType', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      disabled={!systemSettings.referralSettings.welcomeRewardEnabled}
                    >
                      <option value="wallet">Wallet Cash Balance</option>
                      <option value="coupon">Discount Coupon</option>
                      <option value="both">Both Wallet & Coupon</option>
                    </select>
                    <p className="text-[11px] text-gray-500 font-inter">Format of the welcome reward: Wallet Credit, Coupon Code, or both.</p>
                  </div>

                  {/* Welcome Reward Value */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Welcome Reward Value (₹)</label>
                    <input
                      type="number"
                      value={systemSettings.referralSettings.welcomeRewardValue || 0}
                      onChange={(e) => handleNestedChange('referralSettings', 'welcomeRewardValue', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                      disabled={!systemSettings.referralSettings.welcomeRewardEnabled}
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Rupees value of the welcome wallet cash or coupon discount value.</p>
                  </div>

                  {/* Welcome Reward Cap */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Maximum Welcome Reward Cap (₹)</label>
                    <input
                      type="number"
                      value={systemSettings.referralSettings.maxWelcomeRewardValue || 0}
                      onChange={(e) => handleNestedChange('referralSettings', 'maxWelcomeRewardValue', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                      disabled={!systemSettings.referralSettings.welcomeRewardEnabled}
                    />
                    <p className="text-[11px] text-gray-500 font-inter">The absolute maximum welcome reward cash/discount value that can ever be awarded.</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Provider Program Settings */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-3 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-indigo-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-secondary font-poppins text-base">Provider Referral Settings</h4>
                    <p className="text-xs text-gray-400 font-inter">Rules for partner electricians referring other providers. Rewards are based on milestone booking targets.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Provider Program Switch */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Provider Referral Program</label>
                    <select 
                      value={systemSettings.referralSettings.providerProgramEnabled} 
                      onChange={(e) => handleNestedChange('referralSettings', 'providerProgramEnabled', e.target.value === 'true')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                    >
                      <option value="true">Active / Enabled</option>
                      <option value="false">Inactive / Disabled</option>
                    </select>
                    <p className="text-[11px] text-gray-500 font-inter">Enable or disable the referral program for electricians/service providers.</p>
                  </div>
                  
                  {/* Provider Eligibility Bookings */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Min Completed Jobs required to Refer</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.providerReferralEligibilityBookings} 
                      onChange={(e) => handleNestedChange('referralSettings', 'providerReferralEligibilityBookings', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Number of bookings a provider must successfully complete themselves before unlocking their referral code.</p>
                  </div>

                  <div className="flex items-center bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 md:col-span-2">
                    <p>💡 <strong>Milestone Config Note:</strong> Provider milestone rewards (e.g. ₹500 on 5 bookings completed) are configured separately under the <strong>Referral & Rewards &rarr; Milestones</strong> page in the Admin Sidebar menu.</p>
                  </div>
                </div>
              </div>

              {/* Section 3: General Rules & Safety Controls */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-3 flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-secondary font-poppins text-base">Global Program Limits & Safety Settings</h4>
                    <p className="text-xs text-gray-400 font-inter">Apply overall budget caps, hold periods, wallet usage limits, and fraud safety checks.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Monthly Budget */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Monthly Campaign Budget Cap (₹)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.monthlyBudget} 
                      onChange={(e) => handleNestedChange('referralSettings', 'monthlyBudget', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="100"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Maximum budget allowed for all combined referral rewards in a single month. If reached, payouts pause.</p>
                  </div>

                  {/* Wallet Usage Percentage */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Wallet Balance Booking Discount Limit (%)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.walletUsagePercentage !== undefined ? systemSettings.referralSettings.walletUsagePercentage : 20} 
                      onChange={(e) => handleNestedChange('referralSettings', 'walletUsagePercentage', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                      max="100"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Maximum percentage of a booking's bill that can be paid using referral cashback wallet balance.</p>
                  </div>

                  {/* Monthly Cap */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Monthly Earning Cap Per User (₹)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.monthlyCapPerUser} 
                      onChange={(e) => handleNestedChange('referralSettings', 'monthlyCapPerUser', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="1"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Maximum reward amount a single customer or partner provider is allowed to earn per month.</p>
                  </div>

                  {/* Daily Cap */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Daily Earning Cap Per User (₹)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.dailyCapPerUser} 
                      onChange={(e) => handleNestedChange('referralSettings', 'dailyCapPerUser', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="1"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Maximum reward amount a single customer or partner provider is allowed to earn per day.</p>
                  </div>

                  {/* Payout Hold Hours */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Verification Cooling/Hold Time (Hours)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.payoutHoldHours} 
                      onChange={(e) => handleNestedChange('referralSettings', 'payoutHoldHours', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Hours to hold the reward before releasing to the user's wallet (payout fraud protection hold).</p>
                  </div>

                  {/* Expiry Days */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Friend Booking Deadline (Days)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.expiryDays} 
                      onChange={(e) => handleNestedChange('referralSettings', 'expiryDays', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="1"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">The referred friend must complete their first booking within this many days of registering to unlock rewards.</p>
                  </div>

                  {/* Referral Expiry Days */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Referral Expiry Duration (Days)</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.referralExpiryDays !== undefined ? systemSettings.referralSettings.referralExpiryDays : 90} 
                      onChange={(e) => handleNestedChange('referralSettings', 'referralExpiryDays', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="1"
                    />
                    <p className="text-[11px] text-gray-500 font-inter">Overall validity duration in days of a referral registration before it expires.</p>
                  </div>

                  {/* Fraud Score Threshold */}
                  <div className="space-y-2 text-left">
                    <label className="block text-xs font-bold uppercase text-gray-700 font-inter">Security Guard Sensitivity Threshold</label>
                    <input 
                      type="number" 
                      value={systemSettings.referralSettings.fraudScoreThreshold} 
                      onChange={(e) => handleNestedChange('referralSettings', 'fraudScoreThreshold', Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-secondary font-inter"
                      min="0"
                      max="100"
                    />
                    <p className="text-[11px] text-gray-400 font-inter">Safety limit; if abuse checks score above this, reward is held for manual review.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Sticky Action Footer with premium aesthetics */}
        <div className="sticky bottom-0 z-40 -mx-4 lg:-mx-6 xl:-mx-8 -mb-4 lg:-mb-6 xl:-mb-8 mt-12 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-xl p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary animate-pulse flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-secondary font-poppins text-sm">System configuration settings have unsaved items</p>
              <p className="text-xs text-gray-400 font-inter">Review edits across tabs and click apply to commit configurations.</p>
            </div>
          </div>
          <button
            onClick={saveSystemSettings}
            type="button"
            className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-white font-semibold font-inter px-8 py-3.5 rounded-xl shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="w-4 h-4" /> Save All Configurations
          </button>
        </div>

      </div>
    </div >
  );
};

export default SystemSetting;
