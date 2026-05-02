import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../../context/auth';
import {
  Calendar, Clock, MapPin, User, Phone, Mail, DollarSign, Eye, Check, X,
  AlertCircle, Percent, Wallet, Tag, ChevronDown, ChevronUp, Filter,
  ClipboardList, Timer, CheckCheck, HelpCircle, Copy, Zap, Wrench, Play,
  CreditCard, CheckSquare, AlertTriangle, Star, Package, Search, Activity,
  Banknote, Download, FileText, Loader, BarChart2, DownloadCloud, Navigation,
  Home, Info, Shield, FileDigit, PhoneCall
} from 'lucide-react';
import LoadingSpinner from '../../components/Loader';
import * as BookingService from '../../services/BookingService';
import Pagination from '../../components/Pagination';
import { formatDate, formatTime, formatCurrency, formatDuration } from '../../utils/format';

// ── Confirmation Dialog ──────────────────────────────────────────────────────
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, title, message, type = 'default' }) => {
  if (!isOpen) return null;

  const typeStyles = {
    danger: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    default: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const typeIcons = {
    danger: <AlertTriangle className="w-6 h-6 text-red-500" />,
    success: <Check className="w-6 h-6 text-green-500" />,
    warning: <AlertCircle className="w-6 h-6 text-yellow-500" />,
    default: <HelpCircle className="w-6 h-6 text-primary" />,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="p-6">
          <div className="flex items-center mb-4">
            {typeIcons[type] || typeIcons.default}
            <h3 className="text-lg font-semibold text-secondary ml-3">{title}</h3>
          </div>
          <div className={`p-4 rounded-xl border ${typeStyles[type] || typeStyles.default} mb-6`}>
            <p className="text-sm">{message}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-secondary hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
const ProviderBooking = () => {
  const navigate = useNavigate();
  const { API, user, token, logout, showToast } = useAuth();

  const [bookings, setBookings] = useState({ pending: [], accepted: [], 'in-progress': [], completed: [], cancelled: [] });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ booking: true, customer: true, service: true, payment: true, address: true });
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: '', data: null });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBookings: 0, completedBookings: 0, pendingBookings: 0, totalCashCollected: 0, commissionPayable: 0, netEarnings: 0 });
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [downloading, setDownloading] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookingsPerPage, setBookingsPerPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({ id: null, type: null });

  // ── Calculation helpers ──────────────────────────────────────────────────
  const calculateSubtotal = useCallback((booking) => {
    if (!booking?.services) return 0;
    return booking.services.reduce((sum, item) => sum + (item.price * item.quantity) - (item.discountAmount || 0), 0).toFixed(2);
  }, []);

  const calculateServiceSubtotal = useCallback((booking) => {
    if (!booking?.services) return 0;
    return booking.services.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
  }, []);

  const calculateTotalDiscount = useCallback((booking) => {
    if (!booking?.services) return 0;
    return booking.services.reduce((sum, item) => sum + (item.discountAmount || 0), 0).toFixed(2);
  }, []);

  const calculateNetAmount = useCallback((booking) => {
    if (!booking) return 0;
    const totalAmount = booking.totalAmount || calculateSubtotal(booking);
    const commissionAmount = booking.commission?.amount || booking.commissionAmount || 0;
    return (totalAmount - commissionAmount).toFixed(2);
  }, [calculateSubtotal]);

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // ── API calls ────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async (status) => {
    try {
      const response = await BookingService.getBookingsByStatus(status);
      const data = response.data;
      return data.data || [];
    } catch (err) {
      showToast(`Failed to load ${status} bookings`, 'error');
      return [];
    }
  }, [showToast]);

  const calculateStats = useCallback((allBookings) => {
    const completed = allBookings.filter(b => b.status === 'completed');
    const pending = allBookings.filter(b => b.status === 'pending');
    const cashPaid = completed.filter(b => b.paymentMethod === 'cash' && b.paymentStatus === 'paid');
    const totalCashCollected = cashPaid.reduce((sum, b) => {
      const sub = b.services ? b.services.reduce((s, i) => s + (i.price * i.quantity) - (i.discountAmount || 0), 0) : 0;
      return sum + sub + (b.visitingCharge || 0);
    }, 0);
    const commissionPayable = cashPaid.reduce((sum, b) => sum + (b.commission?.amount || b.commissionAmount || 0), 0);
    return { totalBookings: allBookings.length, completedBookings: completed.length, pendingBookings: pending.length, totalCashCollected, commissionPayable, netEarnings: totalCashCollected - commissionPayable };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const all = await Promise.all(['pending', 'accepted', 'in-progress', 'completed', 'cancelled'].map(fetchBookings));
      setBookings({ pending: all[0], accepted: all[1], 'in-progress': all[2], completed: all[3], cancelled: all[4] });
      setStats(calculateStats(all.flat()));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchBookings, calculateStats]);

  useEffect(() => {
    const fetchData = async () => {
      if (token) {
        setLoading(true);
        try {
          const today = new Date();
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(today.getDate() - 7);
          const fmt = (d) => d.toISOString().split('T')[0];
          setDateFilter({ startDate: fmt(oneWeekAgo), endDate: fmt(today) });
          await loadData();
        } catch (error) { console.error('Error fetching data:', error); setLoading(false); }
      }
    };
    fetchData();
  }, [token, loadData]);

  const refreshData = useCallback(async () => { setIsRefreshing(true); await loadData(); }, [loadData]);

  const downloadReport = useCallback(async (reportType) => {
    try {
      if (!dateFilter.startDate || !dateFilter.endDate) { showToast('Please select a date range first', 'error'); return; }
      setDownloading(true);
      if (reportType !== 'providerBooking' && reportType !== 'booking') { 
        showToast('Invalid report type', 'error'); 
        setDownloading(false); 
        return; 
      }
      
      const filename = `provider_booking_report_${dateFilter.startDate}_to_${dateFilter.endDate}.xlsx`;
      const response = await BookingService.providerBookingReport(
        { startDate: dateFilter.startDate, endDate: dateFilter.endDate },
        { responseType: 'blob' }
      );
      
      const blob = response.data;
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
      showToast('Report downloaded successfully', 'success');
    } catch (err) { 
      showToast(err.response?.data?.message || err.message || 'Failed to download report', 'error'); 
    } finally { 
      setDownloading(false); 
    }
  }, [dateFilter, showToast]);

  const executeBookingAction = useCallback(async (bookingId, action, additionalData = {}) => {
    try {
      if (!bookingId) { showToast('Booking ID is missing. Please refresh and try again.', 'error'); return; }
      
      setActionLoading({ id: bookingId, type: action });
      
      let response;
      if (action === 'accept') response = await BookingService.acceptBooking(bookingId);
      else if (action === 'reject') response = await BookingService.rejectBooking(bookingId);
      else if (action === 'start') response = await BookingService.startBooking(bookingId);
      else if (action === 'complete') response = await BookingService.completeBooking(bookingId);
      else throw new Error('Invalid action');

      const result = response.data;
      
      // Clear any pending toasts to ensure only the latest one shows if needed
      // toast.dismiss(); // Optional: uncomment if you want to be extremely aggressive

      showToast(result.message || `Booking ${action}ed successfully`, 'success');
      
      await refreshData(); 
      setShowModal(false); 
      setSelectedBooking(null); 
      setConfirmDialog({ isOpen: false, type: '', data: null });
    } catch (err) { 
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setActionLoading({ id: null, type: null });
    }
  }, [showToast, refreshData]);

  const handleBookingAction = useCallback(async (bookingId, action, additionalData = {}) => {
    if (['reject', 'complete'].includes(action)) {
      setConfirmDialog({
        isOpen: true, type: action === 'reject' ? 'danger' : 'success',
        data: { bookingId, action, additionalData },
        title: action === 'reject' ? 'Reject Booking' : 'Complete Service',
        message: action === 'reject' ? 'Are you sure you want to reject this booking? This action cannot be undone.' : 'Are you sure you want to mark this service as completed?'
      });
      return;
    }
    if (action === 'accept' || action === 'start') {
      setBookings(prev => {
        const updated = { ...prev };
        if (action === 'accept') {
          const idx = updated.pending.findIndex(b => b._id === bookingId);
          if (idx !== -1) { const [b] = updated.pending.splice(idx, 1); updated.accepted.unshift({ ...b, status: 'accepted', provider: user._id }); }
        } else {
          const idx = updated.accepted.findIndex(b => b._id === bookingId);
          if (idx !== -1) { const [b] = updated.accepted.splice(idx, 1); updated['in-progress'].unshift({ ...b, status: 'in-progress' }); }
        }
        return updated;
      });
    }
    await executeBookingAction(bookingId, action, additionalData);
  }, [executeBookingAction, user]);

  const handleConfirmAction = useCallback(() => {
    const { data } = confirmDialog;
    if (data) executeBookingAction(data.bookingId, data.action, data.additionalData);
  }, [confirmDialog, executeBookingAction]);

  const getBookingDetails = useCallback(async (bookingId) => {
    try {
      const response = await BookingService.getProviderBookingById(bookingId);
      const data = response.data;
      setSelectedBooking(data.data || null); setShowModal(true);
    } catch (err) { 
      showToast(err.response?.data?.message || err.message, 'error'); 
      setShowModal(false); 
    }
  }, [showToast]);

  // ── Formatters ───────────────────────────────────────────────────────────
  const formatAddress = useCallback((address) => {
    if (!address) return 'Address not specified';
    if (typeof address === 'string') return address;
    return [address.street, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(', ') || 'Address not specified';
  }, []);

  const getStatusColor = useCallback((status) => {
    const map = { pending: 'bg-yellow-100 text-yellow-700 border-yellow-200', confirmed: 'bg-blue-50 text-blue-700 border-blue-200', accepted: 'bg-blue-100 text-blue-700 border-blue-200', 'in-progress': 'bg-purple-100 text-purple-700 border-purple-200', completed: 'bg-green-100 text-green-700 border-green-200', cancelled: 'bg-red-100 text-red-700 border-red-200' };
    return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  }, []);

  const getStatusIcon = useCallback((status) => {
    const map = { pending: <Timer className="w-3.5 h-3.5" />, accepted: <CheckCheck className="w-3.5 h-3.5" />, 'in-progress': <Activity className="w-3.5 h-3.5" />, completed: <Check className="w-3.5 h-3.5" />, cancelled: <X className="w-3.5 h-3.5" /> };
    return map[status?.toLowerCase()] || <Clock className="w-3.5 h-3.5" />;
  }, []);

  const getServiceIcon = useCallback((category) => {
    if (category?.toLowerCase() === 'electrical') return <Zap className="w-4 h-4 text-yellow-500" />;
    if (['appliance repair', 'repair', 'maintenance'].includes(category?.toLowerCase())) return <Wrench className="w-4 h-4 text-orange-500" />;
    return <Package className="w-4 h-4 text-gray-400" />;
  }, []);


  // ── Filtered bookings ────────────────────────────────────────────────────
  const currentBookings = useMemo(() => {
    let filtered = activeTab === 'all' ? Object.values(bookings).flat() : bookings[activeTab] || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.customer?.name?.toLowerCase().includes(q) ||
        b.services?.some(s => s.service?.title?.toLowerCase().includes(q)) ||
        b.bookingId?.toLowerCase().includes(q) ||
        b._id?.toLowerCase().includes(q));
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (filter === 'today') filtered = filtered.filter(b => new Date(b.date).toISOString().split('T')[0] === todayStr);
    else if (filter === 'upcoming') filtered = filtered.filter(b => new Date(b.date).toISOString().split('T')[0] >= todayStr);
    else if (filter === 'past') filtered = filtered.filter(b => new Date(b.date).toISOString().split('T')[0] < todayStr);
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [bookings, activeTab, searchQuery, filter]);

  const totalPages = Math.ceil(currentBookings.length / bookingsPerPage);
  const paginatedBookings = currentBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage);
  const paginate = (n) => setCurrentPage(n);

  if (loading) return <LoadingSpinner />;

  // ── Stat card ────────────────────────────────────────────────────────────
  const StatCard = ({ label, value, icon: Icon, iconColor = 'text-primary', iconBg = 'bg-primary/10' }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-lg font-bold text-secondary">{value}</p>
        </div>
        <div className={`${iconBg} p-2.5 rounded-xl`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );

  // ── Status badge ─────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      <span className="capitalize">{status === 'in-progress' ? 'In Progress' : status || 'Unknown'}</span>
    </span>
  );

  // ── Booking card ─────────────────────────────────────────────────────────
  const renderBookingCard = (booking) => (
    <div key={booking._id} className="bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-all duration-200">
      <div className="p-4 sm:p-5">

        {/* ── Card body: LEFT info + RIGHT buttons ── */}
        <div className="flex items-start gap-4">

          {/* LEFT: Booking Info */}
          <div className="flex-1 min-w-0">
            {/* Status + ID + Amount */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <StatusBadge status={booking.status} />
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg font-mono">
                #{booking.bookingId || booking._id.slice(-8)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(booking.bookingId || booking._id)}
                className="p-1 text-gray-300 hover:text-secondary transition-colors"
                title="Copy ID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <span className="ml-auto text-sm font-bold text-secondary shrink-0">
                {formatCurrency(booking.totalAmount)}
              </span>
            </div>

            {/* Service & Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                  {getServiceIcon(booking.services?.[0]?.service?.category)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Service</p>
                  <p className="text-sm font-medium text-secondary truncate">
                    {booking.services?.map(s => s.service?.title).join(', ') || 'Service'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent/10 rounded-lg shrink-0">
                  <MapPin className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Address</p>
                  <p className="text-sm font-medium text-secondary truncate">{formatAddress(booking.address)}</p>
                </div>
              </div>
            </div>

            {/* Payment tags */}
            <div className="flex items-center gap-2">
              {(booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service') ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-md">
                  <Banknote className="w-3 h-3" /> Pay After Service
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                  <CreditCard className="w-3 h-3" /> Paid Online
                </span>
              )}
              {booking.paymentStatus === 'paid' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                  <CheckSquare className="w-3 h-3" /> Paid
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: Action Buttons — vertical stack */}
          <div className="flex flex-col gap-2 shrink-0 w-[130px]">
            {/* View Details — always visible */}
            <button
              onClick={() => getBookingDetails(booking._id)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-secondary bg-white hover:bg-gray-50 transition-colors w-full"
            >
              <Eye className="w-3.5 h-3.5" /> View Details
            </button>

            {/* Pending: Accept + Reject */}
            {booking.status === 'pending' && (!booking.provider || booking.provider === user?._id) && (
              <>
                <button
                  disabled={actionLoading.id === booking._id}
                  onClick={() => handleBookingAction(booking._id, 'accept')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors w-full disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {actionLoading.id === booking._id && actionLoading.type === 'accept' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {actionLoading.id === booking._id && actionLoading.type === 'accept' ? 'Accepting...' : 'Accept'}
                </button>
                {booking.paymentStatus !== 'paid' && (
                  <button
                    disabled={actionLoading.id === booking._id}
                    onClick={() => handleBookingAction(booking._id, 'reject', { reason: 'Provider declined' })}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-accent hover:bg-accent/90 transition-colors w-full disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                )}
              </>
            )}

            {/* Accepted: Start Service */}
            {booking.status === 'accepted' && (
              <button
                disabled={actionLoading.id === booking._id}
                onClick={() => handleBookingAction(booking._id, 'start')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors w-full disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {actionLoading.id === booking._id && actionLoading.type === 'start' ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {actionLoading.id === booking._id && actionLoading.type === 'start' ? 'Starting...' : 'Start Service'}
              </button>
            )}

            {/* In-Progress: Complete */}
            {booking.status === 'in-progress' && (
              <button
                disabled={actionLoading.id === booking._id}
                onClick={() => handleBookingAction(booking._id, 'complete')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors w-full disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {actionLoading.id === booking._id && actionLoading.type === 'complete' ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {actionLoading.id === booking._id && actionLoading.type === 'complete' ? 'Completing...' : 'Complete'}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-50 px-5 py-2.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">Created {formatDate(booking.createdAt)}</span>
        <span className="text-xs text-gray-400">{formatDate(booking.date)} · {formatTime(booking.time)}</span>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">My Bookings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and track all your service bookings</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              {showSummary ? 'Hide Stats' : 'Show Stats'}
            </button>
            <button
              onClick={() => setShowReports(!showReports)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
            >
              <DownloadCloud className="w-4 h-4" />
              {showReports ? 'Hide Reports' : 'Reports'}
            </button>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {showSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label="Total" value={stats.totalBookings} icon={ClipboardList} />
            <StatCard label="Completed" value={stats.completedBookings} icon={Check} iconColor="text-green-600" iconBg="bg-green-50" />
            <StatCard label="Pending" value={stats.pendingBookings} icon={Timer} iconColor="text-yellow-600" iconBg="bg-yellow-50" />
            <StatCard label="Cash Collected" value={formatCurrency(stats.totalCashCollected)} icon={Banknote} />
            <StatCard label="Commission" value={formatCurrency(stats.commissionPayable)} icon={Percent} iconColor="text-red-500" iconBg="bg-red-50" />
            <StatCard label="Net Earnings" value={formatCurrency(stats.netEarnings)} icon={BarChart2} iconColor="text-primary" iconBg="bg-primary/10" />
          </div>
        )}

        {/* ── Download Reports ── */}
        {showReports && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <DownloadCloud className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-secondary">Download Reports</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Date Range:</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <DatePicker
                  selected={dateFilter.startDate ? new Date(dateFilter.startDate) : null}
                  onChange={(date) => setDateFilter({ ...dateFilter, startDate: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })}
                  dateFormat="yyyy-MM-dd" placeholderText="Start Date"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                />
                <span className="text-xs text-gray-400">to</span>
                <DatePicker
                  selected={dateFilter.endDate ? new Date(dateFilter.endDate) : null}
                  onChange={(date) => setDateFilter({ ...dateFilter, endDate: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })}
                  dateFormat="yyyy-MM-dd" placeholderText="End Date"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                />
                <button onClick={() => setDateFilter({ startDate: '', endDate: '' })} className="text-sm text-primary hover:text-primary/80 transition-colors">Clear</button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">Date range must be between 7 days and 2 months</p>
            <button
              onClick={() => downloadReport('booking')}
              disabled={!dateFilter.startDate || !dateFilter.endDate || downloading}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {downloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Downloading...' : 'Download Excel'}
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          {/* Row 1: Search — full width */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, service or ID..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Row 2: All 3 filters — always one line */}
          <div className="flex flex-row gap-2">
            {/* Status */}
            <div className="relative flex-1 min-w-0">
              <select
                value={activeTab}
                onChange={(e) => { setActiveTab(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-2.5 pr-7 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm bg-white font-medium w-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary truncate"
              >
                <option value="all">All ({Object.values(bookings).flat().length})</option>
                <option value="pending">Pending ({bookings.pending.length})</option>
                <option value="accepted">Accepted ({bookings.accepted.length})</option>
                <option value="in-progress">In Progress ({bookings['in-progress'].length})</option>
                <option value="completed">Completed ({bookings.completed.length})</option>
                <option value="cancelled">Cancelled ({bookings.cancelled.length})</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Time filter */}
            <div className="relative flex-1 min-w-0">
              <select
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-2.5 pr-7 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm bg-white font-medium w-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
              <Filter className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Per page */}
            <div className="relative flex-1 min-w-0">
              <select
                value={bookingsPerPage}
                onChange={(e) => { setBookingsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="appearance-none pl-2.5 pr-7 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm bg-white font-medium w-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={25}>25 / page</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Booking List ── */}
        {currentBookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-2xl mb-4">
              <ClipboardList className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-secondary mb-2">No bookings found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {searchQuery ? `No results for "${searchQuery}".` : filter !== 'all' ? `No bookings for "${filter}".` : "You don't have any bookings yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 mb-4">
              {paginatedBookings.map(renderBookingCard)}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={currentBookings.length}
              limit={bookingsPerPage}
              onPageChange={paginate}
            />
          </>
        )}
      </div>

      {/* ── Booking Details Modal ── */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-gray-100 max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <ClipboardList className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-secondary">Booking Details</h2>
                    <p className="text-xs text-gray-400">ID: {selectedBooking.bookingId || selectedBooking._id}</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={selectedBooking.status} />
                  <span className="text-sm text-gray-500">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    {formatDate(selectedBooking.date)} · {formatTime(selectedBooking.time)}
                  </span>
                </div>
                <span className="text-lg font-bold text-primary">{formatCurrency(calculateNetAmount(selectedBooking))}</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Service + Payment */}
                <div className="space-y-5">
                  {/* Service Info */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><Package className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-semibold text-secondary">Service Information</h3>
                    </div>
                    <div className="space-y-3">
                      {selectedBooking.services?.map((service, index) => (
                        <div key={index} className="bg-white rounded-xl p-4 border border-gray-100">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getServiceIcon(service.service?.category)}
                                <h4 className="font-medium text-secondary text-sm">{service.service?.title || 'Service'}</h4>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">{service.service?.description || 'No description'}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDuration(service.service?.duration)}</span>
                                <span>Qty: {service.quantity || 1}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary text-sm">{formatCurrency(service.price * (service.quantity || 1))}</p>
                              {service.discountAmount > 0 && <p className="text-xs text-primary">-{formatCurrency(service.discountAmount)}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedBooking.notes && (
                      <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3 flex gap-2">
                        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-secondary mb-1">Additional Instructions</p>
                          <p className="text-xs text-gray-600">{selectedBooking.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Info */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><CreditCard className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-semibold text-secondary">Payment Details</h3>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Payment Method</span>
                        {selectedBooking.paymentMethod === 'cash' ? (
                          <span className="flex items-center gap-1 text-secondary font-medium"><Banknote className="w-4 h-4 text-primary" />Cash on Delivery</span>
                        ) : (
                          <span className="flex items-center gap-1 text-secondary font-medium"><CreditCard className="w-4 h-4 text-primary" />Online Payment</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Payment Status</span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${selectedBooking.paymentStatus === 'paid'
                          ? 'bg-primary/10 text-primary'
                          : (selectedBooking.paymentMethod === 'cash' || selectedBooking.paymentType === 'pay_after_service')
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-accent/10 text-accent'
                          }`}>
                          {selectedBooking.paymentStatus === 'paid' ? 'Paid' : (selectedBooking.paymentMethod === 'cash' || selectedBooking.paymentType === 'pay_after_service') ? 'Pending Collection' : 'Unpaid'}
                        </span>
                      </div>
                    </div>

                    {(selectedBooking.paymentMethod === 'cash' || selectedBooking.paymentType === 'pay_after_service') && selectedBooking.status === 'completed' && selectedBooking.paymentStatus !== 'paid' && (
                      <div className="p-4 border-2 border-dashed border-yellow-200 bg-yellow-50 rounded-xl text-center mb-4">
                        <div className="bg-white p-2 inline-block rounded-lg shadow-sm mb-2">
                          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=COLLECT_CASH" alt="Collect Cash QR" className="w-20 h-20 opacity-60" />
                        </div>
                        <h4 className="text-sm font-bold text-secondary mb-1">Verify Cash Collection</h4>
                        <p className="text-xs text-gray-500 mb-3">Collect ₹{calculateNetAmount(selectedBooking)} from customer.</p>
                        <button className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl text-sm font-bold transition-colors" onClick={() => showToast('Payment collection verified!', 'success')}>
                          Confirm & Close
                        </button>
                      </div>
                    )}

                    <div className="border-t border-gray-200 pt-4 space-y-2">
                      {[
                        { label: 'Service Amount', value: formatCurrency(calculateServiceSubtotal(selectedBooking)) },
                        ...(calculateTotalDiscount(selectedBooking) > 0 ? [{ label: 'Discount', value: `-${formatCurrency(calculateTotalDiscount(selectedBooking))}`, color: 'text-primary' }] : []),
                        { label: 'Subtotal', value: formatCurrency(calculateSubtotal(selectedBooking)) },
                        ...(selectedBooking.visitingCharge > 0 ? [{ label: 'Visiting Charge', value: `+${formatCurrency(selectedBooking.visitingCharge)}`, color: 'text-accent' }] : []),
                        { label: 'Platform Commission', value: `-${formatCurrency(selectedBooking.commission?.amount || selectedBooking.commissionAmount || 0)}`, color: 'text-gray-500' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className={`font-medium ${color || 'text-secondary'}`}>{value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <span className="font-bold text-secondary">Net Amount</span>
                        <span className="font-bold text-primary">{formatCurrency(calculateNetAmount(selectedBooking))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Customer + Address + Timeline */}
                <div className="space-y-5">
                  {/* Customer Info */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><User className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-semibold text-secondary">Customer Information</h3>
                    </div>
                    {['accepted', 'in-progress', 'assigned'].includes(selectedBooking.status) ? (
                      <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg"><User className="w-4 h-4 text-primary" /></div>
                          <div>
                            <p className="text-xs text-gray-400">Name</p>
                            <p className="font-medium text-secondary text-sm">{selectedBooking.customer?.name || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <PhoneCall className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-400">Phone</p>
                              <p className="font-medium text-sm text-secondary">{selectedBooking.customer?.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-400">Email</p>
                              <p className="font-medium text-sm text-secondary truncate">{selectedBooking.customer?.email || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                          <Shield className="w-3.5 h-3.5" /><span>Customer since: {formatDate(selectedBooking.customer?.createdAt)}</span>
                        </div>
                      </div>
                    ) : selectedBooking.status === 'pending' ? (
                      <div className="text-center py-6 bg-white rounded-xl border border-gray-100">
                        <div className="p-3 bg-primary/10 rounded-full inline-flex mb-3"><Shield className="w-5 h-5 text-primary" /></div>
                        <p className="text-sm text-secondary">Details visible after accepting booking.</p>
                        <p className="text-xs text-gray-400 mt-1">Customer privacy for pending requests.</p>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-white rounded-xl border border-gray-100">
                        <div className="p-3 bg-primary/10 rounded-full inline-flex mb-3"><Check className="w-5 h-5 text-primary" /></div>
                        <p className="text-sm text-secondary">Customer information hidden for completed bookings.</p>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><MapPin className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-semibold text-secondary">Service Address</h3>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-start gap-3">
                      <Home className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-700">{formatAddress(selectedBooking.address)}</p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><Clock className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-semibold text-secondary">Booking Timeline</h3>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Created', value: formatDate(selectedBooking.createdAt) },
                        { label: 'Scheduled Date', value: formatDate(selectedBooking.date) },
                        { label: 'Time Slot', value: formatTime(selectedBooking.time) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-secondary">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  {selectedBooking.status === 'pending' && (
                    <>
                      <button onClick={() => handleBookingAction(selectedBooking._id, 'accept')} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <Check className="w-4 h-4" /> Accept Booking
                      </button>
                      <button onClick={() => handleBookingAction(selectedBooking._id, 'reject', { reason: 'Provider declined' })} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <X className="w-4 h-4" /> Reject Booking
                      </button>
                    </>
                  )}
                  {selectedBooking.status === 'accepted' && (
                    <button onClick={() => handleBookingAction(selectedBooking._id, 'start')} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                      <Play className="w-4 h-4" /> Start Service
                    </button>
                  )}
                  {selectedBooking.status === 'in-progress' && (
                    <button onClick={() => handleBookingAction(selectedBooking._id, 'complete')} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                      <Check className="w-4 h-4" /> Complete Service
                    </button>
                  )}
                  <button onClick={() => setShowModal(false)} className="px-4 py-3 border border-gray-200 text-secondary font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Dialog ── */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, type: '', data: null })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default ProviderBooking;