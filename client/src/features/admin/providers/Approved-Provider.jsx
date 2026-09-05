import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../../components/ui/Pagination';
import usePagination from '../../../hooks/usePagination';
import Table from '../../../components/ui/Table';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import {
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  UserCheck,
  UserX,
  Star,
  Shield,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  MoreVertical,
  Download,
  Printer
} from 'lucide-react';
import { toast } from '../../../components/ui/Toast';

import { useAuth } from '../../../context/auth';
import * as AdminService from '../../../services/AdminService';
import { formatDate, formatAddress as formatAddressUtil } from '../../../utils/format';
import StatCard from '../../../components/ui/StatCard';
import { AdminLocalFilterBar } from '../../../components/AdminFilterBar';
import ProviderModal from './components/ProviderModal';

// ─── Pure helpers at module scope ───────────────────────────────────────────

const formatAddress = (address) => formatAddressUtil(address);


const getServiceBadges = (services) => {
  if (!services || services.length === 0) return null;
  return services.map((service, idx) => {
    const name = typeof service === 'object' ? (service.name || service.title || service._id) : service;
    return (
      <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 mr-1 mb-1">
        {name}
      </span>
    );
  });
};

const getStatusBadge = (provider) => {
  if (provider.deletionRequested) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white border border-amber-700 animate-pulse">
        🚨 Deletion Requested
      </span>
    );
  }
  if (provider.blockedTill && new Date(provider.blockedTill) > new Date()) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white border border-red-700">
        <XCircle className="w-3 h-3 mr-1" />Blocked
      </span>
    );
  }
  if (provider.isSuspended) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
        <AlertCircle className="w-3 h-3 mr-1 animate-pulse" />Suspended
      </span>
    );
  }
  if (provider.performanceScore?.restrictionsActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Shield className="w-3 h-3 mr-1 text-amber-600 animate-pulse" />Restricted
      </span>
    );
  }
  if (provider.kycStatus === 'rejected') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" />Rejected
      </span>
    );
  }
  if (provider.approved) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />Approved
      </span>
    );
  }
  if (provider.kycStatus === 'pending') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      <UserX className="w-3 h-3 mr-1" />Inactive
    </span>
  );
};

const getRatingStars = (rating) => {
  if (!rating || rating === 0) return 'No ratings yet';
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < fullStars ? 'text-yellow-400 fill-yellow-400' : (i === fullStars && hasHalfStar ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')}`} />
      ))}
      <span className="ml-1 text-sm text-gray-600">({rating.toFixed(1)})</span>
    </div>
  );
};

