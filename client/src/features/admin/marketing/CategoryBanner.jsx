import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/auth';

import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaPlus, FaSave, FaTimes, FaImage, FaTag, FaBullhorn, FaCalendar, FaUpload, FaLink } from 'react-icons/fa';
import * as SystemService from '../../../services/SystemService';
import useCategory from '../../../hooks/useCategory';
import { formatDate } from '../../../utils/format';
import { useConfirm } from '../../../context/ConfirmContext';
import Button from '../../../components/ui/Button';
import Loader from '../../../components/ui/Loader';
import EmptyState from '../../../components/ui/EmptyState';
import Badge from '../../../components/ui/Badge';

const CategoryBanner = () => {
  const confirm = useConfirm();
  const { categories, loading: categoriesLoading, refresh: refreshCategories } = useCategory(true);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '', description: '' });
  const [categoryIconFile, setCategoryIconFile] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [newBanner, setNewBanner] = useState({
    image: '',
    title: '',
    subtitle: '',
    link: '',
    startDate: '',
    endDate: '',
    noExpiry: false
  });
  const [activeTab, setActiveTab] = useState('banners');
  const [previewBanner, setPreviewBanner] = useState('');
  const [previewCategoryIcon, setPreviewCategoryIcon] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let objectUrl;
    if (bannerImageFile) {
      objectUrl = URL.createObjectURL(bannerImageFile);
      setPreviewBanner(objectUrl);
    } else if (newBanner.image && newBanner.image instanceof File) {
      objectUrl = URL.createObjectURL(newBanner.image);
      setPreviewBanner(objectUrl);
    } else if (!editingBanner) {
      setPreviewBanner('');
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [bannerImageFile, newBanner.image, editingBanner]);

  useEffect(() => {
    if (categoryIconFile) {
      const objectUrl = URL.createObjectURL(categoryIconFile);
      setPreviewCategoryIcon(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [categoryIconFile]);

  const fetchData = async () => {
    try {
      const bannersRes = await SystemService.getBannersAdmin();
      const bannersData = bannersRes.data;
      setBanners(bannersData.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addBanner = async () => {
    if (!newBanner.image) {
      showToast('Please upload a banner image', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', newBanner.title || '');
      formData.append('subtitle', newBanner.subtitle || '');
      formData.append('link', newBanner.link || '');
      formData.append('startDate', newBanner.startDate || '');
      formData.append('endDate', newBanner.endDate || '');
      formData.append('noExpiry', newBanner.noExpiry);
      if (newBanner.image) {
        formData.append('image', newBanner.image);
      }

      const response = await SystemService.createBanner(formData);
      const data = response.data;
      setBanners([...banners, data.data]);
      setNewBanner({ image: '', title: '', subtitle: '', link: '', startDate: '', endDate: '', noExpiry: false });
      setPreviewBanner('');
      setFileInputKey(prev => prev + 1);
      showToast('Banner added successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to add banner', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateBanner = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', newBanner.title || '');
      formData.append('subtitle', newBanner.subtitle || '');
      formData.append('link', newBanner.link || '');
      formData.append('startDate', newBanner.startDate || '');
      formData.append('endDate', newBanner.endDate || '');
      formData.append('noExpiry', newBanner.noExpiry);
      if (bannerImageFile) {
        formData.append('image', bannerImageFile);
      }

      await SystemService.updateBanner(editingBanner._id, formData);

      setEditingBanner(null);
      setNewBanner({ image: '', title: '', subtitle: '', link: '', startDate: '', endDate: '', noExpiry: false });
      setBannerImageFile(null);
      setPreviewBanner('');
      setFileInputKey(prev => prev + 1);
      fetchData();
      showToast('Banner updated successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to update banner', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const removeBanner = async (id) => {
    const isConfirmed = await confirm({
      title: 'Remove Banner',
      message: 'Are you sure you want to remove this banner? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Remove',
    });
    if (!isConfirmed) return;

    try {
      await SystemService.deleteBanner(id);
      setBanners(banners.filter(banner => banner._id !== id));
      showToast('Banner removed successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to remove banner', 'error');
    }
  };

  const handleCategoryChange = (e) => {
    setNewCategory({ ...newCategory, [e.target.name]: e.target.value });
  };

  const createCategory = async () => {
    if (!newCategory.name) {
      showToast('Category name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', newCategory.name);
      formData.append('description', newCategory.description);
      if (categoryIconFile) {
        formData.append('icon', categoryIconFile);
      }

      await SystemService.createCategory(formData);

      setNewCategory({ name: '', icon: '', description: '' });
      setCategoryIconFile(null);
      refreshCategories();
      showToast('Category created successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to create category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateCategory = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', newCategory.name);
      formData.append('description', newCategory.description);
      if (categoryIconFile) {
        formData.append('icon', categoryIconFile);
      }

      await SystemService.updateCategory(editingCategory._id, formData);

      setEditingCategory(null);
      setNewCategory({ name: '', icon: '', description: '' });
      setCategoryIconFile(null);
      refreshCategories();
      showToast('Category updated successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to update category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCategory = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!isConfirmed) return;

    try {
      await SystemService.deleteCategory(id);
      refreshCategories();
      showToast('Category deleted successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to delete category', 'error');
    }
  };

  const toggleCategoryStatus = async (id) => {
    try {
      await SystemService.toggleCategoryStatus(id);
      refreshCategories();
      showToast('Category status updated successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to toggle category status', 'error');
    }
  };

  const editCategory = (category) => {
    setEditingCategory(category);
    setNewCategory({ name: category.label || category.name, description: category.description });
    setPreviewCategoryIcon(category.icon || '');
  };

  const editBanner = (banner) => {
    setEditingBanner(banner);
    setNewBanner({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      link: banner.link || '',
      startDate: banner.startDate ? banner.startDate.split('T')[0] : '',
      endDate: banner.endDate ? banner.endDate.split('T')[0] : '',
      noExpiry: !banner.endDate
    });
    setPreviewBanner(banner.image || '');
  };

  const resetBannerForm = () => {
    setEditingBanner(null);
    setNewBanner({ image: '', title: '', subtitle: '', link: '', startDate: '', endDate: '', noExpiry: false });
    setBannerImageFile(null);
    setPreviewBanner('');
    setFileInputKey(prev => prev + 1);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setNewCategory({ name: '', icon: '', description: '' });
    setCategoryIconFile(null);
    setPreviewCategoryIcon('');
  };

  if (loading || categoriesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-roboto p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-poppins">
            Category & Banner Management
          </h1>
          <p className="text-gray-600 mt-2 font-inter">Manage promotional banners and service categories</p>
        </div>



        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex border-b border-gray-200">
            {['banners', 'categories'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-center text-xs sm:text-sm md:text-base px-2 py-3 rounded-t-lg font-medium font-inter transition-all ${activeTab === tab
                  ? 'bg-primary text-white border-b-2 border-accent'
                  : 'text-secondary hover:text-primary hover:bg-gray-100'
                  }`}
              >
                {tab === 'banners' ? 'Banner Management' : 'Category Management'}
              </button>
            ))}
          </div>
        </div>

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
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/800x400?text=Banner+Image';
                            }}
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
                        key={fileInputKey}
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
                      Title
                    </label>
                    <input
                      type="text"
                      placeholder="Enter banner title"
                      value={newBanner.title}
                      onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all font-inter"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all font-inter"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-secondary font-inter">
                        <FaLink className="inline mr-2 text-accent" />
                        Redirect URL / Target Link
                      </label>
                      {categories && categories.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setNewBanner({ ...newBanner, link: e.target.value });
                            }
                          }}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-secondary outline-none focus:border-accent cursor-pointer"
                          value=""
                        >
                          <option value="" disabled>⚡ Quick Category Select</option>
                          <option value="/customer/services-list?category=All">All Services (/customer/services-list?category=All)</option>
                          {categories.map((cat) => (
                            <option key={cat._id || cat.name} value={`/customer/services-list?category=${encodeURIComponent(cat.name)}`}>
                              {cat.name} (/customer/services-list?category={cat.name})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. /customer/services-list?category=All or https://..."
                      value={newBanner.link || ''}
                      onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all font-inter text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      When user clicks on this banner, they will be navigated to this page.
                    </p>
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all font-inter"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-secondary font-inter">
                          <FaCalendar className="inline mr-2" />
                          End Date
                        </label>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="noExpiry"
                            checked={newBanner.noExpiry}
                            onChange={(e) => setNewBanner({ ...newBanner, noExpiry: e.target.checked, endDate: e.target.checked ? '' : newBanner.endDate })}
                            className="mr-2 cursor-pointer w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent"
                          />
                          <label htmlFor="noExpiry" className="text-sm text-secondary font-inter cursor-pointer">
                            No Expiry
                          </label>
                        </div>
                      </div>
                      <input
                        type="date"
                        value={newBanner.endDate}
                        disabled={newBanner.noExpiry}
                        onChange={(e) => setNewBanner({ ...newBanner, endDate: e.target.value })}
                        className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all font-inter ${newBanner.noExpiry ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={editingBanner ? updateBanner : addBanner}
                  isLoading={submitting}
                  leftIcon={editingBanner ? <FaSave /> : <FaPlus />}
                >
                  {editingBanner ? 'Update Banner' : 'Add Banner'}
                </Button>
                {editingBanner && (
                  <Button
                    variant="outline"
                    onClick={resetBannerForm}
                    leftIcon={<FaTimes />}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Existing Banners */}
            <div>
              <h3 className="text-xl font-semibold text-secondary mb-4 font-inter">Existing Banners</h3>
              {banners.length === 0 ? (
                <EmptyState
                  title="No banners created yet"
                  message="Add your first banner to get started"
                  icon={FaBullhorn}
                  className="py-12 bg-gray-50 border-0 shadow-none"
                />
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
                        <h4 className="font-semibold text-secondary mb-1 truncate font-inter">{banner.title}</h4>
                        {banner.subtitle && (
                          <p className="text-gray-600 text-sm mb-2 truncate font-inter">{banner.subtitle}</p>
                        )}
                        {banner.link && (
                          <div className="mb-3 text-xs text-teal-700 font-medium truncate flex items-center gap-1.5 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">
                            <FaLink className="shrink-0 text-teal-600" />
                            <span className="truncate">{banner.link}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-gray-500 font-inter">
                          <span>Start: {formatDate(banner.startDate)}</span>
                          <span>End: {formatDate(banner.endDate)}</span>
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
                <p className="text-gray-600 font-inter">Manage service categories</p>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-inter"
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
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/96x96?text=Icon';
                            }}
                          />
                        </div>
                        <p className="text-sm text-gray-600 font-inter">Icon preview</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <FaImage className="text-4xl text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2 font-inter">Upload category icon</p>
                        <p className="text-sm text-gray-500 font-inter">PNG, SVG up to 1MB</p>
                      </div>
                    )}
                    <label className="mt-4 inline-block bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02] font-inter">
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
                <Button
                  onClick={editingCategory ? updateCategory : createCategory}
                  isLoading={submitting}
                  leftIcon={editingCategory ? <FaSave /> : <FaPlus />}
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </Button>
                {editingCategory && (
                  <Button
                    variant="outline"
                    onClick={resetCategoryForm}
                    leftIcon={<FaTimes />}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Categories Table */}
            <div>
              <h3 className="text-xl font-semibold text-secondary mb-4 font-inter">Category List</h3>
              {categories.length === 0 ? (
                <EmptyState
                  title="No categories created yet"
                  message="Add your first category to get started"
                  icon={FaTag}
                  className="py-12 bg-gray-50 border-0 shadow-none"
                />
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
                            <div className="font-medium text-secondary font-inter">{category.label || category.name}</div>
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
                              <span className="text-gray-400 font-inter" style={{ display: category.icon ? 'none' : 'block' }}>
                                No icon
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-600 max-w-xs truncate font-inter">{category.description || 'No description'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={category.isActive ? 'success' : 'danger'}>
                              {category.isActive ? 'Active' : 'Inactive'}
                            </Badge>
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