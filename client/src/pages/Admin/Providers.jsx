import React, { useState, useEffect } from 'react';
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
  Clock as ClockIcon
} from 'lucide-react';
import { useAuth } from '../../store/auth';

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

  // Determine provider status based on backend fields
  const getProviderStatus = (provider) => {
    if (provider.approved) return 'approved';
    if (provider.kycStatus === 'rejected') return 'rejected';
    return 'pending';
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    // Filter only pending providers using the correct logic
    const pendingOnly = allProviders.filter(provider => !provider.approved && provider.kycStatus !== 'rejected');
    setPendingProviders(pendingOnly);
    setFilteredProviders(pendingOnly);
  }, [allProviders]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [searchTerm, filters, sortBy, sortOrder, pendingProviders]);

  useEffect(() => {
    calculateStats();
  }, [filteredProviders, allProviders]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/admin/providers/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setAllProviders(data.providers || []);
      } else {
        showToast('Failed to fetch providers', 'error');
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      showToast('Failed to fetch providers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
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
  };

  const getDaysPending = (registrationDate) => {
    const created = new Date(registrationDate);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...pendingProviders];

    // Search filter - search across multiple fields
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

    // Apply individual filters
    if (filters.services) {
      filtered = filtered.filter(p => 
        p.services?.some(s => s.toLowerCase().includes(filters.services.toLowerCase()))
      );
    }

    if (filters.city) {
      filtered = filtered.filter(p => 
        (p.address?.city?.toLowerCase().includes(filters.city.toLowerCase())) ||
        (p.serviceArea?.toLowerCase().includes(filters.city.toLowerCase()))
      );
    }

    if (filters.state) {
      filtered = filtered.filter(p => 
        p.address?.state?.toLowerCase().includes(filters.state.toLowerCase())
      );
    }

    if (filters.experience) {
      const exp = parseInt(filters.experience);
      filtered = filtered.filter(p => p.experience >= exp);
    }

    if (filters.age) {
      const age = parseInt(filters.age);
      filtered = filtered.filter(p => p.age >= age);
    }

    if (filters.testPassed !== '') {
      filtered = filtered.filter(p => p.testPassed === (filters.testPassed === 'true'));
    }

    if (filters.profileComplete !== '') {
      filtered = filtered.filter(p => p.profileComplete === (filters.profileComplete === 'true'));
    }

    if (filters.bankVerified !== '') {
      filtered = filtered.filter(p => p.bankDetails?.verified === (filters.bankVerified === 'true'));
    }

    if (filters.hasResume !== '') {
      filtered = filtered.filter(p => {
        const hasResume = !!p.resume;
        return hasResume === (filters.hasResume === 'true');
      });
    }

    if (filters.hasPassbook !== '') {
      filtered = filtered.filter(p => {
        const hasPassbook = !!p.bankDetails?.passbookImage;
        return hasPassbook === (filters.hasPassbook === 'true');
      });
    }

    // Days pending filter
    if (filters.minDaysPending || filters.maxDaysPending) {
      filtered = filtered.filter(p => {
        const days = getDaysPending(p.registrationDate || p.createdAt);
        const min = filters.minDaysPending ? parseInt(filters.minDaysPending) : 0;
        const max = filters.maxDaysPending ? parseInt(filters.maxDaysPending) : Infinity;
        return days >= min && days <= max;
      });
    }

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
  };

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

  const handleApproveReject = async () => {
    if (!selectedProvider) return;

    if (approvalAction === 'rejected' && !approvalRemarks.trim()) {
      showToast('Please provide rejection reason', 'error');
      return;
    }

    try {
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
        showToast(`Provider ${approvalAction} successfully!`, 'success');
        setShowApprovalModal(false);
        setApprovalRemarks('');
        setSelectedProvider(null);
        fetchProviders();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (error) {
      console.error('Error updating provider status:', error);
      showToast('Failed to update provider status', 'error');
    }
  };

  const openApprovalModal = (action, provider) => {
    setSelectedProvider(provider);
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const closeModal = () => {
    setSelectedProvider(null);
    setApprovalRemarks('');
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

  // Table view for providers
  const ProviderTableRow = ({ provider }) => {
    const daysPending = getDaysPending(provider.registrationDate || provider.createdAt);
    const status = getProviderStatus(provider);
    
    return (
      <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
        <td className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {provider.profilePicUrl && provider.profilePicUrl !== 'default-provider.jpg' ? (
                <img 
                  src={provider.profilePicUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <div className="font-medium text-secondary">{provider.name}</div>
              <div className="text-xs text-gray-500 flex items-center">
                <Mail className="w-3 h-3 mr-1" />
                {provider.email}
              </div>
            </div>
          </div>
        </td>
        <td className="p-3">
          <div className="text-sm text-gray-900">{provider.phone}</div>
        </td>
        <td className="p-3">
          <div className="text-sm text-gray-900 flex items-center">
            <MapPin className="w-3 h-3 mr-1 text-primary" />
            {provider.serviceArea || (provider.address?.city || 'N/A')}
          </div>
        </td>
        <td className="p-3">
          <div className="text-sm text-gray-900">
            {provider.services?.slice(0, 2).join(', ')}
            {provider.services?.length > 2 && '...'}
          </div>
        </td>
        <td className="p-3">
          <div className="text-sm text-gray-900">{provider.experience || '0'} yrs</div>
        </td>
        <td className="p-3">
          <div className="text-sm text-gray-900">
            {new Date(provider.createdAt || provider.registrationDate).toLocaleDateString()}
          </div>
        </td>
        <td className="p-3">
          <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            daysPending > 7 ? 'bg-accent text-white' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {daysPending} days
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-1">
            <div className={`p-1 rounded ${provider.resume ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className={`p-1 rounded ${provider.bankDetails?.passbookImage ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
              <FileImage className="w-4 h-4" />
            </div>
            <div className={`p-1 rounded ${provider.bankDetails?.verified ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProviderDetails(provider._id)}
              className="p-1.5 bg-primary text-white rounded hover:bg-teal-600 transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => openApprovalModal('approved', provider)}
              className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              title="Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => openApprovalModal('rejected', provider)}
              className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              title="Reject"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const ProviderDetailsModal = () => {
    if (!selectedProvider) return null;
    const status = getProviderStatus(selectedProvider);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
          <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold text-secondary">Provider Details</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 mb-8 pb-6 border-b">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-r from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
                {selectedProvider.profilePicUrl && selectedProvider.profilePicUrl !== 'default-provider.jpg' ? (
                  <img 
                    src={selectedProvider.profilePicUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-bold text-secondary">{selectedProvider.name}</h3>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mt-2 text-gray-600 text-sm">
                  <span className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    {selectedProvider.email}
                  </span>
                  <span className="flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    {selectedProvider.phone}
                  </span>
                </div>
              </div>
              <div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  status === 'approved' 
                    ? 'bg-green-100 text-green-800' 
                    : status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Personal Information */}
              <div className="bg-teal-50 rounded-lg p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-secondary flex items-center">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                  Personal Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Date of Birth</p>
                    <p className="font-medium text-secondary text-sm sm:text-base">
                      {selectedProvider.dateOfBirth ? new Date(selectedProvider.dateOfBirth).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Age</p>
                    <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.age || 'N/A'} years</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Registration Date</p>
                    <p className="font-medium text-secondary text-sm sm:text-base">
                      {new Date(selectedProvider.registrationDate || selectedProvider.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Profile Complete</p>
                    <p className="font-medium">
                      <span className={`px-2 py-1 rounded text-xs ${
                        selectedProvider.profileComplete 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedProvider.profileComplete ? 'Yes' : 'No'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div className="bg-teal-50 rounded-lg p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-secondary flex items-center">
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                  Professional Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Services</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedProvider.services?.map((service, index) => (
                        <span key={index} className="px-2 py-1 bg-primary text-white rounded text-xs">
                          {service}
                        </span>
                      )) || <span className="text-secondary text-sm">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Experience</p>
                    <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.experience || '0'} years</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Service Area</p>
                    <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.serviceArea || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Test Status</p>
                    <span className={`px-2 py-1 rounded text-xs ${
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
              <div className="bg-teal-50 rounded-lg p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-secondary flex items-center">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                  Address Information
                </h3>
                <div className="space-y-3">
                  {selectedProvider.address ? (
                    <>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Street</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.address.street || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">City</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.address.city || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">State</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.address.state || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Postal Code</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">{selectedProvider.address.postalCode || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Address not provided</p>
                  )}
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-teal-50 rounded-lg p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-secondary flex items-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                  Bank Details
                </h3>
                <div className="space-y-3">
                  {selectedProvider.bankDetails ? (
                    <>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Account Number</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">
                          {selectedProvider.bankDetails.accountNo || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">IFSC Code</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">
                          {selectedProvider.bankDetails.ifsc || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Bank Name</p>
                        <p className="font-medium text-secondary text-sm sm:text-base">
                          {selectedProvider.bankDetails.bankName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Verification Status</p>
                        <span className={`px-2 py-1 rounded text-xs ${
                          selectedProvider.bankDetails.verified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedProvider.bankDetails.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Bank details not provided</p>
                  )}
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="mt-6 bg-teal-50 rounded-lg p-4 sm:p-5">
              <h3 className="text-base sm:text-lg font-semibold mb-4 text-secondary">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Profile Picture */}
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-teal-200">
                  <div className="flex items-center mb-3">
                    <Image className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                    <span className="font-medium text-secondary text-sm">Profile Picture</span>
                  </div>
                  {selectedProvider.profilePicUrl && selectedProvider.profilePicUrl !== 'default-provider.jpg' ? (
                    <>
                      <div className="aspect-square bg-gray-100 rounded-md overflow-hidden mb-3">
                        <img 
                          src={selectedProvider.profilePicUrl} 
                          alt="Profile" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => viewDocument(selectedProvider, 'profile')}
                        />
                      </div>
                      <button
                        onClick={() => viewDocument(selectedProvider, 'profile')}
                        className="w-full py-1.5 sm:py-2 bg-primary text-white rounded hover:bg-teal-600 text-xs sm:text-sm transition-colors"
                      >
                        View Full Size
                      </button>
                    </>
                  ) : (
                    <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                      <p className="text-gray-400 text-xs sm:text-sm">Not uploaded</p>
                    </div>
                  )}
                </div>

                {/* Resume */}
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-teal-200">
                  <div className="flex items-center mb-3">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                    <span className="font-medium text-secondary text-sm">Resume/CV</span>
                  </div>
                  {selectedProvider.resume ? (
                    <>
                      <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center mb-3 cursor-pointer hover:bg-gray-200 transition-colors"
                           onClick={() => viewDocument(selectedProvider, 'resume')}>
                        <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
                      </div>
                      <button
                        onClick={() => viewDocument(selectedProvider, 'resume')}
                        className="w-full py-1.5 sm:py-2 bg-primary text-white rounded hover:bg-teal-600 text-xs sm:text-sm transition-colors"
                      >
                        View Document
                      </button>
                    </>
                  ) : (
                    <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                      <p className="text-gray-400 text-xs sm:text-sm">Not uploaded</p>
                    </div>
                  )}
                </div>

                {/* Passbook */}
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-teal-200">
                  <div className="flex items-center mb-3">
                    <FileImage className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                    <span className="font-medium text-secondary text-sm">Bank Passbook</span>
                  </div>
                  {selectedProvider.bankDetails?.passbookImage ? (
                    <>
                      <div className="aspect-square bg-gray-100 rounded-md overflow-hidden mb-3">
                        <img 
                          src={selectedProvider.bankDetails.passbookImage} 
                          alt="Passbook" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => viewDocument(selectedProvider, 'passbook')}
                        />
                      </div>
                      <button
                        onClick={() => viewDocument(selectedProvider, 'passbook')}
                        className="w-full py-1.5 sm:py-2 bg-primary text-white rounded hover:bg-teal-600 text-xs sm:text-sm transition-colors"
                      >
                        View Full Size
                      </button>
                    </>
                  ) : (
                    <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                      <p className="text-gray-400 text-xs sm:text-sm">Not uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {status === 'pending' && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => openApprovalModal('approved', selectedProvider)}
                  className="flex-1 flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                >
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Approve Provider
                </button>
                <button
                  onClick={() => openApprovalModal('rejected', selectedProvider)}
                  className="flex-1 flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
                >
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Reject Provider
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ApprovalModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className={`w-5 h-5 sm:w-6 sm:h-6 mr-2 ${
              approvalAction === 'approved' ? 'text-green-600' : 'text-red-600'
            }`} />
            <h3 className="text-base sm:text-lg font-semibold text-secondary">
              {approvalAction === 'approved' ? 'Approve' : 'Reject'} Provider
            </h3>
          </div>
          
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            Are you sure you want to {approvalAction === 'approved' ? 'approve' : 'reject'} 
            <span className="font-semibold"> {selectedProvider?.name}</span>?
          </p>
          
          <div className="mb-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              {approvalAction === 'rejected' ? 'Rejection Reason (Required)' : 'Remarks (Optional)'}
            </label>
            <textarea
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              rows="3"
              placeholder={`Enter ${approvalAction === 'rejected' ? 'rejection reason' : 'approval remarks'}...`}
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleApproveReject}
              className={`flex-1 py-2 sm:py-3 px-4 rounded-lg text-white font-medium transition-colors text-sm sm:text-base ${
                approvalAction === 'approved' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Confirm {approvalAction === 'approved' ? 'Approval' : 'Rejection'}
            </button>
            <button
              onClick={() => {
                setShowApprovalModal(false);
                setApprovalRemarks('');
              }}
              className="flex-1 py-2 sm:py-3 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm sm:text-base"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const DocumentViewModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base sm:text-lg font-semibold text-secondary">
            {documentView.type === 'image' ? 'Image Preview' : 'Document View'}
          </h3>
          <button
            onClick={closeDocumentView}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center bg-gray-50">
          {documentView.type === 'image' ? (
            <img 
              src={documentView.url} 
              alt="Document" 
              className="max-w-full max-h-[calc(90vh-100px)] object-contain"
            />
          ) : (
            <iframe 
              src={documentView.url} 
              className="w-full h-[calc(90vh-100px)] min-h-[400px] border-0 bg-white"
              title="Document"
            />
          )}
        </div>
      </div>
    </div>
  );

  const Pagination = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
      <div className="text-xs sm:text-sm text-gray-600">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredProviders.length)} of {filteredProviders.length} providers
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
        >
          <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          Previous
        </button>
        
        <div className="flex items-center gap-1">
          {totalPages <= 5 ? (
            [...Array(totalPages)].map((_, index) => (
              <button
                key={index + 1}
                onClick={() => setCurrentPage(index + 1)}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                  currentPage === index + 1
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {index + 1}
              </button>
            ))
          ) : (
            <>
              {currentPage > 2 && (
                <>
                  <button onClick={() => setCurrentPage(1)} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs sm:text-sm">1</button>
                  {currentPage > 3 && <span className="px-2">...</span>}
                </>
              )}
              {[...Array(3)].map((_, index) => {
                const pageNumber = currentPage - 1 + index;
                if (pageNumber > 0 && pageNumber <= totalPages) {
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                        currentPage === pageNumber
                          ? 'bg-primary text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                }
                return null;
              })}
              {currentPage < totalPages - 1 && (
                <>
                  {currentPage < totalPages - 2 && <span className="px-2">...</span>}
                  <button onClick={() => setCurrentPage(totalPages)} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs sm:text-sm">{totalPages}</button>
                </>
              )}
            </>
          )}
        </div>
        
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
          >
          Next
          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
        </button>
      </div>
    </div>
  );

  const FilterSection = () => (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-secondary flex items-center">
          <Filter className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Advanced Filters
        </h3>
        <div className="flex gap-2">
          <button
            onClick={clearFilters}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {showFilters ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Filter className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Services</label>
            <input
              type="text"
              value={filters.services}
              onChange={(e) => setFilters({...filters, services: e.target.value})}
              placeholder="e.g., Cleaning"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={filters.city}
              onChange={(e) => setFilters({...filters, city: e.target.value})}
              placeholder="Filter by city"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={filters.state}
              onChange={(e) => setFilters({...filters, state: e.target.value})}
              placeholder="Filter by state"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Experience</label>
            <input
              type="number"
              value={filters.experience}
              onChange={(e) => setFilters({...filters, experience: e.target.value})}
              placeholder="Years"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Age</label>
            <input
              type="number"
              value={filters.age}
              onChange={(e) => setFilters({...filters, age: e.target.value})}
              placeholder="Age"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Test Status</label>
            <select
              value={filters.testPassed}
              onChange={(e) => setFilters({...filters, testPassed: e.target.value})}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            >
              <option value="">All</option>
              <option value="true">Passed</option>
              <option value="false">Not Passed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Profile Status</label>
            <select
              value={filters.profileComplete}
              onChange={(e) => setFilters({...filters, profileComplete: e.target.value})}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            >
              <option value="">All</option>
              <option value="true">Complete</option>
              <option value="false">Incomplete</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Bank Verification</label>
            <select
              value={filters.bankVerified}
              onChange={(e) => setFilters({...filters, bankVerified: e.target.value})}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            >
              <option value="">All</option>
              <option value="true">Verified</option>
              <option value="false">Not Verified</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Has Resume</label>
            <select
              value={filters.hasResume}
              onChange={(e) => setFilters({...filters, hasResume: e.target.value})}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Has Passbook</label>
            <select
              value={filters.hasPassbook}
              onChange={(e) => setFilters({...filters, hasPassbook: e.target.value})}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Days Pending</label>
            <input
              type="number"
              value={filters.minDaysPending}
              onChange={(e) => setFilters({...filters, minDaysPending: e.target.value})}
              placeholder="Days"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Max Days Pending</label>
            <input
              type="number"
              value={filters.maxDaysPending}
              onChange={(e) => setFilters({...filters, maxDaysPending: e.target.value})}
              placeholder="Days"
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-secondary mb-2">Pending Providers</h1>
          <p className="text-sm sm:text-base text-gray-600">Review and approve provider registrations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Providers</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.totalProviders}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.pendingApproval}</p>
              </div>
              <div className="p-2 md:p-3 bg-yellow-100 rounded-full">
                <ClockIcon className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today Registered</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.todayRegistered}</p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today Approved</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.todayApproved}</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-600">With Resume</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">{stats.withResume}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-600">Bank Details</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.withBankDetails}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-600">Profile Complete</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.profileComplete}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-600">Test Passed</p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-600">{stats.testPassed}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-600">Avg Days Pending</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.avgDaysPending}</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search by name, email, phone, services, area, bank details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Filters and Sorting */}
        <FilterSection />

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 sm:p-12 text-center">
            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">No Pending Providers</h3>
            <p className="text-sm sm:text-base text-gray-600">
              {searchTerm || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search or filters'
                : 'No pending providers at the moment.'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Pending</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentProviders.map(provider => (
                      <ProviderTableRow key={provider._id} provider={provider} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && <Pagination />}
          </>
        )}

        {/* Modals */}
        {selectedProvider && <ProviderDetailsModal />}
        {showApprovalModal && <ApprovalModal />}
        {documentView.visible && <DocumentViewModal />}
      </div>
    </div>
  );
};

export default AdminProvidersPage;