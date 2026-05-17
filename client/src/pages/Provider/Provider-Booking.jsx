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
import * as ComplaintService from '../../services/ComplaintService';

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

// ── Proof Upload Modal ──────────────────────────────────────────────────────
const ProofModal = ({ isOpen, onClose, onConfirm, action, loading, progress }) => {
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setImages([]);
      // Auto-capture location
      setGettingLocation(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            setGettingLocation(false);
          },
          (err) => {
            console.error('Location error:', err);
            setGettingLocation(false);
          },
          { timeout: 10000 }
        );
      } else {
        setGettingLocation(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
  };

  const handleRemoveImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const isStart = action === 'start';

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-xl ${isStart ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isStart ? <Play className="w-6 h-6" /> : <CheckSquare className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-secondary">
                {isStart ? 'Start Service Proof' : 'Complete Service Proof'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isStart ? 'Upload before-work images to begin' : 'Upload after-work images to finish'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Image Upload Area */}
            <div>
              <label className="block text-sm font-bold text-secondary mb-3">
                {isStart ? 'Before-Work Photos' : 'Completion Photos'} <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" alt="Proof" />
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {images.length < 6 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center cursor-pointer group">
                    <DownloadCloud className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-primary mt-1">Add Photo</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-gray-400 italic">Minimum 1 image required. Maximum 6.</p>
            </div>

            {/* Location Status */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${location ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${location ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {gettingLocation ? 'Capturing Location...' : location ? 'Location Captured' : 'Location Optional'}
                </span>
              </div>
              {gettingLocation && <Loader className="w-3.5 h-3.5 animate-spin" />}
              {location && <Check className="w-4 h-4" />}
            </div>

            {/* Progress Bar */}
            {loading && progress > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-primary uppercase">
                  <span>Uploading Proofs...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-secondary hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={loading || images.length === 0}
                onClick={() => onConfirm(images, location)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none ${isStart ? 'bg-primary' : 'bg-emerald-600'}`}
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isStart ? 'Start Work' : 'Complete Work'}
              </button>
            </div>
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
  const [proofModal, setProofModal] = useState({ isOpen: false, action: null, bookingId: null });
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
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [disputeResponseText, setDisputeResponseText] = useState('');
  const [disputeImages, setDisputeImages] = useState([]);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

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
      setUploadProgress(0);

      const config = {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      };

      let response;
      if (action === 'accept') response = await BookingService.acceptBooking(bookingId);
      else if (action === 'reject') response = await BookingService.rejectBooking(bookingId);
      else if (action === 'start') {
        const formData = new FormData();
        const images = additionalData.images || selectedImages;
        images.forEach(image => formData.append('images', image));
        if (additionalData.location) {
          formData.append('latitude', additionalData.location.latitude);
          formData.append('longitude', additionalData.location.longitude);
        }
        response = await BookingService.startBooking(bookingId, formData, config);
      }
      else if (action === 'complete') {
        const formData = new FormData();
        const images = additionalData.images || selectedImages;
        images.forEach(image => formData.append('images', image));
        if (additionalData.location) {
          formData.append('latitude', additionalData.location.latitude);
          formData.append('longitude', additionalData.location.longitude);
        }
        response = await BookingService.completeBooking(bookingId, formData, config);
      }
      else throw new Error('Invalid action');

      const result = response.data;

      // Clear any pending toasts to ensure only the latest one shows if needed
      // toast.dismiss(); // Optional: uncomment if you want to be extremely aggressive

      showToast(result.message || `Booking ${action}ed successfully`, 'success');

      await refreshData();
      setShowModal(false);
      setSelectedBooking(null);
      setSelectedImages([]);
      setUploadProgress(0);
      setConfirmDialog({ isOpen: false, type: '', data: null });
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setActionLoading({ id: null, type: null });
      setUploadProgress(0);
    }
  }, [showToast, refreshData, selectedImages]);

  const handleBookingAction = useCallback(async (bookingId, action, additionalData = {}) => {
    if (action === 'start' || action === 'complete') {
      setProofModal({ isOpen: true, action, bookingId });
      return;
    }

    if (action === 'reject') {
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
  }, [executeBookingAction, user, selectedImages, showToast]);

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

  const handleDisputeReply = async () => {
    if (!disputeResponseText.trim()) {
      showToast('Response text is required', 'error');
      return;
    }
    try {
      setIsSubmittingResponse(true);
      const formData = new FormData();
      formData.append('message', disputeResponseText);
      disputeImages.forEach(img => formData.append('images', img));

      await ComplaintService.replyToComplaint(selectedBooking.complaint, formData);
      showToast('Response submitted successfully', 'success');

      setDisputeResponseText('');
      setDisputeImages([]);

      // Refresh details
      await getBookingDetails(selectedBooking._id);
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to submit response', 'error');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

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
            <div className="flex items-center gap-2 flex-wrap">
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
              {/* Dispute / Hold Badges */}
              {booking.disputeRaised && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                  <AlertTriangle className="w-3 h-3" /> Under Review
                </span>
              )}
              {booking.payoutHoldUntil && new Date(booking.payoutHoldUntil) > new Date() && !booking.disputeRaised && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
                  <AlertCircle className="w-3 h-3" /> Payout On Hold
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
              <>
                <button
                  disabled={actionLoading.id === booking._id || ((booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service') && booking.paymentStatus !== 'paid')}
                  onClick={() => handleBookingAction(booking._id, 'start')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors w-full disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {actionLoading.id === booking._id && actionLoading.type === 'start' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {actionLoading.id === booking._id && actionLoading.type === 'start' 
                    ? 'Starting...' 
                    : ((booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service') && booking.paymentStatus !== 'paid')
                      ? 'Payment Pending'
                      : 'Start Service'}
                </button>
                {((booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service') && booking.paymentStatus !== 'paid') && (
                  <p className="text-[10px] text-accent font-bold mt-1 text-center leading-tight">
                    Customer payment is pending. Please ask customer to pay online.
                  </p>
                )}
              </>
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
                        ...(selectedBooking.startedAt ? [{ label: 'Service Started', value: formatDate(selectedBooking.startedAt), color: 'text-blue-600' }] : []),
                        ...(selectedBooking.providerWorkProof?.beforeImages?.length > 0 ? [{ label: 'Work Started Images Uploaded', value: 'Yes', color: 'text-gray-600' }] : []),
                        ...(selectedBooking.completedAt ? [{ label: 'Completed', value: formatDate(selectedBooking.completedAt), color: 'text-green-600' }] : []),
                        ...(selectedBooking.providerWorkProof?.afterImages?.length > 0 ? [{ label: 'Work Completed Images Uploaded', value: 'Yes', color: 'text-gray-600' }] : []),
                        ...(selectedBooking.payoutHoldUntil ? [{ label: 'Payout Hold Until', value: formatDate(selectedBooking.payoutHoldUntil), color: 'text-orange-500' }] : []),
                        ...(selectedBooking.disputeRaised ? [{ label: 'Dispute Raised', value: selectedBooking.disputeStatus || 'UNDER_REVIEW', color: 'text-red-500' }] : []),
                        ...(selectedBooking.adminRefundDecision ? [{ label: 'Admin Decision', value: selectedBooking.adminRefundDecision, color: 'text-purple-600' }] : []),
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className={`font-medium ${color || 'text-secondary'}`}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payout Hold Countdown */}
                    {selectedBooking.payoutHoldUntil && new Date(selectedBooking.payoutHoldUntil) > new Date() && (
                      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <p className="text-xs font-bold text-orange-700 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Payout held until {formatDate(selectedBooking.payoutHoldUntil)}
                        </p>
                        <p className="text-[10px] text-orange-600 mt-1">
                          Your earnings are temporarily on hold. They will be released automatically after the review period or when admin clears it.
                        </p>
                      </div>
                    )}

                    {/* Dispute Alert */}
                    {selectedBooking.disputeRaised && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Dispute: {selectedBooking.disputeStatus?.replace('_', ' ')}
                        </p>
                        {selectedBooking.adminRefundDecision && (
                          <p className="text-[10px] text-red-600 mt-1">
                            Admin Decision: <span className="font-bold capitalize">{selectedBooking.adminRefundDecision}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-red-500 mt-1">Refund Status: {selectedBooking.paymentStatus}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Proofs Section */}
              <div className="mt-6 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg"><Activity className="w-4 h-4 text-primary" /></div>
                    <h3 className="font-semibold text-secondary">Work & Complaint Proofs</h3>
                  </div>
                  {(['accepted', 'in-progress'].includes(selectedBooking.status)) && (
                    <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                      <DownloadCloud className="w-3.5 h-3.5" />
                      Add Photos
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setSelectedImages(prev => [...prev, ...files]);
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Selected Images Preview */}
                {selectedImages.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">To be uploaded ({selectedImages.length})</p>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <span className="text-[10px] font-bold text-primary">{uploadProgress}% Uploading...</span>
                      )}
                    </div>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {selectedImages.map((file, idx) => (
                        <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-primary/30">
                          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={uploadProgress > 0}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Proofs - Comparison UI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Before Section */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">Before Service</p>
                      {selectedBooking.providerWorkProof?.startLocation && (
                        <a
                          href={`https://www.google.com/maps?q=${selectedBooking.providerWorkProof.startLocation.latitude},${selectedBooking.providerWorkProof.startLocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                          <MapPin className="w-3 h-3" /> Location Captured
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedBooking.providerWorkProof?.beforeImages?.length > 0 ? (
                        selectedBooking.providerWorkProof.beforeImages.map((img, idx) => (
                          <div key={idx} onClick={() => setPreviewImage(img.url)} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 hover:border-primary transition-all cursor-pointer group">
                            <img src={img.url} alt="Before" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-3 py-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
                          <Activity className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">No before-work photos</p>
                        </div>
                      )}
                    </div>
                    {selectedBooking.serviceStartedAt && (
                      <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Started: {new Date(selectedBooking.serviceStartedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* After Section */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">After Service</p>
                      {selectedBooking.providerWorkProof?.completionLocation && (
                        <a
                          href={`https://www.google.com/maps?q=${selectedBooking.providerWorkProof.completionLocation.latitude},${selectedBooking.providerWorkProof.completionLocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                        >
                          <MapPin className="w-3 h-3" /> Location Captured
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedBooking.providerWorkProof?.afterImages?.length > 0 ? (
                        selectedBooking.providerWorkProof.afterImages.map((img, idx) => (
                          <div key={idx} onClick={() => setPreviewImage(img.url)} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 hover:border-emerald-500 transition-all cursor-pointer group">
                            <img src={img.url} alt="After" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <CheckSquare className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-3 py-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
                          <Activity className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">No completion photos</p>
                        </div>
                      )}
                    </div>
                    {selectedBooking.serviceCompletedAt && (
                      <p className="text-[10px] text-emerald-600 mt-3 flex items-center gap-1 font-medium">
                        <CheckSquare className="w-3 h-3" /> Completed: {new Date(selectedBooking.serviceCompletedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispute Thread & Response Section */}
              {selectedBooking.disputeRaised && (
                <div className="mt-6 bg-red-50/30 rounded-2xl p-5 border border-red-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-red-100 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
                    <h3 className="font-semibold text-secondary">Dispute Timeline & Responses</h3>
                  </div>

                  {/* Existing Thread */}
                  <div className="space-y-4 mb-6">
                    {selectedBooking.complaintProofs?.map((proof, pIdx) => (
                      <div key={pIdx} className={`bg-white rounded-xl p-4 border ${proof.uploadedBy === 'customer' ? 'border-red-100' : proof.uploadedBy === 'admin' ? 'border-purple-100' : 'border-blue-100'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[10px] font-bold uppercase ${proof.uploadedBy === 'customer' ? 'text-red-600' : proof.uploadedBy === 'admin' ? 'text-purple-600' : 'text-blue-600'}`}>
                            {proof.uploadedBy}
                          </span>
                          <span className="text-[10px] text-gray-400">{formatDate(proof.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{proof.message}</p>
                        {proof.images?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {proof.images.map((img, iIdx) => (
                              <div key={iIdx} onClick={() => setPreviewImage(img.url)} className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 hover:border-primary transition-colors cursor-pointer">
                                <img src={img.url} alt="Proof" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Provider Response Form (Only if dispute is not fully resolved/refunded by admin) */}
                  {selectedBooking.disputeStatus !== 'resolved' && selectedBooking.disputeStatus !== 'refunded' && selectedBooking.complaint && (
                    <div className="bg-white rounded-xl p-4 border border-red-200">
                      <h4 className="text-sm font-bold text-secondary mb-3">Add Your Response</h4>
                      <textarea
                        value={disputeResponseText}
                        onChange={(e) => setDisputeResponseText(e.target.value)}
                        placeholder="Explain your side of the dispute clearly..."
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-300 mb-3 min-h-[100px]"
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-xl transition-colors">
                          <DownloadCloud className="w-4 h-4" /> Add Evidence Photos
                          <input
                            type="file" multiple accept="image/*" className="hidden"
                            onChange={(e) => setDisputeImages(Array.from(e.target.files))}
                          />
                        </label>
                        <button
                          onClick={handleDisputeReply}
                          disabled={isSubmittingResponse || !disputeResponseText.trim()}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors inline-flex items-center justify-center gap-2"
                        >
                          {isSubmittingResponse ? <Loader className="w-4 h-4 animate-spin" /> : 'Submit Response'}
                        </button>
                      </div>

                      {/* Evidence Preview */}
                      {disputeImages.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-xl">
                          {disputeImages.map((file, idx) => (
                            <div key={idx} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                              <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                              <button onClick={() => setDisputeImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                    <div className="flex-1 flex flex-col gap-1">
                      <button
                        disabled={(selectedBooking.paymentMethod === 'cash' || selectedBooking.paymentType === 'pay_after_service') && selectedBooking.paymentStatus !== 'paid'}
                        onClick={() => handleBookingAction(selectedBooking._id, 'start')}
                        className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" /> 
                        {(selectedBooking.paymentMethod === 'cash' || selectedBooking.paymentType === 'pay_after_service') && selectedBooking.paymentStatus !== 'paid'
                          ? 'Payment Pending'
                          : 'Start Service'}
                      </button>
                      {((selectedBooking.paymentMethod === 'cash' || selectedBooking.paymentType === 'pay_after_service') && selectedBooking.paymentStatus !== 'paid') && (
                        <p className="text-[10px] text-accent font-bold text-center leading-tight">
                          Customer payment is pending. Ask customer to pay online.
                        </p>
                      )}
                    </div>
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

      {/* ── Proof Upload Modal ── */}
      <ProofModal
        isOpen={proofModal.isOpen}
        onClose={() => setProofModal({ isOpen: false, action: null, bookingId: null })}
        action={proofModal.action}
        loading={actionLoading.id === proofModal.bookingId}
        progress={uploadProgress}
        onConfirm={(images, location) => {
          executeBookingAction(proofModal.bookingId, proofModal.action, { images, location });
          setProofModal({ isOpen: false, action: null, bookingId: null });
        }}
      />

      {/* ── Confirmation Dialog ── */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, type: '', data: null })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />

      {/* Image Preview Gallery Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999]" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
          <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
            <X className="w-6 h-6" />
          </button>
          <img src={previewImage} className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="Preview" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default ProviderBooking;