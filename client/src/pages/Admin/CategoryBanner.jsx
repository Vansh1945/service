import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaPlus, FaSave, FaTimes, FaImage, FaTag, FaStore, FaBullhorn, FaCalendar, FaUpload, FaEye } from 'react-icons/fa';

const CategoryBanner = () => {
  const [systemSettings, setSystemSettings] = useState({
    companyName: '',
    tagline: '',
    logo: '',
    favicon: '',
    promoMessage: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '', description: '' });
  const [categoryIconFile, setCategoryIconFile] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [newBanner, setNewBanner] = useState({ 
    image: '', 
    title: '', 
    subtitle: '', 
    startDate: '', 
    endDate: '' 
  });
  const [activeTab, setActiveTab] = useState('settings');
  const [previewLogo, setPreviewLogo] = useState('');
  const [previewFavicon, setPreviewFavicon] = useState('');
  const [previewBanner, setPreviewBanner] = useState('');
  const [previewCategoryIcon, setPreviewCategoryIcon] = useState('');
  
  const { API, token, showToast } = useAuth();

  useEffect(() => {
    fetchData();
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

  useEffect(() => {
    if (bannerImageFile) {
      const objectUrl = URL.createObjectURL(bannerImageFile);
      setPreviewBanner(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [bannerImageFile]);

  useEffect(() => {
    if (categoryIconFile) {
      const objectUrl = URL.createObjectURL(categoryIconFile);
      setPreviewCategoryIcon(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [categoryIconFile]);

  const fetchData = async () => {
    try {
      const [settingsRes, categoriesRes, bannersRes] = await Promise.all([
        fetch(`${API}/system-setting/admin/system-setting`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/system-setting/admin/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/system-setting/admin/banners`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!settingsRes.ok || !categoriesRes.ok || !bannersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const settingsData = await settingsRes.json();
      const categoriesData = await categoriesRes.json();
      const bannersData = await bannersRes.json();

      setSystemSettings({
        companyName: settingsData.data?.companyName || '',
        tagline: settingsData.data?.tagline || '',
        logo: settingsData.data?.logo || '',
        favicon: settingsData.data?.favicon || '',
        promoMessage: settingsData.data?.promoMessage || ''
      });
      setCategories(categoriesData.data || []);
      setBanners(bannersData.data || []);

      // Set previews from fetched data
      if (settingsData.data?.logo) setPreviewLogo(settingsData.data.logo);
      if (settingsData.data?.favicon) setPreviewFavicon(settingsData.data.favicon);
    } catch (error) {
      setMessage('Error fetching data');
      console.error(error);
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
      formData.append('promoMessage', systemSettings.promoMessage);
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

      if (!response.ok) throw new Error('Failed to save system settings');

      setMessage('System settings saved successfully');
      showToast('System settings saved successfully');
      setLogoFile(null);
      setFaviconFile(null);
      fetchData();
    } catch (error) {
      setMessage('Error saving system settings');
      console.error(error);
    }
  };

  const addBanner = async () => {
    if (!newBanner.title) {
      setMessage('Banner title is required');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', newBanner.title);
      formData.append('subtitle', newBanner.subtitle);
      formData.append('startDate', newBanner.startDate);
      formData.append('endDate', newBanner.endDate);
      if (newBanner.image instanceof File) {
        formData.append('image', newBanner.image);
      }

      const response = await fetch(`${API}/system-setting/admin/banners`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to add banner');

      const data = await response.json();
      setBanners([...banners, data.data]);
      setNewBanner({ image: '', title: '', subtitle: '', startDate: '', endDate: '' });
      setMessage('Banner added successfully');
      showToast('Banner added successfully');
    } catch (error) {
      setMessage('Error adding banner');
      console.error(error);
    }
  };

  const updateBanner = async () => {
    try {
      const formData = new FormData();
      formData.append('title', newBanner.title);
      formData.append('subtitle', newBanner.subtitle);
      formData.append('startDate', newBanner.startDate);
      formData.append('endDate', newBanner.endDate);
      if (bannerImageFile) {
        formData.append('image', bannerImageFile);
      }

      const response = await fetch(`${API}/system-setting/admin/banners/${editingBanner._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update banner');

      setEditingBanner(null);
      setNewBanner({ image: '', title: '', subtitle: '', startDate: '', endDate: '' });
      setBannerImageFile(null);
      fetchData();
      setMessage('Banner updated successfully');
      showToast('Banner updated successfully');
    } catch (error) {
      setMessage('Error updating banner');
      console.error(error);
    }
  };

  const removeBanner = async (id) => {
    if (!window.confirm('Are you sure you want to remove this banner?')) return;

    try {
      const response = await fetch(`${API}/system-setting/admin/banners/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to remove banner');

      setBanners(banners.filter(banner => banner._id !== id));
      setMessage('Banner removed successfully');
      showToast('Banner removed successfully');
    } catch (error) {
      setMessage('Error removing banner');
      console.error(error);
    }
  };

  const handleCategoryChange = (e) => {
    setNewCategory({ ...newCategory, [e.target.name]: e.target.value });
  };

  const createCategory = async () => {
    if (!newCategory.name) {
      setMessage('Category name is required');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', newCategory.name);
      formData.append('description', newCategory.description);
      if (categoryIconFile) {
        formData.append('icon', categoryIconFile);
      }

      const response = await fetch(`${API}/system-setting/admin/categories`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to create category');

      setNewCategory({ name: '', icon: '', description: '' });
      setCategoryIconFile(null);
      fetchData();
      setMessage('Category created successfully');
      showToast('Category created successfully');
    } catch (error) {
      setMessage('Error creating category');
      console.error(error);
    }
  };

  const updateCategory = async () => {
    try {
      const formData = new FormData();
      formData.append('name', newCategory.name);
      formData.append('description', newCategory.description);
      if (categoryIconFile) {
        formData.append('icon', categoryIconFile);
      }

      const response = await fetch(`${API}/system-setting/admin/categories/${editingCategory._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update category');

      setEditingCategory(null);
      setNewCategory({ name: '', icon: '', description: '' });
      setCategoryIconFile(null);
      fetchData();
      setMessage('Category updated successfully');
      showToast('Category updated successfully');
    } catch (error) {
      setMessage('Error updating category');
      console.error(error);
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`${API}/system-setting/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete category');

      fetchData();
      setMessage('Category deleted successfully');
      showToast('Category deleted successfully');
    } catch (error) {
      setMessage('Error deleting category');
      console.error(error);
    }
  };

  const toggleCategoryStatus = async (id) => {
    try {
      const response = await fetch(`${API}/system-setting/admin/categories/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to toggle category status');

      fetchData();
      setMessage('Category status updated successfully');
      showToast('Category status updated successfully');
    } catch (error) {
      setMessage('Error updating category status');
      console.error(error);
    }
  };

  const editCategory = (category) => {
    setEditingCategory(category);
    setNewCategory({ name: category.name, description: category.description });
    setPreviewCategoryIcon(category.icon || '');
  };

  const editBanner = (banner) => {
    setEditingBanner(banner);
    setNewBanner({ 
      title: banner.title, 
      subtitle: banner.subtitle, 
      startDate: banner.startDate ? banner.startDate.split('T')[0] : '', 
      endDate: banner.endDate ? banner.endDate.split('T')[0] : '' 
    });
    setPreviewBanner(banner.image || '');
  };

  const resetBannerForm = () => {
    setEditingBanner(null);
    setNewBanner({ image: '', title: '', subtitle: '', startDate: '', endDate: '' });
    setBannerImageFile(null);
    setPreviewBanner('');
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setNewCategory({ name: '', icon: '', description: '' });
    setCategoryIconFile(null);
    setPreviewCategoryIcon('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-secondary font-inter">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-roboto p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary font-poppins">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2 font-inter">Manage system settings, banners, and categories</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl font-inter border ${message.includes('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            {message}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 border-b border-gray-200">
            {['settings', 'banners', 'categories'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 rounded-t-lg font-medium font-inter transition-all ${activeTab === tab
                    ? 'bg-primary text-white border-b-2 border-accent'
                    : 'text-secondary hover:text-primary hover:bg-gray-100'
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* System Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FaStore className="text-2xl text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-secondary font-poppins">System Settings</h2>
                <p className="text-gray-600 font-inter">Configure your company details and branding</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Text Inputs */}
              <div className="space-y-6">
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

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                    Promotional Message
                  </label>
                  <textarea
                    name="promoMessage"
                    value={systemSettings.promoMessage}
                    onChange={handleSystemSettingsChange}
                    rows="4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
                    placeholder="Enter promotional message"
                  />
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
                        <div className="relative mx-auto w-32 h-32">
                          <img
                            src={previewLogo}
                            alt="Logo preview"
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                        <p className="text-sm text-gray-600">Logo preview</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <FaImage className="text-4xl text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Upload company logo</p>
                        <p className="text-sm text-gray-500">PNG, JPG, SVG up to 2MB</p>
                      </div>
                    )}
                    <label className="mt-4 inline-block bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02]">
                      <FaUpload className="inline mr-2" />
                      {previewLogo ? 'Change Logo' : 'Upload Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files[0])}
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
                        <div className="relative mx-auto w-16 h-16">
                          <img
                            src={previewFavicon}
                            alt="Favicon preview"
                            className="w-full h-full object-contain rounded"
                          />
                        </div>
                        <p className="text-sm text-gray-600">Favicon preview</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <FaImage className="text-3xl text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Upload favicon</p>
                        <p className="text-sm text-gray-500">ICO, PNG up to 256×256px</p>
                      </div>
                    )}
                    <label className="mt-4 inline-block bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02]">
                      <FaUpload className="inline mr-2" />
                      {previewFavicon ? 'Change Favicon' : 'Upload Favicon'}
                      <input
                        type="file"
                        accept="image/*,.ico"
                        onChange={(e) => setFaviconFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={saveSystemSettings}
              className="mt-8 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-medium font-inter flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FaSave /> Save System Settings
            </button>
          </div>
        )}

        {/* Banner Management Tab */}
        {activeTab === 'banners' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-accent/10 rounded-xl">
                <FaBullhorn className="text-2xl text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-secondary font-poppins">Banner Management</h2>
                <p className="text-gray-600 font-inter">Add and manage promotional banners</p>
              </div>
            </div>

            {/* Banner Form */}
            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h3 className="text-xl font-semibold text-secondary mb-4 font-inter">
                {editingBanner ? 'Edit Banner' : 'Add New Banner'}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                    Banner Image *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-accent transition-colors">
                    {previewBanner ? (
                      <div className="space-y-4">
                        <div className="relative mx-auto max-w-full h-48">
                          <img
                            src={previewBanner}
                            alt="Banner preview"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        <p className="text-sm text-gray-600">Banner preview</p>
                      </div>
                    ) : (
                      <div className="py-12">
                        <FaImage className="text-4xl text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Upload banner image</p>
                        <p className="text-sm text-gray-500">PNG, JPG up to 5MB</p>
                      </div>
                    )}
                    <label className="mt-4 inline-block bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02]">
                      <FaUpload className="inline mr-2" />
                      {previewBanner ? 'Change Image' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => editingBanner 
                          ? setBannerImageFile(e.target.files[0])
                          : setNewBanner({ ...newBanner, image: e.target.files[0] })
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Right Column - Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                      Title *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter banner title"
                      value={newBanner.title}
                      onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      placeholder="Enter banner subtitle"
                      value={newBanner.subtitle}
                      onChange={(e) => setNewBanner({ ...newBanner, subtitle: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                        <FaCalendar className="inline mr-2" />
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={newBanner.startDate}
                        onChange={(e) => setNewBanner({ ...newBanner, startDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                        <FaCalendar className="inline mr-2" />
                        End Date
                      </label>
                      <input
                        type="date"
                        value={newBanner.endDate}
                        onChange={(e) => setNewBanner({ ...newBanner, endDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={editingBanner ? updateBanner : addBanner}
                  className="bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:scale-[1.02]"
                >
                  {editingBanner ? <><FaSave /> Update Banner</> : <><FaPlus /> Add Banner</>}
                </button>
                {editingBanner && (
                  <button
                    onClick={resetBannerForm}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-all"
                  >
                    <FaTimes /> Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Existing Banners */}
            <div>
              <h3 className="text-xl font-semibold text-secondary mb-4 font-inter">Existing Banners</h3>
              {banners.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl">
                  <FaBullhorn className="text-4xl mx-auto mb-3 text-gray-400" />
                  <p className="text-lg mb-2">No banners created yet</p>
                  <p className="text-sm">Add your first banner to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {banners.map((banner) => (
                    <div key={banner._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                      <div className="relative h-48 bg-gray-100">
                        <img
                          src={banner.image}
                          alt={banner.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/400x200?text=Banner+Image';
                          }}
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <button
                            onClick={() => editBanner(banner)}
                            className="bg-primary hover:bg-primary/90 text-white p-2 rounded-full transition-colors"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => removeBanner(banner._id)}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-secondary mb-1 truncate">{banner.title}</h4>
                        {banner.subtitle && (
                          <p className="text-gray-600 text-sm mb-3 truncate">{banner.subtitle}</p>
                        )}
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Start: {banner.startDate ? new Date(banner.startDate).toLocaleDateString() : 'N/A'}</span>
                          <span>End: {banner.endDate ? new Date(banner.endDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category Management Tab */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FaTag className="text-2xl text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-secondary font-poppins">Category Management</h2>
                <p className="text-gray-600 font-inter">Manage product categories</p>
              </div>
            </div>

            {/* Category Form */}
            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h3 className="text-xl font-semibold text-secondary mb-4 font-inter">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newCategory.name}
                      onChange={handleCategoryChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                      placeholder="Enter category name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={newCategory.description}
                      onChange={handleCategoryChange}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                      placeholder="Enter category description"
                    />
                  </div>
                </div>

                {/* Right Column - Icon Upload */}
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2 font-inter">
                    Category Icon
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary transition-colors">
                    {previewCategoryIcon ? (
                      <div className="space-y-4">
                        <div className="relative mx-auto w-24 h-24">
                          <img
                            src={previewCategoryIcon}
                            alt="Icon preview"
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                        <p className="text-sm text-gray-600">Icon preview</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <FaImage className="text-4xl text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Upload category icon</p>
                        <p className="text-sm text-gray-500">PNG, SVG up to 1MB</p>
                      </div>
                    )}
                    <label className="mt-4 inline-block bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02]">
                      <FaUpload className="inline mr-2" />
                      {previewCategoryIcon ? 'Change Icon' : 'Upload Icon'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCategoryIconFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={editingCategory ? updateCategory : createCategory}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:scale-[1.02]"
                >
                  {editingCategory ? <><FaSave /> Update Category</> : <><FaPlus /> Create Category</>}
                </button>
                {editingCategory && (
                  <button
                    onClick={resetCategoryForm}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-all"
                  >
                    <FaTimes /> Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Categories Table */}
            <div>
              <h3 className="text-xl font-semibold text-secondary mb-4 font-inter">Category List</h3>
              {categories.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl">
                  <FaTag className="text-4xl mx-auto mb-3 text-gray-400" />
                  <p className="text-lg mb-2">No categories created yet</p>
                  <p className="text-sm">Add your first category to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider font-inter">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider font-inter">
                          Icon
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider font-inter">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider font-inter">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider font-inter">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((category) => (
                        <tr key={category._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-secondary">{category.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {category.icon ? (
                                <img
                                  src={category.icon}
                                  alt={category.name}
                                  className="w-8 h-8 object-contain mr-3"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                  }}
                                />
                              ) : null}
                              <span className="text-gray-400" style={{ display: category.icon ? 'none' : 'block' }}>
                                No icon
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-600 max-w-xs truncate">{category.description || 'No description'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${category.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}>
                              {category.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => editCategory(category)}
                                className="text-primary hover:text-primary/80 p-2 hover:bg-primary/10 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => toggleCategoryStatus(category._id)}
                                className={`p-2 rounded-lg transition-colors ${category.isActive
                                    ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50'
                                    : 'text-green-500 hover:text-green-600 hover:bg-green-50'
                                  }`}
                                title={category.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {category.isActive ? <FaToggleOff /> : <FaToggleOn />}
                              </button>
                              <button
                                onClick={() => deleteCategory(category._id)}
                                className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryBanner;