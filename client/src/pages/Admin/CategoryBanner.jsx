import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../store/auth';

const CategoryBanner = () => {
  const [systemSettings, setSystemSettings] = useState({
    companyName: '',
    tagline: '',
    logo: '',
    favicon: '',
    promoMessage: '',
    banners: []
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '', description: '' });
  const [newBanner, setNewBanner] = useState({ image: '', title: '', subtitle: '', startDate: '', endDate: '' });
  const {API,token, showToast } = useAuth();


  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, categoriesRes] = await Promise.all([
        fetch(`${API}/system-setting/admin/system-setting`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`${API}/system-setting/admin/categories`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      if (!settingsRes.ok || !categoriesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const settingsData = await settingsRes.json();
      const categoriesData = await categoriesRes.json();

      setSystemSettings(settingsData.data || {});
      setCategories(categoriesData.data || []);
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
      const response = await fetch(`${API}/system-setting/admin/system-setting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(systemSettings)
      });

      if (!response.ok) {
        throw new Error('Failed to save system settings');
      }

      const data = await response.json();
      setMessage('System settings saved successfully');
      showToast('System settings saved successfully');
    } catch (error) {
      setMessage('Error saving system settings');
      console.error(error);
    }
  };

  const addBanner = async () => {
    try {
      const updatedBanners = [...systemSettings.banners, newBanner];
      const response = await fetch(`${API}/system-setting/admin/system-setting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...systemSettings, banners: updatedBanners })
      });

      if (!response.ok) {
        throw new Error('Failed to add banner');
      }

      setSystemSettings({ ...systemSettings, banners: updatedBanners });
      setNewBanner({ image: '', title: '', subtitle: '', startDate: '', endDate: '' });
      setMessage('Banner added successfully');
      showToast('Banner added successfully');
    } catch (error) {
      setMessage('Error adding banner');
      console.error(error);
    }
  };

  const removeBanner = async (index) => {
    try {
      const updatedBanners = systemSettings.banners.filter((_, i) => i !== index);
      const response = await fetch(`${API}/system-setting/admin/system-setting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...systemSettings, banners: updatedBanners })
      });

      if (!response.ok) {
        throw new Error('Failed to remove banner');
      }

      setSystemSettings({ ...systemSettings, banners: updatedBanners });
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
    try {
      const response = await fetch(`${API}/system-setting/admin/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCategory)
      });

      if (!response.ok) {
        throw new Error('Failed to create category');
      }

      setNewCategory({ name: '', icon: '', description: '' });
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
      const response = await fetch(`${API}/system-setting/admin/categories/${editingCategory._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCategory)
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setEditingCategory(null);
      setNewCategory({ name: '', icon: '', description: '' });
      fetchData();
      setMessage('Category updated successfully');
      showToast('Category updated successfully');
    } catch (error) {
      setMessage('Error updating category');
      console.error(error);
    }
  };

  const deleteCategory = async (id) => {
    try {
      const response = await fetch(`${API}/system-setting/admin/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle category status');
      }

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
    setNewCategory({ name: category.name, icon: category.icon, description: category.description });
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      {message && <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded">{message}</div>}

      {/* System Settings Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">System Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            name="companyName"
            placeholder="Company Name"
            value={systemSettings.companyName}
            onChange={handleSystemSettingsChange}
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="tagline"
            placeholder="Tagline"
            value={systemSettings.tagline}
            onChange={handleSystemSettingsChange}
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="logo"
            placeholder="Logo URL"
            value={systemSettings.logo}
            onChange={handleSystemSettingsChange}
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="favicon"
            placeholder="Favicon URL"
            value={systemSettings.favicon}
            onChange={handleSystemSettingsChange}
            className="border p-2 rounded"
          />
          <textarea
            name="promoMessage"
            placeholder="Promo Message"
            value={systemSettings.promoMessage}
            onChange={handleSystemSettingsChange}
            className="border p-2 rounded md:col-span-2"
            rows="3"
          />
        </div>
        <button onClick={saveSystemSettings} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Save System Settings
        </button>
      </div>

      {/* Banner Management Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Banner Management</h2>
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Add New Banner</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Image URL"
              value={newBanner.image}
              onChange={(e) => setNewBanner({ ...newBanner, image: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Title"
              value={newBanner.title}
              onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Subtitle"
              value={newBanner.subtitle}
              onChange={(e) => setNewBanner({ ...newBanner, subtitle: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="date"
              placeholder="Start Date"
              value={newBanner.startDate}
              onChange={(e) => setNewBanner({ ...newBanner, startDate: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="date"
              placeholder="End Date"
              value={newBanner.endDate}
              onChange={(e) => setNewBanner({ ...newBanner, endDate: e.target.value })}
              className="border p-2 rounded"
            />
          </div>
          <button onClick={addBanner} className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Add Banner
          </button>
        </div>
        <div>
          <h3 className="text-lg font-medium mb-2">Existing Banners</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2">Image</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Subtitle</th>
                  <th className="px-4 py-2">Start Date</th>
                  <th className="px-4 py-2">End Date</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {systemSettings.banners.map((banner, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-4 py-2"><img src={banner.image} alt="Banner" className="w-16 h-16 object-cover" /></td>
                    <td className="px-4 py-2">{banner.title}</td>
                    <td className="px-4 py-2">{banner.subtitle}</td>
                    <td className="px-4 py-2">{banner.startDate}</td>
                    <td className="px-4 py-2">{banner.endDate}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => removeBanner(index)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Category Management Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Category Management</h2>
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={newCategory.name}
              onChange={handleCategoryChange}
              className="border p-2 rounded"
            />
            <input
              type="text"
              name="icon"
              placeholder="Icon"
              value={newCategory.icon}
              onChange={handleCategoryChange}
              className="border p-2 rounded"
            />
            <input
              type="text"
              name="description"
              placeholder="Description"
              value={newCategory.description}
              onChange={handleCategoryChange}
              className="border p-2 rounded"
            />
          </div>
          <button
            onClick={editingCategory ? updateCategory : createCategory}
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {editingCategory ? 'Update Category' : 'Create Category'}
          </button>
          {editingCategory && (
            <button
              onClick={() => { setEditingCategory(null); setNewCategory({ name: '', icon: '', description: '' }); }}
              className="mt-2 ml-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
        <div>
          <h3 className="text-lg font-medium mb-2">Category List</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Icon</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category._id} className="border-b">
                    <td className="px-4 py-2">{category.name}</td>
                    <td className="px-4 py-2">{category.icon}</td>
                    <td className="px-4 py-2">{category.description}</td>
                    <td className="px-4 py-2">{category.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => editCategory(category)} className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 mr-2">
                        Edit
                      </button>
                      <button onClick={() => toggleCategoryStatus(category._id)} className={`px-2 py-1 rounded mr-2 ${category.isActive ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                        {category.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteCategory(category._id)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryBanner;