const AdminProviders = () => {
  const { token, API, showToast } = useAuth();
  const { reset } = useAdminFilter();

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (searchParams.get('openDetail') === 'true' && providers.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = searchParams.get('search');
      const target = providers.find(p =>
        p._id === searchVal ||
        p.providerId === searchVal ||
        p.name?.toLowerCase().includes((searchVal || '').toLowerCase()) ||
        p.email === searchVal ||
        p.phone === searchVal
      ) || providers[0];
      if (target) {
        setSelectedProvider(target);
        setShowViewModal(true);
      }
    }
  }, [searchParams, providers]);

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    if (searchParams.get('openDetail') === 'true') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('openDetail');
      setSearchParams(newParams, { replace: true });
    }
  };

  const [statusFilter, setStatusFilter] = useState('approved');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState({ show: false, action: null });
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [actionModal, setActionModal] = useState({ isOpen: false, type: null, provider: null });
  const [actionRemarks, setActionRemarks] = useState('');
  const [durationValue, setDurationValue] = useState('');

  const {
    currentPage,
    setCurrentPage,
    limit: itemsPerPage,
    totalPages,
    onPageChange,
    setPaginationData,
    resetPagination
  } = usePagination(1, 10);

  // ─── Derived state via useMemo (replaces two separate useEffects) ────────────────
  const filteredProviders = useMemo(() => {
    let filtered = [...providers];
    if (statusFilter === 'approved') filtered = filtered.filter(p => p.approved);
    else if (statusFilter === 'pending') filtered = filtered.filter(p => !p.approved && p.kycStatus === 'pending');
    else if (statusFilter === 'rejected') filtered = filtered.filter(p => p.kycStatus === 'rejected');
    else if (statusFilter === 'active') filtered = filtered.filter(p => p.isActive);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(lower) ||
        p.email?.toLowerCase().includes(lower) ||
        p.phone?.includes(searchTerm)
      );
    }
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(p => p.services && p.services.includes(serviceFilter));
    }
    if (ratingFilter !== 'all') {
      const minRating = parseInt(ratingFilter);
      filtered = filtered.filter(p => p.averageRating >= minRating && p.averageRating < minRating + 1);
    }
    return filtered;
  }, [providers, statusFilter, searchTerm, serviceFilter, ratingFilter]);

  useEffect(() => {
    setPaginationData({ total: filteredProviders.length });
  }, [filteredProviders.length, setPaginationData]);

  const stats = useMemo(() => ({
    total: providers.length,
    approved: providers.filter(p => p.approved).length,
    pending: providers.filter(p => !p.approved && p.kycStatus === 'pending').length,
    rejected: providers.filter(p => p.kycStatus === 'rejected').length,
    active: providers.filter(p => p.isActive).length
  }), [providers]);

  // Fetch all providers
  const fetchProviders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await AdminService.getAllProviders();
      if (res.data?.success || res.data?.providers || res.data?.data) {
        setProviders(res.data.providers || res.data.data || []);
      }
    } catch (error) {
      console.error('Fetch providers error:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch providers');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdownId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleViewClick = useCallback((provider) => {
    setSelectedProvider(provider);
    setShowViewModal(true);
    setApprovalRemarks('');
  }, []);

  const clearFilters = useCallback(() => {
    reset(() => {
      setStatusFilter('approved');
      setServiceFilter('all');
      setRatingFilter('all');
      setSearchTerm('');
    }, fetchProviders);
  }, [reset, fetchProviders]);

  const openActionModal = (type, providerTarget = null) => {
    const target = providerTarget || selectedProvider;
    setActionModal({ isOpen: true, type, provider: target });
    setActionRemarks('');
    setDurationValue('');
  };

  const handleConfirmActionModal = async () => {
    const targetProvider = actionModal.provider || selectedProvider;
    if (!targetProvider) return;

    if ((actionModal.type === 'restricted' || actionModal.type === 'suspended' || actionModal.type === 'blocked') && !actionRemarks.trim()) {
      showToast('Please enter a reason or remarks for this action', 'error');
      return;
    }
    const days = durationValue.trim();
    await handleStatusUpdate(actionModal.type, days ? Number(days) : null, actionRemarks, targetProvider);
    setActionModal({ isOpen: false, type: null, provider: null });
  };

  const handleStatusUpdate = async (action, durationDays = null, remarksOverride = null, targetProviderOverride = null) => {
    const target = targetProviderOverride || selectedProvider;
    if (!target) return;
    const remarksToUse = remarksOverride !== null ? remarksOverride : approvalRemarks;

    if ((action === 'rejected' || action === 'restricted' || action === 'suspended' || action === 'blocked') && !remarksToUse.trim()) {
      showToast('Please provide a reason or remarks for this action', 'error');
      return;
    }

    try {
      setProcessingAction(action);
      const payload = {
        status: action,
        remarks: remarksToUse,
        rejectionReason: remarksToUse
      };
      if (durationDays !== null && durationDays !== undefined && durationDays !== '') {
        payload.durationDays = Number(durationDays);
      }

      const res = await AdminService.updateProviderStatus(target._id, payload);
      const data = res.data;

      if (data.success) {
        let msg = 'Provider status updated successfully.';
        if (action === 'approved' || action === 'active') msg = 'Provider account activated successfully.';
        if (action === 'restricted') msg = 'Provider account restricted successfully.';
        if (action === 'suspended') msg = 'Provider account suspended successfully.';
        if (action === 'blocked') msg = 'Provider account blocked successfully.';

        showToast(msg, 'success');
        fetchProviders(true);

        if (data.provider) {
          if (selectedProvider && selectedProvider._id === data.provider._id) {
            setSelectedProvider(data.provider);
          }
          setProviders(prev => prev.map(p => p._id === data.provider._id ? data.provider : p));
        }
      } else {
        showToast(data.message || 'Unable to update provider status. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast(error.response?.data?.message || 'Unable to update provider status. Please refresh and try again.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };
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

  const [downloadingDossierId, setDownloadingDossierId] = useState(null);

  const handleDownloadDossierPdf = async (provider) => {
    try {
      setDownloadingDossierId(provider._id);
      showToast(`Generating complete PDF dossier for ${provider.name || 'provider'}...`, 'info');
      const response = await AdminService.getProviderDossierPdf(provider._id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');

      const link = document.createElement('a');
      link.href = fileURL;
      const cleanName = (provider.name || 'Provider').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${cleanName}_${provider.providerId || provider._id}_Dossier.pdf`;
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      showToast('PDF Dossier generated successfully!', 'success');
    } catch (err) {
      console.error('Error downloading provider dossier PDF:', err);
      showToast(err.response?.data?.message || 'Failed to download provider dossier PDF', 'error');
    } finally {
      setDownloadingDossierId(null);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await AdminService.exportProvidersExcel({
        status: statusFilter,
        search: searchTerm
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `providers_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Providers exported successfully!', 'success');
    } catch (err) {
      console.error('Error exporting providers to Excel:', err);
      showToast(err.response?.data?.message || 'Failed to export providers to Excel', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProviders = filteredProviders.slice(indexOfFirstItem, indexOfLastItem);

  const filterFields = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'approved', label: 'Approved' },
        { value: 'all', label: 'All Providers' },
        { value: 'pending', label: 'Pending' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'active', label: 'Active' }
      ]
    },
    {
      key: 'service',
      label: 'Services',
      type: 'select',
      options: [
        { value: 'all', label: 'All Services' },
        { value: 'Electrical', label: 'Electrical' },
        { value: 'AC', label: 'AC' },
        { value: 'Appliance Repair', label: 'Appliance Repair' },
        { value: 'Other', label: 'Other' }
      ]
    },
    {
      key: 'rating',
      label: 'Ratings',
      type: 'select',
      options: [
        { value: 'all', label: 'All Ratings' },
        { value: '5', label: '5 Stars' },
        { value: '4', label: '4+ Stars' },
        { value: '3', label: '3+ Stars' },
        { value: '2', label: '2+ Stars' },
        { value: '1', label: '1+ Stars' }
      ]
    }
  ];

  const handleLocalFilterChange = (key, value) => {
    if (key === 'status') setStatusFilter(value);
    if (key === 'service') setServiceFilter(value);
    if (key === 'rating') setRatingFilter(value);
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Providers Management</h1>
            <p className="text-gray-600 mt-1">Manage service providers and their accounts</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              loading={isExporting}
              icon={Download}
              className="bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-500 shadow-sm"
            >
              Export to Excel
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <StatCard
            title="Total Providers"
            value={stats.total}
            icon={Users}
            iconBg="bg-primary/10"
            iconColor="text-primary"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            icon={UserCheck}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            iconBg="bg-yellow-100"
            iconColor="text-yellow-600"
          />
          <StatCard
            title="Rejected"
            value={stats.rejected}
            icon={UserX}
            iconBg="bg-red-100"
            iconColor="text-red-600"
          />
          <StatCard
            title="Active"
            value={stats.active}
            icon={TrendingUp}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
        </div>

        {/* Filters and Search */}
        <AdminLocalFilterBar
          isInline={true}
          searchValue={searchTerm}
          onSearchChange={(e) => setSearchTerm(e.target.value)}
          onSearchClear={() => {
            setSearchTerm('');
            const newParams = new URLSearchParams(searchParams);
            if (newParams.has('search')) {
              newParams.delete('search');
              setSearchParams(newParams, { replace: true });
            }
          }}
          searchPlaceholder="Search provider by name, email, phone, ID, city, state, pincode..."
          filters={{ status: statusFilter, service: serviceFilter, rating: ratingFilter }}
          onChange={handleLocalFilterChange}
          onClear={clearFilters}
          fields={filterFields}
        />

        {/* Providers Table */}
        <Table
          isLoading={loading}
          className="min-h-[280px]"
          data={currentProviders}
          rowKey="_id"
          emptyTitle="No providers found"
          emptyMessage={
            searchTerm || statusFilter !== 'approved' || serviceFilter !== 'all' || ratingFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No approved providers found'
          }
          columns={[
            {
              header: 'Provider',
              key: 'name',
              accessor: (provider) => (
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <img
                      className="h-10 w-10 rounded-full object-cover"
                      src={provider.profilePicUrl || '/default-avatar.png'}
                      alt={provider.name || "Provider profile photo"}
                      loading="lazy"
                      decoding="async"
                      width={40}
                      height={40}
                      onError={(e) => {
                        e.target.src = '/default-avatar.png';
                      }}
                    />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-secondary">{provider.name}</div>
                    {provider.providerId && (
                      <div className="text-[10px] font-bold text-primary tracking-wider uppercase">{provider.providerId}</div>
                    )}
                    <div className="text-sm text-gray-500">
                      Joined {formatDate(provider.registrationDate || provider.createdAt)}
                    </div>
                  </div>
                </div>
              )
            },
            {
              header: 'Contact',
              key: 'contact',
              accessor: (provider) => (
                <div>
                  <div className="text-sm text-gray-900">{provider.email}</div>
                  <div className="text-sm text-gray-500">{provider.phone}</div>
                </div>
              )
            },
            {
              header: 'Services',
              key: 'services',
              accessor: (provider) => (
                <div className="flex flex-wrap">
                  {getServiceBadges(provider.services)}
                </div>
              )
            },
            {
              header: 'Experience',
              key: 'experience',
              accessor: (provider) => (
                <span className="text-sm text-gray-600">
                  {provider.experience || 0} {provider.experience === 1 ? 'year' : 'years'}
                </span>
              )
            },
            {
              header: 'Bookings',
              key: 'bookings',
              accessor: (provider) => (
                <div>
                  <div className="text-sm text-gray-900">
                    {provider.completedBookings || 0} completed
                  </div>
                  <div className="text-sm text-gray-500">
                    {provider.canceledBookings || 0} canceled
                  </div>
                </div>
              )
            },
            {
              header: 'Performance',
              key: 'performance',
              accessor: (provider) => (
                <div className="flex flex-col gap-1">
                  <div>{getRatingStars(provider.performanceScore?.rating || 0)}</div>
                  <div className="text-xs text-gray-500 flex items-center mt-1">
                    <Clock className="w-3 h-3 mr-1" /> On-Time: {provider.performanceScore?.onTimePercentage?.toFixed(1) || '0.0'}%
                  </div>
                  <div className="text-xs text-gray-500 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" /> Completion: {provider.performanceScore?.completionPercentage?.toFixed(1) || '0.0'}%
                  </div>
                  <div className="text-xs font-semibold flex items-center mt-0.5">
                    <TrendingUp className="w-3 h-3 mr-1 text-primary" /> Badge: <span className="ml-1 font-bold text-gray-800 font-mono capitalize">{provider.performanceBadge || provider.performanceScore?.badge || 'bronze'}</span>
                  </div>
                </div>
              )
            },
            {
              header: 'Status',
              key: 'status',
              accessor: (provider) => getStatusBadge(provider)
            },
            {
              header: 'Actions',
              key: 'actions',
              accessor: (provider, idx) => {
                const isBlocked = provider.blockedTill && new Date(provider.blockedTill) > new Date();
                const isSuspended = provider.isSuspended;
                const isRestricted = provider.performanceScore?.restrictionsActive;
                const isOpen = activeDropdownId === provider._id;
                const isNearBottom = idx > 0 && currentProviders.length >= 3 && idx >= currentProviders.length - 2;

                return (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownId(isOpen ? null : provider._id);
                      }}
                      className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
                      title="Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isOpen && (
                      <div
                        className={`absolute right-0 z-40 w-44 bg-white rounded-xl shadow-xl border border-neutral-200 py-1 text-xs font-medium animate-in fade-in duration-150 ${isNearBottom ? 'bottom-full mb-1' : 'top-8'
                          }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setActiveDropdownId(null);
                            handleViewClick(provider);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-neutral-50 flex items-center gap-2 text-neutral-700 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" /> View Details
                        </button>

                        <button
                          onClick={() => {
                            setActiveDropdownId(null);
                            handleDownloadDossierPdf(provider);
                          }}
                          disabled={downloadingDossierId === provider._id}
                          className="w-full px-3 py-2 text-left hover:bg-teal-50 flex items-center gap-2 text-teal-800 font-semibold transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-teal-700" /> Print / PDF Dossier
                        </button>

                        {isBlocked ? (
                          <button
                            onClick={() => {
                              setActiveDropdownId(null);
                              openActionModal('active', provider);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2 text-emerald-700 font-semibold"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Unblock Account
                          </button>
                        ) : (
                          <>
                            {isRestricted ? (
                              <button
                                onClick={() => {
                                  setActiveDropdownId(null);
                                  openActionModal('active', provider);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2 text-emerald-700 font-semibold"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Remove Restriction
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveDropdownId(null);
                                  openActionModal('restricted', provider);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-amber-50 flex items-center gap-2 text-amber-700 font-semibold"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" /> Restrict Account
                              </button>
                            )}

                            {isSuspended ? (
                              <button
                                onClick={() => {
                                  setActiveDropdownId(null);
                                  openActionModal('active', provider);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2 text-emerald-700 font-semibold"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Unsuspend Account
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveDropdownId(null);
                                  openActionModal('suspended', provider);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-700 font-semibold"
                              >
                                <AlertCircle className="w-3.5 h-3.5" /> Suspend Account
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setActiveDropdownId(null);
                                openActionModal('blocked', provider);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-700 font-semibold"
                            >
                              <X className="w-3.5 h-3.5" /> Block Account
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            }
          ]}
        />
        {filteredProviders.length > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredProviders.length}
              limit={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {/* View Provider Modal */}
        {showViewModal && selectedProvider && (
          <ProviderModal
            provider={selectedProvider}
            onClose={handleCloseViewModal}
            approvalRemarks={approvalRemarks}
            setApprovalRemarks={setApprovalRemarks}
            processingAction={processingAction}
            handleStatusUpdate={handleStatusUpdate}
            handleDownloadPDF={handleDownloadPDF}
            onRefresh={() => fetchProviders(true)}
          />
        )}

        {/* Dedicated Action Confirmation Modal */}
        {actionModal.isOpen && (
          <Modal
            isOpen={actionModal.isOpen}
            onClose={() => setActionModal({ isOpen: false, type: null, provider: null })}
            title={
              actionModal.type === 'restricted'
                ? 'Restrict Provider Account'
                : actionModal.type === 'suspended'
                  ? 'Suspend Provider Account'
                  : actionModal.type === 'blocked'
                    ? 'Block Provider Account'
                    : 'Activate / Restore Provider Account'
            }
            size="medium"
          >
            <div className="space-y-4 p-1">
              {/* Impact Guide Box */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${actionModal.type === 'restricted'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : actionModal.type === 'suspended'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : actionModal.type === 'blocked'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[11px]">Action Impact Guide</p>
                  <p className="leading-relaxed font-medium">
                    {actionModal.type === 'restricted' && '⚠️ Restricting this account disables new booking assignments. The provider can still log in and view earnings history.'}
                    {actionModal.type === 'suspended' && '⛔ Suspending this account restricts all provider login operations. The provider will be logged out immediately.'}
                    {actionModal.type === 'blocked' && '🚫 Blocking this account results in full account termination. Active sessions will be terminated and booking dispatches blocked.'}
                    {actionModal.type === 'active' && '✅ Restores full access. The provider will be able to log in and receive new booking assignments.'}
                  </p>
                </div>
              </div>

              {/* Justification Field */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Reason / Justification {actionModal.type !== 'active' && <span className="text-rose-500">*</span>}
                  <span className="text-neutral-400 font-normal text-[11px] block mt-0.5">
                    This explanation will be sent in an email & push notification to the provider.
                  </span>
                </label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  placeholder={`Enter exact reason for ${actionModal.type} action...`}
                  className="w-full p-2.5 text-xs sm:text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white resize-none shadow-2xs font-medium"
                  rows="3"
                />
              </div>

              {/* Duration Field */}
              {(actionModal.type === 'restricted' || actionModal.type === 'blocked') && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Duration in Days <span className="text-neutral-400 font-normal">(Optional - leave blank for permanent/indefinite)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder={actionModal.type === 'restricted' ? 'e.g. 7 (blank for indefinite)' : 'e.g. 30 (blank for permanent)'}
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="w-full p-2.5 text-xs sm:text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white shadow-2xs font-medium"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false, type: null, provider: null })}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmActionModal}
                  disabled={processingAction}
                  className={`flex-1 py-2.5 px-4 text-xs font-bold text-white rounded-xl transition-all shadow-2xs active:scale-95 disabled:opacity-50 ${actionModal.type === 'restricted'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : actionModal.type === 'suspended'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : actionModal.type === 'blocked'
                        ? 'bg-red-700 hover:bg-red-800'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  {processingAction === actionModal.type ? 'Processing...' : `Confirm ${actionModal.type === 'active' ? 'Activation' : actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1)}`}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default AdminProviders;