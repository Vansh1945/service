import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import TableSkeleton from '../../components/ui-skeletons/TableSkeleton';
import Modal from '../../components/ui/Modal';
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
  FileText
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import { formatDate } from '../../utils/format';
import StatsCard from '../../components/ui/StatsCard';
import { AdminLocalFilterBar } from '../../components/AdminFilterBar';

// ─── Pure helpers at module scope ───────────────────────────────────────────

const formatAddress = (address) => {
  if (!address) return 'N/A';
  const { street, city, state, postalCode, country } = address;
  return [street, city, state, postalCode, country].filter(Boolean).join(', ');
};

const getServiceBadges = (services) => {
  if (!services || services.length === 0) return null;
  return services.map(service => (
    <span key={service} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 mr-1 mb-1">
      {service}
    </span>
  ));
};

const getStatusBadge = (provider) => {
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

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

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
  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await AdminService.getAllProviders();
      if (res.data?.success || res.data?.providers || res.data?.data) {
        setProviders(res.data.providers || res.data.data || []);
      }
    } catch (error) {
      console.error('Fetch providers error:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleViewClick = useCallback((provider) => {
    setSelectedProvider(provider);
    setShowViewModal(true);
    setApprovalRemarks('');
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter('approved');
    setServiceFilter('all');
    setRatingFilter('all');
    setSearchTerm('');
  }, []);
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
        let msg = `Provider status updated to "${action}" successfully`;
        if (action === 'approved') msg = 'Bank details verified successfully';
        if (action === 'rejected') msg = 'Bank details rejected successfully';

        showToast(msg, 'success');
        fetchProviders();
        
        // Update local state without closing the modal or refresh to meet "no page refresh required"
        if (data.provider) {
          setSelectedProvider(data.provider);
          setProviders(prev => prev.map(p => p._id === data.provider._id ? data.provider : p));
        } else {
          setShowViewModal(false);
        }
        setShowConfirmModal({ show: false, action: null });
      } else {
        showToast(data.message || 'Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast(error.response?.data?.message || 'Failed to update status', 'error');
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
          <StatsCard
            title="Total Providers"
            value={stats.total}
            icon={Users}
            iconBg="bg-primary/10"
            iconColor="text-primary"
          />
          <StatsCard
            title="Approved"
            value={stats.approved}
            icon={UserCheck}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <StatsCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            iconBg="bg-yellow-100"
            iconColor="text-yellow-600"
          />
          <StatsCard
            title="Rejected"
            value={stats.rejected}
            icon={UserX}
            iconBg="bg-red-100"
            iconColor="text-red-600"
          />
          <StatsCard
            title="Active"
            value={stats.active}
            icon={TrendingUp}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
        </div>

        {/* Filters and Search */}
        <AdminLocalFilterBar
          filters={{ status: statusFilter, service: serviceFilter, rating: ratingFilter }}
          onChange={handleLocalFilterChange}
          onClear={clearFilters}
          fields={filterFields}
        />

        {/* Providers Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {(!loading && currentProviders.length === 0) ? (
            <div className="text-center py-12 md:py-16">
              <Users className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
              <p className="text-gray-600 text-md md:text-lg">No providers found</p>
              <p className="text-gray-400 text-sm mt-1 md:mt-2">
                {searchTerm || statusFilter !== 'approved' || serviceFilter !== 'all' || ratingFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No approved providers found'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <TableSkeleton rows={8} cols={8} />
                    ) : (
                      currentProviders.map((provider) => (
                        <tr key={provider._id} className="hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 md:px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <img
                                  className="h-10 w-10 rounded-full object-cover"
                                  src={provider.profilePicUrl || '/default-avatar.png'}
                                  alt={provider.name}
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
                          </td>
                          <td className="px-4 md:px-6 py-4">
                            <div className="text-sm text-gray-900">{provider.email}</div>
                            <div className="text-sm text-gray-500">{provider.phone}</div>
                          </td>
                          <td className="px-4 md:px-6 py-4">
                            <div className="flex flex-wrap">
                              {getServiceBadges(provider.services)}
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {provider.experience || 0} {provider.experience === 1 ? 'year' : 'years'}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {provider.completedBookings || 0} completed
                            </div>
                            <div className="text-sm text-gray-500">
                              {provider.canceledBookings || 0} canceled
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div>{getRatingStars(provider.performanceScore?.rating || 0)}</div>
                              <div className="text-xs text-gray-500 flex items-center mt-1">
                                <Clock className="w-3 h-3 mr-1" /> On-Time: {provider.performanceScore?.onTimePercentage?.toFixed(1) || '0.0'}%
                              </div>
                              <div className="text-xs text-gray-500 flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> Completion: {provider.performanceScore?.completionPercentage?.toFixed(1) || '0.0'}%
                              </div>
                              <div className="text-xs font-semibold flex items-center mt-0.5">
                                <TrendingUp className="w-3 h-3 mr-1 text-primary" /> Badge: <span className="ml-1 font-bold text-gray-800">{provider.performanceBadge || provider.performanceScore?.badge || 'Bronze'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(provider)}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewClick(provider)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredProviders.length}
                limit={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>

        {/* View Provider Modal */}
        {showViewModal && selectedProvider && (
          <ProviderModal
            provider={selectedProvider}
            onClose={() => setShowViewModal(false)}
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
    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
    <span className={`text-sm font-medium text-gray-800 break-all ${mono ? 'font-mono' : ''}`}>{value || 'N/A'}</span>
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-teal-600', bgColor = 'bg-white', children }) => (
  <div className={`${bgColor} rounded-2xl border border-gray-100 shadow-sm overflow-hidden`}>
    <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
      {Icon && <Icon className={`w-4.5 h-4.5 ${iconColor}`} size={18} />}
      <h4 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">{title}</h4>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const StatPill = ({ label, value, color }) => (
  <div className={`flex flex-col items-center justify-center rounded-xl p-3 ${color}`}>
    <span className="text-lg font-extrabold leading-none">{value}</span>
    <span className="text-[10px] font-semibold mt-1 opacity-80 text-center leading-tight">{label}</span>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Gradient Header ── */}
        <div className="relative bg-gradient-to-r from-primary to-teal-700 px-6 pt-6 pb-16 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-xs font-bold text-teal-100 uppercase tracking-widest mb-1">Provider Details</p>
          <h2 className="text-2xl font-extrabold text-white">{provider.name}</h2>
          {provider.providerId && (
            <p className="text-xs text-teal-100 font-mono mt-0.5">{provider.providerId}</p>
          )}
        </div>

        {/* ── Floating Profile Card ── */}
        <div className="relative px-6 -mt-10 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img
              src={provider.profilePicUrl || '/default-avatar.png'}
              alt={provider.name}
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
              className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {getStatusBadge(provider)}
                {ps.restrictionsActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/10 text-danger">
                    <Shield size={10} /> Restricted
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1"><Mail size={11} />{provider.email}</span>
                {provider.phone && <span className="flex items-center gap-1"><Phone size={11} />{provider.phone}</span>}
                <span className="flex items-center gap-1"><Calendar size={11} />Joined {formatDate(provider.registrationDate || provider.createdAt)}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {provider.averageRating > 0 && (
                <div className="flex items-center gap-1 justify-end">
                  <Star size={14} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-lg font-extrabold text-gray-800">{provider.averageRating.toFixed(1)}</span>
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">Avg Rating</p>
            </div>
          </div>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-4">

          {/* Restriction Alert */}
          {ps.restrictionsActive && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
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
              color="bg-success-light text-success"
            />
            <StatPill
              label="Cancelled Jobs"
              value={provider.canceledBookings || 0}
              color="bg-danger-light text-danger"
            />
            <StatPill
              label="Experience"
              value={`${provider.experience || 0}y`}
              color="bg-info-light text-info"
            />
            <StatPill
              label="Performance Badge"
              value={ps.badge || 'Bronze'}
              color="bg-warning-light text-warning"
            />
          </div>

          {/* Performance Metrics */}
          <SectionCard title="Performance Metrics" icon={TrendingUp} iconColor="text-teal-600">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Rating" value={ps.rating > 0 ? `⭐ ${ps.rating.toFixed(1)}` : 'No ratings yet'} />
              <InfoRow label="On-Time %" value={`${ps.onTimePercentage?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Completion %" value={`${ps.completionPercentage?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Cancellation Ratio" value={`${ps.cancellationRatio?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Complaint Ratio" value={`${ps.complaintRatio?.toFixed(1) || '0.0'}%`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">COD Risk</span>
                <span className={`text-sm font-bold ${ps.codAbuseRisk === 'HIGH' ? 'text-red-600' :
                  ps.codAbuseRisk === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-600'
                  }`}>{ps.codAbuseRisk || 'LOW'}</span>
              </div>
            </div>
          </SectionCard>

          {/* Contact Information */}
          <SectionCard title="Contact Information" icon={Mail} iconColor="text-blue-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Email" value={provider.email} />
              <InfoRow label="Phone" value={provider.phone} />
              <InfoRow label="Date of Birth" value={formatDate(provider.dateOfBirth)} />
              <InfoRow label="Address" value={formatAddress(provider.address)} />
            </div>
            {(provider.address?.s2CellId || provider.address?.s2CellIdPrecise) && (
              <div className="mt-4 bg-slate-900 p-3 rounded-xl">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <MapPin size={10} className="text-teal-400" /> S2 Geofence Telemetry
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {provider.address?.s2CellId && (
                    <div className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400">Level 13 (≈1km²)</span>
                      <span className="font-mono text-[10px] text-teal-300">{provider.address.s2CellId}</span>
                    </div>
                  )}
                  {provider.address?.s2CellIdPrecise && (
                    <div className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400">Level 15 (≈150m²)</span>
                      <span className="font-mono text-[10px] text-emerald-300">{provider.address.s2CellIdPrecise}</span>
                    </div>
                  )}
                  {provider.address?.lat && provider.address?.lng && (
                    <div className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400">Coords</span>
                      <span className="font-mono text-[10px] text-slate-300">
                        {parseFloat(provider.address.lat).toFixed(5)}, {parseFloat(provider.address.lng).toFixed(5)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Professional Information */}
          <SectionCard title="Professional Information" icon={Briefcase} iconColor="text-purple-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">Services Offered</span>
                <div className="flex flex-wrap gap-1.5">
                  {getServiceBadges(provider.services) || <span className="text-sm text-gray-500">N/A</span>}
                </div>
              </div>
              <InfoRow label="Service Area" value={provider.serviceArea} />
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">KYC Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${provider.kycStatus === 'approved' ? 'bg-green-100 text-green-800' :
                  provider.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                  {provider.kycStatus?.charAt(0).toUpperCase() + provider.kycStatus?.slice(1) || 'N/A'}
                </span>
                {provider.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1">Reason: {provider.rejectionReason}</p>
                )}
              </div>
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Test Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${provider.testPassed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {provider.testPassed ? '✓ Passed' : 'Not Passed'}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Bank Details */}
          {provider.bankDetails && (
            <SectionCard title="Bank Details" icon={Banknote} iconColor="text-emerald-600">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Account Name" value={bd.accountName} />
                <InfoRow label="Account Number" value={bd.accountNo} mono />
                <InfoRow label="Bank Name" value={bd.bankName} />
                <InfoRow label="IFSC Code" value={bd.ifsc} mono />
                <InfoRow label="District" value={bd.district} />
                <div className="sm:col-span-2">
                  <InfoRow label="Address" value={bd.address} />
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Verification Status</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${bd.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {bd.verified ? '✓ Verified' : '⏳ Pending Verification'}
                  </span>
                </div>
              </div>


            </SectionCard>
          )}

          {/* Legal Contracts & Signatures */}
          <SectionCard title="Legal Contracts & Signatures" icon={FileText} iconColor="text-teal-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-teal-100 p-3.5 rounded-lg bg-teal-50/30 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-gray-700 text-sm mb-1">Provider Service Agreement</h4>
                  <p className="text-xs text-gray-500 mb-3">Legal contract containing self declaration and digital signature logs.</p>
                </div>
                {provider.legalAcceptance?.agreementAccepted ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(provider._id, 'agreement')}
                    className="text-center py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 font-medium text-xs block w-full"
                  >
                    Download/View Agreement PDF
                  </button>
                ) : (
                  <button disabled className="py-2 bg-gray-100 text-gray-400 rounded-lg font-medium text-xs cursor-not-allowed w-full">
                    Agreement Pending Acceptance
                  </button>
                )}
              </div>
              <div className="border border-teal-100 p-3.5 rounded-lg bg-teal-50/30 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-gray-700 text-sm mb-1">Official Approval Letter</h4>
                  <p className="text-xs text-gray-500 mb-3">Registration confirmation letter with approved service details.</p>
                </div>
                {provider.approved ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(provider._id, 'approval')}
                    className="text-center py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 font-medium text-xs block w-full"
                  >
                    Download/View Approval Letter
                  </button>
                ) : (
                  <button disabled className="py-2 bg-gray-100 text-gray-400 rounded-lg font-medium text-xs cursor-not-allowed w-full">
                    Approval Letter Pending Activation
                  </button>
                )}
              </div>
            </div>
            {provider.legalAcceptance?.acceptedAt && (
              <div className="mt-4 pt-3 border-t border-teal-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-500 font-medium">
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
          <SectionCard title="Account Controls" icon={Shield} iconColor="text-slate-600" bgColor="bg-slate-50">
            <div className="mb-4 bg-white p-3 rounded-xl border border-slate-100 space-y-1">
              <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Actions Guide</h5>
              <p className="text-[10px] text-slate-500">
                ⚠️ <strong>Restrict:</strong> Disables new bookings. | 
                🚫 <strong>Suspend:</strong> Restricts login operations. | 
                ❌ <strong>Block:</strong> Complete block & logout.
              </p>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Remarks / Reason <span className="text-red-400">(Required for Restrict, Suspend, Reject)</span>
              </label>
              <textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white resize-none"
                placeholder="Enter justification..."
                rows="2"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {isBlocked ? (
                <button
                  onClick={() => handleStatusUpdate('active')}
                  disabled={processingAction}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {processingAction === 'active' ? 'Unblocking…' : '✓ Unblock'}
                </button>
              ) : (
                <>
                  {/* Restriction buttons */}
                  {isRestricted ? (
                    <button
                      onClick={() => handleStatusUpdate('active')}
                      disabled={processingAction}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {processingAction === 'active' ? 'Activating…' : '✓ Remove Restriction'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setDurationType('restricted');
                        setDurationValue('');
                        setShowDurationInput(true);
                      }}
                      disabled={processingAction}
                      className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      ⚠ Restrict
                    </button>
                  )}

                  {/* Suspension buttons */}
                  {isSuspended ? (
                    <button
                      onClick={() => handleStatusUpdate('active')}
                      disabled={processingAction}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {processingAction === 'active' ? 'Activating…' : '✓ Unsuspend'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusUpdate('suspended')}
                      disabled={processingAction}
                      className="py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {processingAction === 'suspended' ? 'Suspending…' : '🚫 Suspend'}
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
                    className="py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    ❌ Block
                  </button>
                </>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Sticky Footer ── */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
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