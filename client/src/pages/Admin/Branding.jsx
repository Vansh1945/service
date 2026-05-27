import React, { useState, useEffect } from 'react';
import { 
  FiSmartphone, FiMonitor, FiUploadCloud, FiImage, FiSettings, 
  FiRefreshCw, FiSave, FiEye, FiCheckCircle, FiInfo, FiTrash2,
  FiLayout
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import * as SystemService from '../../services/SystemService';

const Branding = () => {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'provider' | 'admin'
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestData, setManifestData] = useState(null);

  // States for role branding fields
  const [formData, setFormData] = useState({
    customer: {
      appName: 'SafeVolt Customer',
      shortName: 'SafeVolt',
      logo: '',
      icon: '',
      splashScreen: '',
      themeColor: '#0D9488', // Default to tailwind config primary teal
      backgroundColor: '#FFFFFF',
      description: 'Book certified electricians near you for repairs, wiring, and installations.'
    },
    provider: {
      appName: 'SafeVolt Provider',
      shortName: 'Provider',
      logo: '',
      icon: '',
      splashScreen: '',
      themeColor: '#0D9488',
      backgroundColor: '#FFFFFF',
      description: 'Accept requests and provide certified electrical services on SafeVolt.'
    },
    admin: {
      appName: 'SafeVolt Admin',
      shortName: 'Admin',
      logo: '',
      icon: '',
      favicon: '',
      themeColor: '#0D9488',
      backgroundColor: '#FFFFFF',
      dashboardTitle: 'SafeVolt Control Panel'
    }
  });

  // Fetch initial branding settings for all roles on load
  useEffect(() => {
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

    if (file.size > 5 * 1024 * 1024) {
      toast.warning('File size must be under 5MB');
      return;
    }

    setUploadingField(field);
    const fd = new FormData();
    fd.append(field, file);

    try {
      const response = await SystemService.uploadBrandingAsset(role, fd);
      if (response.data?.success) {
        handleInputChange(role, field, response.data.url);
        toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} uploaded successfully!`);
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

  // Save branding changes to the database
  const handleSave = async (role) => {
    setLoading(true);
    try {
      const response = await SystemService.updateBrandingSettings(role, formData[role]);
      if (response.data?.success) {
        toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} branding saved successfully!`);
        
        // Notify dynamic client hook in App.jsx
        window.dispatchEvent(
          new CustomEvent('brandingUpdated', { 
            detail: { role, data: response.data.data } 
          })
        );
        
        localStorage.setItem(`branding_${role}`, JSON.stringify(response.data.data));

        toast.info(
          'Installed PWA users may need browser refresh or reinstall to see branding updates.',
          { autoClose: 8000 }
        );
      }
    } catch (error) {
      console.error('Failed to update branding settings:', error);
      toast.error('Failed to save branding changes.');
    } finally {
      setLoading(false);
    }
  };

  // Reset fields to system defaults
  const handleReset = (role) => {
    const defaults = {
      customer: {
        appName: 'SafeVolt Customer',
        shortName: 'SafeVolt',
        logo: '',
        icon: '',
        splashScreen: '',
        themeColor: '#0D9488',
        backgroundColor: '#FFFFFF',
        description: 'Book certified electricians near you for repairs, wiring, and installations.'
      },
      provider: {
        appName: 'SafeVolt Provider',
        shortName: 'Provider',
        logo: '',
        icon: '',
        splashScreen: '',
        themeColor: '#0D9488',
        backgroundColor: '#FFFFFF',
        description: 'Accept requests and provide certified electrical services on SafeVolt.'
      },
      admin: {
        appName: 'SafeVolt Admin',
        shortName: 'Admin',
        logo: '',
        icon: '',
        favicon: '',
        themeColor: '#0D9488',
        backgroundColor: '#FFFFFF',
        dashboardTitle: 'SafeVolt Control Panel'
      }
    };

    setFormData(prev => ({
      ...prev,
      [role]: defaults[role]
    }));
    toast.info('Fields reset to defaults. Click "Save Environment Settings" to apply.');
  };

  // Open raw manifest preview modal
  const handlePreviewManifest = (role) => {
    const roleData = formData[role];
    const manifest = {
      name: roleData.appName,
      short_name: roleData.shortName,
      start_url: role === 'admin' ? '/admin/dashboard' : role === 'provider' ? '/provider/dashboard' : '/',
      display: 'standalone',
      background_color: roleData.backgroundColor,
      theme_color: roleData.themeColor,
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
      description: roleData.description || `${roleData.shortName} App`,
      id: `com.safevolt.${role}`
    };

    setManifestData(manifest);
    setShowManifestModal(true);
  };

  const currentBranding = formData[activeTab];

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-inter text-secondary">
      {/* Header section - Clean design aligned with tailwind.config.js */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold font-poppins text-primary flex items-center gap-2">
            <FiLayout /> Branding Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure dynamic app identity, primary themes, and PWA assets for each user environment.
          </p>
        </div>
        <button 
          onClick={() => handlePreviewManifest(activeTab)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:border-primary text-secondary hover:text-primary font-medium text-xs rounded-lg transition-all bg-white"
        >
          <FiEye /> View PWA Manifest
        </button>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-lg max-w-md">
        {['customer', 'provider', 'admin'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-center text-xs font-semibold capitalize rounded-md transition-all ${
              activeTab === tab 
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-secondary'
            }`}
          >
            {tab} app
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Form Column */}
        <div className="lg:col-span-7 bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-6">
          
          {/* Identity Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b border-gray-150 pb-2 flex items-center gap-2">
              <FiSettings /> Identity
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">App Name</label>
                <input
                  type="text"
                  value={currentBranding.appName}
                  onChange={(e) => handleInputChange(activeTab, 'appName', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary transition-colors text-secondary font-medium"
                  placeholder="App title name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Short Name</label>
                <input
                  type="text"
                  value={currentBranding.shortName}
                  onChange={(e) => handleInputChange(activeTab, 'shortName', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary transition-colors text-secondary font-medium"
                  placeholder="Short launcher name"
                />
              </div>
            </div>

            {activeTab === 'admin' ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Dashboard Navbar Title</label>
                <input
                  type="text"
                  value={currentBranding.dashboardTitle}
                  onChange={(e) => handleInputChange(activeTab, 'dashboardTitle', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary transition-colors text-secondary font-medium"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Meta Description</label>
                <textarea
                  rows={2}
                  value={currentBranding.description}
                  onChange={(e) => handleInputChange(activeTab, 'description', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary transition-colors text-secondary font-medium resize-none"
                  placeholder="Enter app description for SEO and manifest..."
                />
              </div>
            )}
          </div>

          {/* Visual Assets Upload Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b border-gray-150 pb-2 flex items-center gap-2">
              <FiImage /> Visual Assets
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logo Box */}
              <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl flex flex-col items-center justify-between text-center min-h-36 relative overflow-hidden">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Logo URL</span>
                {currentBranding.logo ? (
                  <div className="space-y-2">
                    <img src={currentBranding.logo} alt="Logo" className="h-10 w-auto object-contain mx-auto" />
                    <button 
                      onClick={() => removeAsset(activeTab, 'logo')}
                      className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 mx-auto"
                    >
                      <FiTrash2 /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center p-2 hover:bg-gray-100 w-full h-full rounded-lg transition-all">
                    <FiUploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs font-bold text-primary">Upload Logo</span>
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
                  <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                    <FiRefreshCw className="w-5 h-5 text-primary animate-spin" />
                  </div>
                )}
              </div>

              {/* Launcher Icon Box */}
              <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl flex flex-col items-center justify-between text-center min-h-36 relative overflow-hidden">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Launcher Icon</span>
                {currentBranding.icon ? (
                  <div className="space-y-2">
                    <img src={currentBranding.icon} alt="Icon" className="w-10 h-10 object-cover mx-auto rounded border border-gray-200" />
                    <button 
                      onClick={() => removeAsset(activeTab, 'icon')}
                      className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 mx-auto"
                    >
                      <FiTrash2 /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center p-2 hover:bg-gray-100 w-full h-full rounded-lg transition-all">
                    <FiUploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs font-bold text-primary">Upload Icon</span>
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
                  <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                    <FiRefreshCw className="w-5 h-5 text-primary animate-spin" />
                  </div>
                )}
              </div>

              {/* Splash Image Box (Customer / Provider) */}
              {activeTab !== 'admin' && (
                <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl flex flex-col items-center justify-between text-center min-h-36 relative overflow-hidden md:col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Splash Screen / Banner</span>
                  {currentBranding.splashScreen ? (
                    <div className="space-y-2 w-full">
                      <img src={currentBranding.splashScreen} alt="Splash Screen" className="h-16 w-full object-cover mx-auto rounded border border-gray-200" />
                      <button 
                        onClick={() => removeAsset(activeTab, 'splashScreen')}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 mx-auto"
                      >
                        <FiTrash2 /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-2 hover:bg-gray-100 w-full h-full rounded-lg transition-all">
                      <FiUploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs font-bold text-primary">Upload Splash Image</span>
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
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                      <FiRefreshCw className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                </div>
              )}

              {/* Favicon Box (Admin Only) */}
              {activeTab === 'admin' && (
                <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl flex flex-col items-center justify-between text-center min-h-36 relative overflow-hidden md:col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Browser Favicon</span>
                  {currentBranding.favicon ? (
                    <div className="space-y-2">
                      <img src={currentBranding.favicon} alt="Favicon" className="w-6 h-6 object-contain mx-auto" />
                      <button 
                        onClick={() => removeAsset(activeTab, 'favicon')}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 mx-auto"
                      >
                        <FiTrash2 /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-2 hover:bg-gray-100 w-full h-full rounded-lg transition-all">
                      <FiUploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs font-bold text-primary">Upload Favicon</span>
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
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                      <FiRefreshCw className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Color Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b border-gray-150 pb-2 flex items-center gap-2">
              <FiSmartphone /> Color Theme
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-xl bg-white">
                <input
                  type="color"
                  value={currentBranding.themeColor}
                  onChange={(e) => handleInputChange(activeTab, 'themeColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                />
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Primary Theme Color</span>
                  <span className="font-bold text-xs text-secondary">{currentBranding.themeColor}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-xl bg-white">
                <input
                  type="color"
                  value={currentBranding.backgroundColor}
                  onChange={(e) => handleInputChange(activeTab, 'backgroundColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                />
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Background Color</span>
                  <span className="font-bold text-xs text-secondary">{currentBranding.backgroundColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-150">
            <button 
              type="button" 
              onClick={() => handleReset(activeTab)}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-secondary rounded-lg font-bold text-xs transition-all"
              disabled={loading}
            >
              Reset to Defaults
            </button>
            <button 
              type="button" 
              onClick={() => handleSave(activeTab)}
              className="px-4 py-2 bg-primary hover:bg-teal-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              disabled={loading}
            >
              {loading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiSave className="w-3.5 h-3.5" />}
              Save Environment Settings
            </button>
          </div>

        </div>

        {/* Minimal Live Previews Column */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b border-gray-150 pb-2 flex items-center gap-2">
              <FiEye /> Live Preview
            </h3>

            {/* A. Customer App Preview */}
            {activeTab === 'customer' && (
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Customer App Install UI</span>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-gray-200 overflow-hidden shadow-sm">
                      {currentBranding.icon ? (
                        <img src={currentBranding.icon} alt="App Icon" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center font-bold text-xs" style={{ color: currentBranding.themeColor }}>
                          SV
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate text-secondary">{currentBranding.appName}</h4>
                      <p className="text-[10px] text-gray-400 truncate">{currentBranding.shortName || 'SafeVolt'}</p>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-gray-500 leading-normal line-clamp-2">
                    {currentBranding.description || 'App Description will load here.'}
                  </p>
                  
                  <button 
                    className="w-full py-2 rounded-lg font-bold text-xs text-white transition-all text-center"
                    style={{ backgroundColor: currentBranding.themeColor }}
                  >
                    Install PWA App
                  </button>
                </div>
              </div>
            )}

            {/* B. Provider App Preview */}
            {activeTab === 'provider' && (
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Provider Dashboard UI</span>
                <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-200">
                        {currentBranding.logo ? (
                          <img src={currentBranding.logo} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[7px] font-bold" style={{ color: currentBranding.themeColor }}>P</span>
                        )}
                      </div>
                      <span className="font-bold text-[10px] truncate max-w-28 text-secondary">{currentBranding.appName}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBranding.themeColor }} />
                  </div>

                  {/* Body Content */}
                  <div className="p-3 space-y-2">
                    <div className="p-2 bg-white rounded-lg space-y-1 border border-gray-200">
                      <span className="text-[8px] text-gray-400 font-bold uppercase">Weekly Earnings</span>
                      <div className="text-sm font-bold" style={{ color: currentBranding.themeColor }}>₹ 4,850.00</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="py-1.5 rounded font-semibold text-[8px] text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">
                        Decline
                      </button>
                      <button 
                        className="py-1.5 rounded font-bold text-[8px] text-white"
                        style={{ backgroundColor: currentBranding.themeColor }}
                      >
                        Accept Booking
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* C. Admin Dashboard Preview */}
            {activeTab === 'admin' && (
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Admin Header UI</span>
                <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                  {/* Header Row */}
                  <div className="bg-white px-3 py-2.5 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-1.5">
                      {currentBranding.logo && (
                        <img src={currentBranding.logo} alt="Logo" className="h-5 w-auto object-contain" />
                      )}
                      <span className="font-bold text-[10px] bg-gradient-to-r bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, ${currentBranding.themeColor}, #0D9488)` }}>
                        {currentBranding.appName}
                      </span>
                    </div>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm" style={{ backgroundColor: currentBranding.themeColor }}>
                      A
                    </div>
                  </div>

                  {/* Body area */}
                  <div className="p-3 flex gap-2">
                    <div className="w-1/3 bg-white rounded-lg p-2 flex flex-col gap-1 text-[7px] text-gray-400 font-bold border border-gray-200">
                      <div className="px-1 py-0.5 rounded bg-gray-50 flex items-center gap-1" style={{ color: currentBranding.themeColor }}>
                        <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: currentBranding.themeColor }} /> Dashboard
                      </div>
                      <div className="px-1 py-0.5 hover:text-secondary">System Settings</div>
                    </div>
                    <div className="flex-1 bg-white rounded-lg p-2 border border-gray-200">
                      <span className="text-[6px] text-gray-400 font-bold uppercase block">Control Panel Title</span>
                      <h5 className="font-bold text-[9px] text-secondary mt-0.5">{currentBranding.dashboardTitle}</h5>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General dynamic info box */}
            <div className="bg-teal-50/50 p-4 border border-teal-100 rounded-xl flex items-start gap-2 text-xs">
              <FiInfo className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold text-primary text-xs">PWA Cache Notice</h5>
                <p className="text-[10px] text-gray-500 leading-normal">
                  Branding configurations are saved directly to the database. Client apps update dynamically, but service-worker browser settings might require a refresh.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manifest Preview Modal */}
      {showManifestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-xl rounded-xl overflow-hidden flex flex-col shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-sm text-secondary flex items-center gap-2">
                <FiLayout className="text-primary" /> Manifest JSON Preview ({activeTab})
              </h3>
              <button 
                onClick={() => setShowManifestModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[50vh] font-mono text-[11px] text-secondary leading-relaxed bg-gray-50 border-b border-gray-150">
              <pre>{JSON.stringify(manifestData, null, 2)}</pre>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center text-[10px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <FiCheckCircle className="text-primary w-3.5 h-3.5" />
                <span>Generated dynamically from MongoDB model</span>
              </div>
              <button 
                onClick={() => setShowManifestModal(false)}
                className="px-3 py-1.5 bg-primary hover:bg-teal-700 text-white rounded font-bold text-xs transition-colors"
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
