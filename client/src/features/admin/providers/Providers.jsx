import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../../components/ui/Pagination';
import Table from '../../../components/ui/Table';
import SectionHeader from '../../../components/ui/SectionHeader';
import {
  Users,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  X,
  FileImage,
  Image,
  Briefcase,
  Home,
  CreditCard,
  FileText,
  UserCheck,
  UserPlus,
  Clock as ClockIcon,
  Camera
} from 'lucide-react';
import { useAuth } from '../../../context/auth';
import * as AdminService from '../../../services/AdminService';
import LoadingSpinner from '../../../components/ui/Loader';
import { formatDate } from '../../../utils/format';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { AdminLocalFilterBar } from '../../../components/AdminFilterBar';
import StatCard from '../../../components/ui/StatCard';

const AdminProvidersPage = () => {
  const { token, API, showToast } = useAuth();
  const [allProviders, setAllProviders] = useState([]);
  const [pendingProviders, setPendingProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  const handleDownloadPDF = async (providerId, type) => {
    try {
      const response = type === 'agreement'
        ? await AdminService.getProviderAgreementPdf(providerId)
        : await AdminService.getProviderApprovalLetter(providerId);

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      showToast('Failed to download PDF document', 'error');
    }
  };

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalConfirmation, setApprovalConfirmation] = useState('');
  const [processingAction, setProcessingAction] = useState(null);

  const [activeTab, setActiveTab] = useState('pending_providers'); // 'pending_providers' | 'bank_pending'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [documentView, setDocumentView] = useState({
    visible: false,
    type: '',
    url: ''
  });

  const {
    filterType,
    year,
    financialYear,
    month,
    quarter,
    zoneIds,
    getMergedQuery,
    reset
  } = useAdminFilter();

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

  const [sortBy] = useState('registrationDate');
  const [sortOrder] = useState('desc');

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

  const [tabCounts, setTabCounts] = useState({ pending: 0, bankPending: 0 });

  // Memoized provider status calculation
  const getProviderStatus = useCallback((provider) => {
    if (provider.approved) return 'approved';
    if (provider.kycStatus === 'rejected') return 'rejected';
    return 'pending';
  }, []);

  const getDaysPending = useCallback((registrationDate) => {
    const created = new Date(registrationDate);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  const fetchProviders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = {
        tab: activeTab === 'pending_providers' ? 'pending' : 'bank_pending',
        search: searchTerm,
        ...getMergedQuery()
      };
      const response = await AdminService.getPendingProviders(params);
      const data = response.data;

      if (data.success) {
        setAllProviders(data.providers || []);
        if (data.stats) {
          setStats(data.stats);
        }
        setTabCounts({
          pending: data.pendingCount || 0,
          bankPending: data.bankPendingCount || 0
        });
      } else {
        showToast('Failed to fetch providers', 'error');
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      showToast('Failed to fetch providers', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeTab, searchTerm, getMergedQuery, showToast]);

  // Optimized data fetching
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders, filterType, year, financialYear, month, quarter, zoneIds]);

  // Memoized provider filtering
  useEffect(() => {
    setPendingProviders(allProviders);
  }, [allProviders]);

  // Optimized filtering and sorting
  useEffect(() => {
    applyFiltersAndSearch();
  }, [searchTerm, filters, sortBy, sortOrder, pendingProviders]);

  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...pendingProviders];

    // Local filters (like experience, services etc)
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      switch (key) {
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
          filtered = filtered.filter(p => (p.bankDetails?.bankVerificationStatus === 'verified') === (value === 'true'));
          break;
        case 'bankVerificationStatus':
          if (value === 'verified') filtered = filtered.filter(p => p.bankDetails?.bankVerificationStatus === 'verified');
          else if (value === 'pending') filtered = filtered.filter(p => p.bankDetails?.bankVerificationStatus === 'pending');
          else if (value === 'rejected') filtered = filtered.filter(p => p.bankDetails?.bankVerificationStatus === 'rejected');
          break;
        case 'preferredMethod':
          filtered = filtered.filter(p => (p.bankDetails?.preferredMethod || 'bank_account') === value);
          break;
        case 'hasResume':
          filtered = filtered.filter(p => !!(p.aadhaarFront && p.aadhaarBack && p.panCard && p.liveSelfie) === (value === 'true'));
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

      switch (sortBy) {
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
  }, [filters, sortBy, sortOrder, pendingProviders, getDaysPending]);

  const clearFilters = () => {
    reset(() => {
      setFilters({
        services: '',
        city: '',
        profileComplete: '',
        hasResume: '',
        testPassed: '',
        bankVerified: ''
      });
      setSearchTerm('');
    }, () => fetchProviders(false));
  };

  const fetchProviderDetails = useCallback(async (providerId) => {
    try {
      const response = await AdminService.getProviderDetails(providerId);
      const data = response.data;
      if (data.success) {
        setSelectedProvider(data.provider || data.data);
      } else {
        showToast('Failed to fetch provider details', 'error');
      }
    } catch (error) {
      console.error('Error fetching provider details:', error);
      showToast('Failed to fetch provider details', 'error');
    }
  }, [showToast]);

  const openApprovalModal = useCallback((action, provider) => {
    setSelectedProvider(provider);
    setApprovalAction(action);
    setApprovalRemarks('');
    setApprovalConfirmation('');
    setShowApprovalModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedProvider(null);
    setApprovalRemarks('');
    setApprovalConfirmation('');
    setShowApprovalModal(false);
  }, []);

  const handleRemarksChange = useCallback((e) => {
    setApprovalRemarks(e.target.value);
  }, []);

  const handleApproveProvider = useCallback((p) => {
    openApprovalModal(activeTab === 'pending_providers' ? 'approved' : 'bank_approved', p);
  }, [openApprovalModal, activeTab]);

  const handleRejectProvider = useCallback((p) => {
    openApprovalModal(activeTab === 'pending_providers' ? 'rejected' : 'bank_rejected', p);
  }, [openApprovalModal, activeTab]);

  const handleModalConfirm = async () => {
    if (!selectedProvider || !approvalAction) return;

    const isReject = approvalAction === 'rejected' || approvalAction === 'bank_rejected';
    if (isReject && !approvalRemarks.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    const prevProviders = [...allProviders];

    try {
      setProcessingAction(approvalAction);

      // Optimistic UI update
      setAllProviders(prev => prev.filter(p => p._id !== selectedProvider._id));

      const response = await AdminService.updateProviderStatus(selectedProvider._id, {
        status: approvalAction,
        remarks: approvalRemarks,
        rejectionReason: approvalRemarks
      });

      const data = response.data;

      if (data.success) {
        showToast(`Action performed successfully`, 'success');
        fetchProviders(true); // Silent background sync
        setShowApprovalModal(false);
        setSelectedProvider(null);
        setApprovalRemarks('');
        setApprovalConfirmation('');
      } else {
        showToast(data.message || 'Failed to update provider status', 'error');
        setAllProviders(prevProviders);
      }
    } catch (error) {
      console.error('Error updating provider status:', error);
      showToast('Failed to update provider status', 'error');
      setAllProviders(prevProviders);
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

    switch (docType) {
      case 'profile':
        url = provider.profilePicUrl;
        type = 'image';
        break;
      case 'aadhaarFront':
        url = provider.aadhaarFront;
        type = 'image';
        break;
      case 'aadhaarBack':
        url = provider.aadhaarBack;
        type = 'image';
        break;
      case 'panCard':
        url = provider.panCard;
        type = 'image';
        break;
      case 'liveSelfie':
        url = provider.liveSelfie;
        type = 'image';
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

  // ProviderTableRow is hoisted to module scope


  // Modals and FilterSection hoisted to module scope

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <SectionHeader
          title="Pending Providers"
          subtitle="Review and approve provider registrations"
          className="mb-8"
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Providers"
            value={stats.totalProviders}
            icon={Users}
            iconBg="bg-primary/10"
            iconColor="text-primary"
          />
          <StatCard
            title="Pending Approval"
            value={stats.pendingApproval}
            icon={ClockIcon}
            iconBg="bg-yellow-50"
            iconColor="text-yellow-600"
          />
          <StatCard
            title="Today Registered"
            value={stats.todayRegistered}
            icon={UserPlus}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            title="Today Approved"
            value={stats.todayApproved}
            icon={UserCheck}
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />
        </div>

        {/* Additional Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="KYC Documents"
            value={<span className="text-primary">{stats.withResume}</span>}
          />
          <StatCard
            title="Bank Details"
            value={<span className="text-green-600">{stats.withBankDetails}</span>}
          />
          <StatCard
            title="Profile Complete"
            value={<span className="text-blue-600">{stats.profileComplete}</span>}
          />
          <StatCard
            title="Test Passed"
            value={<span className="text-indigo-600">{stats.testPassed}</span>}
          />
          <StatCard
            title="Avg Days Pending"
            value={<span className="text-purple-600">{stats.avgDaysPending}</span>}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2.5 mb-6 bg-white/60 backdrop-blur-md p-1.5 rounded-xl border border-gray-200 shadow-sm max-w-md">
          <button
            onClick={() => {
              setActiveTab('pending_providers');
              setCurrentPage(1);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === 'pending_providers'
              ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-sm transform scale-[1.02]'
              : 'text-gray-600 hover:bg-gray-50 hover:text-secondary'
              }`}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Pending Providers</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeTab === 'pending_providers' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
              {tabCounts.pending}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('bank_pending');
              setCurrentPage(1);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === 'bank_pending'
              ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-sm transform scale-[1.02]'
              : 'text-gray-600 hover:bg-gray-50 hover:text-secondary'
              }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Bank Pending</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeTab === 'bank_pending' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
              {tabCounts.bankPending}
            </span>
          </button>
        </div>

        {/* Filters and Search */}
        <AdminLocalFilterBar
          isInline={true}
          searchValue={searchTerm}
          onSearchChange={(e) => setSearchTerm(e.target.value)}
          onSearchClear={() => setSearchTerm('')}
          searchPlaceholder="Search provider by name, email, phone, ID, city, state..."
          filters={filters}
          onChange={(key, val) => setFilters({ ...filters, [key]: val })}
          onClear={clearFilters}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          fields={[
            { key: 'services', label: 'Services', placeholder: 'e.g., Cleaning', type: 'text' },
            { key: 'city', label: 'City', placeholder: 'Filter by city', type: 'text' },
            {
              key: 'profileComplete', label: 'Profile Status', type: 'select', options: [
                { value: '', label: 'All' },
                { value: 'true', label: 'Complete' },
                { value: 'false', label: 'Incomplete' }
              ]
            },
            {
              key: 'hasResume', label: 'Has KYC Docs', type: 'select', options: [
                { value: '', label: 'All' },
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' }
              ]
            },
            {
              key: 'testPassed', label: 'Test Status', type: 'select', options: [
                { value: '', label: 'All' },
                { value: 'true', label: 'Passed' },
                { value: 'false', label: 'Not Passed' }
              ]
            },
            {
              key: 'bankVerified', label: 'Bank Verification', type: 'select', options: [
                { value: '', label: 'All' },
                { value: 'true', label: 'Verified' },
                { value: 'false', label: 'Not Verified' }
              ]
            }
          ]}
        />

        {/* Content */}
        <Table
          isLoading={loading}
          data={currentProviders}
          rowKey="_id"
          emptyTitle="No Pending Providers"
          emptyMessage={
            searchTerm || Object.values(filters).some(f => f)
              ? 'Try adjusting your search or filters'
              : 'No pending providers at the moment.'
          }
          columns={[
            {
              header: 'Provider',
              key: 'name',
              accessor: (provider) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
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
                    <div className="font-semibold text-secondary flex items-center gap-2">
                      {provider.name}
                      {provider.providerId && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-primary/20">
                          {provider.providerId}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {provider.email}
                    </div>
                  </div>
                </div>
              )
            },
            {
              header: 'Phone',
              key: 'phone',
              accessor: (provider) => (
                <div className="text-sm text-gray-900 font-medium">{provider.phone}</div>
              )
            },
            {
              header: 'Location',
              key: 'location',
              accessor: (provider) => (
                <div className="text-sm text-gray-900 flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-primary" />
                  {provider.serviceArea || (provider.address?.city || 'N/A')}
                </div>
              )
            },
            {
              header: 'Services',
              key: 'services',
              accessor: (provider) => (
                <div className="text-sm text-gray-900">
                  {provider.services?.slice(0, 2).join(', ')}
                  {provider.services?.length > 2 && '...'}
                </div>
              )
            },
            {
              header: 'Experience',
              key: 'experience',
              accessor: (provider) => (
                <div className="text-sm text-gray-900 font-medium">{provider.experience || '0'} yrs</div>
              )
            },
            {
              header: 'Registered',
              key: 'registered',
              accessor: (provider) => (
                <div className="text-sm text-gray-900">
                  {formatDate(provider.createdAt || provider.registrationDate)}
                </div>
              )
            },
            {
              header: 'Days Pending',
              key: 'daysPending',
              accessor: (provider) => {
                const daysPending = getDaysPending(provider.registrationDate || provider.createdAt);
                return (
                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    daysPending > 7 ? 'bg-accent text-white shadow-2xs' : 'bg-amber-100 text-amber-800'
                  }`}>
                    <Clock className="w-3 h-3 mr-1" />
                    {daysPending} days
                  </div>
                );
              }
            },
            {
              header: 'Actions',
              key: 'actions',
              accessor: (provider) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchProviderDetails(provider._id)}
                    className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-2xs"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApproveProvider(provider)}
                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-2xs"
                    title="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRejectProvider(provider)}
                    className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all duration-200 shadow-2xs"
                    title="Reject"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )
            }
          ]}
        />
        {totalPages > 1 && (
          <div className="mt-4 bg-white p-4 rounded-xl shadow-2xs border border-neutral-200/80">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredProviders.length}
              limit={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {/* Modals */}
        {selectedProvider && !showApprovalModal && (
          <ProviderDetailsModal
            selectedProvider={selectedProvider}
            status={getProviderStatus(selectedProvider)}
            closeModal={closeModal}
            viewDocument={viewDocument}
            activeTab={activeTab}
            openApprovalModal={openApprovalModal}
            handleDownloadPDF={handleDownloadPDF}
          />
        )}
        <ApprovalModal
          show={showApprovalModal}
          action={approvalAction}
          providerName={selectedProvider?.name}
          remarks={approvalRemarks}
          onRemarksChange={handleRemarksChange}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          processing={processingAction === approvalAction}
          selectedProvider={selectedProvider}
        />
        {documentView.visible && (
          <DocumentViewModal
            documentView={documentView}
            closeDocumentView={closeDocumentView}
          />
        )}
      </div>
    </div>
  );
};

// Hoisted Provider Table Row Component
const ProviderTableRow = React.memo(({ provider, onViewDetails, onApprove, onReject, daysPending, _status }) => {
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
            <div className="font-semibold text-secondary group-hover:text-primary transition-colors flex items-center gap-2">
              {provider.name}
              {provider.providerId && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-primary/20">
                  {provider.providerId}
                </span>
              )}
            </div>
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
          {formatDate(provider.createdAt || provider.registrationDate)}
        </div>
      </td>
      <td className="p-4">
        <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold transition-all ${daysPending > 7 ? 'bg-accent text-white shadow-sm' : 'bg-yellow-100 text-yellow-800'
          }`}>
          <Clock className="w-3 h-3 mr-1" />
          {daysPending} days
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

// Hoisted Document View Modal
const DocumentViewModal = React.memo(({ documentView, closeDocumentView }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h3 className="text-lg font-semibold text-secondary">
          {documentView.type === 'image' ? 'Image Preview' : 'Document View'}
        </h3>
        <div className="flex items-center gap-2">
          {documentView.url && (
            <a
              href={documentView.url}
              download="document.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-700 text-white rounded-lg hover:from-teal-600 hover:to-teal-800 transition-all duration-200 font-bold text-xs shadow-sm"
            >
              Download File
            </a>
          )}
          <button
            onClick={closeDocumentView}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
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

// Hoisted Provider Details Modal Component
const ProviderDetailsModal = ({
  selectedProvider,
  status,
  closeModal,
  viewDocument,
  activeTab,
  openApprovalModal,
  handleDownloadPDF
}) => {
  if (!selectedProvider) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-6 max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200/80 animate-scale-up">
        {/* Sticky Header */}
        <div className="bg-neutral-50/80 px-6 py-4 border-b border-neutral-200/70 sticky top-0 z-20 flex items-center justify-between backdrop-blur-xs">
          <h2 className="text-lg font-bold text-neutral-800">Provider Details</h2>
          <button
            onClick={closeModal}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-full transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Profile Header Card */}
          <div className="bg-neutral-50/50 p-5 rounded-xl border border-neutral-200/70 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="w-16 h-16 bg-white border border-neutral-200 rounded-full flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                {selectedProvider.profilePicUrl && selectedProvider.profilePicUrl !== 'default-provider.jpg' ? (
                  <img
                    src={selectedProvider.profilePicUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-neutral-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-800">{selectedProvider.name}</h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1.5 text-xs text-neutral-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-neutral-400" />
                    {selectedProvider.email}
                  </span>
                  {selectedProvider.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      {selectedProvider.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : status === 'rejected'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                {status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Personal Information */}
            <div className="bg-white rounded-xl p-5 border border-neutral-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center border-b border-neutral-100 pb-3">
                <User className="w-4 h-4 mr-2 text-primary" />
                Personal Information
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Date of Birth</span>
                  <span className="font-semibold text-neutral-800">
                    {formatDate(selectedProvider.dateOfBirth)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Age</span>
                  <span className="font-semibold text-neutral-800">{selectedProvider.age || 'N/A'} years</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Registration Date</span>
                  <span className="font-semibold text-neutral-800">
                    {formatDate(selectedProvider.registrationDate || selectedProvider.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Profile Complete</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedProvider.profileComplete
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                    {selectedProvider.profileComplete ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Referral Code</span>
                  <span className="font-bold text-neutral-800 font-mono bg-neutral-100 px-2 py-0.5 rounded text-xs">{selectedProvider.referralCode || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Referred By Code</span>
                  <span className="font-bold text-neutral-800 font-mono bg-neutral-100 px-2 py-0.5 rounded text-xs">{selectedProvider.referredBy || 'Direct Signup'}</span>
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className="bg-white rounded-xl p-5 border border-neutral-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center border-b border-neutral-100 pb-3">
                <Briefcase className="w-4 h-4 mr-2 text-primary" />
                Professional Details
              </h3>
              <div className="space-y-2">
                <div className="py-2 border-b border-neutral-100/70">
                  <span className="text-xs font-medium text-neutral-500 block mb-1.5">Services Offered</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProvider.services?.map((service, index) => (
                      <span key={index} className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs font-semibold">
                        {service.name || service}
                      </span>
                    )) || <span className="text-neutral-500 text-xs">N/A</span>}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Experience</span>
                  <span className="font-semibold text-neutral-800">{selectedProvider.experience || '0'} years</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Service Area</span>
                  <span className="font-semibold text-neutral-800">{selectedProvider.serviceArea || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                  <span className="text-neutral-500 font-medium">Test Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedProvider.testPassed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}>
                    {selectedProvider.testPassed ? 'Passed' : 'Not Taken'}
                  </span>
                </div>
                {selectedProvider.approved && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium">Rating</span>
                      <span className="font-semibold text-neutral-800">
                        ⭐ {selectedProvider.performanceScore?.rating > 0 ? selectedProvider.performanceScore.rating.toFixed(1) : 'No ratings yet'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium">On-Time</span>
                      <span className="font-semibold text-neutral-800">
                        {selectedProvider.performanceScore?.onTimePercentage?.toFixed(1) || '0.0'}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium">Completion</span>
                      <span className="font-semibold text-neutral-800">
                        {selectedProvider.performanceScore?.completionPercentage?.toFixed(1) || '0.0'}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-xl p-5 border border-neutral-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center border-b border-neutral-100 pb-3">
                <Home className="w-4 h-4 mr-2 text-primary" />
                Address Information
              </h3>
              <div className="space-y-3">
                {selectedProvider.currentAddress ? (
                  <div>
                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Current Address</h4>
                    <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-200/70">
                      {selectedProvider.currentAddress.houseNumber && `${selectedProvider.currentAddress.houseNumber}, `}
                      {selectedProvider.currentAddress.street && `${selectedProvider.currentAddress.street}, `}
                      {selectedProvider.currentAddress.landmark && `${selectedProvider.currentAddress.landmark}, `}
                      {selectedProvider.currentAddress.villageCity && `${selectedProvider.currentAddress.villageCity}, `}
                      {selectedProvider.currentAddress.district && `${selectedProvider.currentAddress.district}, `}
                      {selectedProvider.currentAddress.state && `${selectedProvider.currentAddress.state} - `}
                      {selectedProvider.currentAddress.pincode || ''}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Current Address</h4>
                    <p className="text-xs text-neutral-400 italic">No current address</p>
                  </div>
                )}

                {selectedProvider.addressSame ? (
                  <div>
                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Permanent Address</h4>
                    <p className="text-xs text-emerald-700 font-semibold italic bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200/60">Same as Current Address</p>
                  </div>
                ) : selectedProvider.permanentAddress ? (
                  <div>
                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Permanent Address</h4>
                    <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-200/70">
                      {selectedProvider.permanentAddress.houseNumber && `${selectedProvider.permanentAddress.houseNumber}, `}
                      {selectedProvider.permanentAddress.street && `${selectedProvider.permanentAddress.street}, `}
                      {selectedProvider.permanentAddress.landmark && `${selectedProvider.permanentAddress.landmark}, `}
                      {selectedProvider.permanentAddress.villageCity && `${selectedProvider.permanentAddress.villageCity}, `}
                      {selectedProvider.permanentAddress.district && `${selectedProvider.permanentAddress.district}, `}
                      {selectedProvider.permanentAddress.state && `${selectedProvider.permanentAddress.state} - `}
                      {selectedProvider.permanentAddress.pincode || ''}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Permanent Address</h4>
                    <p className="text-xs text-neutral-400 italic">No permanent address</p>
                  </div>
                )}

                {selectedProvider.address && (
                  <div>
                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Map Routing Location</h4>
                    <p className="text-xs sm:text-sm text-neutral-800 bg-neutral-50 p-3 rounded-lg border border-neutral-200/70">{selectedProvider.address.formattedAddress || selectedProvider.address.street || 'N/A'}</p>
                    {/* S2 Geofence Telemetry */}
                    {(selectedProvider.address?.s2CellId || selectedProvider.address?.s2CellIdPrecise) && (
                      <div className="mt-3 bg-neutral-900 text-neutral-100 p-3.5 rounded-xl border border-neutral-800">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-teal-400" /> S2 Geofence Telemetry
                        </p>
                        <div className="space-y-1.5">
                          {selectedProvider.address?.s2CellId && (
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-neutral-400 font-medium">Level 13 (≈1km²)</span>
                              <span className="font-mono text-xs text-teal-300 font-semibold bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/60">
                                {selectedProvider.address.s2CellId}
                              </span>
                            </div>
                          )}
                          {selectedProvider.address?.s2CellIdPrecise && (
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-neutral-400 font-medium">Level 15 (≈150m²)</span>
                              <span className="font-mono text-xs text-emerald-300 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                                {selectedProvider.address.s2CellIdPrecise}
                              </span>
                            </div>
                          )}
                          {selectedProvider.address?.lat && selectedProvider.address?.lng && (
                            <div className="flex justify-between items-center pt-1 border-t border-neutral-800">
                              <span className="text-[11px] text-neutral-400 font-medium">Coordinates</span>
                              <span className="font-mono text-xs text-neutral-300">
                                {parseFloat(selectedProvider.address.lat).toFixed(6)}, {parseFloat(selectedProvider.address.lng).toFixed(6)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-white rounded-xl p-5 border border-neutral-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center border-b border-neutral-100 pb-3">
                <CreditCard className="w-4 h-4 mr-2 text-primary" />
                Bank Details
              </h3>
              <div className="space-y-1">
                {selectedProvider.bankDetails ? (
                  <>
                    <div className="flex justify-between items-start py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Account Holder Name</span>
                      <span className="font-semibold text-neutral-800 text-right max-w-[70%] break-words">
                        {selectedProvider.bankDetails.accountName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Account Number</span>
                      <span className="font-semibold text-neutral-800 font-mono text-right max-w-[70%] break-words">
                        {selectedProvider.bankDetails.accountNo || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">IFSC Code</span>
                      <span className="font-semibold text-neutral-800 font-mono text-right max-w-[70%] break-words">
                        {selectedProvider.bankDetails.ifsc || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-start py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Bank Name</span>
                      <span className="font-semibold text-neutral-800 text-right max-w-[70%] break-words">
                        {selectedProvider.bankDetails.bankName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">District</span>
                      <span className="font-semibold text-neutral-800 text-right max-w-[70%] break-words">
                        {selectedProvider.bankDetails.district || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-start py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Branch Address</span>
                      <span className="font-semibold text-neutral-800 text-right text-xs max-w-[70%] break-words">
                        {selectedProvider.bankDetails.address || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Verification Status</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedProvider.bankDetails.bankVerificationStatus === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedProvider.bankDetails.bankVerificationStatus === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                        {selectedProvider.bankDetails.bankVerificationStatus ? selectedProvider.bankDetails.bankVerificationStatus.toUpperCase() : (selectedProvider.bankDetails.verified ? 'VERIFIED' : 'PENDING')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Document Uploaded At</span>
                      <span className="font-semibold text-neutral-800 text-right text-xs max-w-[70%] break-words">
                        {selectedProvider.bankDetails.uploadedAt ? new Date(selectedProvider.bankDetails.uploadedAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                      <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Uploaded By</span>
                      <span className="font-semibold text-neutral-800 text-right text-xs max-w-[70%] break-words">
                        Provider
                      </span>
                    </div>

                    {selectedProvider.bankDetails.bankVerifiedAt && (
                      <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                        <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Verified At</span>
                        <span className="font-semibold text-neutral-800 text-right text-xs max-w-[70%] break-words">
                          {new Date(selectedProvider.bankDetails.bankVerifiedAt).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {selectedProvider.bankDetails.bankVerifiedBy && (
                      <div className="flex justify-between items-center py-2 border-b border-neutral-100/70 text-xs sm:text-sm">
                        <span className="text-neutral-500 font-medium flex-shrink-0 mr-4">Verified By</span>
                        <span className="font-semibold text-neutral-800 text-right text-xs max-w-[70%] break-words">
                          {selectedProvider.bankDetails.bankVerifiedBy.name || selectedProvider.bankDetails.bankVerifiedBy.email || 'Admin'}
                        </span>
                      </div>
                    )}

                    {selectedProvider.bankDetails.bankRejectReason && (
                      <div className="py-2">
                        <span className="text-xs text-rose-600 font-bold block mb-1">Bank Reject Reason</span>
                        <span className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg block font-medium border border-rose-200">
                          {selectedProvider.bankDetails.bankRejectReason}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-neutral-400 text-center py-4 text-xs italic">Bank details not provided</p>
                )}
              </div>
            </div>
          </div>

          {/* Documents Section */}
          <div className="bg-white rounded-xl p-5 border border-neutral-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center border-b border-neutral-100 pb-3">
              <FileImage className="w-4 h-4 mr-2 text-primary" />
              Documents
            </h3>
            {(() => {
              const docs = [];
              if (selectedProvider.profilePicUrl && selectedProvider.profilePicUrl !== 'default-provider.jpg') {
                docs.push({ label: 'Profile Picture', icon: Image, src: selectedProvider.profilePicUrl, type: 'profile' });
              }
              if (selectedProvider.aadhaarFront) {
                docs.push({ label: 'Aadhaar Front', icon: FileText, src: selectedProvider.aadhaarFront, type: 'aadhaarFront' });
              }
              if (selectedProvider.aadhaarBack) {
                docs.push({ label: 'Aadhaar Back', icon: FileText, src: selectedProvider.aadhaarBack, type: 'aadhaarBack' });
              }
              if (selectedProvider.panCard) {
                docs.push({ label: 'PAN Card', icon: FileText, src: selectedProvider.panCard, type: 'panCard' });
              }
              if (selectedProvider.liveSelfie) {
                docs.push({ label: 'Live Selfie', icon: Camera, src: selectedProvider.liveSelfie, type: 'liveSelfie' });
              }
              if (selectedProvider.bankDetails?.passbookImage) {
                docs.push({ label: 'Bank Passbook', icon: FileImage, src: selectedProvider.bankDetails.passbookImage, type: 'passbook' });
              }

              if (docs.length === 0) {
                return <p className="text-neutral-400 text-center py-6 text-xs italic">No documents uploaded yet</p>;
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {docs.map((doc) => {
                    const IconComp = doc.icon;
                    return (
                      <div key={doc.type} className="bg-neutral-50/60 p-4 rounded-xl border border-neutral-200/80 shadow-2xs hover:shadow-sm transition-all">
                        <div className="flex items-center mb-3">
                          <IconComp className="w-4 h-4 mr-2 text-primary" />
                          <span className="font-semibold text-neutral-800 text-xs sm:text-sm">{doc.label}</span>
                        </div>
                        <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden mb-3 border border-neutral-200">
                          <img
                            src={doc.src}
                            alt={doc.label}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                            onClick={() => viewDocument(selectedProvider, doc.type)}
                          />
                        </div>
                        <button
                          onClick={() => viewDocument(selectedProvider, doc.type)}
                          className="w-full py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg transition-all font-semibold text-xs shadow-2xs"
                        >
                          View Full Size
                        </button>
                        {doc.type === 'passbook' && (
                          <div className="mt-3 pt-3 border-t border-neutral-200/70 space-y-1.5 text-[11px] text-neutral-500 font-medium">
                            <div className="flex justify-between">
                              <span>Uploaded Date:</span>
                              <span className="text-neutral-800 font-bold">
                                {selectedProvider.bankDetails?.uploadedAt ? new Date(selectedProvider.bankDetails.uploadedAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Uploaded By:</span>
                              <span className="text-neutral-800 font-bold">Provider</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Verification Status:</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${selectedProvider.bankDetails?.bankVerificationStatus === 'verified'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : selectedProvider.bankDetails?.bankVerificationStatus === 'rejected'
                                    ? 'bg-rose-50 text-rose-600'
                                    : 'bg-amber-50 text-amber-600'
                                }`}>
                                {selectedProvider.bankDetails?.bankVerificationStatus || 'pending'}
                              </span>
                            </div>
                            {selectedProvider.bankDetails?.bankRejectReason && (
                              <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg mt-1 border border-rose-200">
                                Reject Reason: {selectedProvider.bankDetails.bankRejectReason}
                              </div>
                            )}
                            <a
                              href={doc.src}
                              download={`passbook_${selectedProvider.name}.jpg`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg transition-all font-bold text-center block mt-2 text-[10px] shadow-2xs"
                            >
                              Download Passbook Document
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Agreement PDF and Approval Letter PDF */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-2xs space-y-3">
            <div className="flex items-center border-b border-neutral-100 pb-3">
              <FileText className="w-4 h-4 mr-2 text-primary" />
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Legal Contracts & Signatures</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-neutral-200/80 p-4 rounded-xl bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs sm:text-sm mb-1">Provider Service Agreement</h4>
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Dynamically compiled legal contract containing self declaration and digital signature logs.</p>
                </div>
                {selectedProvider.legalAcceptance?.agreementAccepted ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(selectedProvider._id, 'agreement')}
                    className="text-center py-2 px-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg transition-all duration-200 font-semibold text-xs block w-full shadow-2xs"
                  >
                    Download/View Agreement PDF
                  </button>
                ) : (
                  <button disabled className="py-2 px-3 bg-neutral-100 text-neutral-400 rounded-lg font-medium text-xs cursor-not-allowed w-full">
                    Agreement Pending Acceptance
                  </button>
                )}
              </div>

              <div className="border border-neutral-200/80 p-4 rounded-xl bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs sm:text-sm mb-1">Official Approval Letter</h4>
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">System generated registration confirmation letter containing approved service details and admin comments.</p>
                </div>
                {selectedProvider.approved ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(selectedProvider._id, 'approval')}
                    className="text-center py-2 px-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg transition-all duration-200 font-semibold text-xs block w-full shadow-2xs"
                  >
                    Download/View Approval Letter
                  </button>
                ) : (
                  <button disabled className="py-2 px-3 bg-neutral-100 text-neutral-400 rounded-lg font-medium text-xs cursor-not-allowed w-full">
                    Approval Letter Pending Activation
                  </button>
                )}
              </div>
            </div>

            {selectedProvider.legalAcceptance?.acceptedAt && (
              <div className="mt-4 pt-3 border-t border-neutral-100 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-neutral-500 font-medium">
                <div>Accepted At: {new Date(selectedProvider.legalAcceptance.acceptedAt).toLocaleString()}</div>
                <div>Signature Version: {selectedProvider.legalAcceptance.version}</div>
                <div>IP Address: {selectedProvider.legalAcceptance.ipAddress || 'N/A'}</div>
                {selectedProvider.digitalSignature?.signatureUrl && (
                  <div className="flex items-center gap-2">
                    <span>Signature:</span>
                    <img src={selectedProvider.digitalSignature.signatureUrl} alt="Signature Log" className="h-6 object-contain bg-white border rounded" />
                  </div>
                )}
              </div>
            )}
          </div>

          {activeTab === 'pending_providers' ? (
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => openApprovalModal('approved', selectedProvider)}
                className="flex-1 flex items-center justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all duration-200 shadow-2xs font-semibold text-xs sm:text-sm gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve Provider
              </button>
              <button
                onClick={() => openApprovalModal('rejected', selectedProvider)}
                className="flex-1 flex items-center justify-center px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all duration-200 shadow-2xs font-semibold text-xs sm:text-sm gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject Provider
              </button>
            </div>
          ) : (
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => openApprovalModal('bank_approved', selectedProvider)}
                className="flex-1 flex items-center justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all duration-200 shadow-2xs font-semibold text-xs sm:text-sm gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve Bank Update
              </button>
              <button
                onClick={() => openApprovalModal('bank_rejected', selectedProvider)}
                className="flex-1 flex items-center justify-center px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all duration-200 shadow-2xs font-semibold text-xs sm:text-sm gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject Bank Update
              </button>
            </div>
          )}
        </div>
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
  selectedProvider
}) => {
  const [comparisonConfirmed, setComparisonConfirmed] = useState(false);

  // Reset comparison checkbox when modal opens/closes
  React.useEffect(() => {
    if (show) {
      setComparisonConfirmed(false);
    }
  }, [show]);

  if (!show) return null;

  const isApprove = action === 'approved' || action === 'bank_approved';
  const isReject = action === 'rejected' || action === 'bank_rejected';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            {action === 'approved' && 'Approve Provider'}
            {action === 'rejected' && 'Reject Provider'}
            {action === 'bank_approved' && 'Approve Bank Update'}
            {action === 'bank_rejected' && 'Reject Bank Update'}
          </h3>

          <p className="text-center text-gray-600 mb-6 text-sm">
            Are you sure you want to {isApprove ? 'approve' : 'reject'} <strong>{providerName}</strong>{action.startsWith('bank_') ? "'s bank details update" : ''}?
          </p>

          {/* Verification Comparison Sheet */}
          {action === 'bank_approved' && selectedProvider && (
            <div className="mb-6 border border-teal-200 rounded-xl p-4 bg-teal-50/10 text-xs text-secondary font-medium space-y-4">
              <h4 className="font-bold text-teal-800 text-sm border-b pb-2">Verification Comparison Sheet</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Proposed bank details */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submitted Bank Details</span>
                  <div className="space-y-2 bg-white p-3 rounded-lg border border-teal-50">
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase font-bold">Holder Name</span>
                      <div className="font-bold text-secondary text-xs">{selectedProvider.bankDetails?.accountName || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase font-bold">Account Number</span>
                      <div className="font-bold text-secondary font-mono text-xs">{selectedProvider.bankDetails?.accountNo || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase font-bold">IFSC Code</span>
                      <div className="font-bold text-secondary font-mono text-xs">{selectedProvider.bankDetails?.ifsc || 'N/A'}</div>
                    </div>
                    {selectedProvider.bankDetails?.bankName && (
                      <div>
                        <span className="text-gray-500 block text-[9px] uppercase font-bold">Bank Name</span>
                        <div className="font-bold text-secondary text-xs">{selectedProvider.bankDetails.bankName}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Passbook preview */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passbook Document</span>
                  {selectedProvider.bankDetails?.passbookImage ? (
                    <div className="space-y-2">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-teal-150 relative">
                        {selectedProvider.bankDetails.passbookImage.toLowerCase().endsWith('.pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-teal-50/20 text-center">
                            <FileText className="w-8 h-8 text-rose-500 mb-1" />
                            <span className="text-[10px] font-black text-rose-600">PDF Passbook</span>
                          </div>
                        ) : (
                          <img
                            src={selectedProvider.bankDetails.passbookImage}
                            alt="Passbook Preview"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={selectedProvider.bankDetails.passbookImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 rounded-lg text-[9px] font-bold text-center transition-colors"
                        >
                          Open Full Image
                        </a>
                        <a
                          href={selectedProvider.bankDetails.passbookImage}
                          download={`passbook_${selectedProvider.name}.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[9px] font-bold text-center transition-colors"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500 font-bold py-4 text-center">No Passbook Uploaded!</div>
                  )}
                </div>
              </div>

              <div className="border-t border-teal-200/60 pt-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  id="confirm-matched"
                  checked={comparisonConfirmed}
                  onChange={(e) => setComparisonConfirmed(e.target.checked)}
                  className="mt-0.5 accent-primary h-3.5 w-3.5 border-teal-300 rounded cursor-pointer"
                />
                <label htmlFor="confirm-matched" className="text-[10px] font-medium leading-tight text-slate-600 cursor-pointer select-none">
                  I confirm that I have compared the submitted Holder Name, Account Number, and IFSC Code against the passbook image and found them to match.
                </label>
              </div>
            </div>
          )}

          <div className="mb-6 text-left">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isApprove ? 'Remarks' : 'Reason for Rejection'} {!isApprove && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={onRemarksChange}
              placeholder={isApprove ? 'Optional remarks for approval...' : 'Please provide a reason for rejection...'}
              className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${isApprove ? 'focus:ring-primary' : 'focus:ring-red-500'} focus:border-transparent transition-all duration-200 resize-none text-sm`}
              rows={2}
              required={!isApprove}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={processing}
              className="flex-1 px-4 py-2.5 bg-gray-150 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing || (!isApprove && !remarks.trim()) || (action === 'bank_approved' && !comparisonConfirmed)}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-all duration-200 font-bold text-xs ${isApprove
                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50'
                } disabled:cursor-not-allowed`}
            >
              {processing ? (
                <div className="flex items-center justify-center">
                  <div className="rounded-full h-4 w-4 border-b-2 border-white mr-2 animate-spin"></div>
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
