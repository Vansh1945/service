import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { FaSave, FaUpload, FaStore, FaPhone, FaEnvelope, FaMapMarkerAlt, FaFacebook, FaInstagram, FaTwitter, FaLinkedin, FaYoutube } from 'react-icons/fa';
import { MapPin, Phone, Mail, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';

const SystemSetting = () => {
  const [systemSettings, setSystemSettings] = useState({
    companyName: '',
    tagline: '',
    logo: '',
    favicon: '',
    address: '',
    phone: '',
    email: '',
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: ''
    }
  });
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [previewLogo, setPreviewLogo] = useState('');
  const [previewFavicon, setPreviewFavicon] = useState('');
  
  const { API, token, showToast } = useAuth();

  useEffect(() => {
    fetchSystemSettings();
  }, []);

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
      const response = await fetch(`${API}/system-setting/admin/system-setting`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch system settings');
      }

      const settingsData = await response.json();
      
      if (settingsData.success && settingsData.data) {
        setSystemSettings({
          companyName: settingsData.data.companyName || '',
          tagline: settingsData.data.tagline || '',
          logo: settingsData.data.logo || '',
          favicon: settingsData.data.favicon || '',
          address: settingsData.data.address || '',
          phone: settingsData.data.phone || '',
          email: settingsData.data.email || '',
          socialLinks: settingsData.data.socialLinks || {
            facebook: '',
            instagram: '',
            twitter: '',
            linkedin: '',
            youtube: ''
          }
        });
        
        // Set previews from fetched data
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



  const saveSystemSettings = async () => {
    try {
      const formData = new FormData();
      formData.append('companyName', systemSettings.companyName);
      formData.append('tagline', systemSettings.tagline);
      formData.append('address', systemSettings.address);
      formData.append('phone', systemSettings.phone);
      formData.append('email', systemSettings.email);
      formData.append('socialLinks', JSON.stringify(systemSettings.socialLinks));

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (faviconFile) {
        formData.append('favicon', faviconFile);
      }

      const response = await fetch(`${API}/system-setting/admin/system-setting`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save system settings');
      }

      const data = await response.json();

      if (data.success) {
        setMessage('System settings saved successfully');
        showToast('System settings saved successfully');
        setLogoFile(null);
        setFaviconFile(null);
        fetchSystemSettings(); // Refresh data
      } else {
        throw new Error(data.message || 'Failed to save system settings');
      }
    } catch (error) {
      setMessage('Error saving system settings: ' + error.message);
      console.error('Save error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-secondary font-inter">Loading system settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-roboto p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-poppins">
            System Settings
          </h1>
          <p className="text-gray-600 mt-2 font-inter">Configure your company details and branding</p>
        </div>



        {/* Main Settings Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FaStore className="text-2xl text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-secondary font-poppins">Company Information</h2>
              <p className="text-gray-600 font-inter">Update your company details and branding</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Text Inputs */}
            <div className="space-y-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={systemSettings.companyName}
                  onChange={handleSystemSettingsChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                  placeholder="Enter company name"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Tagline
                </label>
                <input
                  type="text"
                  name="tagline"
                  value={systemSettings.tagline}
                  onChange={handleSystemSettingsChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                  placeholder="Enter tagline"
                />
              </div>
              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    name="address"
                    value={systemSettings.address}
                    onChange={handleSystemSettingsChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                    placeholder="Enter company address"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    name="phone"
                    value={systemSettings.phone}
                    onChange={handleSystemSettingsChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    name="email"
                    value={systemSettings.email}
                    onChange={handleSystemSettingsChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              {/* Social Links Section */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-4 font-inter">
                  Social Media Links
                </label>
                <div className="space-y-3">
                  {/* Facebook */}
                  <div className="flex items-center gap-3">
                    <Facebook className="text-blue-600 w-5 h-5" />
                    <input
                      type="url"
                      value={systemSettings.socialLinks.facebook || ''}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        socialLinks: { ...systemSettings.socialLinks, facebook: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                      placeholder="https://facebook.com/yourcompany"
                    />
                  </div>

                  {/* Instagram */}
                  <div className="flex items-center gap-3">
                    <Instagram className="text-pink-600 w-5 h-5" />
                    <input
                      type="url"
                      value={systemSettings.socialLinks.instagram || ''}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        socialLinks: { ...systemSettings.socialLinks, instagram: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                      placeholder="https://instagram.com/yourcompany"
                    />
                  </div>

                  {/* Twitter */}
                  <div className="flex items-center gap-3">
                    <Twitter className="text-blue-400 w-5 h-5" />
                    <input
                      type="url"
                      value={systemSettings.socialLinks.twitter || ''}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        socialLinks: { ...systemSettings.socialLinks, twitter: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                      placeholder="https://twitter.com/yourcompany"
                    />
                  </div>

                  {/* LinkedIn */}
                  <div className="flex items-center gap-3">
                    <Linkedin className="text-blue-700 w-5 h-5" />
                    <input
                      type="url"
                      value={systemSettings.socialLinks.linkedin || ''}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        socialLinks: { ...systemSettings.socialLinks, linkedin: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                      placeholder="https://linkedin.com/company/yourcompany"
                    />
                  </div>

                  {/* YouTube */}
                  <div className="flex items-center gap-3">
                    <Youtube className="text-red-600 w-5 h-5" />
                    <input
                      type="url"
                      value={systemSettings.socialLinks.youtube || ''}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        socialLinks: { ...systemSettings.socialLinks, youtube: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                      placeholder="https://youtube.com/c/yourcompany"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - File Uploads */}
            <div className="space-y-6">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Company Logo
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary transition-colors">
                  {previewLogo ? (
                    <div className="space-y-4">
                      <div className="relative mx-auto w-40 h-40">
                        <img
                          src={previewLogo}
                          alt="Logo preview"
                          className="w-full h-full object-contain rounded-lg"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/160x160?text=Logo+Preview';
                          }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">Current logo preview</p>
                    </div>
                  ) : (
                    <div className="py-8">
                      <FaUpload className="text-4xl text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">Upload company logo</p>
                      <p className="text-sm text-gray-500">PNG, JPG, SVG up to 2MB</p>
                    </div>
                  )}
                  <label className="mt-4 inline-block bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02] font-inter">
                    <FaUpload className="inline mr-2" />
                    {previewLogo ? 'Change Logo' : 'Upload Logo'}
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
              </div>

              {/* Favicon Upload */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                  Favicon
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary transition-colors">
                  {previewFavicon ? (
                    <div className="space-y-4">
                      <div className="relative mx-auto w-20 h-20">
                        <img
                          src={previewFavicon}
                          alt="Favicon preview"
                          className="w-full h-full object-contain rounded"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/80x80?text=Favicon';
                          }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">Current favicon preview</p>
                    </div>
                  ) : (
                    <div className="py-8">
                      <FaUpload className="text-3xl text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">Upload favicon</p>
                      <p className="text-sm text-gray-500">ICO, PNG up to 256×256px</p>
                    </div>
                  )}
                  <label className="mt-4 inline-block bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02] font-inter">
                    <FaUpload className="inline mr-2" />
                    {previewFavicon ? 'Change Favicon' : 'Upload Favicon'}
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

              {/* Current Information Preview */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-secondary mb-4 font-inter">Current Settings Preview</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">Company:</span>
                    <p className="font-medium text-secondary">{systemSettings.companyName || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Tagline:</span>
                    <p className="font-medium text-secondary">{systemSettings.tagline || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Contact:</span>
                    <p className="font-medium text-secondary">{systemSettings.phone || 'Not set'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={saveSystemSettings}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-medium font-inter flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
            >
              <FaSave className="text-lg" /> Save All Settings
            </button>
            <p className="text-sm text-gray-500 mt-2 font-inter">Click save to update all system settings</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSetting;