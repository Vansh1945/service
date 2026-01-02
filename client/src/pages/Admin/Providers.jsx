import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Award,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  Image,
  File,
  Briefcase,
  Home,
  CreditCard,
  AlertCircle,
  Filter,
  ArrowUpDown,
  FileText,
  Building,
  Hash,
  CheckSquare,
  XSquare,
  Plus,
  TrendingUp,
  UserCheck,
  UserPlus,
  Clock as ClockIcon,
  Loader
} from 'lucide-react';
import { useAuth } from '../../store/auth';
import LoadingSpinner from '../../components/Loader';

const AdminProvidersPage = () => {
  const { API, showToast } = useAuth();
  const [allProviders, setAllProviders] = useState([]);
  const [pendingProviders, setPendingProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalConfirmation, setApprovalConfirmation] = useState('');
  const [processingAction, setProcessingAction] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [documentView, setDocumentView] = useState({
    visible: false,
    type: '',
    url: ''
  });

  // Advanced Filters
  const [filters, setFilters] = useState({
    services: '',
    city: '',
    state: '',
    experience: '',
    age: '',
    testPassed: '',
    profileComplete: '',
    bankVerified: '',
    minDaysPending: '',
    maxDaysPending: '',
    hasResume: '',
    hasPassbook: ''
  });

  const [sortBy, setSortBy] = useState('registrationDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Stats
  const [stats, setStats] = useState({
    totalProviders: 0,
    pendingApproval: 0,
    todayRegistered: 0,
    todayApproved: 0,
    withResume: 0,
    withBankDetails: 0,
    profileComplete: 0,
    testPassed: 0,
    avgDaysPending: 0
  });

  // Memoized provider status calculation
  const getProviderStatus = useCallback((provider) => {
    if (provider.approved) return 'approved';
    if (provider.kycStatus === 'rejected') return 'rejected';
    return 'pending';
  }, []);

  // Memoized days pending calculation
  const getDaysPending = useCallback((registrationDate) => {
    const created = new Date(registrationDate);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  // Optimized data fetching
  useEffect(() => {
    fetchProviders();
  }, []);

  // Memoized provider filtering
  useEffect(() => {
    const pendingOnly = allProviders.filter(provider => !provider.approved && provider.kycStatus !== 'rejected');
    setPendingProviders(pendingOnly);
  }, [allProviders]);

  // Optimized filtering and sorting
  useEffect(() => {
    applyFiltersAndSearch();
  }, [searchTerm, filters, sortBy, sortOrder, pendingProviders]);

  // Stats calculation
  useEffect(() => {
    calculateStats();
  }, [filteredProviders, allProviders, getDaysPending]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API}/admin/providers/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.success) {
        setAllProviders(data.providers || []);
      } else {
        showToast('Failed to fetch providers', 'error');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showToast('Request timeout. Please try again.', 'error');
      } else {
        console.error('Error fetching providers:', error);
        showToast('Failed to fetch providers', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = useCallback(() => {
    const total = allProviders.length;
    const pending = allProviders.filter(p => !p.approved && p.kycStatus !== 'rejected').length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayRegistered = allProviders.filter(p => {
      const regDate = new Date(p.registrationDate || p.createdAt).toISOString().split('T')[0];
      return regDate === today;
    }).length;
    
    const todayApproved = allProviders.filter(p => {
      if (p.approved && p.approvalDate) {
        const approvalDate = new Date(p.approvalDate).toISOString().split('T')[0];
        return approvalDate === today;
      }
      return false;
    }).length;
    
    const withResume = allProviders.filter(p => p.resume).length;
    const withBankDetails = allProviders.filter(p => p.bankDetails?.accountNo).length;
    const profileComplete = allProviders.filter(p => p.profileComplete).length;
    const testPassed = allProviders.filter(p => p.testPassed).length;
    
    let totalDays = 0;
    const pendingProviders = allProviders.filter(p => !p.approved && p.kycStatus !== 'rejected');
    pendingProviders.forEach(provider => {
      totalDays += getDaysPending(provider.registrationDate || provider.createdAt);
    });
    
    setStats({
      totalProviders: total,
      pendingApproval: pending,
      todayRegistered,
      todayApproved,
      withResume,
      withBankDetails,
      profileComplete,
      testPassed,
      avgDaysPending: pending > 0 ? Math.round(totalDays / pending) : 0
    });
  }, [allProviders, getDaysPending]);

  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...pendingProviders];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(provider => {
        return (
          provider.name?.toLowerCase().includes(search) ||
          provider.email?.toLowerCase().includes(search) ||
          provider.phone?.includes(search) ||
          provider.services?.some(s => s.toLowerCase().includes(search)) ||
          provider.serviceArea?.toLowerCase().includes(search) ||
          (provider.address?.city?.toLowerCase().includes(search)) ||
          (provider.address?.state?.toLowerCase().includes(search)) ||
          (provider.address?.street?.toLowerCase().includes(search)) ||
          (provider.bankDetails?.accountNo?.includes(search)) ||
          (provider.bankDetails?.ifsc?.includes(search)) ||
          (provider.bankDetails?.bankName?.toLowerCase().includes(search))
        );
      });
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      switch(key) {
        case 'services':
          filtered = filtered.filter(p => 
            p.services?.some(s => s.toLowerCase().includes(value.toLowerCase()))
          );
          break;
        case 'city':
          filtered = filtered.filter(p => 
            (p.address?.city?.toLowerCase().includes(value.toLowerCase())) ||
            (p.serviceArea?.toLowerCase().includes(value.toLowerCase()))
          );
          break;
        case 'state':
          filtered = filtered.filter(p => 
            p.address?.state?.toLowerCase().includes(value.toLowerCase())
          );
          break;
        case 'experience':
          filtered = filtered.filter(p => p.experience >= parseInt(value));
          break;
        case 'age':
          filtered = filtered.filter(p => p.age >= parseInt(value));
          break;
        case 'testPassed':
          filtered = filtered.filter(p => p.testPassed === (value === 'true'));
          break;
        case 'profileComplete':
          filtered = filtered.filter(p => p.profileComplete === (value === 'true'));
          break;
        case 'bankVerified':
          filtered = filtered.filter(p => p.bankDetails?.verified === (value === 'true'));
          break;
        case 'hasResume':
          filtered = filtered.filter(p => !!p.resume === (value === 'true'));
          break;
        case 'hasPassbook':
          filtered = filtered.filter(p => !!p.bankDetails?.passbookImage === (value === 'true'));
          break;
        case 'minDaysPending':
        case 'maxDaysPending':
          const min = filters.minDaysPending ? parseInt(filters.minDaysPending) : 0;
          const max = filters.maxDaysPending ? parseInt(filters.maxDaysPending) : Infinity;
          filtered = filtered.filter(p => {
            const days = getDaysPending(p.registrationDate || p.createdAt);
            return days >= min && days <= max;
          });
          break;
      }
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch(sortBy) {
        case 'name':
          compareValue = (a.name || '').localeCompare(b.name || '');
          break;
        case 'email':
          compareValue = (a.email || '').localeCompare(b.email || '');
          break;
        case 'registrationDate':
          compareValue = new Date(a.registrationDate || a.createdAt) - new Date(b.registrationDate || b.createdAt);
          break;
        case 'experience':
          compareValue = (a.experience || 0) - (b.experience || 0);
          break;
        case 'age':
          compareValue = (a.age || 0) - (b.age || 0);
          break;
        case 'daysPending':
          compareValue = getDaysPending(a.registrationDate || a.createdAt) - getDaysPending(b.registrationDate || b.createdAt);
          break;
        default:
          compareValue = 0;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    setFilteredProviders(filtered);
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy, sortOrder, pendingProviders, getDaysPending]);

  const clearFilters = () => {
    setFilters({
      services: '',
      city: '',
      state: '',
      experience: '',
      age: '',
      testPassed: '',
      profileComplete: '',
      bankVerified: '',
      minDaysPending: '',
      maxDaysPending: '',
      hasResume: '',
      hasPassbook: ''
    });
    setSearchTerm('');
  };

  const fetchProviderDetails = async (providerId) => {
    try {
      const response = await fetch(`${API}/admin/providers/${providerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSelectedProvider(data.provider);
      } else {
        showToast('Failed to fetch provider details', 'error');
      }
    } catch (error) {
      console.error('Error fetching provider details:', error);
      showToast('Failed to fetch provider details', 'error');
    }
  };



  const openApprovalModal = (action, provider) => {
    setSelectedProvider(provider);
    setApprovalAction(action);
    setApprovalRemarks('');
    setApprovalConfirmation('');
    setShowApprovalModal(true);
  };

  const closeModal = () => {
    setSelectedProvider(null);
    setApprovalRemarks('');
    setApprovalConfirmation('');
    setShowApprovalModal(false);
  };

  const handleRemarksChange = (e) => {
    setApprovalRemarks(e.target.value);
  };

  const handleModalConfirm = async () => {
    if (!selectedProvider || !approvalAction) return;

    if (approvalAction === 'rejected' && !approvalRemarks.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    if (approvalAction === 'approved' && approvalConfirmation !== 'APPROVE') {
      showToast('Please type "APPROVE" to confirm', 'error');
      return;
    }

    if (approvalAction === 'rejected' && approvalConfirmation !== 'REJECT') {
      showToast('Please type "REJECT" to confirm', 'error');
      return;
    }

    try {
      setProcessingAction(approvalAction);

      const response = await fetch(`${API}/admin/providers/${selectedProvider._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: approvalAction,
          remarks: approvalRemarks
        })
      });

      const data = await response.json();

      if (data.success) {
        showToast(`Provider ${approvalAction} successfully`, 'success');
        // Refresh the providers list
        fetchProviders();
        // Close modal and reset states
        setShowApprovalModal(false);
        setSelectedProvider(null);
        setApprovalRemarks('');
        setApprovalConfirmation('');
      } else {
        showToast(data.message || 'Failed to update provider status', 'error');
      }
    } catch (error) {
      console.error('Error updating provider status:', error);
      showToast('Failed to update provider status', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleModalCancel = () => {
    setShowApprovalModal(false);
    setApprovalRemarks('');
    setApprovalConfirmation('');
  };

  const viewDocument = (provider, docType) => {
    let url = '';
    let type = '';
    
    switch(docType) {
      case 'profile':
        url = provider.profilePicUrl;
        type = 'image';
        break;
      case 'resume':
        url = provider.resume;
        type = 'document';
        break;
      case 'passbook':
        url = provider.bankDetails?.passbookImage;
        type = 'image';
        break;
    }

    if (url && url !== 'default-provider.jpg') {
      setDocumentView({
        visible: true,
        type: type,
        url: url
      });
    } else {
      showToast('Document not available', 'info');
    }
  };

  const closeDocumentView = () => {
    setDocumentView({
      visible: false,
      type: '',
      url: ''
    });
  };

  // Pagination
  const totalPages = Math.ceil(filteredProviders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProviders = filteredProviders.slice(startIndex, endIndex);

  // Optimized Table Row Component
  const ProviderTableRow = React.memo(({ provider, onViewDetails, onApprove, onReject }) => {
    const daysPending = getDaysPending(provider.registrationDate || provider.createdAt);
    const status = getProviderStatus(provider);
    
    return (
      <tr className="border-b border-gray-200 hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-white transition-all duration-200 group">
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
              {provider.profilePicUrl && provider.profilePicUrl !== 'default-provider.jpg' ? (
                <img 
                  src={provider.profilePicUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <div className="font-semibold text-secondary group-hover:text-primary transition-colors">{provider.name}</div>
              <div className="text-xs text-gray-500 flex items-center mt-1">
                <Mail className="w-3 h-3 mr-1" />
                {provider.email}
              </div>
            </div>
          </div>
        </td>
        <td className="p-4">
          <div className="text-sm text-gray-900 font-medium">{provider.phone}</div>
        </td>
        <td className="p-4">
          <div className="text-sm text-gray-900 flex items-center">
            <MapPin className="w-3 h-3 mr-1 text-primary" />
            {provider.serviceArea || (provider.address?.city || 'N/A')}
          </div>
        </td>
        <td className="p-4">
          <div className="text-sm text-gray-900">
            {provider.services?.slice(0, 2).join(', ')}
            {provider.services?.length > 2 && '...'}
          </div>
        </td>
        <td className="p-4">
          <div className="text-sm text-gray-900 font-medium">{provider.experience || '0'} yrs</div>
        </td>
        <td className="p-4">
          <div className="text-sm text-gray-900">
            {new Date(provider.createdAt || provider.registrationDate).toLocaleDateString()}
          </div>
        </td>
        <td className="p-4">
          <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            daysPending > 7 ? 'bg-accent text-white shadow-sm' : 'bg-yellow-100 text-yellow-800'
          }`}>
            <Clock className="w-3 h-3 mr-1" />
            {daysPending} days
          </div>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg transition-colors ${provider.resume ? 'text-green-600 bg-green-50 border border-green-200' : 'text-gray-400 bg-gray-100'}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className={`p-2 rounded-lg transition-colors ${provider.bankDetails?.passbookImage ? 'text-green-600 bg-green-50 border border-green-200' : 'text-gray-400 bg-gray-100'}`}>
              <FileImage className="w-4 h-4" />
            </div>
            <div className={`p-2 rounded-lg transition-colors ${provider.bankDetails?.verified ? 'text-green-600 bg-green-50 border border-green-200' : 'text-gray-400 bg-gray-100'}`}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDetails(provider._id)}
              className="p-2 bg-gradient-to-r from-primary to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-primary transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onApprove(provider)}
              className="p-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
              title="Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReject(provider)}
              className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
              title="Reject"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  });


  // Document View Modal
  const DocumentViewModal = React.memo(() => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <h3 className="text-lg font-semibold text-secondary">
            {documentView.type === 'image' ? 'Image Preview' : 'Document View'}
          </h3>
          <button
            onClick={closeDocumentView}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center bg-gray-50 min-h-[400px]">
          {documentView.type === 'image' ? (
            <img 
              src={documentView.url} 
              alt="Document" 
              className="max-w-full max-h-[calc(90vh-100px)] object-contain rounded-lg shadow-sm"
            />
          ) : (
            <iframe 
              src={documentView.url} 
              className="w-full h-[calc(90vh-100px)] min-h-[400px] border-0 bg-white rounded-lg shadow-sm"
              title="Document"
            />
          )}
        </div>
      </div>
    </div>
  ));

  // Provider Details Modal Component
  const ProviderDetailsModal = () => {
    if (!selectedProvider) return null;
    const status = getProviderStatus(selectedProvider);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-secondary">Provider Details</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 mb-8 pb-6 border-b">
              <div className="w-24 h-24 bg-gradient-to-r from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                {selectedProvider.profilePicUrl && selectedProvider.profilePicUrl !== 'default-provider.jpg' ? (
                  <img 
                    src={selectedProvider.profilePicUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-2xl font-bold text-secondary">{selectedProvider.name}</h3>
                <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 text-gray-600">
                  <span className="flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    {selectedProvider.email}
                  </span>
                  <span className="flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    {selectedProvider.phone}
                  </span>
                </div>
              </div>
              <div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  status === 'approved' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : status === 'rejected'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                }`}>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl p-5 border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold mb-4 text-secondary flex items-center">
                  <User className="w-5 h-5 mr-2 text-primary" />
                  Personal Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-teal-50">
                    <span className="text-sm text-gray-600">Date of Birth</span>
                    <span className="font-medium text-secondary">
                      {selectedProvider.dateOfBirth ? new Date(selectedProvider.dateOfBirth).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-teal-50">
                    <span className="text-sm text-gray-600">Age</span>
                    <span className="font-medium text-secondary">{selectedProvider.age || 'N/A'} years</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-teal-50">
                    <span className="text-sm text-gray-600">Registration Date</span>
                    <span className="font-medium text-secondary">
                      {new Date(selectedProvider.registrationDate || selectedProvider.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Profile Complete</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedProvider.profileComplete 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedProvider.profileComplete ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl p-5 border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold mb-4 text-secondary flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-primary" />
                  Professional Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Services</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedProvider.services?.map((service, index) => (
                        <span key={index} className="px-3 py-1 bg-gradient-to-r from-primary to-teal-600 text-white rounded-full text-xs font-medium">
                          {service.name || service}
                        </span>
                      )) || <span className="text-secondary text-sm">N/A</span>}
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-teal-50">
                    <span className="text-sm text-gray-600">Experience</span>
                    <span className="font-medium text-secondary">{selectedProvider.experience || '0'} years</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-teal-50">
                    <span className="text-sm text-gray-600">Service Area</span>
                    <span className="font-medium text-secondary">{selectedProvider.serviceArea || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Test Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedProvider.testPassed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedProvider.testPassed ? 'Passed' : 'Not Taken'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl p-5 border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold mb-4 text-secondary flex items-center">
                  <Home className="w-5 h-5 mr-2 text-primary" />
                  Address Information
                </h3>
                <div className="space-y-3">
                  {selectedProvider.address ? (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-teal-50">
                        <span className="text-sm text-gray-600">Street</span>
                        <span className="font-medium text-secondary text-right">{selectedProvider.address.street || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-teal-50">
                        <span className="text-sm text-gray-600">City</span>
                        <span className="font-medium text-secondary">{selectedProvider.address.city || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-teal-50">
                        <span className="text-sm text-gray-600">State</span>
                        <span className="font-medium text-secondary">{selectedProvider.address.state || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-600">Postal Code</span>
                        <span className="font-medium text-secondary">{selectedProvider.address.postalCode || 'N/A'}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Address not provided</p>
                  )}
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl p-5 border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold mb-4 text-secondary flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-primary" />
                  Bank Details
                </h3>
                <div className="space-y-3">
                  {selectedProvider.bankDetails ? (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-teal-50">
                        <span className="text-sm text-gray-600">Account Number</span>
                        <span className="font-medium text-secondary font-mono">
                          {selectedProvider.bankDetails.accountNo || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-teal-50">
                        <span className="text-sm text-gray-600">IFSC Code</span>
                        <span className="font-medium text-secondary font-mono">
                          {selectedProvider.bankDetails.ifsc || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-teal-50">
                        <span className="text-sm text-gray-600">Bank Name</span>
                        <span className="font-medium text-secondary">
                          {selectedProvider.bankDetails.bankName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-600">Verification Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          selectedProvider.bankDetails.verified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedProvider.bankDetails.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Bank details not provided</p>
                  )}
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="mt-8 bg-gradient-to-br from-teal-50 to-white rounded-xl p-6 border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-6 text-secondary">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Picture */}
                <div className="bg-white p-4 rounded-lg border border-teal-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-4">
                    <Image className="w-5 h-5 mr-2 text-primary" />
                    <span className="font-semibold text-secondary">Profile Picture</span>
                  </div>
                  {selectedProvider.profilePicUrl && selectedProvider.profilePicUrl !== 'default-provider.jpg' ? (
                    <>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 border border-teal-100">
                        <img 
                          src={selectedProvider.profilePicUrl} 
                          alt="Profile" 
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                          onClick={() => viewDocument(selectedProvider, 'profile')}
                        />
                      </div>
                      <button
                        onClick={() => viewDocument(selectedProvider, 'profile')}
                        className="w-full py-2 bg-gradient-to-r from-primary to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-primary transition-all duration-200 font-medium"
                      >
                        View Full Size
                      </button>
                    </>
                  ) : (
                    <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                      <p className="text-gray-400">Not uploaded</p>
                    </div>
                  )}
                </div>

                {/* Resume */}
                <div className="bg-white p-4 rounded-lg border border-teal-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-4">
                    <FileText className="w-5 h-5 mr-2 text-primary" />
                    <span className="font-semibold text-secondary">Resume/CV</span>
                  </div>
                  {selectedProvider.resume ? (
                    <>
                      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4 cursor-pointer hover:bg-gray-200 transition-colors border border-teal-100"
                           onClick={() => viewDocument(selectedProvider, 'resume')}>
                        <FileText className="w-12 h-12 text-primary" />
                      </div>
                      <button
                        onClick={() => viewDocument(selectedProvider, 'resume')}
                        className="w-full py-2 bg-gradient-to-r from-primary to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-primary transition-all duration-200 font-medium"
                      >
                        View Document
                      </button>
                    </>
                  ) : (
                    <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                      <p className="text-gray-400">Not uploaded</p>
                    </div>
                  )}
                </div>

                {/* Passbook */}
                <div className="bg-white p-4 rounded-lg border border-teal-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-4">
                    <FileImage className="w-5 h-5 mr-2 text-primary" />
                    <span className="font-semibold text-secondary">Bank Passbook</span>
                  </div>
                  {selectedProvider.bankDetails?.passbookImage ? (
                    <>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 border border-teal-100">
                        <img 
                          src={selectedProvider.bankDetails.passbookImage} 
                          alt="Passbook" 
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                          onClick={() => viewDocument(selectedProvider, 'passbook')}
                        />
                      </div>
                      <button
                        onClick={() => viewDocument(selectedProvider, 'passbook')}
                        className="w-full py-2 bg-gradient-to-r from-primary to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-primary transition-all duration-200 font-medium"
                      >
                        View Full Size
                      </button>
                    </>
                  ) : (
                    <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                      <p className="text-gray-400">Not uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {status === 'pending' && (
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => openApprovalModal('approved', selectedProvider)}
                  className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md font-semibold"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Approve Provider
                </button>
                <button
                  onClick={() => openApprovalModal('rejected', selectedProvider)}
                  className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md font-semibold"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject Provider
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Pagination = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
      <div className="text-sm text-gray-600">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredProviders.length)} of {filteredProviders.length} providers
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </button>
        
        <div className="flex items-center gap-1">
          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index + 1}
              onClick={() => setCurrentPage(index + 1)}
              className={`px-3 py-2 rounded-lg transition-all duration-200 font-medium ${
                currentPage === index + 1
                  ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );

  const FilterSection = () => (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-secondary flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Advanced Filters
        </h3>
        <div className="flex gap-2">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium"
          >
            Clear All
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {showFilters ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            { key: 'services', label: 'Services', placeholder: 'e.g., Cleaning', type: 'text' },
            { key: 'city', label: 'City', placeholder: 'Filter by city', type: 'text' },
            { key: 'state', label: 'State', placeholder: 'Filter by state', type: 'text' },
            { key: 'experience', label: 'Min Experience', placeholder: 'Years', type: 'number' },
            { key: 'age', label: 'Min Age', placeholder: 'Age', type: 'number' },
            { key: 'testPassed', label: 'Test Status', type: 'select', options: ['All', 'Passed', 'Not Passed'] },
            { key: 'profileComplete', label: 'Profile Status', type: 'select', options: ['All', 'Complete', 'Incomplete'] },
            { key: 'bankVerified', label: 'Bank Verification', type: 'select', options: ['All', 'Verified', 'Not Verified'] },
            { key: 'hasResume', label: 'Has Resume', type: 'select', options: ['All', 'Yes', 'No'] },
            { key: 'hasPassbook', label: 'Has Passbook', type: 'select', options: ['All', 'Yes', 'No'] },
            { key: 'minDaysPending', label: 'Min Days Pending', placeholder: 'Days', type: 'number' },
            { key: 'maxDaysPending', label: 'Max Days Pending', placeholder: 'Days', type: 'number' },
          ].map(({ key, label, placeholder, type, options }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              {type === 'select' ? (
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters({...filters, [key]: e.target.value.toLowerCase()})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                >
                  {options.map(option => (
                    <option key={option} value={option === 'All' ? '' : option.toLowerCase()}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={type}
                  value={filters[key]}
                  onChange={(e) => setFilters({...filters, [key]: e.target.value})}
                  placeholder={placeholder}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary mb-2">Pending Providers</h1>
          <p className="text-gray-600">Review and approve provider registrations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Providers', value: stats.totalProviders, icon: Users, color: 'primary', border: 'primary' },
            { label: 'Pending Approval', value: stats.pendingApproval, icon: ClockIcon, color: 'yellow', border: 'yellow' },
            { label: 'Today Registered', value: stats.todayRegistered, icon: UserPlus, color: 'blue', border: 'blue' },
            { label: 'Today Approved', value: stats.todayApproved, icon: UserCheck, color: 'green', border: 'green' },
          ].map(({ label, value, icon: Icon, color, border }) => (
            <div key={label} className={`bg-white rounded-xl shadow-lg p-6 border-l-4 border-${border}-500 hover:shadow-xl transition-shadow duration-300`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{label}</p>
                  <p className="text-3xl font-bold text-secondary">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-100 rounded-full`}>
                  <Icon className={`w-6 h-6 text-${color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'With Resume', value: stats.withResume, color: 'primary' },
            { label: 'Bank Details', value: stats.withBankDetails, color: 'green' },
            { label: 'Profile Complete', value: stats.profileComplete, color: 'blue' },
            { label: 'Test Passed', value: stats.testPassed, color: 'indigo' },
            { label: 'Avg Days Pending', value: stats.avgDaysPending, color: 'purple' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 text-center hover:shadow-xl transition-shadow duration-300">
              <p className="text-sm text-gray-600 mb-1">{label}</p>
              <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mb-6 hover:shadow-xl transition-shadow duration-300">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, phone, services, area, bank details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {/* Filters and Sorting */}
        <FilterSection />

        {/* Content */}
        {loading ? (
          <LoadingSpinner />
        ) : filteredProviders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center hover:shadow-xl transition-shadow duration-300">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Pending Providers</h3>
            <p className="text-gray-600">
              {searchTerm || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search or filters'
                : 'No pending providers at the moment.'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-primary to-teal-600">
                    <tr>
                      {['Provider', 'Phone', 'Location', 'Services', 'Experience', 'Registered', 'Days Pending', 'Documents', 'Actions'].map((header) => (
                        <th key={header} className="p-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentProviders.map(provider => (
                      <ProviderTableRow 
                        key={provider._id} 
                        provider={provider}
                        onViewDetails={fetchProviderDetails}
                        onApprove={openApprovalModal.bind(null, 'approved')}
                        onReject={openApprovalModal.bind(null, 'rejected')}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && <Pagination />}
          </>
        )}

        {/* Modals */}
        {selectedProvider && !showApprovalModal && <ProviderDetailsModal />}
        <ApprovalModal
          show={showApprovalModal}
          action={approvalAction}
          providerName={selectedProvider?.name}
          remarks={approvalRemarks}
          onRemarksChange={handleRemarksChange}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          processing={processingAction === approvalAction}
          confirmation={approvalConfirmation}
          onConfirmationChange={setApprovalConfirmation}
        />
        {documentView.visible && <DocumentViewModal />}
      </div>
    </div>
  );
};

// Approval Modal Component
const ApprovalModal = ({
  show,
  action,
  providerName,
  remarks,
  onRemarksChange,
  onConfirm,
  onCancel,
  processing,
  confirmation,
  onConfirmationChange
}) => {
  if (!show) return null;

  const isApprove = action === 'approved';
  const isReject = action === 'rejected';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            {isApprove ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            )}
          </div>

          <h3 className="text-xl font-bold text-center text-secondary mb-2">
            {isApprove ? 'Approve Provider' : 'Reject Provider'}
          </h3>

          <p className="text-center text-gray-600 mb-6">
            Are you sure you want to {isApprove ? 'approve' : 'reject'} <strong>{providerName}</strong>?
          </p>

          {isReject && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={remarks}
                onChange={onRemarksChange}
                placeholder="Please provide a reason for rejection..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 resize-none"
                rows={3}
                required
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <strong>{isApprove ? 'APPROVE' : 'REJECT'}</strong> to confirm
            </label>
            <textarea
              type="text"
              value={confirmation}
              onChange={(e) => onConfirmationChange(e.target.value)}
              placeholder={isApprove ? 'APPROVE' : 'REJECT'}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-mono "
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={processing}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing || (isApprove && confirmation !== 'APPROVE') || (isReject && confirmation !== 'REJECT')}
              className={`flex-1 px-4 py-3 text-white rounded-lg transition-all duration-200 font-semibold ${
                isApprove
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50'
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50'
              } disabled:cursor-not-allowed`}
            >
              {processing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                isApprove ? 'Approve' : 'Reject'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProvidersPage;
