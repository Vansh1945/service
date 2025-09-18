import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Upload,
  Download,
  Settings,
  Star,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  BarChart3,
  TrendingUp,
  Package,
  Activity,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminServices = () => {
  const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';
  const token = localStorage.getItem("token");

  // State management
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalRevenue: 0,
    avgRating: 0
  });

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'Electrical',
    description: '',
    basePrice: '',
    duration: '',
    specialNotes: [],
    materialsUsed: [],
    images: []
  });
  const [editForm, setEditForm] = useState({});
  const [bulkFile, setBulkFile] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [editImagePreviews, setEditImagePreviews] = useState([]);
  const [newSpecialNote, setNewSpecialNote] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [editNewSpecialNote, setEditNewSpecialNote] = useState('');
  const [editNewMaterial, setEditNewMaterial] = useState('');

  // Refs
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);

  // Categories
  const categories = ['Electrical', 'AC', 'Appliance Repair', 'Other'];

  // Check admin access
  useEffect(() => {
    fetchServices();
  }, []);

  // Filter and search services
  useEffect(() => {
    let filtered = [...services];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(service => service.isActive === isActive);
    }

    setFilteredServices(filtered);
  }, [services, searchTerm, categoryFilter, statusFilter]);

  // Calculate stats whenever services change
  useEffect(() => {
    const ratedServices = services.filter(s => s.averageRating && s.averageRating > 0);
    const newStats = {
      total: services.length,
      active: services.filter(s => s.isActive).length,
      inactive: services.filter(s => !s.isActive).length,
      ratedServices: ratedServices.length
    };
    setStats(newStats);
  }, [services]);

  // Fetch all services
  const fetchServices = async () => {
    try {
      const toastId = toast.loading('Fetching services...');
      const response = await fetch(`${API}/service/admin/services`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch services');
      }

      const data = await response.json();
      setServices(data.data || []);
      toast.update(toastId, {
        render: 'Services loaded successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
    } catch (error) {
      console.error('Fetch services error:', error);
      toast.error(error.message || 'Failed to fetch services');
    }
  };

  // Handle create form changes
  const handleCreateFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'images' && files && files.length > 0) {
      const newImages = Array.from(files);
      setCreateForm(prev => ({ ...prev, images: [...prev.images, ...newImages] }));

      // Create previews for new images
      const newPreviews = [];
      newImages.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target.result);
          if (newPreviews.length === newImages.length) {
            setImagePreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      setCreateForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle edit form changes
  const handleEditFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'images' && files && files.length > 0) {
      const newImages = Array.from(files);
      setEditForm(prev => ({ ...prev, images: [...(prev.images || []), ...newImages] }));

      // Create previews for new images
      const newPreviews = [];
      newImages.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target.result);
          if (newPreviews.length === newImages.length) {
            setEditImagePreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      setEditForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Add special note to create form
  const addSpecialNote = () => {
    if (newSpecialNote.trim()) {
      setCreateForm(prev => ({
        ...prev,
        specialNotes: [...prev.specialNotes, newSpecialNote.trim()]
      }));
      setNewSpecialNote('');
    }
  };

  // Remove special note from create form
  const removeSpecialNote = (index) => {
    setCreateForm(prev => ({
      ...prev,
      specialNotes: prev.specialNotes.filter((_, i) => i !== index)
    }));
  };

  // Add material to create form
  const addMaterial = () => {
    const trimmedMaterial = newMaterial.trim();
    if (trimmedMaterial && !createForm.materialsUsed.includes(trimmedMaterial)) {
      setCreateForm(prev => ({
        ...prev,
        materialsUsed: [...prev.materialsUsed, trimmedMaterial]
      }));
    }
    setNewMaterial('');
  };

  // Remove material from create form
  const removeMaterial = (index) => {
    setCreateForm(prev => ({
      ...prev,
      materialsUsed: prev.materialsUsed.filter((_, i) => i !== index)
    }));
  };

  // Add special note to edit form
  const addEditSpecialNote = () => {
    if (editNewSpecialNote.trim()) {
      setEditForm(prev => ({
        ...prev,
        specialNotes: [...prev.specialNotes, editNewSpecialNote.trim()]
      }));
      setEditNewSpecialNote('');
    }
  };

  // Remove special note from edit form
  const removeEditSpecialNote = (index) => {
    setEditForm(prev => ({
      ...prev,
      specialNotes: prev.specialNotes.filter((_, i) => i !== index)
    }));
  };

  // Add material to edit form
  const addEditMaterial = () => {
    const trimmedMaterial = editNewMaterial.trim();
    if (trimmedMaterial && !editForm.materialsUsed.includes(trimmedMaterial)) {
      setEditForm(prev => ({
        ...prev,
        materialsUsed: [...prev.materialsUsed, trimmedMaterial]
      }));
    }
    setEditNewMaterial('');
  };

  // Remove material from edit form
  const removeEditMaterial = (index) => {
    setEditForm(prev => ({
      ...prev,
      materialsUsed: prev.materialsUsed.filter((_, i) => i !== index)
    }));
  };

  // Create new service
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const toastId = toast.loading('Creating service...');
      const formData = new FormData();
      formData.append('title', createForm.title);
      formData.append('category', createForm.category);
      formData.append('description', createForm.description);
      formData.append('basePrice', createForm.basePrice);
      formData.append('duration', createForm.duration);
      formData.append('specialNotes', JSON.stringify(createForm.specialNotes));
      formData.append('materialsUsed', JSON.stringify(createForm.materialsUsed));

      // Append all images - use the correct field name 'image' (not 'images')
      createForm.images.forEach(image => {
        formData.append('image', image);
      });

      const response = await fetch(`${API}/service/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create service');
      }

      const data = await response.json();
      setServices(prev => [data.data, ...prev]);
      toast.update(toastId, {
        render: 'Service created successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
      resetCreateForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Create service error:', error);
      toast.error(error.message || 'Failed to create service');
    }
  };

  // Update service
  const handleUpdateService = async (e) => {
    e.preventDefault();
    try {
      const toastId = toast.loading('Updating service...');
      const formData = new FormData();
      Object.keys(editForm).forEach(key => {
        if (key !== 'images' && key !== 'existingImages' && key !== 'specialNotes' && key !== 'materialsUsed' && editForm[key] !== undefined) {
          formData.append(key, editForm[key]);
        }
      });

      if (editForm.specialNotes) {
        formData.append('specialNotes', JSON.stringify(editForm.specialNotes));
      }

      if (editForm.materialsUsed) {
        formData.append('materialsUsed', JSON.stringify(editForm.materialsUsed));
      }

      if (editForm.existingImages) {
        formData.append('existingImages', JSON.stringify(editForm.existingImages));
      }

      // Append new images - use the correct field name 'image' (not 'images')
      if (editForm.images) {
        editForm.images.forEach(image => {
          formData.append('image', image);
        });
      }

      const response = await fetch(`${API}/service/admin/service/${selectedService._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update service');
      }

      const data = await response.json();
      setServices(prev => prev.map(s => s._id === data.data._id ? data.data : s));
      toast.update(toastId, {
        render: 'Service updated successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
      setShowEditModal(false);
    } catch (error) {
      console.error('Update service error:', error);
      toast.error(error.message || 'Failed to update service');
    }
  };

  // Update service price
  const handleUpdatePrice = async (serviceId, newPrice) => {
    try {
      const toastId = toast.loading('Updating price...');
      const response = await fetch(`${API}/service/admin/services/${serviceId}/price`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ basePrice: newPrice })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update price');
      }

      const data = await response.json();
      setServices(prev => prev.map(s => s._id === data.data._id ? data.data : s));
      toast.update(toastId, {
        render: 'Price updated successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
    } catch (error) {
      console.error('Update price error:', error);
      toast.error(error.message || 'Failed to update price');
    }
  };

  // Toggle service status
  const handleToggleStatus = async (service) => {
    try {
      const toastId = toast.loading(service.isActive ? 'Deactivating service...' : 'Activating service...');
      let response;

      if (service.isActive) {
        // Deactivate service using DELETE endpoint
        response = await fetch(`${API}/service/admin/services/${service._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        // Activate service using PUT endpoint to update isActive field
        response = await fetch(`${API}/service/admin/service/${service._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ isActive: true })
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update service status');
      }

      // Refetch services to get updated status
      await fetchServices();
      toast.update(toastId, {
        render: `Service ${service.isActive ? 'deactivated' : 'activated'} successfully!`,
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error(error.message || 'Failed to update service status');
    }
  };

  // Handle bulk import
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      const toastId = toast.loading('Importing services...');
      const formData = new FormData();
      formData.append('servicesFile', bulkFile);

      const response = await fetch(`${API}/service/admin/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import services');
      }

      const data = await response.json();
      toast.update(toastId, {
        render: `Successfully imported ${data.importedCount} services!`,
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });

      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} services had errors`);
      }

      await fetchServices();
      setShowBulkImportModal(false);
      setBulkFile(null);
    } catch (error) {
      console.error('Bulk import error:', error);
      toast.error(error.message || 'Failed to import services');
    }
  };

  // Export services to Excel
  const handleExportServices = async () => {
    try {
      const toastId = toast.loading('Exporting services...');
      const response = await fetch(`${API}/service/admin/services-export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export services');
      }

      // Create blob from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'services.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.update(toastId, {
        render: 'Services exported successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
    } catch (error) {
      console.error('Export services error:', error);
      toast.error(error.message || 'Failed to export services');
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      category: 'Electrical',
      description: '',
      basePrice: '',
      duration: '',
      specialNotes: [],
      materialsUsed: [],
      images: []
    });
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle edit click
  const handleEditClick = (service) => {
    setSelectedService(service);
    setEditForm({
      title: service.title,
      category: service.category,
      description: service.description,
      basePrice: service.basePrice,
      duration: service.duration,
      specialNotes: service.specialNotes || [],
      materialsUsed: service.materialsUsed || [],
      existingImages: service.images || [],
      images: []
    });
    setEditImagePreviews([]);
    setShowEditModal(true);
  };

  // Handle view click
  const handleViewClick = (service) => {
    setSelectedService(service);
    setShowViewModal(true);
  };

  // Remove image from create form
  const removeCreateImage = (index) => {
    setCreateForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Remove image from edit form
  const removeEditImage = (index, isExisting = false) => {
    if (isExisting) {
      setEditForm(prev => ({
        ...prev,
        existingImages: prev.existingImages.filter((_, i) => i !== index)
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
      setEditImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format duration
  const formatDuration = (duration) => {
    const hours = Math.floor(duration);
    const minutes = Math.round((duration - hours) * 60);
    return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m` : ''}`.trim();
  };

  const parseArrayField = (field) => {
    if (!field) {
      return [];
    }
    if (Array.isArray(field)) {
      return field.flatMap(item => parseArrayField(item)).filter(Boolean);
    }
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        return parseArrayField(parsed);
      } catch (e) {
        return field
          .replace(/[[\]"\\]/g, ' ')
          .trim()
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    }
    return [String(field)];
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentServices = filteredServices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Services Management</h1>
            <p className="text-gray-600 mt-1">Manage all your services and offerings</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center bg-primary hover:bg-teal-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
            >
              <Upload className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
              Bulk Import
            </button>
            <button
              onClick={handleExportServices}
              className="flex items-center bg-accent hover:bg-orange-700 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
            >
              <Download className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
              Export
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center bg-primary hover:bg-teal-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
              Add Service
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Services</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Services</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.active}</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Services</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.inactive}</p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Services with Ratings</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.ratedServices}</p>
              </div>
              <div className="p-2 md:p-3 bg-yellow-100 rounded-full">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {currentServices.length === 0 ? (
            <div className="text-center py-12 md:py-16">
              <Package className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
              <p className="text-gray-600 text-md md:text-lg">No services found</p>
              <p className="text-gray-400 text-sm mt-1 md:mt-2">
                {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first service to get started'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentServices.map((service) => (
                      <tr key={service._id} className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="px-4 md:px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 md:h-12 md:w-12">
                              {service.images && service.images[0] ? (
                                <img
                                  className="h-10 w-10 md:h-12 md:w-12 rounded-lg object-cover"
                                  src={service.images[0]}
                                  alt={service.title}
                                  onError={(e) => {
                                    e.target.src = '/default-service-placeholder.jpg';
                                  }}
                                />
                              ) : (
                                <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-secondary">{service.title}</div>
                              <div className="text-xs text-gray-500 truncate max-w-xs">
                                {service.description.substring(0, 50)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                            {service.category}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(service.basePrice)}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mr-1" />
                            <span className="text-sm text-gray-600">
                              {formatDuration(service.duration)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-400 mr-1" />
                            <span className="text-sm text-gray-600">
                              {service.averageRating || 0} ({service.ratingCount || 0})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${service.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {service.isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewClick(service)}
                              className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditClick(service)}
                              className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                              title="Edit Service"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(service)}
                              className={`p-1 rounded transition-colors duration-200 ${service.isActive
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                                }`}
                              title={service.isActive ? 'Deactivate Service' : 'Activate Service'}
                            >
                              {service.isActive ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between bg-gray-50 gap-3">
                  <div className="text-sm text-gray-600">
                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredServices.length)} of {filteredServices.length} results
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2 py-1 md:px-3 md:py-2 text-sm rounded-lg ${currentPage === page
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:text-primary hover:bg-gray-100'
                            }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Service Modal */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              resetCreateForm();
            }}
            title="Create New Service"
            size="xlarge"
          >
            <form onSubmit={handleCreateService} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Service Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={createForm.title}
                    onChange={handleCreateFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter service title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={createForm.category}
                    onChange={handleCreateFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={createForm.description}
                  onChange={handleCreateFormChange}
                  required
                  className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary h-40"
                  placeholder="Enter service description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="basePrice"
                    value={createForm.basePrice}
                    onChange={handleCreateFormChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter base price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Duration (hours) *
                  </label>
                  <input
                    type="number"
                    name="duration"
                    value={createForm.duration}
                    onChange={handleCreateFormChange}
                    required
                    min="0.25"
                    max="500"
                    step="0.25"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter duration in hours"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Special Notes
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newSpecialNote}
                      onChange={(e) => setNewSpecialNote(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Add a special note"
                    />
                    <button
                      type="button"
                      onClick={addSpecialNote}
                      className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-teal-800"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {createForm.specialNotes.map((note, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        {note}
                        <button
                          type="button"
                          onClick={() => removeSpecialNote(index)}
                          className="ml-1 text-teal-600 hover:text-teal-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Materials Used
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newMaterial}
                      onChange={(e) => setNewMaterial(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Add a material"
                    />
                    <button
                      type="button"
                      onClick={addMaterial}
                      className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-teal-800"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {createForm.materialsUsed.map((material, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {material}
                        <button
                          type="button"
                          onClick={() => removeMaterial(index)}
                          className="ml-1 text-orange-600 hover:text-orange-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                  Service Images (Multiple)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    name="images"
                    ref={fileInputRef}
                    onChange={handleCreateFormChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    <ImageIcon className="w-4 h-4 md:w-5 md:h-5 mr-2 text-gray-400" />
                    Choose Images
                  </button>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Selected Images:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="h-20 w-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeCreateImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create Service
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Service Modal */}
        {showEditModal && selectedService && (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title="Edit Service"
            size="xlarge"
          >
            <form onSubmit={handleUpdateService} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Service Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={editForm.title}
                    onChange={handleEditFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter service title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={editForm.category}
                    onChange={handleEditFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditFormChange}
                  required
                  className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary h-40"
                  placeholder="Enter service description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Special Notes
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={editNewSpecialNote}
                      onChange={(e) => setEditNewSpecialNote(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Add a special note"
                    />
                    <button
                      type="button"
                      onClick={addEditSpecialNote}
                      className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-teal-800"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editForm.specialNotes && editForm.specialNotes.map((note, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        {note}
                        <button
                          type="button"
                          onClick={() => removeEditSpecialNote(index)}
                          className="ml-1 text-teal-600 hover:text-teal-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Materials Used
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={editNewMaterial}
                      onChange={(e) => setEditNewMaterial(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Add a material"
                    />
                    <button
                      type="button"
                      onClick={addEditMaterial}
                      className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-teal-800"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editForm.materialsUsed && editForm.materialsUsed.map((material, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {material}
                        <button
                          type="button"
                          onClick={() => removeEditMaterial(index)}
                          className="ml-1 text-orange-600 hover:text-orange-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="basePrice"
                    value={editForm.basePrice}
                    onChange={handleEditFormChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter base price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Duration (hours) *
                  </label>
                  <input
                    type="number"
                    name="duration"
                    value={editForm.duration}
                    onChange={handleEditFormChange}
                    required
                    min="0.25"
                    max="500"
                    step="0.25"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter duration in hours"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                  Service Images
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    name="images"
                    ref={editFileInputRef}
                    onChange={handleEditFormChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    <ImageIcon className="w-4 h-4 md:w-5 md:h-5 mr-2 text-gray-400" />
                    Add More Images
                  </button>
                </div>
                {(editForm.existingImages && editForm.existingImages.length > 0) || editImagePreviews.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Current Images:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {editForm.existingImages?.map((image, index) => (
                        <div key={`existing-${index}`} className="relative">
                          <img
                            src={image}
                            alt={`Existing ${index + 1}`}
                            className="h-20 w-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeEditImage(index, true)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {editImagePreviews.map((preview, index) => (
                        <div key={`new-${index}`} className="relative">
                          <img
                            src={preview}
                            alt={`New ${index + 1}`}
                            className="h-20 w-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeEditImage(index, false)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Update Service
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* View Service Modal */}
        {showViewModal && selectedService && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Service Details"
            size="large"
          >
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex flex-col md:flex-row items-start gap-6">
                {selectedService.images && selectedService.images.length > 0 ? (
                  <div className="flex-shrink-0">
                    <img
                      className="h-28 w-28 md:h-36 md:w-36 rounded-xl object-cover shadow-md"
                      src={selectedService.images[0]}
                      alt={selectedService.title}
                      onError={(e) => {
                        e.target.src = '/default-service-placeholder.jpg';
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-28 w-28 md:h-36 md:w-36 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center shadow-md">
                    <ImageIcon className="w-12 h-12 md:w-16 md:h-16 text-teal-300" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <h3 className="text-2xl md:text-3xl font-bold text-secondary">{selectedService.title}</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${selectedService.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {selectedService.isActive ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" />
                          Inactive
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                      {selectedService.category}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(selectedService.duration)}
                    </span>
                  </div>

                  <p className="text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    {selectedService.description}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-100 shadow-sm">
                  <div className="flex items-center mb-2">
                    <DollarSign className="w-5 h-5 text-teal-600 mr-2" />
                    <span className="text-sm font-medium text-teal-700">Base Price</span>
                  </div>
                  <p className="text-2xl font-bold text-teal-900">
                    {formatCurrency(selectedService.basePrice)}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-100 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Clock className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-700">Duration</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatDuration(selectedService.duration)}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-100 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Star className="w-5 h-5 text-amber-600 mr-2" />
                    <span className="text-sm font-medium text-amber-700">Rating</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">
                    {selectedService.averageRating || 0}/5
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    ({selectedService.ratingCount || 0} reviews)
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-100 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Users className="w-5 h-5 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-purple-700">Popularity</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {selectedService.ratingCount || 0}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Total ratings
                  </p>
                </div>
              </div>

              {/* Images Section */}
              {selectedService.images && selectedService.images.length > 0 && (
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <h4 className="text-lg font-semibold text-secondary mb-4 flex items-center">
                    <ImageIcon className="w-5 h-5 mr-2 text-teal-600" />
                    Service Images
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {selectedService.images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`Service image ${index + 1}`}
                          className="h-28 w-full object-cover rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src = '/default-service-placeholder.jpg';
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-300 flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Notes Section */}
              {selectedService.specialNotes && parseArrayField(selectedService.specialNotes).length > 0 && (
                <div className="bg-teal-50 p-5 rounded-xl border border-teal-100">
                  <h4 className="text-lg font-semibold text-secondary mb-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-teal-600" />
                    Special Notes
                  </h4>
                  <ul className="space-y-3">
                    {parseArrayField(selectedService.specialNotes).map((note, index) => (
                      <li key={index} className="flex items-start">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                        </div>
                        <p className="ml-3 text-gray-700">{note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Materials Used Section */}
              {selectedService.materialsUsed && parseArrayField(selectedService.materialsUsed).length > 0 && (
                <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
                  <h4 className="text-lg font-semibold text-secondary mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-orange-600" />
                    Materials Used
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {parseArrayField(selectedService.materialsUsed).map((material, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-white text-orange-800 border border-orange-200 shadow-sm">
                        {material}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditClick(selectedService);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Service
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Bulk Import Modal */}
        {showBulkImportModal && (
          <Modal
            isOpen={showBulkImportModal}
            onClose={() => setShowBulkImportModal(false)}
            title="Bulk Import Services"
            size="medium"
          >
            <form onSubmit={handleBulkImport} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                  Upload Excel File
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    ref={bulkFileInputRef}
                    onChange={(e) => setBulkFile(e.target.files[0])}
                    accept=".xlsx,.xls"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    <Upload className="w-4 h-4 md:w-5 md:h-5 mr-2 text-gray-400" />
                    Choose Excel File
                  </button>
                  {bulkFile && (
                    <span className="text-sm text-gray-600">{bulkFile.name}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Upload an Excel file with columns: Title, Category, Description, Base Price, Duration
                </p>
              </div>

              <div className="bg-blue-50 p-3 md:p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Excel Format Requirements:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Column 1: Title (required)</li>
                  <li>• Column 2: Category (Electrical, AC, Appliance Repair, Other)</li>
                  <li>• Column 3: Description (required)</li>
                  <li>• Column 4: Base Price (required, number)</li>
                  <li>• Column 5: Duration in hours (required, number)</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkFile}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Services
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    medium: 'sm:max-w-lg',
    large: 'sm:max-w-2xl',
    xlarge: 'sm:max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} sm:w-full`}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-secondary">{title}</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminServices;