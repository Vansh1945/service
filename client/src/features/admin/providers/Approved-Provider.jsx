import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../../components/ui/Pagination';
import Table from '../../../components/ui/Table';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Modal from '../../../components/ui/Modal';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import {
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Star,
  Shield,
  Banknote,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  FileText
} from 'lucide-react';
import { toast } from '../../../components/ui/Toast';

import { useAuth } from '../../../context/auth';
import * as AdminService from '../../../services/AdminService';
import * as ProviderService from '../../../services/ProviderService';
import { formatDate, formatAddress as formatAddressUtil } from '../../../utils/format';
import StatCard from '../../../components/ui/StatCard';
import { AdminLocalFilterBar } from '../../../components/AdminFilterBar';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState({ show: false, action: null });

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
  const handleStatusUpdate = async (action, durationDays = null) => {
    if (!selectedProvider) return;

    if ((action === 'rejected' || action === 'restricted' || action === 'suspended' || action === 'blocked') && !approvalRemarks.trim()) {
      showToast('Please provide a reason or remarks for this action', 'error');
      return;
    }

    try {
      setProcessingAction(action);
      const payload = {
        status: action,
        remarks: approvalRemarks,
        rejectionReason: approvalRemarks
      };
      if (durationDays !== null) {
        payload.durationDays = Number(durationDays);
      }

      const res = await AdminService.updateProviderStatus(selectedProvider._id, payload);
      const data = res.data;

      if (data.success) {
        let msg = 'Provider approval updated successfully.';
        if (action === 'approved') msg = 'Your provider account has been approved. You can now receive service requests.';
        if (action === 'rejected') msg = 'Your provider application could not be approved at this time. Please review the information provided or contact support.';

        showToast(msg, 'success');
        fetchProviders(true);

        // Update local state without closing the modal or refresh to meet "no page refresh required"
        if (data.provider) {
          setSelectedProvider(data.provider);
          setProviders(prev => prev.map(p => p._id === data.provider._id ? data.provider : p));
        } else {
          setShowViewModal(false);
        }
        setShowConfirmModal({ show: false, action: null });
      } else {
        showToast(data.message || 'Unable to update provider status. Please refresh and try again.', 'error');
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

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProviders = filteredProviders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProviders.length / itemsPerPage);

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
              accessor: (provider) => (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleViewClick(provider)}
                    className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              )
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
          />
        )}
      </div>
    </div>
  );
};

