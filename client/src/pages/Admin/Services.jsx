import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Pagination from '../../components/Pagination';
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
import { useAuth } from '../../context/auth';
import * as ServiceService from '../../services/ServiceService';
import * as SystemService from '../../services/SystemService';
import useCategory from '../../hooks/useCategory';
import { formatCurrency, formatDuration } from '../../utils/format';
import TableSkeleton from '../../components/ui-skeletons/TableSkeleton';






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

// Extracted ServiceRow for performance
const ServiceRow = React.memo(({ service, onViewClick, onEditClick, onToggleStatus }) => {
  return (
    <tr className="hover:bg-gray-50 transition-colors duration-200">
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
                <span className="text-gray-400">No Img</span>
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
          {typeof service.category === 'object' ? (service.category.name || service.category.label) : service.category}
        </span>
      </td>
      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-semibold text-green-600">
          {formatCurrency(service.basePrice)}
        </span>
      </td>
      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-gray-600">
          <Clock className="w-4 h-4 mr-1 text-gray-400" />
          <span className="text-sm">
            {formatDuration(service.duration)}
          </span>
        </div>
      </td>
      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-gray-600">
          <Star className="w-4 h-4 mr-1 text-yellow-500 fill-current" />
          <span className="text-sm">
            {service.averageRating || 0} ({service.ratingCount || 0})
          </span>
        </div>
      </td>
      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${service.isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
          }`}>
          {service.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewClick(service)}
            className="p-1.5 rounded-md text-gray-500 hover:text-primary hover:bg-teal-50 transition-colors duration-200"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditClick(service)}
            className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
            title="Edit Service"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleStatus(service)}
            className={`p-1.5 rounded-md transition-colors duration-200 ${service.isActive
              ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
              : 'text-green-500 hover:text-green-700 hover:bg-green-50'
              }`}
            title={service.isActive ? 'Deactivate Service' : 'Activate Service'}
          >
            {service.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
});

const AdminServices = () => {
  const { token, API } = useAuth();

  // State management
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDisableDiscountsModal, setShowDisableDiscountsModal] = useState(false);
  const [disableDiscountsScope, setDisableDiscountsScope] = useState('all');
  const [disableDiscountsCategory, setDisableDiscountsCategory] = useState('');
  const [isDisablingDiscounts, setIsDisablingDiscounts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { categories, loading: categoriesLoading } = useCategory();

  // Modal active tabs
  const [formActiveTab, setFormActiveTab] = useState('basic');
  const [viewActiveTab, setViewActiveTab] = useState('overview');

  // Form states
  const [formState, setFormState] = useState({
    title: '',
    category: '',
    description: '',
    basePrice: '',
    duration: '',
    specialNotes: [],
    materialsUsed: [],
    images: [],
    existingImages: [],
    serviceType: 'standard',
    warranty: { duration: '', unit: 'days' },
    tags: [],
    faqs: [],
    shortDescription: '',
    isFeatured: false,
    prerequisites: [],
    discountPrice: ''
  });
  const [bulkFile, setBulkFile] = useState(null);
  const [formImagePreviews, setFormImagePreviews] = useState([]);
  const [newSpecialNote, setNewSpecialNote] = useState('');
  const [newMaterial, setNewMaterial] = useState('');

  // Dynamic input helper states
  const [newTag, setNewTag] = useState('');
  const [newPrerequisite, setNewPrerequisite] = useState('');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  // Refs
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);

  // Fetch all services
  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ServiceService.getAllServices();
      const data = response.data;
      setServices(data.data || []);
    } catch (error) {
      console.error('Fetch services error:', error);
      toast.error(error.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, []);


  // Check admin access
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Use useMemo to avoid maintaining redundant state
  const filteredServices = useMemo(() => {
    let filtered = [...services];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(service =>
        service.title?.toLowerCase().includes(lower) ||
        service.description?.toLowerCase().includes(lower) ||
        (typeof service.category === 'object' ? (service.category.name || service.category.label) : service.category)?.toLowerCase().includes(lower)
      );
    }

    if (categoryFilter !== '') {
      filtered = filtered.filter(service => service.category?._id === categoryFilter || service.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(service => service.isActive === isActive);
    }
    return filtered;
  }, [services, searchTerm, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const ratedServices = services.filter(s => s.averageRating && s.averageRating > 0);
    return {
      total: services.length,
      active: services.filter(s => s.isActive).length,
      inactive: services.filter(s => !s.isActive).length,
      ratedServices: ratedServices.length
    };
  }, [services]);


  // Handle form field changes
  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'images' && files && files.length > 0) {
      const newImages = Array.from(files);
      setFormState(prev => ({ ...prev, images: [...prev.images, ...newImages] }));

      // Create previews for new images
      const newPreviews = [];
      newImages.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target.result);
          if (newPreviews.length === newImages.length) {
            setFormImagePreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  // Generic list updaters to reduce code size
  const addToField = (fieldName, value, setter) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setFormState(prev => {
      const list = prev[fieldName] || [];
      if (list.includes(trimmed)) return prev;
      return { ...prev, [fieldName]: [...list, trimmed] };
    });
    setter('');
  };

  const removeFromField = (fieldName, index) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).filter((_, i) => i !== index)
    }));
  };

  const addFaqToForm = (question, answer, qSetter, aSetter) => {
    const q = question.trim();
    const a = answer.trim();
    if (q && a) {
      setFormState(prev => ({
        ...prev,
        faqs: [...(prev.faqs || []), { question: q, answer: a }]
      }));
      qSetter('');
      aSetter('');
    }
  };

  // Submit Handler for Create or Edit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formState.discountPrice && Number(formState.discountPrice) > Number(formState.basePrice)) {
        toast.error('Discount price cannot be greater than base price');
        return;
      }

      const formData = new FormData();
      Object.keys(formState).forEach(key => {
        if (
          key !== 'images' &&
          key !== 'existingImages' &&
          key !== 'specialNotes' &&
          key !== 'materialsUsed' &&
          key !== 'warranty' &&
          key !== 'tags' &&
          key !== 'faqs' &&
          key !== 'prerequisites' &&
          formState[key] !== undefined &&
          formState[key] !== null
        ) {
          formData.append(key, formState[key]);
        }
      });

      formData.append('specialNotes', JSON.stringify(formState.specialNotes || []));
      formData.append('materialsUsed', JSON.stringify(formState.materialsUsed || []));
      formData.append('warranty', JSON.stringify(formState.warranty || { duration: '', unit: 'days' }));
      formData.append('tags', JSON.stringify(formState.tags || []));
      formData.append('faqs', JSON.stringify(formState.faqs || []));
      formData.append('prerequisites', JSON.stringify(formState.prerequisites || []));

      if (isEditMode) {
        formData.append('existingImages', JSON.stringify(formState.existingImages || []));
      }

      // Append new images
      if (formState.images) {
        formState.images.forEach(image => {
          formData.append('image', image);
        });
      }

      let response;
      if (isEditMode) {
        response = await ServiceService.updateService(selectedService._id, formData);
        const data = response.data;
        setServices(prev => prev.map(s => s._id === data.data._id ? data.data : s));
        toast.success('Service updated successfully!');
      } else {
        response = await ServiceService.createService(formData);
        const data = response.data;
        setServices(prev => [data.data, ...prev]);
        toast.success('Service created successfully!');
      }

      resetFormState();
      setShowFormModal(false);
    } catch (error) {
      if (error.message === 'silent_cancel') return;
      console.error('Submit service form error:', error);
      toast.error(error.message || 'Failed to submit service form');
    }
  };

  // Update service price
  const handleUpdatePrice = async (serviceId, newPrice) => {
    try {
      const response = await ServiceService.updateBasePrice(serviceId, { basePrice: newPrice });
      const data = response.data;
      setServices(prev => prev.map(s => s._id === data.data._id ? data.data : s));
      toast.success('Price updated successfully!');
    } catch (error) {
      if (error.message === 'silent_cancel') return;
      console.error('Update price error:', error);
      toast.error(error.message || 'Failed to update price');
    }
  };

  // Toggle service status
  const handleToggleStatus = useCallback(async (service) => {
    try {
      if (service.isActive) {
        // Deactivate service using DELETE endpoint
        await ServiceService.deleteService(service._id);
      } else {
        // Activate service using PUT endpoint to update isActive field
        await ServiceService.updateService(service._id, { isActive: true });
      }

      // Refetch services to get updated status
      await fetchServices();
      toast.success(`Service ${service.isActive ? 'deactivated' : 'activated'} successfully!`);
    } catch (error) {
      if (error.message === 'silent_cancel') return;
      console.error('Toggle status error:', error);
      toast.error(error.message || 'Failed to update service status');
    }
  }, [fetchServices]);

  // Handle bulk import
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('servicesFile', bulkFile);

      const response = await ServiceService.bulkImportServices(formData);
      const data = response.data;
      toast.success(`Successfully imported ${data.importedCount} services!`);

      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} services had errors`);
      }

      await fetchServices();
      setShowBulkImportModal(false);
      setBulkFile(null);
    } catch (error) {
      if (error.message === 'silent_cancel') return;
      console.error('Bulk import error:', error);
      toast.error(error.message || 'Failed to import services');
    }
  };

  // Download Service Import Template
  const handleDownloadTemplate = async () => {
    try {
      const response = await ServiceService.downloadServiceTemplate({ responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'service_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded successfully!');
    } catch (error) {
      console.error('Download template error:', error);
      toast.error('Failed to download template');
    }
  };

  // Export services to Excel
  const handleExportServices = async () => {
    try {
      const response = await ServiceService.exportServicesToExcel({ responseType: 'blob' });

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'services.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Services exported successfully!');
    } catch (error) {
      console.error('Export services error:', error);
      toast.error(error.message || 'Failed to export services');
    }
  };

  // Handle bulk disable discounts
  const handleDisableDiscountsSubmit = async (e) => {
    e.preventDefault();
    if (disableDiscountsScope === 'category' && !disableDiscountsCategory) {
      toast.error('Please select a category');
      return;
    }

    setIsDisablingDiscounts(true);
    try {
      const response = await ServiceService.disableDiscounts({
        scope: disableDiscountsScope,
        categoryId: disableDiscountsScope === 'category' ? disableDiscountsCategory : undefined
      });
      if (response.data.success) {
        toast.success(response.data.message || 'Discounts deactivated successfully!');
        await fetchServices();
        setShowDisableDiscountsModal(false);
        setDisableDiscountsCategory('');
      } else {
        toast.error(response.data.message || 'Failed to deactivate discounts');
      }
    } catch (error) {
      console.error('Disable discounts error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to deactivate discounts');
    } finally {
      setIsDisablingDiscounts(false);
    }
  };

  // Reset form state
  const resetFormState = () => {
    setFormState({
      title: '',
      category: '',
      description: '',
      basePrice: '',
      duration: '',
      specialNotes: [],
      materialsUsed: [],
      images: [],
      existingImages: [],
      serviceType: 'standard',
      warranty: { duration: '', unit: 'days' },
      tags: [],
      faqs: [],
      shortDescription: '',
      isFeatured: false,
      prerequisites: [],
      discountPrice: ''
    });
    setFormImagePreviews([]);
    setNewSpecialNote('');
    setNewMaterial('');
    setNewTag('');
    setNewPrerequisite('');
    setFaqQuestion('');
    setFaqAnswer('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFormActiveTab('basic');
  };

  // Handle Add Service click (open create mode)
  const handleAddServiceClick = () => {
    setIsEditMode(false);
    setSelectedService(null);
    resetFormState();
    setShowFormModal(true);
  };

  // Handle edit click
  const handleEditClick = useCallback((service) => {
    setSelectedService(service);
    setIsEditMode(true);
    setFormState({
      title: service.title || '',
      category: service.category?._id || service.category?.value || service.category || '',
      description: service.description || '',
      basePrice: service.basePrice || '',
      duration: service.duration || '',
      specialNotes: parseArrayField(service.specialNotes),
      materialsUsed: parseArrayField(service.materialsUsed),
      existingImages: service.images || [],
      images: [],
      serviceType: service.serviceType || 'standard',
      warranty: {
        duration: service.warranty?.duration || '',
        unit: service.warranty?.unit || 'days'
      },
      tags: parseArrayField(service.tags),
      faqs: service.faqs || [],
      shortDescription: service.shortDescription || '',
      isFeatured: !!service.isFeatured,
      prerequisites: parseArrayField(service.prerequisites),
      discountPrice: service.discountPrice || ''
    });
    setFormImagePreviews([]);
    setNewSpecialNote('');
    setNewMaterial('');
    setNewTag('');
    setNewPrerequisite('');
    setFaqQuestion('');
    setFaqAnswer('');
    setFormActiveTab('basic');
    setShowFormModal(true);
  }, []);

  // Handle view click
  const handleViewClick = useCallback((service) => {
    setSelectedService(service);
    setViewActiveTab('overview');
    setShowViewModal(true);
  }, []);

  // Remove image from formState (newly added or existing)
  const removeFormImage = (index, isExisting = false) => {
    if (isExisting) {
      setFormState(prev => ({
        ...prev,
        existingImages: (prev.existingImages || []).filter((_, i) => i !== index)
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        images: (prev.images || []).filter((_, i) => i !== index)
      }));
      setFormImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
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
              onClick={() => setShowDisableDiscountsModal(true)}
              className="flex items-center bg-red-600 hover:bg-red-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
            >
              <XCircle className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
              Disable Discounts
            </button>
            <button
              onClick={handleAddServiceClick}
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
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
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
          {currentServices.length === 0 && !loading ? (
            <div className="text-center py-12 md:py-16">
              <Package className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
              <p className="text-gray-600 text-md md:text-lg">No services found</p>
              <p className="text-gray-400 text-sm mt-1 md:mt-2">
                {searchTerm || categoryFilter !== '' || statusFilter !== 'all'
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
                    {loading ? (
                      <TableSkeleton rows={itemsPerPage} cols={7} />
                    ) : (
                      currentServices.map((service) => (
                        <ServiceRow
                          key={service._id}
                          service={service}
                          onViewClick={handleViewClick}
                          onEditClick={handleEditClick}
                          onToggleStatus={handleToggleStatus}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 border-t border-gray-200">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredServices.length}
                  limit={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>

        {/* Service Form Modal (Unified Create/Edit) */}
        {showFormModal && (
          <Modal
            isOpen={showFormModal}
            onClose={() => {
              setShowFormModal(false);
              resetFormState();
            }}
            title={isEditMode ? "Edit Service" : "Create New Service"}
            size="xlarge"
          >
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap scrollbar-none">
              {[
                { id: 'basic', label: 'Basic Info', icon: FileText },
                { id: 'pricing', label: 'Pricing & Type', icon: DollarSign },
                { id: 'additional', label: 'Logistics & Add-ons', icon: Settings },
                { id: 'faq_media', label: 'FAQs & Images', icon: ImageIcon },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = formActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFormActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-medium text-sm transition-all duration-300 ${
                      isActive
                        ? 'border-primary text-primary bg-teal-50 bg-opacity-40 rounded-t-lg font-semibold'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <TabIcon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-6">
              {/* Tab 1: Basic Info */}
              {formActiveTab === 'basic' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Service Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formState.title}
                        onChange={handleFormChange}
                        required
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="e.g. Deep Home Cleaning"
                      />
                    </div>
                    <CategorySelect
                      value={formState.category}
                      onChange={(value) => setFormState(prev => ({ ...prev, category: value }))}
                      label="Category"
                      required
                      categories={categories}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                      Short Description * (Max 150 chars)
                    </label>
                    <textarea
                      name="shortDescription"
                      value={formState.shortDescription}
                      onChange={handleFormChange}
                      required
                      maxLength={150}
                      className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 h-20"
                      placeholder="Summarize the service in a brief sentence for list cards..."
                    />
                    <div className="text-right text-xs text-gray-400 mt-1">
                      {formState.shortDescription.length}/150
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                      Full Description *
                    </label>
                    <textarea
                      name="description"
                      value={formState.description}
                      onChange={handleFormChange}
                      required
                      className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 h-32"
                      placeholder="Describe the service details, what is included, etc..."
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Pricing & Type */}
              {formActiveTab === 'pricing' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Base Price (₹) *
                      </label>
                      <input
                        type="number"
                        name="basePrice"
                        value={formState.basePrice}
                        onChange={handleFormChange}
                        required
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                        placeholder="e.g. 999"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Discount Price (₹)
                      </label>
                      <input
                        type="number"
                        name="discountPrice"
                        value={formState.discountPrice}
                        onChange={handleFormChange}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                        placeholder="Discounted price (optional)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Duration (hours) *
                      </label>
                      <input
                        type="number"
                        name="duration"
                        value={formState.duration}
                        onChange={handleFormChange}
                        required
                        min="0.25"
                        max="500"
                        step="0.25"
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                        placeholder="Enter duration in hours"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Service Type
                      </label>
                      <select
                        name="serviceType"
                        value={formState.serviceType}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                      >
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <label className="flex items-center space-x-3 cursor-pointer mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg w-full md:w-auto hover:bg-gray-150 transition-colors duration-250">
                      <input
                        type="checkbox"
                        name="isFeatured"
                        checked={formState.isFeatured}
                        onChange={(e) => setFormState(prev => ({ ...prev, isFeatured: e.target.checked }))}
                        className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <div>
                        <span className="text-sm font-medium text-secondary block">Feature on Homepage</span>
                        <span className="text-xs text-gray-500">Highlight this service on the customer home screen</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 3: Logistics & Add-ons */}
              {formActiveTab === 'additional' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Warranty Duration
                      </label>
                      <input
                        type="number"
                        value={formState.warranty.duration}
                        onChange={(e) => setFormState(prev => ({ ...prev, warranty: { ...prev.warranty, duration: e.target.value } }))}
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                        placeholder="e.g. 30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Warranty Unit
                      </label>
                      <select
                        value={formState.warranty.unit}
                        onChange={(e) => setFormState(prev => ({ ...prev, warranty: { ...prev.warranty, unit: e.target.value } }))}
                        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      >
                        <option value="days">Days</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Search Tags
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Add a search tag (e.g. best-seller)"
                        />
                        <button
                          type="button"
                          onClick={() => addToField('tags', newTag, setNewTag)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-850 transition-colors duration-200"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                        {formState.tags.length === 0 && (
                          <span className="text-xs text-gray-400 p-1">No tags added yet.</span>
                        )}
                        {formState.tags.map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-150">
                            #{tag}
                            <button
                              type="button"
                              onClick={() => removeFromField('tags', index)}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                        Prerequisites
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={newPrerequisite}
                          onChange={(e) => setNewPrerequisite(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="e.g. Accessible power supply"
                        />
                        <button
                          type="button"
                          onClick={() => addToField('prerequisites', newPrerequisite, setNewPrerequisite)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-855 transition-colors duration-200"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                        {formState.prerequisites.length === 0 && (
                          <span className="text-xs text-gray-400 p-1">No prerequisites added yet.</span>
                        )}
                        {formState.prerequisites.map((item, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-800 border border-purple-150">
                            {item}
                            <button
                              type="button"
                              onClick={() => removeFromField('prerequisites', index)}
                              className="ml-1 text-purple-600 hover:text-purple-800"
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
                          onClick={() => addToField('specialNotes', newSpecialNote, setNewSpecialNote)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-850 transition-colors duration-200"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                        {formState.specialNotes.length === 0 && (
                          <span className="text-xs text-gray-400 p-1">No special notes added yet.</span>
                        )}
                        {formState.specialNotes.map((note, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-150">
                            {note}
                            <button
                              type="button"
                              onClick={() => removeFromField('specialNotes', index)}
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
                          onClick={() => addToField('materialsUsed', newMaterial, setNewMaterial)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-850 transition-colors duration-200"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                        {formState.materialsUsed.length === 0 && (
                          <span className="text-xs text-gray-400 p-1">No materials listed yet.</span>
                        )}
                        {formState.materialsUsed.map((material, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-800 border border-orange-150">
                            {material}
                            <button
                              type="button"
                              onClick={() => removeFromField('materialsUsed', index)}
                              className="ml-1 text-orange-600 hover:text-orange-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: FAQs & Media */}
              {formActiveTab === 'faq_media' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Service FAQs
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      <input
                        type="text"
                        value={faqQuestion}
                        onChange={(e) => setFaqQuestion(e.target.value)}
                        placeholder="Enter FAQ Question"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
                      />
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={faqAnswer}
                          onChange={(e) => setFaqAnswer(e.target.value)}
                          placeholder="Enter FAQ Answer"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => addFaqToForm(faqQuestion, faqAnswer, setFaqQuestion, setFaqAnswer)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-850 transition-colors duration-200 text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {formState.faqs.length === 0 && (
                        <p className="text-xs text-gray-500 italic p-1">No FAQs added yet.</p>
                      )}
                      {formState.faqs.map((faq, index) => (
                        <div key={index} className="flex items-start justify-between bg-white p-3 rounded-lg border border-gray-200 text-sm shadow-sm">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-semibold text-secondary">Q: {faq.question}</p>
                            <p className="text-gray-650 mt-1">A: {faq.answer}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromField('faqs', index)}
                            className="text-red-500 hover:text-red-750 p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                      Service Images (Multiple)
                    </label>
                    <input
                      type="file"
                      name="images"
                      ref={fileInputRef}
                      onChange={handleFormChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    
                    <div 
                      className="border-2 border-dashed border-gray-300 hover:border-primary rounded-xl p-6 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer bg-gray-50 hover:bg-teal-50 group mb-3"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-10 h-10 text-gray-400 group-hover:text-primary mb-2 transition-colors duration-300" />
                      <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors duration-300">Click to upload service images</span>
                      <span className="text-xs text-gray-400 mt-1">Supports PNG, JPG, JPEG (Multiple files)</span>
                    </div>

                    {/* Show existing images in edit mode */}
                    {isEditMode && formState.existingImages && formState.existingImages.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-600 mb-2">Existing Images:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {formState.existingImages.map((image, index) => (
                            <div key={`existing-${index}`} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                              <img
                                src={image}
                                alt={`Existing ${index + 1}`}
                                className="h-20 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <button
                                type="button"
                                onClick={() => removeFormImage(index, true)}
                                className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-750 text-white rounded-full p-1 shadow-md hover:scale-110 transition-all duration-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Upload Previews */}
                    {formImagePreviews.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-650 mb-2">Selected New Images Preview:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {formImagePreviews.map((preview, index) => (
                            <div key={`new-${index}`} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-20 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <button
                                type="button"
                                onClick={() => removeFormImage(index, false)}
                                className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-750 text-white rounded-full p-1 shadow-md hover:scale-110 transition-all duration-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation and Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div>
                  {formActiveTab !== 'basic' && (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = ['basic', 'pricing', 'additional', 'faq_media'];
                        const idx = tabs.indexOf(formActiveTab);
                        setFormActiveTab(tabs[idx - 1]);
                      }}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      Previous
                    </button>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormModal(false);
                      resetFormState();
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>

                  {formActiveTab !== 'faq_media' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = ['basic', 'pricing', 'additional', 'faq_media'];
                        const idx = tabs.indexOf(formActiveTab);
                        setFormActiveTab(tabs[idx + 1]);
                      }}
                      className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-teal-850 transition-colors duration-200"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-teal-850 transition-colors duration-200 flex items-center"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isEditMode ? "Update Service" : "Create Service"}
                    </button>
                  )}
                </div>
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
              {/* Header Hero Section */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-gradient-to-r from-teal-50/50 to-blue-50/30 p-5 rounded-2xl border border-gray-100 shadow-sm animate-fadeIn">
                {selectedService.images && selectedService.images.length > 0 ? (
                  <div className="flex-shrink-0 relative overflow-hidden rounded-xl shadow-md group border border-white">
                    <img
                      className="h-28 w-28 md:h-36 md:w-36 rounded-xl object-cover transition-transform duration-500 group-hover:scale-110"
                      src={selectedService.images[0]}
                      alt={selectedService.title}
                      onError={(e) => {
                        e.target.src = '/default-service-placeholder.jpg';
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-28 w-28 md:h-36 md:w-36 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center shadow-md border border-white">
                    <ImageIcon className="w-12 h-12 md:w-16 md:h-16 text-teal-300 animate-pulseSlow" />
                  </div>
                )}
                <div className="flex-1 text-center md:text-left w-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <h3 className="text-2xl md:text-3xl font-extrabold text-secondary tracking-tight">{selectedService.title}</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm w-fit mx-auto md:mx-0 ${selectedService.isActive
                      ? 'bg-green-150 text-green-800 border border-green-200'
                      : 'bg-red-150 text-red-800 border border-red-200'
                      }`}>
                      {selectedService.isActive ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 mr-1 text-red-650" />
                          Inactive
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-1.5 mb-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-150">
                      {typeof selectedService.category === 'object' ? (selectedService.category.name || selectedService.category.label) : selectedService.category}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-150">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(selectedService.duration)}
                    </span>
                    {selectedService.serviceType && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${selectedService.serviceType === 'emergency' ? 'bg-red-50 text-red-700 border-red-150' :
                          selectedService.serviceType === 'premium' ? 'bg-purple-50 text-purple-700 border-purple-150' : 'bg-gray-50 text-gray-700 border-gray-150'
                        }`}>
                        {selectedService.serviceType.toUpperCase()}
                      </span>
                    )}
                    {selectedService.isFeatured && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-150">
                        ★ Featured
                      </span>
                    )}
                    {selectedService.warranty?.duration && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-150">
                        🛡️ {selectedService.warranty.duration} {selectedService.warranty.unit} Warranty
                      </span>
                    )}
                  </div>

                  {selectedService.shortDescription && (
                    <p className="text-sm italic text-gray-500 mb-2 border-l-2 border-gray-200 pl-3 py-1">
                      "{selectedService.shortDescription}"
                    </p>
                  )}
                </div>
              </div>

              {/* Tabs Section */}
              <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-none">
                {[
                  { id: 'overview', label: 'Overview', icon: FileText },
                  { id: 'logistics', label: 'Logistics & Add-ons', icon: Settings },
                  { id: 'gallery_faq', label: 'Gallery & FAQs', icon: ImageIcon },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = viewActiveTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setViewActiveTab(tab.id)}
                      className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-medium text-sm transition-all duration-300 ${
                        isActive
                          ? 'border-primary text-primary bg-teal-50 bg-opacity-40 rounded-t-lg font-semibold'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <TabIcon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content 1: Overview */}
              {viewActiveTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Primary Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 p-4 rounded-xl border border-teal-100 shadow-sm transition-all duration-300 hover:shadow">
                      <div className="flex items-center mb-1">
                        <DollarSign className="w-4 h-4 text-teal-600 mr-1.5" />
                        <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Base Price</span>
                      </div>
                      <p className="text-xl md:text-2xl font-black text-teal-900 leading-none">
                        {selectedService.discountPrice ? (
                          <div className="flex flex-col">
                            <span className="text-green-600 font-extrabold">{formatCurrency(selectedService.discountPrice)}</span>
                            <span className="text-xs line-through text-gray-450 font-normal mt-1">{formatCurrency(selectedService.basePrice)}</span>
                          </div>
                        ) : (
                          formatCurrency(selectedService.basePrice)
                        )}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-100 shadow-sm transition-all duration-300 hover:shadow">
                      <div className="flex items-center mb-1">
                        <Clock className="w-4 h-4 text-blue-600 mr-1.5" />
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Duration</span>
                      </div>
                      <p className="text-xl md:text-2xl font-black text-blue-900 leading-none">
                        {formatDuration(selectedService.duration)}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-xl border border-amber-100 shadow-sm transition-all duration-300 hover:shadow">
                      <div className="flex items-center mb-1">
                        <Star className="w-4 h-4 text-amber-600 mr-1.5" />
                        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Rating</span>
                      </div>
                      <div className="flex items-baseline">
                        <p className="text-xl md:text-2xl font-black text-amber-950 leading-none mr-1.5">
                          {selectedService.averageRating || 0}
                        </p>
                        <span className="text-xs text-amber-700 font-medium">({selectedService.ratingCount || 0} reviews)</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-100 shadow-sm transition-all duration-300 hover:shadow">
                      <div className="flex items-center mb-1">
                        <Users className="w-4 h-4 text-purple-600 mr-1.5" />
                        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Popularity</span>
                      </div>
                      <p className="text-xl md:text-2xl font-black text-purple-900 leading-none">
                        {selectedService.ratingCount || 0}
                      </p>
                    </div>
                  </div>

                  {/* Description Card */}
                  <div>
                    <h4 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wider">Full Description</h4>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-150 leading-relaxed whitespace-pre-line text-sm">
                      {selectedService.description}
                    </p>
                  </div>

                  {selectedService.tags && selectedService.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wider">Keywords & Tags</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedService.tags.map((tag, i) => (
                          <span key={i} className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-150 px-2.5 py-0.5 rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Logistics & Add-ons */}
              {viewActiveTab === 'logistics' && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Special Notes Section */}
                  {selectedService.specialNotes && parseArrayField(selectedService.specialNotes).length > 0 ? (
                    <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                      <h4 className="text-sm font-bold text-teal-800 mb-2 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1.5 text-teal-650" />
                        Special Service Notes
                      </h4>
                      <ul className="space-y-2 text-sm text-teal-905">
                        {parseArrayField(selectedService.specialNotes).map((note, index) => (
                          <li key={index} className="flex items-start">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 mr-2.5 flex-shrink-0"></span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">No special notes for this service.</div>
                  )}

                  {/* Materials Used Section */}
                  {selectedService.materialsUsed && parseArrayField(selectedService.materialsUsed).length > 0 && (
                    <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                      <h4 className="text-sm font-bold text-orange-800 mb-2.5 flex items-center">
                        <Package className="w-4 h-4 mr-1.5 text-orange-600" />
                        Required Materials
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {parseArrayField(selectedService.materialsUsed).map((material, index) => (
                          <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white text-orange-850 border border-orange-200 shadow-sm">
                            {material}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prerequisites Section */}
                  {selectedService.prerequisites && parseArrayField(selectedService.prerequisites).length > 0 && (
                    <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                      <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1.5 text-purple-650" />
                        Prerequisites & Preparation Needed
                      </h4>
                      <ul className="space-y-2 text-sm text-purple-905">
                        {parseArrayField(selectedService.prerequisites).map((item, index) => (
                          <li key={index} className="flex items-start">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 mr-2.5 flex-shrink-0"></span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 3: Gallery & FAQs */}
              {viewActiveTab === 'gallery_faq' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Images Section */}
                  {selectedService.images && selectedService.images.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-wider flex items-center">
                        <ImageIcon className="w-4 h-4 mr-1.5 text-primary" />
                        Service Photo Gallery
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedService.images.map((img, index) => (
                          <div key={index} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                            <img
                              src={img}
                              alt={`Service image ${index + 1}`}
                              className="h-24 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              onError={(e) => {
                                e.target.src = '/default-service-placeholder.jpg';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FAQs Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-wider flex items-center">
                      <FileText className="w-4 h-4 mr-1.5 text-primary" />
                      Frequently Asked Questions
                    </h4>
                    {selectedService.faqs && selectedService.faqs.length > 0 ? (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {selectedService.faqs.map((faq, index) => (
                          <details 
                            key={index}
                            className="group border border-gray-200 rounded-xl p-3 bg-white hover:bg-gray-50/55 transition-all duration-300"
                          >
                            <summary className="font-semibold text-secondary text-sm flex items-center justify-between cursor-pointer list-none select-none">
                              <span>{faq.question}</span>
                              <span className="transition-transform duration-300 group-open:rotate-180 text-gray-400 text-xs">▼</span>
                            </summary>
                            <p className="text-gray-600 mt-2 pl-4 border-l-2 border-primary/40 leading-relaxed text-sm animate-fadeIn">
                              {faq.answer}
                            </p>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No FAQs available for this service.</div>
                    )}
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
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center text-primary hover:text-teal-700 text-sm font-medium underline transition-all duration-200"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Excel Format Requirements (Template)
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Please use the template above for best results.
                </p>
              </div>

              <div className="bg-blue-50 p-3 md:p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Excel Format Requirements:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li><strong>Service Title*</strong>: Max 100 characters</li>
                  <li><strong>Category Name*</strong>: Must exist in system (e.g., Electrical, AC)</li>
                  <li><strong>Description*</strong>: Max 500 characters</li>
                  <li><strong>Base Price*</strong>: Numeric value</li>
                  <li><strong>Duration*</strong>: Decimal hours (e.g., 1.5)</li>
                  <li><strong>Special Notes</strong>: Comma separated values</li>
                  <li><strong>Materials</strong>: Comma separated values</li>
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

        {/* Disable Discounts Modal */}
        {showDisableDiscountsModal && (
          <Modal
            isOpen={showDisableDiscountsModal}
            onClose={() => {
              setShowDisableDiscountsModal(false);
              setDisableDiscountsCategory('');
            }}
            title="Bulk Deactivate Discounts"
            size="medium"
          >
            <form onSubmit={handleDisableDiscountsSubmit} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                  Select Scope
                </label>
                <select
                  value={disableDiscountsScope}
                  onChange={(e) => setDisableDiscountsScope(e.target.value)}
                  className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Services</option>
                  <option value="category">Category-wise</option>
                </select>
              </div>

              {disableDiscountsScope === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Select Category
                  </label>
                  <select
                    value={disableDiscountsCategory}
                    onChange={(e) => setDisableDiscountsCategory(e.target.value)}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="" disabled hidden>Choose Category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-red-50 p-3 md:p-4 rounded-lg border border-red-200">
                <p className="text-sm text-red-700 font-semibold flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-red-600 flex-shrink-0" />
                  Warning: This action will permanently remove/deactivate the discount prices for all matching services. This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableDiscountsModal(false);
                    setDisableDiscountsCategory('');
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisablingDiscounts}
                  className="px-4 py-2 bg-red-600 hover:bg-red-800 text-white rounded-lg transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDisablingDiscounts ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 " />
                      Deactivating...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Confirm Deactivate
                    </>
                  )}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

// Category Select Component
const CategorySelect = React.memo(({ value, onChange, label, required, includeAll = false, categories }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
        {label} {required && '*'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="" disabled hidden>Select Category</option>
        {includeAll && <option value="">All Categories</option>}
        {categories.map(category => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
});

// Reusable Modal Component
const Modal = React.memo(({ isOpen, onClose, title, children, size = 'medium' }) => {
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
});

export default AdminServices;