import React, { useState, useEffect } from 'react';
import {
  FiSmartphone, FiMonitor, FiUploadCloud, FiImage, FiSettings,
  FiRefreshCw, FiSave, FiEye, FiCheckCircle, FiInfo, FiTrash2,
  FiLayout, FiSend, FiLayers, FiActivity, FiAlertCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import * as SystemService from '../../services/SystemService';

const Branding = () => {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'provider' | 'admin'
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestData, setManifestData] = useState(null);

  // States for App Update Broadcast features
  const [releaseNotes, setReleaseNotes] = useState('');
  const [forceRefresh, setForceRefresh] = useState(true);

  // States for role branding fields (strictly NO themeColor/backgroundColor controls)
  const [formData, setFormData] = useState({
    customer: {
      appName: 'Raj Electrical Service',
      shortName: 'Raj Service',
      logo: '',
      icon: '',
      splashScreen: '',
      browserTitle: 'Raj Electrical Service | Book Trusted Electricians Near You',
      description: 'Book certified electricians for home and commercial electrical repairs, installations, and maintenance. Fast, reliable, and affordable electrician service at your doorstep.',
      appVersion: 1,
      lastPublished: null,
      installedUsersCount: 0
    },
    provider: {
      appName: 'Raj Provider',
      shortName: 'Raj Partner',
      logo: '',
      icon: '',
      splashScreen: '',
      browserTitle: 'Raj Electrical Partner | Earn as a Certified Electrician',
      description: 'Join Raj Electrical Service as a certified partner. Accept electrical repair and installation bookings and grow your earnings.',
      appVersion: 1,
      lastPublished: null,
      installedUsersCount: 0
    },
    admin: {
      appName: 'Raj Admin',
      shortName: 'Raj Admin',
      logo: '',
      favicon: '',
      browserTitle: 'Raj Electrical Admin Panel',
      description: 'Raj Electrical Services Control Panel',
      appVersion: 1,
      lastPublished: null,
      installedUsersCount: 0
    }
  });

  // Fetch initial branding settings for all roles on load
  const fetchAllBranding = async () => {
    setLoading(true);
    try {
      const roles = ['customer', 'provider', 'admin'];
      const newFormData = { ...formData };

      for (const role of roles) {
        const response = await SystemService.getBrandingSettings(role);
        if (response.data?.success && response.data.data) {
          newFormData[role] = {
            ...newFormData[role],
            ...response.data.data
          };
        }
      }
      setFormData(newFormData);
    } catch (error) {
      console.error('Failed to load branding settings:', error);
      toast.error('Failed to load branding settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBranding();
  }, []);

  const handleInputChange = (role, field, value) => {
    setFormData(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value
      }
    }));
  };

  // Asset upload handler
  const handleAssetUpload = async (role, field, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.warning('File size must be under 10MB');
      return;
    }

    setUploadingField(field);
    const fd = new FormData();
    fd.append(field, file);

    try {
      const response = await SystemService.uploadBrandingAsset(role, fd);
      if (response.data?.success) {
        handleInputChange(role, field, response.data.url);
        toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} asset uploaded successfully!`);
      } else {
        toast.error('Upload failed. Please try again.');
      }
    } catch (error) {
      console.error('Asset upload failed:', error);
      toast.error('An error occurred during asset upload.');
    } finally {
      setUploadingField(null);
    }
  };

  // Delete visual asset locally
  const removeAsset = (role, field) => {
    handleInputChange(role, field, '');
  };

  // Save branding changes as draft to the database
  const handleSaveDraft = async (role) => {
    setLoading(true);
    try {
      // Exclude metadata counters
      const { appVersion, lastPublished, installedUsersCount, ...brandingFields } = formData[role];
      const response = await SystemService.updateBrandingSettings(role, brandingFields);
      if (response.data?.success) {
        toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} branding saved as draft successfully!`);

        // Notify dynamic client hook
        window.dispatchEvent(
          new CustomEvent('brandingUpdated', {
            detail: { role, data: response.data.data }
          })
        );

        localStorage.setItem(`branding_${role}`, JSON.stringify(response.data.data));

        // Refresh values from backend
        await fetchAllBranding();
      }
    } catch (error) {
      console.error('Failed to save branding draft:', error);
      toast.error('Failed to save draft changes.');
    } finally {
      setLoading(false);
    }
  };

  // Save changes, BUMP version, and broadcast FCM update push
  const handlePublishUpdate = async (role) => {
    const confirmBroadcast = window.confirm("Send update notification to installed users?");

    setLoading(true);
    try {
      const { appVersion, lastPublished, installedUsersCount, ...brandingFields } = formData[role];
      const response = await SystemService.publishBrandingSettings(role, {
        ...brandingFields,
        releaseNotes: releaseNotes.trim() || 'A new version is available. Tap to update now.',
        forceRefresh,
        sendNotification: confirmBroadcast
      });
      if (response.data?.success) {
        toast.success(`🎉 ${role.charAt(0).toUpperCase() + role.slice(1)} branding published successfully! Version bumped to v${response.data.data.appVersion}`);

        // Notify dynamic client hook
        window.dispatchEvent(
          new CustomEvent('brandingUpdated', {
            detail: { role, data: response.data.data }
          })
        );

        localStorage.setItem(`branding_${role}`, JSON.stringify(response.data.data));
        setReleaseNotes('');

        // Refresh all values
        await fetchAllBranding();
      }
    } catch (error) {
      console.error('Failed to publish branding update:', error);
      toast.error('Failed to publish system update.');
    } finally {
      setLoading(false);
    }
  };

  // Broadcast app update push notification (standalone action)
  const handleSendStandaloneBroadcast = async (role) => {
    const notes = releaseNotes.trim() || 'A new version is available. Tap to update now.';
    setLoading(true);
    try {
      const response = await SystemService.publishBrandingSettings(role, {
        broadcastOnly: true,
        releaseNotes: notes,
        forceRefresh,
        sendNotification: true
      });
      if (response.data?.success) {
        toast.success(`🎉 App update notification broadcasted successfully for ${role} application! Bumped to version v${response.data.data.appVersion}`);
        setReleaseNotes('');
        await fetchAllBranding();
      }
    } catch (error) {
      console.error('Failed to broadcast standalone update notification:', error);
      toast.error('Failed to broadcast update notification.');
    } finally {
      setLoading(false);
    }
  };

  // Reset fields to system defaults
  const handleReset = (role) => {
    const defaults = {
      customer: {
        appName: 'Raj Electrical Service',
        shortName: 'Raj Service',
        logo: '',
        icon: '',
        splashScreen: '',
        browserTitle: 'Raj Electrical Service | Book Trusted Electricians Near You',
        description: 'Book certified electricians for home and commercial electrical repairs, installations, and maintenance. Fast, reliable, and affordable electrician service at your doorstep.'
      },
      provider: {
        appName: 'Raj Provider',
        shortName: 'Raj Partner',
        logo: '',
        icon: '',
        splashScreen: '',
        browserTitle: 'Raj Electrical Partner | Earn as a Certified Electrician',
        description: 'Join Raj Electrical Service as a certified partner. Accept electrical repair and installation bookings and grow your earnings.'
      },
      admin: {
        appName: 'Raj Admin',
        shortName: 'Raj Admin',
        logo: '',
        favicon: '',
        browserTitle: 'Raj Electrical Admin Panel',
        description: 'Raj Electrical Services Control Panel'
      }
    };

    setFormData(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        ...defaults[role]
      }
    }));
    toast.info('Fields reset to defaults locally. Save or Publish to apply to database.');
  };

  // Open raw manifest preview modal
  const handlePreviewManifest = (role) => {
    const roleData = formData[role];
    const manifest = {
      name: roleData.appName,
      short_name: roleData.shortName,
      start_url: role === 'admin' ? '/admin/dashboard' : role === 'provider' ? '/provider/dashboard' : '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#0D9488',
      orientation: 'portrait',
      icons: [
        {
          src: roleData.icon || roleData.logo || '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: roleData.splashScreen || roleData.icon || roleData.logo || '/icon-192.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ],
      description: role === 'admin' ? 'Raj Electrical Services Control Panel' : `${roleData.shortName} App`,
      id: `com.rajelectrical.${role}`
    };

    setManifestData(manifest);
    setShowManifestModal(true);
  };

  const currentBranding = formData[activeTab];

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-inter text-gray-800 pb-12">

      {/* Header section - Clean design aligned with tailwind.config.js */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold font-poppins text-gray-900 flex items-center gap-2">
            <FiLayout className="text-teal-600 w-7 h-7" /> Branding & Update Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure dynamic app identity, visual launcher parameters, and broadcast instant app version pushes.
          </p>
        </div>
        <button
          onClick={() => handlePreviewManifest(activeTab)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-teal-500 text-gray-600 hover:text-teal-600 font-semibold text-xs rounded-xl transition-all bg-white shadow-sm hover:shadow-md"
        >
          <FiEye className="w-4 h-4" /> View Dynamic PWA Manifest
        </button>
      </div>

      {/* Role Segmented Switcher */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl max-w-md shadow-inner">
        {['customer', 'provider', 'admin'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-center text-xs font-bold capitalize rounded-xl transition-all duration-300 ${activeTab === tab
                ? 'bg-white text-teal-600 shadow-md font-extrabold transform scale-[1.02]'
                : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            {tab} application
          </button>
        ))}
      </div>

      {/* Installed Devices Overview - All 3 apps at a glance */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { role: 'customer', label: 'Customer App', icon: '👥', color: 'teal' },
          { role: 'provider', label: 'Provider App', icon: '🔧', color: 'emerald' },
          { role: 'admin', label: 'Admin Panel', icon: '🛡️', color: 'indigo' }
        ].map(({ role, label, icon, color }) => {
          const isActive = activeTab === role;
          const count = formData[role]?.installedUsersCount || 0;
          const colorMap = {
            teal: {
              border: isActive ? 'border-teal-400' : 'border-gray-100',
              bg: isActive ? 'bg-gradient-to-br from-teal-50 to-teal-100/60' : 'bg-white',
              badge: 'bg-teal-100 text-teal-700',
              num: 'text-teal-600',
              dot: 'bg-teal-500'
            },
            emerald: {
              border: isActive ? 'border-emerald-400' : 'border-gray-100',
              bg: isActive ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/60' : 'bg-white',
              badge: 'bg-emerald-100 text-emerald-700',
              num: 'text-emerald-600',
              dot: 'bg-emerald-500'
            },
            indigo: {
              border: isActive ? 'border-indigo-400' : 'border-gray-100',
              bg: isActive ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/60' : 'bg-white',
              badge: 'bg-indigo-100 text-indigo-700',
              num: 'text-indigo-600',
              dot: 'bg-indigo-500'
            }
          };
          const c = colorMap[color];
          return (
            <button
              key={role}
              onClick={() => setActiveTab(role)}
              className={`relative flex flex-col gap-2 p-4 rounded-2xl border-2 shadow-sm transition-all duration-200 hover:shadow-md text-left ${c.border} ${c.bg} ${isActive ? 'scale-[1.02] shadow-md' : 'hover:scale-[1.01]'}`}
            >
              {isActive && (
                <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
              )}
              <div className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className={`text-2xl font-black ${c.num}`}>{count}</span>
                <span className="text-[10px] text-gray-400 font-semibold pb-0.5">devices</span>
              </div>
              <span className={`self-start text-[9px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                <FiSmartphone className="inline w-2.5 h-2.5 mr-0.5 -mt-px" />
                Installed
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Settings Form Column */}
        <div className="lg:col-span-7 bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-6">

          {/* Identity Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <FiSettings className="text-teal-600 w-4 h-4" /> Brand Identity
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">App Name</label>
                <input
                  type="text"
                  value={currentBranding.appName}
                  onChange={(e) => handleInputChange(activeTab, 'appName', e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-800 font-medium bg-gray-55"
                  placeholder="App brand name"
                />
                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                  <span className="text-teal-500 font-bold">Shows on:</span> PWA install dialog, Android app switcher
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Short Name</label>
                <input
                  type="text"
                  value={currentBranding.shortName}
                  onChange={(e) => handleInputChange(activeTab, 'shortName', e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-800 font-medium bg-gray-55"
                  placeholder="Short launcher name (max 12 chars)"
                />
                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                  <span className="text-teal-500 font-bold">Shows on:</span> Phone home screen icon ke neeche
                </p>
              </div>
            </div>

            {/* Browser / SEO Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">
                {activeTab === 'admin' ? 'Dashboard Title' : 'Browser / SEO Title'}
              </label>
              <input
                type="text"
                value={currentBranding.browserTitle || ''}
                onChange={(e) => handleInputChange(activeTab, 'browserTitle', e.target.value)}
                className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-800 font-medium bg-gray-55"
                placeholder={activeTab === 'admin' ? 'Dashboard header title' : 'E.g. Raj Electrical Service | Book Trusted Electricians Near You'}
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                <span className="text-teal-500 font-bold">Shows on:</span>
                {activeTab === 'admin' ? 'Admin panel browser tab' : 'Browser tab (ऊपर) aur Google search result heading mein'}
              </p>
            </div>

            {/* Meta Description (Only for Customer and Provider tabs) */}
            {activeTab !== 'admin' && (
              <div className="space-y-1 animate-in fade-in duration-300">
                <label className="text-xs font-semibold text-gray-500">SEO Meta Description</label>
                <textarea
                  rows={3}
                  value={currentBranding.description || ''}
                  onChange={(e) => handleInputChange(activeTab, 'description', e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-800 font-medium bg-gray-55 resize-none"
                  placeholder="Enter high-ranking electrician search keywords description..."
                />
                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                  <span className="text-teal-500 font-bold">Shows on:</span> Google search result mein title ke neeche, WhatsApp/Facebook link preview mein
                </p>
              </div>
            )}
          </div>

          {/* Visual Assets Upload Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <FiImage className="text-teal-600 w-4 h-4" /> Visual Assets
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Logo Box (Common) */}
              <div className="p-4 border border-gray-200 bg-gray-55 rounded-2xl flex flex-col items-center justify-between text-center min-h-[170px] relative overflow-hidden group">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Logo Asset</span>
                <span className="text-[9px] text-gray-400 mb-2">Navbar, email header, favicon fallback</span>
                {currentBranding.logo ? (
                  <div className="space-y-3 w-full px-2">
                    <div className="h-16 w-full bg-white rounded-xl border border-gray-100 flex items-center justify-center p-2 shadow-sm">
                      <img src={currentBranding.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAsset(activeTab, 'logo')}
                      className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 mx-auto bg-red-50 hover:bg-red-100/50 px-3 py-1 rounded-lg transition-all"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" /> Remove Logo
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center p-4 hover:bg-teal-50/50 border-2 border-dashed border-gray-200 hover:border-teal-400 w-full h-full rounded-xl transition-all">
                    <FiUploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-teal-500 transition-colors" />
                    <span className="text-xs font-bold text-teal-600">Upload Image Logo</span>
                    <span className="text-[9px] text-gray-400 mt-1">Recommended: PNG / SVG</span>
                    <input
                      type="file"
                      onChange={(e) => handleAssetUpload(activeTab, 'logo', e)}
                      className="hidden"
                      accept="image/*"
                      disabled={uploadingField !== null}
                    />
                  </label>
                )}
                {uploadingField === 'logo' && (
                  <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-2">
                    <FiRefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                    <span className="text-[10px] font-bold text-teal-600">Uploading logo...</span>
                  </div>
                )}
              </div>

              {/* Launcher Icon Box (Customer & Provider only) */}
              {(activeTab === 'customer' || activeTab === 'provider') && (
                <div className="p-4 border border-gray-200 bg-gray-55 rounded-2xl flex flex-col items-center justify-between text-center min-h-[170px] relative overflow-hidden group animate-in zoom-in-95 duration-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">PWA Icon (Launcher)</span>
                  <span className="text-[9px] text-gray-400 mb-2">Phone home screen par app icon (512×512 PNG)</span>
                  {currentBranding.icon ? (
                    <div className="space-y-3 w-full px-2">
                      <div className="h-16 w-full flex items-center justify-center">
                        <img src={currentBranding.icon} alt="PWA Icon" className="w-16 h-16 object-cover rounded-2xl border border-gray-100 shadow-sm" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAsset(activeTab, 'icon')}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 mx-auto bg-red-50 hover:bg-red-100/50 px-3 py-1 rounded-lg transition-all"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" /> Remove Icon
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-4 hover:bg-teal-50/50 border-2 border-dashed border-gray-200 hover:border-teal-400 w-full h-full rounded-xl transition-all">
                      <FiUploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-teal-500 transition-colors" />
                      <span className="text-xs font-bold text-teal-600">Upload PWA Icon</span>
                      <span className="text-[9px] text-gray-400 mt-1">Required: Square PNG (512x512)</span>
                      <input
                        type="file"
                        onChange={(e) => handleAssetUpload(activeTab, 'icon', e)}
                        className="hidden"
                        accept="image/png"
                        disabled={uploadingField !== null}
                      />
                    </label>
                  )}
                  {uploadingField === 'icon' && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-2">
                      <FiRefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                      <span className="text-[10px] font-bold text-teal-600">Uploading icon...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Splash Image Box (Customer & Provider only) */}
              {(activeTab === 'customer' || activeTab === 'provider') && (
                <div className="p-4 border border-gray-200 bg-gray-55 rounded-2xl flex flex-col items-center justify-between text-center min-h-[170px] relative overflow-hidden group md:col-span-2 animate-in zoom-in-95 duration-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Splash Screen Overlay</span>
                  <span className="text-[9px] text-gray-400 mb-2">App open hote waqt 1-2 sec ke liye dikhe wali full-screen image</span>
                  {currentBranding.splashScreen ? (
                    <div className="space-y-3 w-full px-2">
                      <div className="h-16 w-full bg-white rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm">
                        <img src={currentBranding.splashScreen} alt="Splash Screen" className="h-full w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAsset(activeTab, 'splashScreen')}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 mx-auto bg-red-50 hover:bg-red-100/50 px-3 py-1 rounded-lg transition-all"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" /> Remove Splash Screen
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-4 hover:bg-teal-50/50 border-2 border-dashed border-gray-200 hover:border-teal-400 w-full h-full rounded-xl transition-all">
                      <FiUploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-teal-500 transition-colors" />
                      <span className="text-xs font-bold text-teal-600">Upload Splash Screen</span>
                      <span className="text-[9px] text-gray-400 mt-1">Recommended: 1080x1920 PNG</span>
                      <input
                        type="file"
                        onChange={(e) => handleAssetUpload(activeTab, 'splashScreen', e)}
                        className="hidden"
                        accept="image/*"
                        disabled={uploadingField !== null}
                      />
                    </label>
                  )}
                  {uploadingField === 'splashScreen' && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-2">
                      <FiRefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                      <span className="text-[10px] font-bold text-teal-600">Uploading splash...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Favicon Box (Admin Only) */}
              {activeTab === 'admin' && (
                <div className="p-4 border border-gray-200 bg-gray-55 rounded-2xl flex flex-col items-center justify-between text-center min-h-[170px] relative overflow-hidden group md:col-span-2 animate-in slide-in-from-top-4 duration-300">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Browser Favicon</span>
                  <span className="text-[9px] text-gray-400 mb-2">Browser tab mein left side wala chota icon (32×32)</span>
                  {currentBranding.favicon ? (
                    <div className="space-y-3 w-full px-2">
                      <div className="h-16 w-full flex items-center justify-center">
                        <img src={currentBranding.favicon} alt="Favicon" className="w-10 h-10 object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAsset(activeTab, 'favicon')}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 mx-auto bg-red-50 hover:bg-red-100/50 px-3 py-1 rounded-lg transition-all"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" /> Remove Favicon
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-4 hover:bg-teal-50/50 border-2 border-dashed border-gray-200 hover:border-teal-400 w-full h-full rounded-xl transition-all">
                      <FiUploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-teal-500 transition-colors" />
                      <span className="text-xs font-bold text-teal-600">Upload Tab Favicon</span>
                      <span className="text-[9px] text-gray-400 mt-1">Recommended: 32x32 ICO or PNG</span>
                      <input
                        type="file"
                        onChange={(e) => handleAssetUpload(activeTab, 'favicon', e)}
                        className="hidden"
                        accept="image/*"
                        disabled={uploadingField !== null}
                      />
                    </label>
                  )}
                  {uploadingField === 'favicon' && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-2">
                      <FiRefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                      <span className="text-[10px] font-bold text-teal-600">Uploading favicon...</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => handleReset(activeTab)}
              className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl font-bold text-xs transition-all shadow-sm bg-white"
              disabled={loading}
            >
              Reset Inputs
            </button>
            <button
              type="button"
              onClick={() => handleSaveDraft(activeTab)}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm hover:shadow"
              disabled={loading}
            >
              {loading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiSave className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handlePublishUpdate(activeTab)}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform active:scale-95 animate-pulse"
              disabled={loading}
            >
              {loading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiSend className="w-3.5 h-3.5" />}
              Publish Live Update
            </button>
          </div>

        </div>

        {/* Live Previews and Version Panel Column */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">

          {/* PWA Deployment and Stats Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl rounded-2xl p-6 space-y-5 border border-slate-800">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <FiActivity className="text-teal-400 w-5 h-5 animate-pulse" />
              <span className="font-bold text-xs uppercase tracking-widest text-slate-400">Live Release Status</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-800/60">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">PWA Version</span>
                <span className="text-xl font-black text-teal-400 block mt-1">v{currentBranding.appVersion || 1}</span>
              </div>
              <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-800/60">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Installed Devices</span>
                <span className="text-xl font-black text-white block mt-1 flex items-center gap-1.5">
                  <FiSmartphone className="text-slate-400 w-4 h-4" />
                  {currentBranding.installedUsersCount || 0}
                </span>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Last Broadcast Publication</span>
              <span className="text-xs font-semibold text-slate-200 block bg-slate-800/20 px-3 py-2 rounded-lg border border-slate-800/35">
                {currentBranding.lastPublished
                  ? new Date(currentBranding.lastPublished).toLocaleString('en-IN', { timeZone: currentBranding.timezone || 'UTC' })
                  : 'Never published to users'}
              </span>
            </div>
          </div>

          {/* Update Management Console (Broadcasting App Updates) */}
          <div className="bg-white border border-gray-100 shadow-md rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <FiSend className="text-indigo-600 w-4 h-4 animate-bounce" /> Update Management Console
            </h3>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Release Notes (Broadcast Body)</label>
                <textarea
                  rows={3}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-800 font-medium bg-gray-55 resize-none"
                  placeholder="E.g. Fixed launcher icon refresh issues. Tap to install immediate updates."
                />
              </div>

              {/* Force Refresh Toggle Checkbox */}
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60">
                <div className="flex items-start gap-2">
                  <FiAlertCircle className="text-indigo-600 w-4 h-4 mt-0.5" />
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">Force Hard Update</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Requires users to reload and clear local caches immediately</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceRefresh}
                    onChange={(e) => setForceRefresh(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Send App Update Notification Button */}
              <button
                onClick={() => handleSendStandaloneBroadcast(activeTab)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider transform hover:translate-y-[-1px] active:translate-y-[1px]"
                disabled={loading}
              >
                {loading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
                Send App Update Notification
              </button>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <FiEye className="text-teal-600 w-4 h-4" /> Responsive Live Previews
            </h3>

            {/* A. Browser Tab Mockup Preview */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                <FiMonitor className="w-3.5 h-3.5" /> Browser Title & Favicon Tab
              </span>
              <div className="bg-gray-100/70 border border-gray-200 rounded-xl p-2.5 pt-3 space-y-1">
                {/* Simulated browser navigation tab */}
                <div className="flex items-end gap-1 px-2 border-b border-gray-200/50 pb-2">
                  <div className="bg-white text-gray-700 px-3 py-1.5 rounded-t-lg border-t border-x border-gray-200 flex items-center gap-2 max-w-[190px] shadow-sm transform translate-y-[9px] relative z-10">
                    <div className="w-3.5 h-3.5 bg-gray-50 flex items-center justify-center overflow-hidden rounded-sm flex-shrink-0">
                      {currentBranding.favicon ? (
                        <img src={currentBranding.favicon} alt="Fav" className="w-full h-full object-contain" />
                      ) : (
                        currentBranding.logo ? (
                          <img src={currentBranding.logo} alt="Fav" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[7px] text-teal-600 font-black">SV</span>
                        )
                      )}
                    </div>
                    <span className="text-[9px] font-bold truncate max-w-[130px]">
                      {currentBranding.browserTitle || currentBranding.appName}
                    </span>
                    <span className="text-[8px] text-gray-400 ml-1">✕</span>
                  </div>
                  <div className="text-[18px] text-gray-400 px-2 py-1 select-none font-light leading-none">+</div>
                </div>
                <div className="bg-white h-7 rounded-b-lg border border-gray-200/60 shadow-inner flex items-center px-3 gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                  </div>
                  <div className="bg-gray-50 border border-gray-150 rounded-md flex-1 text-[8px] text-gray-400 py-1 px-2 font-mono truncate">
                    https://rajelectricalservices.vercel.app/{activeTab === 'customer' ? '' : activeTab}
                  </div>
                </div>
              </div>
            </div>

            {/* B. Install app preview (Mobile Prompt) */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                <FiSmartphone className="w-3.5 h-3.5" /> PWA Application Installer
              </span>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3.5">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-gray-150 overflow-hidden shadow-sm">
                    {currentBranding.icon ? (
                      <img src={currentBranding.icon} alt="App Icon" className="w-full h-full object-cover" />
                    ) : (
                      currentBranding.logo ? (
                        <img src={currentBranding.logo} alt="App Logo Icon" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="w-full h-full bg-teal-50 flex items-center justify-center font-black text-teal-600 text-sm">
                          SV
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-xs text-gray-900 truncate">{currentBranding.appName}</h4>
                    <p className="text-[10px] text-teal-600 font-bold truncate mt-0.5">{currentBranding.shortName || 'Raj'}</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 leading-relaxed font-medium line-clamp-2">
                  Dynamic installation prompt preview for {currentBranding.shortName || 'PWA'}.
                </p>

                <button
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 rounded-xl font-bold text-xs text-white transition-all text-center shadow-md shadow-teal-600/10"
                >
                  Install Application
                </button>
              </div>
            </div>

            {/* C. App Launcher Mockup */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                <FiLayers className="w-3.5 h-3.5" /> Smartphone Launcher Mockup
              </span>
              <div className="bg-slate-100 rounded-2xl p-4 py-6 flex flex-col items-center justify-center gap-1 border border-gray-200/50">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-gray-200/80 overflow-hidden shadow-md transform hover:scale-105 transition-all">
                  {currentBranding.icon ? (
                    <img src={currentBranding.icon} alt="App Icon" className="w-full h-full object-cover" />
                  ) : (
                    currentBranding.logo ? (
                      <img src={currentBranding.logo} alt="App Icon" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="w-full h-full bg-teal-50 flex items-center justify-center font-extrabold text-teal-600 text-base">
                        SV
                      </div>
                    )
                  )}
                </div>
                <span className="text-[9px] font-extrabold text-slate-800 truncate max-w-[80px] drop-shadow-sm mt-1">
                  {currentBranding.shortName || 'App Launcher'}
                </span>
              </div>
            </div>

            {/* General dynamic info box */}
            <div className="bg-teal-50/50 p-4 border border-teal-100 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-300">
              <FiInfo className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1">
                <h5 className="font-bold text-teal-800 text-xs">PWA Update System Notice</h5>
                <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                  When you **Publish Live Update**, the system immediately increments the live PWA index version and issues an FCM push update directly to all active app instances.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Manifest Preview Modal */}
      {showManifestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-150 w-full max-w-xl rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <FiLayout className="text-teal-600" /> Manifest JSON Structure ({activeTab})
              </h3>
              <button
                onClick={() => setShowManifestModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold p-1 hover:bg-gray-100 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh] font-mono text-[11px] text-gray-700 leading-relaxed bg-gray-50 border-b border-gray-100 shadow-inner">
              <pre className="whitespace-pre-wrap">{JSON.stringify(manifestData, null, 2)}</pre>
            </div>

            <div className="px-6 py-4 bg-gray-50/50 flex justify-between items-center text-[10px] text-gray-500">
              <div className="flex items-center gap-1.5 font-medium">
                <FiCheckCircle className="text-teal-600 w-4 h-4" />
                <span>Generated dynamically on requests</span>
              </div>
              <button
                onClick={() => setShowManifestModal(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Branding;