// ─── Provider Detail Modal ──────────────────────────────────────────────────
const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">{label}</span>
    <span className={`text-xs sm:text-sm font-semibold text-neutral-800 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || 'N/A'}</span>
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-primary', bgColor = 'bg-white', children }) => (
  <div className={`${bgColor} rounded-xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all`}>
    <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50/60 border-b border-neutral-100">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} size={16} />}
      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{title}</h4>
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </div>
);

const StatPill = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center rounded-xl p-3.5 bg-white border border-neutral-200/80 shadow-2xs transition-all">
    <span className="text-xl font-bold text-neutral-800 leading-tight">{value}</span>
    <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mt-1 text-center">{label}</span>
  </div>
);

const ProviderModal = ({
  provider,
  onClose,
  approvalRemarks,
  setApprovalRemarks,
  processingAction,
  handleStatusUpdate,
  handleDownloadPDF
}) => {
  const [showDurationInput, setShowDurationInput] = useState(false);
  const [durationType, setDurationType] = useState('restricted'); // or 'blocked'
  const [durationValue, setDurationValue] = useState('');

  if (!provider) return null;
  const ps = provider.performanceScore || {};
  const bd = provider.bankDetails || {};
  const isBlocked = provider.blockedTill && new Date(provider.blockedTill) > new Date();
  const isSuspended = provider.isSuspended;
  const isRestricted = ps.restrictionsActive;
  const isAnyNegativeState = isBlocked || isSuspended || isRestricted;

  const handlePermanentDelete = async (providerId) => {
    if (!window.confirm('Are you sure you want to permanently delete this provider account? This action cannot be undone.')) return;
    try {
      setProcessingAction('permanent_delete');
      const res = await ProviderService.permanentDeleteAccount(providerId);
      if (res.data?.success) {
        toast.success(res.data.message || 'Provider account permanently deleted');
        onClose();
        if (typeof onRefresh === 'function') onRefresh();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete provider account');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRejectDeletion = async (providerId) => {
    try {
      setProcessingAction('reject_deletion');
      const res = await ProviderService.rejectDeletionRequest(providerId);
      if (res.data?.success) {
        toast.success(res.data.message || 'Deletion request rejected successfully');
        onClose();
        if (typeof onRefresh === 'function') onRefresh();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reject deletion request');
    } finally {
      setProcessingAction(null);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-neutral-200/80 animate-scale-up">
        {/* Header */}
        <div className="bg-neutral-50/80 p-5 sm:p-6 relative border-b border-neutral-200/70">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-full transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={provider.profilePicUrl || '/default-avatar.png'}
                  alt={provider.name || "Provider profile photo"}
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                  className="w-14 h-14 rounded-full object-cover border border-neutral-200 bg-white shadow-2xs shrink-0"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-neutral-800 tracking-tight">{provider.name}</h2>
                  {getStatusBadge(provider)}
                  {ps.restrictionsActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                      <Shield size={10} /> Restricted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1.5 flex-wrap font-medium">
                  <span className="font-mono text-neutral-700 bg-neutral-200/60 px-2 py-0.5 rounded-md text-[11px] font-bold">
                    #{provider.providerId || provider._id?.slice(-8)}
                  </span>
                  <span className="flex items-center gap-1"><Mail size={12} className="text-neutral-400" />{provider.email}</span>
                  {provider.phone && <span className="flex items-center gap-1"><Phone size={12} className="text-neutral-400" />{provider.phone}</span>}
                  <span className="flex items-center gap-1"><Calendar size={12} className="text-neutral-400" />Joined {formatDate(provider.registrationDate || provider.createdAt)}</span>
                </div>
              </div>
            </div>

            {provider.averageRating > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Star size={18} className="text-amber-500 fill-amber-500" />
                <div className="text-right">
                  <span className="text-base font-bold text-amber-800 leading-none block">{provider.averageRating.toFixed(1)}</span>
                  <span className="text-[9px] text-amber-600 font-semibold uppercase tracking-wider block mt-0.5">Avg Rating</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-4">

          {/* Restriction Alert */}
          {ps.restrictionsActive && (
            <div className="bg-danger-light/40 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-danger">Account Restricted</p>
                <p className="text-xs text-danger mt-0.5">
                  {ps.restrictionReason || 'Restricted due to poor performance or excessive complaints.'}
                </p>
                {ps.restrictedUntil && (
                  <p className="text-xs text-danger mt-0.5">
                    Until: {new Date(ps.restrictedUntil).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Performance Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill
              label="Completed Jobs"
              value={provider.completedBookings || 0}
            />
            <StatPill
              label="Cancelled Jobs"
              value={provider.canceledBookings || 0}
            />
            <StatPill
              label="Experience"
              value={`${provider.experience || 0}y`}
            />
            <StatPill
              label="Performance Badge"
              value={ps.badge || 'bronze'}
            />
          </div>

          {/* Performance Metrics */}
          <SectionCard title="Performance Metrics" icon={TrendingUp} iconColor="text-primary">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Rating" value={ps.rating > 0 ? `⭐ ${ps.rating.toFixed(1)}` : 'No ratings yet'} />
              <InfoRow label="On-Time %" value={`${ps.onTimePercentage?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Completion %" value={`${ps.completionPercentage?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Cancellation Ratio" value={`${ps.cancellationRatio?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Complaint Ratio" value={`${ps.complaintRatio?.toFixed(1) || '0.0'}%`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">COD Risk</span>
                <span className={`text-xs sm:text-sm font-bold ${ps.codAbuseRisk === 'HIGH' ? 'text-danger' :
                  ps.codAbuseRisk === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{ps.codAbuseRisk || 'LOW'}</span>
              </div>
            </div>
          </SectionCard>

          {/* Contact Information */}
          <SectionCard title="Contact Information" icon={Mail} iconColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Email" value={provider.email} />
              <InfoRow label="Phone" value={provider.phone} />
              <InfoRow label="Date of Birth" value={formatDate(provider.dateOfBirth)} />
              <InfoRow label="Address" value={formatAddress(provider.address)} />
            </div>
            {(provider.address?.s2CellId || provider.address?.s2CellIdPrecise) && (
              <div className="mt-4 bg-neutral-900 text-neutral-100 p-3.5 rounded-xl border border-neutral-800">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin size={12} className="text-teal-400" /> S2 Geofence Telemetry
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {provider.address?.s2CellId && (
                    <div className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-neutral-400 font-medium">Level 13 (≈1km²)</span>
                      <span className="font-mono text-xs text-teal-300 font-semibold">{provider.address.s2CellId}</span>
                    </div>
                  )}
                  {provider.address?.s2CellIdPrecise && (
                    <div className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-neutral-400 font-medium">Level 15 (≈150m²)</span>
                      <span className="font-mono text-xs text-emerald-300 font-semibold">{provider.address.s2CellIdPrecise}</span>
                    </div>
                  )}
                  {provider.address?.lat && provider.address?.lng && (
                    <div className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-neutral-400 font-medium">Coords</span>
                      <span className="font-mono text-xs text-neutral-300">
                        {parseFloat(provider.address.lat).toFixed(5)}, {parseFloat(provider.address.lng).toFixed(5)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Professional Information */}
          <SectionCard title="Professional Information" icon={Briefcase} iconColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-2">Services Offered</span>
                <div className="flex flex-wrap gap-1.5">
                  {getServiceBadges(provider.services) || <span className="text-xs text-neutral-500">N/A</span>}
                </div>
              </div>
              <InfoRow label="Service Area" value={provider.serviceArea} />
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1.5">KYC Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${provider.kycStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  provider.kycStatus === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                  {provider.kycStatus?.charAt(0).toUpperCase() + provider.kycStatus?.slice(1) || 'N/A'}
                </span>
                {provider.rejectionReason && (
                  <p className="text-xs text-rose-600 mt-1">Reason: {provider.rejectionReason}</p>
                )}
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1.5">Test Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${provider.testPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}>
                  {provider.testPassed ? '✓ Passed' : 'Not Passed'}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Bank & Payout Details */}
          {provider.bankDetails && (
            <SectionCard title="Bank & Payout Verification" icon={Banknote} iconColor="text-primary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Account Name" value={bd.accountName} />
                <InfoRow label="Account Number" value={bd.accountNo} mono />
                <InfoRow label="Bank Name" value={bd.bankName} />
                <InfoRow label="IFSC Code" value={bd.ifsc} mono />
                <InfoRow label="UPI ID" value={bd.upiId || 'N/A'} mono />
                <InfoRow label="Preferred Payout Method" value={bd.preferredMethod || 'bank_account'} />
                {bd.district && <InfoRow label="District" value={bd.district} />}
                {bd.address && (
                  <div className="sm:col-span-2">
                    <InfoRow label="Branch Address" value={bd.address} />
                  </div>
                )}
                <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-neutral-100">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Verification Status</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    bd.bankVerificationStatus === 'verified'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : bd.bankVerificationStatus === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {bd.bankVerificationStatus === 'verified'
                      ? '✓ Verified & Active'
                      : bd.bankVerificationStatus === 'rejected'
                        ? '✕ Rejected'
                        : '⏳ Pending Admin Review'}
                  </span>
                </div>
              </div>

              {/* Visual Comparison: Current vs Backup/Pending (If Re-verification Pending) */}
              {(() => {
                let backupData = null;
                if (provider.rejectionReason && provider.rejectionReason.startsWith('{') && provider.rejectionReason.endsWith('}')) {
                  try { backupData = JSON.parse(provider.rejectionReason); } catch (e) { backupData = null; }
                }
                if (!backupData) return null;

                const fields = [
                  { label: 'Holder Name', curr: backupData.accountName, proposed: bd.accountName },
                  { label: 'Account Number', curr: backupData.accountNo, proposed: bd.accountNo },
                  { label: 'IFSC Code', curr: backupData.ifsc, proposed: bd.ifsc },
                  { label: 'Bank Name', curr: backupData.bankName, proposed: bd.bankName },
                ];
                const changedFields = fields.filter(f => (f.curr || '').trim() !== (f.proposed || '').trim());

                return (
                  <div className="mt-4 pt-3 border-t border-neutral-100 bg-amber-50/40 p-4 rounded-xl border border-amber-200/80">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-2">
                      ⚠️ Visual Comparison (Current Verified vs New Proposed)
                    </span>
                    {changedFields.length === 0 ? (
                      <p className="text-xs text-amber-800 italic">No fields changed.</p>
                    ) : (
                      <div className="space-y-2">
                        {fields.map(f => {
                          const isChanged = (f.curr || '').trim() !== (f.proposed || '').trim();
                          return (
                            <div key={f.label} className={`grid grid-cols-3 gap-2 text-xs p-2 rounded-lg ${isChanged ? 'bg-amber-100 border border-amber-300 font-bold' : 'bg-white/60'}`}>
                              <span className="text-neutral-500 font-semibold">{f.label}</span>
                              <span className="text-neutral-700">Current: {f.curr || '—'}</span>
                              <span className={isChanged ? 'text-amber-900 font-extrabold' : 'text-neutral-700'}>
                                New: {f.proposed || '—'} {isChanged && '✏️'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Passbook / Cancelled Cheque Image */}
              {bd.passbookImage && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-2">Passbook / Cheque Document</span>
                  <a href={bd.passbookImage} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <img src={bd.passbookImage} alt="Passbook/Cheque" className="w-32 h-24 object-cover rounded-xl border border-neutral-200 hover:opacity-90 transition-opacity shadow-2xs" />
                  </a>
                </div>
              )}

              {/* Verification History Timeline */}
              {Array.isArray(bd.verificationHistory) && bd.verificationHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-2">Verification Timeline</span>
                  <div className="space-y-2">
                    {bd.verificationHistory.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
                        <span className="font-semibold uppercase tracking-wider text-neutral-700">{item.status}</span>
                        <span className="text-neutral-400">{new Date(item.timestamp).toLocaleString()}</span>
                        <span className="text-neutral-500 italic">{item.reason || 'No remarks'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Legal Contracts & Signatures */}
          <SectionCard title="Legal Contracts & Signatures" icon={FileText} iconColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-neutral-200/80 p-4 rounded-xl bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs sm:text-sm mb-1">Provider Service Agreement</h4>
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Legal contract containing self declaration and digital signature logs.</p>
                </div>
                {provider.legalAcceptance?.agreementAccepted ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(provider._id, 'agreement')}
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
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Registration confirmation letter with approved service details.</p>
                </div>
                {provider.approved ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(provider._id, 'approval')}
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
            {provider.legalAcceptance?.acceptedAt && (
              <div className="mt-4 pt-3 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-neutral-500 font-medium">
                <div>Accepted At: {new Date(provider.legalAcceptance.acceptedAt).toLocaleString()}</div>
                <div>Version: {provider.legalAcceptance.version}</div>
                <div>IP: {provider.legalAcceptance.ipAddress || 'N/A'}</div>
                {provider.digitalSignature?.signatureUrl && (
                  <div className="flex items-center gap-2">
                    <span>Signature:</span>
                    <img src={provider.digitalSignature.signatureUrl} alt="Signature" className="h-6 object-contain bg-white border rounded" />
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Account Controls */}
          <SectionCard title="Account Controls" icon={Shield} iconColor="text-neutral-600" bgColor="bg-neutral-50/60">
            {provider.deletionRequested && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 text-xs">
                    <AlertCircle size={15} className="text-rose-600" />
                    <span>Provider Requested Account Deletion</span>
                  </div>
                  <span className="text-[10px] text-rose-600 font-bold">
                    Requested: {provider.deletionRequestedAt ? formatDate(provider.deletionRequestedAt) : 'Recently'}
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium">
                  Reason: <span className="italic">{provider.deletionReason || 'Provider requested account deletion'}</span>
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(provider._id)}
                    disabled={processingAction}
                    className="py-2 px-3 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    <X size={13} />
                    {processingAction === 'permanent_delete' ? 'Deleting…' : 'Approve & Permanently Delete Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectDeletion(provider._id)}
                    disabled={processingAction}
                    className="py-2 px-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle size={13} />
                    {processingAction === 'reject_deletion' ? 'Rejecting…' : 'Reject Deletion Request'}
                  </button>
                </div>
              </div>
            )}

            <div className="mb-3 p-3 bg-white rounded-xl border border-neutral-200/80 text-xs text-neutral-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800 text-[11px] uppercase tracking-wider">
                <Info size={13} className="text-neutral-500" />
                <span>Actions Guide</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                <span className="font-semibold text-amber-700">Restrict:</span> Disables new booking assignments. &bull; <span className="font-semibold text-rose-700">Suspend:</span> Restricts provider login operations. &bull; <span className="font-semibold text-red-700">Block:</span> Full account termination & logout.
              </p>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Remarks / Justification <span className="text-rose-500 font-normal">(Required for Restrict, Suspend)</span>
              </label>
              <textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                className="w-full p-2.5 text-xs sm:text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white resize-none shadow-2xs font-medium"
                placeholder="Enter justification..."
                rows="2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {isBlocked ? (
                <button
                  onClick={() => handleStatusUpdate('active')}
                  disabled={processingAction}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  {processingAction === 'active' ? 'Unblocking…' : 'Unblock Account'}
                </button>
              ) : (
                <>
                  {/* Restriction buttons */}
                  {isRestricted ? (
                    <button
                      onClick={() => handleStatusUpdate('active')}
                      disabled={processingAction}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      {processingAction === 'active' ? 'Activating…' : 'Remove Restriction'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setDurationType('restricted');
                        setDurationValue('');
                        setShowDurationInput(true);
                      }}
                      disabled={processingAction}
                      className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <AlertTriangle size={14} />
                      Restrict Account
                    </button>
                  )}

                  {/* Suspension buttons */}
                  {isSuspended ? (
                    <button
                      onClick={() => handleStatusUpdate('active')}
                      disabled={processingAction}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      {processingAction === 'active' ? 'Activating…' : 'Unsuspend Account'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusUpdate('suspended')}
                      disabled={processingAction}
                      className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <AlertCircle size={14} />
                      {processingAction === 'suspended' ? 'Suspending…' : 'Suspend Account'}
                    </button>
                  )}

                  {/* Block button */}
                  <button
                    onClick={() => {
                      setDurationType('blocked');
                      setDurationValue('');
                      setShowDurationInput(true);
                    }}
                    disabled={processingAction}
                    className="py-2.5 px-4 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <X size={14} />
                    Block Account
                  </button>
                </>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Sticky Footer ── */}
        <div className="flex-shrink-0 px-6 py-3.5 border-t border-neutral-200/80 bg-neutral-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>

      {showDurationInput && (
        <Modal
          isOpen={showDurationInput}
          onClose={() => setShowDurationInput(false)}
          title={durationType === 'restricted' ? 'Restrict Provider Account' : 'Block Provider Account'}
          size="small"
        >
          <div className="p-1">
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {durationType === 'restricted'
                ? 'Specify the number of days to restrict this provider. Leave blank for an indefinite restriction.'
                : 'Specify the number of days to block this provider. Leave blank for a permanent block.'}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                placeholder={durationType === 'restricted' ? 'e.g. 7 (blank for indefinite)' : 'e.g. 30 (blank for permanent)'}
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
              />
            </div>
            <div className="flex items-center gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setShowDurationInput(false)}
                className="flex-1 py-2 px-4 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDurationInput(false);
                  const days = durationValue.trim();
                  handleStatusUpdate(durationType, days ? Number(days) : null);
                }}
                className={`flex-1 py-2 px-4 text-xs font-bold text-white rounded-lg transition-all ${durationType === 'restricted' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-700 hover:bg-red-800'
                  }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminProviders;