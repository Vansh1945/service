import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../../context/auth';
import { useNotification } from '../../context/NotificationContext';
import {
  Calendar, Clock, MapPin, User, Phone, Eye, Check, X,
  AlertCircle, Percent, ChevronDown, Filter,
  ClipboardList, Timer, CheckCheck, HelpCircle, Zap, Wrench, Play,
  CreditCard, CheckSquare, AlertTriangle, Package, Search, Activity,
  Banknote, Download, Loader, BarChart2, DownloadCloud, Navigation,
  Home, Info, Shield, FileDigit, Camera, MessageSquare, Lock
} from 'lucide-react';
import BookingCardSkeleton from '../../components/ui-skeletons/BookingCardSkeleton';
import * as BookingService from '../../services/BookingService';
import Pagination from '../../components/Pagination';
import { formatDate, formatTime, formatCurrency, formatDuration, compressImage } from '../../utils/format';
import PriceDisplay from '../../components/PriceDisplay';
import { isChatVisible, formatAddress, calculateNetAmount } from '../../utils/providerHelpers';
import * as ComplaintService from '../../services/ComplaintService';
import L from 'leaflet';
import ChatModal from '../../components/chat/ChatModal';



// Override default Leaflet marker assets with divIcon to prevent 404 image errors in Vite
const defaultIcon = L.divIcon({ html: `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [1, -34] });
L.Marker.prototype.options.icon = defaultIcon;




const getBookingTypeBadge = (bookingType) => {
  const type = bookingType || 'scheduled';
  let colorClass = '';
  let label = '';
  switch (type.toLowerCase()) {
    case 'scheduled':
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
      label = 'Scheduled';
      break;
    case 'instant':
      colorClass = 'bg-green-50 text-green-700 border-green-200';
      label = 'Instant';
      break;
    case 'emergency':
      colorClass = 'bg-red-50 text-red-700 border-red-200';
      label = 'Emergency';
      break;
    default:
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
      label = 'Scheduled';
  }
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
};


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
const ProofModal = ({ isOpen, onClose, onConfirm, action, loading, progress, minCompletedImages }) => {
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [pin, setPin] = useState('');
  const [notes, setNotes] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const captureLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setGettingLocation(false);
        },
        (err) => {
          console.warn('Geolocation capture failed, using fallback:', err.message);

          setGettingLocation(false);
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
      );
    } else {
      setGettingLocation(false);
    }
  };

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setImages([]);
      setPin('');
      setLocation(null);
      setNotes('');
    }
  }

  useEffect(() => {
    if (isOpen) {
      captureLocation();
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

  const handleSubmit = async () => {
    setCompressing(true);
    try {
      const compressedImages = await Promise.all(
        images.map(img => compressImage(img, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }))
      );
      onConfirm(compressedImages, location, pin, notes);
    } catch (err) {
      console.error("Compression error, using originals:", err);
      onConfirm(images, location, pin, notes);
    } finally {
      setCompressing(false);
    }
  };

  const isStart = action === 'start';

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Sticky Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center gap-3 bg-white">
          <div className={`p-2.5 rounded-xl ${isStart ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {isStart ? <Play className="w-6 h-6" /> : <CheckSquare className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-secondary">
              {isStart ? 'Start Service Verification' : 'Complete Service Verification'}
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
              {isStart ? 'Verify code and upload before-work proof' : 'Verify code and upload completion proof'}
            </p>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 bg-white">
          {/* Verification PIN Input */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-secondary mb-2">
              {isStart ? 'Start Verification PIN' : 'Completion Verification PIN'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4-digit PIN"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold tracking-widest text-secondary focus:outline-none focus:border-primary focus:bg-white transition-all text-center text-lg"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <FileDigit className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Ask the customer for the code displayed in their app dashboard.</p>
          </div>

          {/* Image Upload Area */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-secondary mb-3">
              {isStart ? 'Before-Work Photos' : 'Completion Photos'} <span className="text-red-500">*</span>
            </label>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
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
                <>
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center cursor-pointer group px-1">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-primary transition-colors" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 group-hover:text-primary mt-1 text-center leading-tight">Take Photo<br />(Camera)</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                  </label>
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center cursor-pointer group px-1">
                    <DownloadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-primary transition-colors" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 group-hover:text-primary mt-1 text-center leading-tight">Gallery<br />(Optional)</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-400 italic">Minimum {isStart ? 1 : (minCompletedImages || 1)} image{(isStart ? 1 : (minCompletedImages || 1)) > 1 ? 's' : ''} required. Maximum 6.</p>
          </div>

          {/* Completion Notes Area */}
          {!isStart && (
            <div>
              <label className="block text-xs sm:text-sm font-bold text-secondary mb-1.5">
                Completion Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter details of work completed..."
                rows="2"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-secondary focus:outline-none focus:border-primary focus:bg-white resize-none"
              />
            </div>
          )}

          {/* Location Status */}
          <div className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between ${location ? 'bg-green-50 border-green-150 text-green-700' : 'bg-red-50 border-red-150 text-red-700'}`}>
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${location ? 'text-green-500' : 'text-red-400'}`} />
              <span className="text-xs font-bold uppercase tracking-wider">
                {gettingLocation ? 'Capturing GPS...' : location ? 'Location Captured' : 'GPS Location Required'}
              </span>
            </div>
            {gettingLocation ? (
              <Loader className="w-3.5 h-3.5" />
            ) : location ? (
              <Check className="w-4 h-4" />
            ) : (
              <button
                type="button"
                onClick={captureLocation}
                className="text-xs font-bold text-red-600 hover:text-red-800 underline uppercase"
              >
                Retry
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {(loading || compressing) && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-primary uppercase">
                <span>{compressing ? 'Optimizing & Compressing Photos...' : 'Uploading Proofs...'}</span>
                <span>{compressing ? 'Please wait' : `${progress}%`}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 transition-all duration-300"
                  style={{ width: compressing ? '50%' : `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading || compressing}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50 bg-white"
          >
            Cancel
          </button>
          <button
            disabled={loading || compressing || images.length < (isStart ? 1 : (minCompletedImages || 1)) || pin.length !== 4 || !location || (!isStart && !notes.trim())}
            onClick={handleSubmit}
            className={`flex-1 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none ${isStart ? 'bg-primary' : 'bg-emerald-600'}`}
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 " />
                Uploading...
              </>
            ) : compressing ? (
              <>
                <Loader className="w-4 h-4 " />
                Compressing...
              </>
            ) : (
              <>
                {isStart ? <Play className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                {isStart ? 'Start Work' : 'Complete Work'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

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


// EMERGENCY BOOKING ENGINE UPGRADE
const CountdownTimer = ({ deadline }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const diff = Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;
  if (secs <= 0) return <span className="text-red-500 font-extrabold animate-pulse">Timed Out</span>;
  return <span className="text-orange-500 font-extrabold animate-pulse">{secs}s remaining</span>;
};
// END EMERGENCY BOOKING ENGINE UPGRADE

// ── Main Component ───────────────────────────────────────────────────────────
const ProviderBooking = () => {
  const navigate = useNavigate();
  const { user, token, showToast, systemSettings } = useAuth();
  const { stopBookingAlert } = useNotification() || {};

  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId') || searchParams.get('bookingId');

  const [bookings, setBookings] = useState({ pending: [], accepted: [], 'in-progress': [], completed: [], cancelled: [] });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState('booking');
  const [paymentBreakdownExpanded, setPaymentBreakdownExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ booking: true, customer: true, service: true, payment: true, address: true });
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: '', data: null });
  const [proofModal, setProofModal] = useState({ isOpen: false, action: null, bookingId: null });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBookings: 0, completedBookings: 0, pendingBookings: 0, totalCashCollected: 0, commissionPayable: 0, netEarnings: 0 });
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [downloading, setDownloading] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [chatBookingId, setChatBookingId] = useState(null);
  const [chatRoomType, setChatRoomType] = useState('provider_customer');
  const [currentPage, setCurrentPage] = useState(1);
  const [bookingsPerPage, setBookingsPerPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({ id: null, type: null });
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [navModal, setNavModal] = useState({ isOpen: false, booking: null });

  const [disputeResponseText, setDisputeResponseText] = useState('');
  const [disputeImages, setDisputeImages] = useState([]);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const parallelBookingsCount = (bookings.accepted?.length || 0) + (bookings['in-progress']?.length || 0);
  const isLimitReached = parallelBookingsCount >= 10;

  useEffect(() => {
    if (isLimitReached) {
      showToast("You have reached the maximum limit of parallel bookings (10). Complete your current jobs first.", "error");
    }
  }, [isLimitReached, showToast]);

  // ── Calculation helpers ──────────────────────────────────────────────────




  // ── API calls ────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async (status) => {
    try {
      const response = await BookingService.getBookingsByStatus(status);
      const data = response.data;
      const list = data.data || [];
      return list.filter(b => {
        if (b.paymentMethod === "cash") {
          return true;
        }
        const activeStatuses = ['Assigned', 'Offered', 'Accepted', 'OnTheWay', 'Arrived', 'Started', 'InProgress', 'Reassigned'];
        const normalizedStatus = (b.status || '').toLowerCase().replace(/[^a-z]/g, '');
        const isActive = activeStatuses.some(s => s.toLowerCase() === normalizedStatus);
        if (isActive) {
          return true;
        }
        return ["paid", "escrow_hold"].includes(b.paymentStatus);
      });
    } catch (err) {
      showToast(`Failed to load ${status} bookings`, 'error');
      return [];
    }
  }, [showToast]);

  const calculateStats = useCallback((allBookings) => {
    const completed = allBookings.filter(b => (b.status || '').toLowerCase().replace(/[^a-z]/g, '') === 'completed');
    const pending = allBookings.filter(b => ['pending', 'searchingprovider', 'offered', 'assigned', 'reassigned'].includes((b.status || '').toLowerCase().replace(/[^a-z]/g, '')));
    const cashPaid = completed.filter(b => b.paymentMethod === 'cash' && (b.paymentStatus || '').toLowerCase() === 'paid');
    const totalCashCollected = cashPaid.reduce((sum, b) => {
      const sub = b.services ? b.services.reduce((s, i) => s + (i.price * i.quantity) - (i.discountAmount || 0), 0) : 0;
      return sum + sub + (b.visitingCharge || 0);
    }, 0);
    const commissionPayable = cashPaid.reduce((sum, b) => sum + (b.commission?.amount || b.commissionAmount || 0), 0);
    return { totalBookings: allBookings.length, completedBookings: completed.length, pendingBookings: pending.length, totalCashCollected, commissionPayable, netEarnings: totalCashCollected - commissionPayable };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [allBookings, pendingBookings] = await Promise.all([
        fetchBookings('all'),
        fetchBookings('pending')
      ]);

      const combinedMap = new Map();
      allBookings.forEach(b => combinedMap.set(b._id, b));
      pendingBookings.forEach(b => combinedMap.set(b._id, b));
      const combinedList = Array.from(combinedMap.values());

      const pendingList = [];
      const acceptedList = [];
      const inProgressList = [];
      const completedList = [];
      const cancelledList = [];

      combinedList.forEach(b => {
        const s = (b.status || '').toLowerCase().replace(/[^a-z]/g, '');
        if (['pending', 'searchingprovider', 'offered', 'assigned', 'reassigned'].includes(s)) {
          pendingList.push(b);
        } else if (['accepted', 'scheduled', 'confirmed'].includes(s)) {
          acceptedList.push(b);
        } else if (['inprogress', 'started', 'ontheway', 'arrived'].includes(s)) {
          inProgressList.push(b);
        } else if (['completed'].includes(s)) {
          completedList.push(b);
        } else if (['cancelled', 'rejected', 'expired', 'refunded'].includes(s)) {
          cancelledList.push(b);
        } else {
          pendingList.push(b);
        }
      });

      setBookings({
        pending: pendingList,
        accepted: acceptedList,
        'in-progress': inProgressList,
        completed: completedList,
        cancelled: cancelledList
      });
      setStats(calculateStats(combinedList));
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
        timeout: 120000, // 2 minutes timeout for large camera uploads
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      };

      let response;
      if (action === 'accept') {
        response = await BookingService.acceptBooking(bookingId);
        if (stopBookingAlert) stopBookingAlert();
      }
      else if (action === 'reject') {
        response = await BookingService.rejectBooking(bookingId);
        if (stopBookingAlert) stopBookingAlert();
      }
      else if (action === 'start') {
        const formData = new FormData();
        const images = additionalData.images || selectedImages;
        images.forEach(image => formData.append('images', image));
        if (additionalData.location) {
          formData.append('latitude', additionalData.location.latitude);
          formData.append('longitude', additionalData.location.longitude);
        }
        if (additionalData.pin) {
          formData.append('pin', additionalData.pin);
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
        if (additionalData.pin) {
          formData.append('pin', additionalData.pin);
        }
        if (additionalData.completionNotes) {
          formData.append('completionNotes', additionalData.completionNotes);
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
      setProofModal({ isOpen: false, action: null, bookingId: null });
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
      setSelectedBooking(data.data || null);
      // PROVIDER UX UPGRADE
      setModalActiveTab('booking');
      setPaymentBreakdownExpanded(false);
      // END PROVIDER UX UPGRADE
      setShowModal(true);
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      setShowModal(false);
    }
  }, [showToast]);

  const openBookingModalAtTab = useCallback(async (bookingId, tabId) => {
    await getBookingDetails(bookingId);
    setModalActiveTab(tabId);
  }, [getBookingDetails]);

  useEffect(() => {
    if (entityId) {
      getBookingDetails(entityId);
    }
  }, [entityId, getBookingDetails]);

  const handleDisputeReply = async () => {
    if (!disputeResponseText.trim()) {
      showToast('Response text is required', 'error');
      return;
    }
    try {
      setIsSubmittingResponse(true);

      const compressedImages = await Promise.all(
        disputeImages.map(img => compressImage(img, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }))
      );

      const formData = new FormData();
      formData.append('message', disputeResponseText);
      compressedImages.forEach(img => formData.append('images', img));

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


  const getStatusColor = useCallback((status) => {
    const map = {
      pending: 'bg-accent/10 text-accent border border-accent/20',
      searchingprovider: 'bg-accent/10 text-accent border border-accent/20',
      offered: 'bg-accent/10 text-accent border border-accent/20',
      assigned: 'bg-primary/10 text-primary border border-primary/20',
      accepted: 'bg-primary/10 text-primary border border-primary/20',
      ontheway: 'bg-secondary/10 text-secondary border border-secondary/20',
      arrived: 'bg-secondary/10 text-secondary border border-secondary/20',
      started: 'bg-secondary/10 text-secondary border border-secondary/20',
      inprogress: 'bg-secondary/10 text-secondary border border-secondary/20',
      completed: 'bg-primary/15 text-primary border border-primary/25',
      cancelled: 'bg-red-50 text-red-600 border border-red-200',
      rejected: 'bg-red-50 text-red-600 border border-red-200',
      expired: 'bg-red-50 text-red-600 border border-red-200',
      reassigned: 'bg-accent/10 text-accent border border-accent/20',
      refunded: 'bg-red-50 text-red-600 border border-red-200'
    };
    const key = status?.toLowerCase().replace(/[^a-z]/g, '') || 'pending';
    return map[key] || map[status?.toLowerCase()] || 'bg-gray-100 text-secondary/70 border border-gray-200';
  }, []);

  const getStatusIcon = useCallback((status) => {
    const map = {
      pending: <Timer className="w-3.5 h-3.5" />,
      searchingprovider: <Timer className="w-3.5 h-3.5" />,
      offered: <Timer className="w-3.5 h-3.5" />,
      assigned: <CheckCheck className="w-3.5 h-3.5" />,
      accepted: <CheckCheck className="w-3.5 h-3.5" />,
      ontheway: <Activity className="w-3.5 h-3.5" />,
      arrived: <Activity className="w-3.5 h-3.5" />,
      started: <Activity className="w-3.5 h-3.5" />,
      inprogress: <Activity className="w-3.5 h-3.5" />,
      completed: <Check className="w-3.5 h-3.5" />,
      cancelled: <X className="w-3.5 h-3.5" />,
      rejected: <X className="w-3.5 h-3.5" />,
      expired: <X className="w-3.5 h-3.5" />,
      reassigned: <Timer className="w-3.5 h-3.5" />,
      refunded: <X className="w-3.5 h-3.5" />
    };
    const key = status?.toLowerCase().replace(/[^a-z]/g, '') || 'pending';
    return map[key] || map[status?.toLowerCase()] || <Clock className="w-3.5 h-3.5" />;
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
    if (filter === 'today') {
      filtered = filtered.filter(b => {
        const bookingDateStr = new Date(b.date).toISOString().split('T')[0];
        if (bookingDateStr === todayStr) return true;
        const s = (b.status || '').toLowerCase().replace(/[^a-z]/g, '');
        const isActive = ['accepted', 'scheduled', 'confirmed', 'inprogress', 'started', 'ontheway', 'arrived'].includes(s);
        return isActive && bookingDateStr < todayStr;
      });
    }
    else if (filter === 'upcoming') filtered = filtered.filter(b => new Date(b.date).toISOString().split('T')[0] >= todayStr);
    else if (filter === 'past') filtered = filtered.filter(b => new Date(b.date).toISOString().split('T')[0] < todayStr);
    else if (filter === 'emergency') filtered = filtered.filter(b => b.bookingType === 'emergency' || b.isEmergency);
    else if (filter === 'instant') filtered = filtered.filter(b => b.bookingType === 'instant' || b.isInstant);
    else if (filter === 'scheduled') filtered = filtered.filter(b => b.bookingType === 'scheduled' || (!b.isEmergency && !b.isInstant));
    // EMERGENCY BOOKING ENGINE UPGRADE
    const typePriority = {
      'emergency': 1,
      'instant': 2,
      'scheduled': 3
    };
    const statusPriority = {
      'in-progress': 1,
      'accepted': 2,
      'pending': 3,
      'completed': 4,
      'cancelled': 5
    };
    return filtered.sort((a, b) => {
      const typeA = typePriority[(a.bookingType || '').toLowerCase()] || (a.isEmergency ? 1 : (a.isInstant ? 2 : 3));
      const typeB = typePriority[(b.bookingType || '').toLowerCase()] || (b.isEmergency ? 1 : (b.isInstant ? 2 : 3));
      if (typeA !== typeB) {
        return typeA - typeB;
      }
      const pA = statusPriority[a.status?.toLowerCase()] || 99;
      const pB = statusPriority[b.status?.toLowerCase()] || 99;
      if (pA !== pB) {
        return pA - pB;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    // END EMERGENCY BOOKING ENGINE UPGRADE
  }, [bookings, activeTab, searchQuery, filter]);

  const totalPages = Math.ceil(currentBookings.length / bookingsPerPage);
  const paginatedBookings = currentBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage);
  const paginate = (n) => setCurrentPage(n);

  // ── Booking card ─────────────────────────────────────────────────────────
  const renderBookingCard = (booking) => {
    const currentStatus = (booking.status || 'Pending').toLowerCase().replace(/[^a-z]/g, '');
    const isPending = currentStatus === 'pending' || currentStatus === 'assigned' || currentStatus === 'searchingprovider' || currentStatus === 'offered' || currentStatus === 'reassigned';
    const isAccepted = currentStatus === 'accepted';
    const isInProgress = currentStatus === 'inprogress' || currentStatus === 'started' || currentStatus === 'ontheway' || currentStatus === 'arrived';
    const isCompleted = currentStatus === 'completed';
    const isCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected' || currentStatus === 'expired' || currentStatus === 'refunded';

    const isEmergency = booking.bookingType?.toLowerCase() === 'emergency' || booking.isEmergency;
    const isInstant = booking.bookingType?.toLowerCase() === 'instant' || booking.isInstant;

    const calculatedEarnings = calculateNetAmount(booking);
    const distanceText = booking.liveDistance
      ? `${booking.liveDistance} km${booking.liveDuration ? ` (${booking.liveDuration})` : ''}`
      : (booking.distanceText || 'Nearby');

    const approxArea = booking.address?.area || booking.address?.suburb || booking.address?.locality || booking.address?.city || 'Nearby Area';
    const customerRating = booking.customer?.rating || booking.customer?.averageRating || booking.customer?.performanceScore?.rating || 4.8;
    const durationText = booking.estimatedDuration ? `${booking.estimatedDuration} hrs` : (booking.services?.[0]?.service?.duration ? `${booking.services[0].service.duration} hrs` : '1 hr');

    let borderStyle = "border-neutral-200";
    let glowStyle = "shadow-sm";
    if (isEmergency) {
      borderStyle = "border-2 border-danger";
      glowStyle = "shadow-md shadow-danger-light/50";
    } else if (isInstant) {
      borderStyle = "border border-accent";
      glowStyle = "shadow-md shadow-accent/10";
    } else if (isCancelled) {
      borderStyle = "border border-neutral-300 opacity-75";
    }

    const renderStatusBadge = () => {
      let colorClass = "bg-neutral-100 text-neutral-600 border-neutral-200";
      if (isEmergency) colorClass = "bg-danger text-white border-danger";
      else if (isInstant) colorClass = "bg-accent text-white border-accent";
      else if (isCompleted) colorClass = "bg-success text-white border-success";
      else if (isCancelled) colorClass = "bg-neutral-300 text-neutral-600 border-neutral-400";
      else if (isAccepted) colorClass = "bg-primary text-white border-primary";
      else if (isInProgress) colorClass = "bg-warning text-neutral-900 border-warning";

      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${colorClass}`}>
          {isEmergency && <AlertCircle className="w-3 h-3 animate-pulse" />}
          {booking.status}
        </span>
      );
    };

    return (
      <div key={booking._id} className={`bg-white rounded-xl border ${borderStyle} ${glowStyle} hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col p-4 gap-3`}>
        {/* Top: Status Badge, Priority Badge, Booking ID, Created Date */}
        <div className="flex items-center justify-between text-[11px] text-neutral-500 border-b border-neutral-100 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {renderStatusBadge()}
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${isEmergency ? 'bg-danger-light text-danger border-danger/20' : (isInstant ? 'bg-accent/10 text-accent border-accent/20' : 'bg-info-light text-info border-info/20')}`}>
              {isEmergency ? '⚠️ Critical' : (isInstant ? '⚡ Instant' : '📅 Scheduled')}
            </span>
            {booking.providerResponseDeadline && isPending && (
              <span className="text-[9px] bg-danger-light text-danger border border-danger/15 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" />
                <CountdownTimer deadline={booking.providerResponseDeadline} />
              </span>
            )}
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="font-mono font-bold text-secondary">#{booking.bookingId || booking._id.slice(-8)}</span>
            <span className="text-[9px] text-neutral-400">Created {formatDate(booking.createdAt)}</span>
          </div>
        </div>

        {/* Middle: Service Name, Customer, Amount, Bonus */}
        <div className="flex items-start justify-between gap-4 py-1">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-secondary truncate">
              {booking.services?.map(s => s.service?.title).join(', ') || 'Electrical Service'}
            </h4>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-600">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span className="font-medium truncate">{booking.customer?.name || 'Guest Customer'}</span>
            </div>
          </div>
          
          <div className="text-right shrink-0 flex flex-col items-end">
            <span className="text-sm font-bold text-secondary">₹{calculatedEarnings}</span>
            {booking.providerEmergencyShare > 0 && (
              <span className="text-[9px] text-accent font-bold mt-0.5">
                +₹{booking.providerEmergencyShare} Bonus
              </span>
            )}
          </div>
        </div>

        {/* Bottom: Address, Time, Payment, Rating */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-50 rounded-xl p-3 border border-neutral-100">
          <div className="col-span-2 flex items-start gap-1.5 text-neutral-600">
            <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-tight">
              {isPending ? approxArea : formatAddress(booking.address)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-600">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span className="truncate">{formatDate(booking.date)} · {formatTime(booking.time)}</span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 text-neutral-600 truncate">
              <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
              <span className="truncate">{(booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service') ? 'COD' : 'Online'}</span>
            </div>
            <span className="text-amber-500 font-bold flex items-center shrink-0">
              ⭐ {Number(customerRating).toFixed(1)}
            </span>
          </div>
        </div>

        {/* Footer: Call, Navigate, View Details, Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-neutral-100">
          
          {/* Secondary Actions Group */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {/* Details (always there) */}
            <button
              onClick={() => getBookingDetails(booking._id)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-secondary text-xs font-bold rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span className="hidden xs:inline sm:inline">Details</span>
              <span className="xs:hidden sm:hidden">Info</span>
            </button>

            {/* Call customer if accepted & not completed */}
            {!isPending && booking.customer && !isCompleted && booking.customer.phone && (
              <a
                href={`tel:${booking.customer.phone}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-secondary text-xs font-bold rounded-lg transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-success" />
                <span>Call</span>
              </a>
            )}

            {/* Navigate option */}
            {!isPending && !isCompleted && (
              <button
                onClick={() => navigate(`/provider/track/${booking._id}`)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-secondary text-xs font-bold rounded-lg transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-success" />
                <span>Map</span>
              </button>
            )}

            {/* Chat option */}
            {!isPending && !isCompleted && isChatVisible(booking) && (
              <button
                onClick={() => { setChatBookingId(booking._id); setChatRoomType('provider_customer'); }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-secondary text-xs font-bold rounded-lg transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-info" />
                <span>Chat</span>
              </button>
            )}
          </div>

          {/* Primary Action Group */}
          <div className="w-full sm:w-auto">
            {isPending ? (
              (!booking.provider || booking.provider === user?._id || booking.provider?._id === user?._id || (booking.provider?.toString && booking.provider.toString() === user?._id?.toString())) && (
                <div className="flex gap-1.5 w-full">
                  <button
                    disabled={actionLoading.id !== null}
                    onClick={() => handleBookingAction(booking._id, 'accept')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {actionLoading.id === booking._id && actionLoading.type === 'accept' ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Accept</span>
                  </button>
                  <button
                    disabled={actionLoading.id !== null}
                    onClick={() => handleBookingAction(booking._id, 'reject')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger/95 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {actionLoading.id === booking._id && actionLoading.type === 'reject' ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    <span>Reject</span>
                  </button>
                </div>
              )
            ) : !isCompleted ? (
              <div className="w-full">
                {isAccepted ? (
                  <button
                    disabled={actionLoading.id !== null || (booking.paymentMethod !== 'cash' && booking.paymentType !== 'pay_after_service' && !['paid', 'escrow_hold'].includes(booking.paymentStatus))}
                    onClick={() => handleBookingAction(booking._id, 'start')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-lg transition-all disabled:bg-neutral-300 disabled:cursor-not-allowed"
                  >
                    {actionLoading.id === booking._id && actionLoading.type === 'start' ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Start</span>
                  </button>
                ) : isInProgress ? (
                  <div className="flex gap-1.5 w-full">
                    <button
                      onClick={() => setProofModal({ isOpen: true, action: 'start', bookingId: booking._id })}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-warning hover:bg-warning/95 text-neutral-900 text-xs font-bold rounded-lg transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Photo</span>
                    </button>
                    <button
                      disabled={actionLoading.id !== null}
                      onClick={() => handleBookingAction(booking._id, 'complete')}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-success hover:bg-success/95 text-white text-xs font-bold rounded-lg transition-all disabled:bg-neutral-300"
                    >
                      {actionLoading.id === booking._id && actionLoading.type === 'complete' ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Complete</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // PROVIDER UX UPGRADE
  const isSelectedPending = ['pending', 'assigned', 'searchingprovider', 'offered', 'reassigned'].includes((selectedBooking?.status || '').toLowerCase().replace(/[^a-z]/g, ''));
  const isSelectedCompleted = (selectedBooking?.status || '').toLowerCase().replace(/[^a-z]/g, '') === 'completed';
  const selectedBookingTabs = selectedBooking ? [
    { id: 'booking', label: 'Booking Summary' },
    ...(!isSelectedPending ? [
      ...(!isSelectedCompleted ? [{ id: 'customer', label: 'Customer Details' }] : []),
      { id: 'payment', label: 'Payment Info' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'proofs', label: 'Work Proofs' }
    ] : [])
  ] : [];
  const selectedActiveTabId = selectedBookingTabs.some(t => t.id === modalActiveTab) ? modalActiveTab : 'booking';
  // END PROVIDER UX UPGRADE

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 font-inter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {isLimitReached && (
          <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="text-sm font-bold text-secondary">Booking Limit Reached</h4>
              <p className="text-xs text-neutral-550 mt-0.5 font-medium">
                You have reached the maximum limit of parallel bookings (10). Complete your current jobs first.
              </p>
            </div>
          </div>
        )}

        {/* ── Page Title ── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-secondary tracking-tight">My Bookings</h1>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">Manage and track your service jobs</p>
          </div>
        </div>

        {/* ── Download Reports Accordion (Secondary Section now at the top) ── */}
        <div className="bg-white border border-neutral-100 rounded-xl shadow-sm transition-all duration-200 mb-6">
          <button
            onClick={() => setShowReports(!showReports)}
            className="w-full px-4 py-3.5 flex items-center justify-between text-secondary hover:bg-neutral-50 transition-colors rounded-xl"
          >
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">Download Reports</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-neutral-450 transition-transform duration-200 ${showReports ? 'rotate-180' : ''}`} />
          </button>
          
          {showReports && (
            <div className="px-4 pb-4 pt-2 border-t border-neutral-100 bg-neutral-50 rounded-b-xl animate-slide-up">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">Start Date</label>
                    <DatePicker
                      selected={dateFilter.startDate ? new Date(dateFilter.startDate) : null}
                      onChange={(date) => setDateFilter({ ...dateFilter, startDate: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="YYYY-MM-DD"
                      className="border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">End Date</label>
                    <DatePicker
                      selected={dateFilter.endDate ? new Date(dateFilter.endDate) : null}
                      onChange={(date) => setDateFilter({ ...dateFilter, endDate: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="YYYY-MM-DD"
                      className="border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white w-full"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadReport('booking')}
                    disabled={!dateFilter.startDate || !dateFilter.endDate || downloading}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/95 disabled:bg-neutral-200 disabled:text-neutral-400 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    {downloading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>{downloading ? 'Downloading...' : 'Excel'}</span>
                  </button>
                  <button
                    onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                    className="px-3 py-2.5 text-xs font-bold text-neutral-500 hover:text-danger hover:bg-danger-light rounded-lg transition-colors border border-transparent"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-2 font-medium">Note: Date range must be between 7 days and 2 months.</p>
            </div>
          )}
        </div>

        {/* ── Search (Full Width) ── */}
        <div className="mb-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search bookings by ID, service name, or customer..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ── Filters (All on a single line on both mobile and desktop) ── */}
        <div className="grid grid-cols-3 md:flex md:flex-row gap-1.5 mb-6">
          {/* Status Filter */}
          <div className="relative md:flex-1">
            <select
              value={activeTab}
              onChange={(e) => { setActiveTab(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-2 pr-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-[10px] font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm truncate"
            >
              <option value="all">All ({Object.values(bookings).flat().length})</option>
              <option value="pending">Pending ({bookings.pending.length})</option>
              <option value="accepted">Accepted ({bookings.accepted.length})</option>
              <option value="in-progress">In Progress ({bookings['in-progress'].length})</option>
              <option value="completed">Completed ({bookings.completed.length})</option>
              <option value="cancelled">Cancelled ({bookings.cancelled.length})</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          </div>

          {/* Time Filter */}
          <div className="relative flex-1">
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-2 pr-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-[10px] font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
            >
              <option value="all">All Jobs</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="emergency">Emergency</option>
              <option value="instant">Instant</option>
              <option value="scheduled">Scheduled</option>
              <option value="past">Past</option>
            </select>
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          </div>

          {/* Per Page Filter */}
          <div className="relative flex-1">
            <select
              value={bookingsPerPage}
              onChange={(e) => { setBookingsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full appearance-none pl-2 pr-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-[10px] font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Booking List ── */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingCardSkeleton key={i} />
            ))}
          </div>
        ) : currentBookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-150 p-12 text-center flex flex-col items-center justify-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-50 rounded-2xl mb-4 border border-neutral-100">
              <ClipboardList className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">No Bookings Found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              {searchQuery ? `We couldn't find any results matching "${searchQuery}".` : "There are no bookings matching the selected filters."}
            </p>
            {(searchQuery || activeTab !== 'all' || filter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                  setFilter('all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 mb-6">
              {paginatedBookings.map(renderBookingCard)}
            </div>

            {/* Pagination */}
            <div className="mb-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={currentBookings.length}
                limit={bookingsPerPage}
                onPageChange={paginate}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Booking Details Modal ── */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-gray-100 max-h-[90vh] overflow-y-auto flex flex-col">

            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-t-2xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="hidden sm:block p-1 bg-primary/10 rounded-lg">
                    <ClipboardList className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-secondary font-black leading-tight">Booking Details</h2>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusColor(selectedBooking.status)}`}>
                        {getStatusIcon(selectedBooking.status)}
                        <span className="capitalize">{selectedBooking.status}</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      ID: {selectedBooking.bookingId || selectedBooking._id} · <Calendar className="w-3 h-3 inline-block mx-0.5 text-primary align-text-top" /> {formatDate(selectedBooking.date)} · {formatTime(selectedBooking.time)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">You'll Receive</span>
                  <span className="text-lg sm:text-xl font-black text-primary"><PriceDisplay amount={calculateNetAmount(selectedBooking)} type="text-only" /></span>
                </div>
              </div>

              {/* Tabs Selector Row - instant loaded */}
              <div className="flex border-b border-gray-200 mt-2 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {selectedBookingTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setModalActiveTab(tab.id)}
                    className={`px-3 py-1.5 font-black text-[11px] border-b-2 transition-all whitespace-nowrap uppercase tracking-wider ${selectedActiveTabId === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* ── BOOKING TAB ── */}
              {selectedActiveTabId === 'booking' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">

                  {/* Left: Service List */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><Package className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Service Information</h3>
                    </div>
                    <div className="space-y-3">
                      {selectedBooking.services?.map((service, index) => (
                        <div key={index} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div className="flex-grow min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {getServiceIcon(service.service?.category)}
                                <h4 className="font-bold text-secondary text-sm">{service.service?.title || 'Service'}</h4>
                                {service.service?.serviceType && service.service?.serviceType !== 'standard' && (
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${service.service?.serviceType === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {service.service?.serviceType}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mb-2 truncate">
                                {service.service?.shortDescription || 'No description'}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1 font-semibold"><Timer className="w-3 h-3 text-primary" />{formatDuration(service.service?.duration)}</span>
                                <span className="font-semibold">Qty: {service.quantity || 1}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="font-black text-primary text-sm">{formatCurrency(service.price * (service.quantity || 1))}</p>
                              {service.discountAmount > 0 && <p className="text-xs text-red-500">-{formatCurrency(service.discountAmount)}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Service Address */}
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex gap-2">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-secondary mb-1 uppercase tracking-wider">Service Address</p>
                        <p className="text-xs text-gray-600 font-medium">{formatAddress(selectedBooking.address)}</p>
                      </div>
                    </div>

                    {selectedBooking.notes && (
                      <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3 flex gap-2">
                        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-secondary mb-1">Special Instructions</p>
                          <p className="text-xs text-gray-650">{selectedBooking.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Assignment Details */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><Shield className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Assignment Details</h3>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3 text-xs font-semibold text-gray-650">
                      <div className="flex justify-between items-center">
                        <span>Booking Type</span>
                        {getBookingTypeBadge(selectedBooking.bookingType)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Priority Status</span>
                        <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full ${selectedBooking.isEmergency ? 'bg-red-100 text-red-700' : (selectedBooking.isInstant ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')}`}>
                          {selectedBooking.isEmergency ? 'Highest' : (selectedBooking.isInstant ? 'Medium' : 'Normal')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Estimated Job Duration</span>
                        <span className="text-secondary font-bold">
                          {selectedBooking.estimatedDuration ? `${selectedBooking.estimatedDuration} hrs` : (selectedBooking.services?.[0]?.service?.duration ? `${selectedBooking.services[0].service.duration} hrs` : 'N/A')}
                        </span>
                      </div>
                      {selectedBooking.metadata?.assignedAt && (
                        <div className="flex justify-between items-center">
                          <span>Assigned At</span>
                          <span className="font-mono text-secondary">{new Date(selectedBooking.metadata.assignedAt).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span>Provider Requirement</span>
                        <span className="text-secondary font-bold">
                          {selectedBooking.trustedProviderOnly ? 'Trusted Expert Partner' : 'Standard Partner'}
                        </span>
                      </div>
                      <div className="border-t border-gray-100 pt-3">
                        <span className="text-[9px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">Workflow Instructions</span>
                        <p className="text-xs text-gray-500 italic">
                          {selectedBooking.bookingType === 'emergency'
                            ? '🚨 High priority emergency service requested. Please rush immediately.'
                            : selectedBooking.bookingType === 'instant'
                              ? '⚡ Instant request. Ensure you are ready to mobilize.'
                              : '📅 Standard scheduled booking. Reach location by the slotted time.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CUSTOMER TAB (Locked before Acceptance) ── */}
              {selectedActiveTabId === 'customer' && !isSelectedPending && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">

                  {/* Customer Profile Info */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg"><User className="w-4 h-4 text-primary" /></div>
                        <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Customer Profile</h3>
                      </div>
                      <div className="flex gap-2">
                        {selectedBooking.customer?.phone && (
                          <a
                            href={`tel:${selectedBooking.customer.phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call
                          </a>
                        )}
                        {isChatVisible(selectedBooking) && selectedBooking.provider && selectedBooking.provider.toString() === user?._id?.toString() && (
                          <button
                            onClick={() => {
                              setShowModal(false);
                              setChatBookingId(selectedBooking._id);
                              setChatRoomType('provider_customer');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3 text-xs font-semibold text-gray-650">
                      <div className="flex justify-between">
                        <span>Name</span>
                        <span className="text-secondary font-bold">{selectedBooking.customer?.name || 'Not specified'}</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Email Address</span>
                        <span className="text-secondary font-bold break-all">{selectedBooking.customer?.email || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>User Rating</span>
                        <span className="text-amber-500 font-bold">⭐ {Number(selectedBooking.customer?.rating || selectedBooking.customer?.averageRating || selectedBooking.customer?.performanceScore?.rating || 4.8).toFixed(1)}</span>
                      </div>
                      <div className="border-t border-gray-100 pt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Member since: {formatDate(selectedBooking.customer?.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Address & Navigation */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg"><MapPin className="w-4 h-4 text-primary" /></div>
                        <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Exact Address</h3>
                      </div>
                      {['accepted', 'in-progress', 'assigned'].includes(selectedBooking.status) && (
                        <button
                          onClick={() => {
                            setShowModal(false);
                            navigate(`/provider/track/${selectedBooking._id}`);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Navigate
                        </button>
                      )}
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm text-secondary font-bold">
                      <Home className="w-4 h-4 text-gray-400 inline mr-2 shrink-0" />
                      {formatAddress(selectedBooking.address)}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PAYMENT TAB (Locked before Acceptance) ── */}
              {selectedActiveTabId === 'payment' && !isSelectedPending && (() => {
                const netReceivable = selectedBooking.providerEarnings || selectedBooking.pricingBreakdown?.providerEarnings || 0;
                const platformFee = selectedBooking.commissionAmount || selectedBooking.pricingBreakdown?.platformCommission || 0;

                const visitingAllowance = selectedBooking.providerVisitingShare || 0;
                const emergencyBonus = selectedBooking.providerEmergencyShare || 0;

                const rainBonus = selectedBooking.providerRainShare || 0;
                const trafficBonus = selectedBooking.providerTrafficShare || 0;
                const nightBonus = selectedBooking.providerNightShare || 0;
                const demandBonus = selectedBooking.providerDemandShare || 0;
                const surgeBonus = parseFloat((rainBonus + trafficBonus + nightBonus + demandBonus).toFixed(2)) || 0;

                const discount = selectedBooking.totalDiscount || selectedBooking.pricingBreakdown?.discount || 0;
                const servicePrice = selectedBooking.subtotal || 0;

                return (
                  <div className="max-w-2xl mx-auto bg-gray-50 rounded-2xl p-6 border border-gray-100 animate-fade-in space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><CreditCard className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Receivables Breakdown</h3>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-6 rounded-2xl text-center">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">YOU'LL RECEIVE</span>
                      <span className="text-4xl font-black text-emerald-700">₹{netReceivable.toFixed(2)}</span>

                      <button
                        onClick={() => setPaymentBreakdownExpanded(!paymentBreakdownExpanded)}
                        className="mt-4 text-xs font-black text-primary hover:text-primary/90 flex items-center gap-1 mx-auto border-b border-primary border-dashed pb-0.5"
                      >
                        {paymentBreakdownExpanded ? 'Hide Breakdown ▲' : 'View Breakdown ▼'}
                      </button>

                      {paymentBreakdownExpanded && (
                        <div className="mt-6 border-t border-emerald-500/20 pt-4 space-y-3 text-left text-xs font-semibold text-gray-650 max-w-md mx-auto">
                          <div className="flex justify-between">
                            <span>Service Price (Base)</span>
                            <span className="font-bold text-secondary">₹{servicePrice}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between">
                              <span>Discount Deduction</span>
                              <span className="font-bold text-red-650">-₹{discount}</span>
                            </div>
                          )}
                          {platformFee > 0 && (
                            <div className="flex justify-between">
                              <span>Service Fee Deduction</span>
                              <span className="font-bold text-red-650">-₹{platformFee}</span>
                            </div>
                          )}
                          {visitingAllowance > 0 && (
                            <div className="flex justify-between">
                              <span>Visiting Allowance</span>
                              <span className="font-bold text-emerald-600">+₹{visitingAllowance}</span>
                            </div>
                          )}
                          {emergencyBonus > 0 && (
                            <div className="flex justify-between">
                              <span>Emergency Allowance</span>
                              <span className="font-bold text-emerald-600">+₹{emergencyBonus}</span>
                            </div>
                          )}
                          {surgeBonus > 0 && (
                            <div className="flex justify-between">
                              <span>Surge Allowance (Demand/Rain/Night)</span>
                              <span className="font-bold text-emerald-600">+₹{surgeBonus}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-gray-200 pt-3 font-bold text-sm text-secondary">
                            <span>Net receivable earning</span>
                            <span className="text-emerald-700">₹{netReceivable.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>



                    {/* General details */}
                    <div className="space-y-3 text-xs font-semibold text-gray-650 border-t border-gray-150 pt-4">
                      <div className="flex justify-between">
                        <span>Payment Mode</span>
                        <span className="text-secondary font-bold uppercase">{selectedBooking.paymentMethod === 'cash' ? 'Cash / Pay after service' : 'Paid Online'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Settlement Status</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${(selectedBooking.status === 'completed' && ['paid', 'escrow_hold'].includes(selectedBooking.paymentStatus)) ? 'bg-green-150 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {(selectedBooking.status === 'completed' && ['paid', 'escrow_hold'].includes(selectedBooking.paymentStatus)) ? 'Settled' : 'Pending Settlement'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── TIMELINE TAB ── */}
              {selectedActiveTabId === 'timeline' && !isSelectedPending && (
                <div className="max-w-xl mx-auto bg-gray-50 rounded-2xl p-5 border border-gray-100 animate-fade-in space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg"><Clock className="w-4 h-4 text-primary" /></div>
                    <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Tracking Timeline</h3>
                  </div>

                  <div className="relative mt-2 pl-1">
                    <div className="absolute left-[12px] top-3 bottom-3 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {(() => {
                        const steps = [
                          { label: 'Booking Created', statuses: ['pending', 'searchingprovider', 'offered', 'assigned', 'accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                          { label: 'Provider Assigned', statuses: ['assigned', 'accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                          { label: 'Accepted', statuses: ['accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                          { label: 'On The Way', statuses: ['ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                          { label: 'Arrived', statuses: ['arrived', 'started', 'inprogress', 'completed'] },
                          { label: 'Started', statuses: ['started', 'inprogress', 'completed'] },
                          { label: 'Completed', statuses: ['completed'] }
                        ];

                        return steps.map((step, idx) => {
                          const history = selectedBooking.statusHistory || [];
                          const match = history.find(h => {
                            const s = (h.status || '').toLowerCase().replace(/[^a-z]/g, '');
                            return step.statuses.includes(s);
                          });
                          const isCompleted = !!match || step.statuses.includes((selectedBooking.status || '').toLowerCase().replace(/[^a-z]/g, ''));
                          const timestamp = match ? match.timestamp : null;

                          return (
                            <div key={idx} className="relative flex items-center mb-1">
                              <div className={`relative z-20 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isCompleted ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 border border-gray-300 text-gray-400'
                                }`}>
                                {isCompleted ? '✓' : idx + 1}
                              </div>
                              <div className="ml-4 flex-1">
                                <h4 className={`text-xs font-bold leading-tight ${isCompleted ? 'text-secondary font-black' : 'text-gray-400 font-medium'
                                  }`}>
                                  {step.label}
                                </h4>
                                {timestamp && (
                                  <span className="text-[9px] text-gray-400 font-mono block mt-0.5">{new Date(timestamp).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Dispute Alert inside Timeline */}
                  {selectedBooking.disputeRaised && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Dispute Raised: {selectedBooking.disputeStatus?.replace('_', ' ')}
                      </p>
                      {selectedBooking.adminRefundDecision && (
                        <p className="text-[10px] text-red-600 mt-1">
                          Decision: <span className="font-bold uppercase">{selectedBooking.adminRefundDecision}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-red-500 mt-0.5">Refund Status: {selectedBooking.paymentStatus}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── PROOFS TAB ── */}
              {selectedActiveTabId === 'proofs' && !isSelectedPending && (
                <div className="max-w-3xl mx-auto bg-gray-50 rounded-2xl p-5 border border-gray-100 animate-fade-in space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg"><Activity className="w-4 h-4 text-primary" /></div>
                      <h3 className="font-black text-secondary text-sm uppercase tracking-wide">Work & Complaint Evidence</h3>
                    </div>

                    {/* Photo Upload triggers only when accepted / in progress */}
                    {['accepted', 'inprogress', 'in-progress', 'started', 'ontheway', 'arrived'].includes((selectedBooking.status || '').toLowerCase().replace(/[^a-z]/g, '')) && (
                      <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                        <DownloadCloud className="w-3.5 h-3.5" />
                        {selectedBooking.providerWorkProof?.beforeImages?.length > 0 ? 'Upload Completion Photo' : 'Upload Before Photo'}
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

                  {/* Show selected files preview */}
                  {selectedImages.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Queueing for upload ({selectedImages.length})</p>
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
                          <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-primary/30">
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

                  {/* Progress Specific disclosure logic: only show after start-job (in-progress or completed) */}
                  {(['inprogress', 'in-progress', 'started', 'ontheway', 'arrived', 'completed', 'cancelled', 'rejected', 'expired', 'refunded'].includes((selectedBooking.status || '').toLowerCase().replace(/[^a-z]/g, ''))) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before work proof */}
                      <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase">Before Service Photos</span>
                          {selectedBooking.providerWorkProof?.startLocation && (
                            <a
                              href={`https://www.google.com/maps?q=${selectedBooking.providerWorkProof.startLocation.latitude},${selectedBooking.providerWorkProof.startLocation.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-primary font-bold flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> GPS Pin
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedBooking.providerWorkProof?.beforeImages?.length > 0 ? (
                            selectedBooking.providerWorkProof.beforeImages.map((img, idx) => (
                              <div key={idx} onClick={() => setPreviewImage(img.url)} className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:border-primary transition-all">
                                <img src={img.url} alt="Before" className="w-full h-full object-cover" />
                              </div>
                            ))
                          ) : (
                            <div className="col-span-3 py-6 text-center text-gray-400 text-xs font-semibold">
                              No before photos uploaded.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* After work completion proof */}
                      <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase">Completion Photos</span>
                          {selectedBooking.providerWorkProof?.completionLocation && (
                            <a
                              href={`https://www.google.com/maps?q=${selectedBooking.providerWorkProof.completionLocation.latitude},${selectedBooking.providerWorkProof.completionLocation.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> GPS Pin
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedBooking.providerWorkProof?.afterImages?.length > 0 ? (
                            selectedBooking.providerWorkProof.afterImages.map((img, idx) => (
                              <div key={idx} onClick={() => setPreviewImage(img.url)} className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:border-emerald-500 transition-all">
                                <img src={img.url} alt="After" className="w-full h-full object-cover" />
                              </div>
                            ))
                          ) : (
                            <div className="col-span-3 py-6 text-center text-gray-400 text-xs font-semibold">
                              {selectedBooking.status === 'in-progress' ? (
                                <button
                                  onClick={() => {
                                    setShowModal(false);
                                    handleBookingAction(selectedBooking._id, 'complete');
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shadow-sm"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" /> Upload & Complete
                                </button>
                              ) : 'No completion photos.'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 border-2 border-dashed border-gray-200 text-center rounded-xl bg-white">
                      <Lock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <h4 className="text-sm font-bold text-secondary">Work Proofs Locked</h4>
                      <p className="text-xs text-gray-400 mt-1">Start the job and complete verification to unlock work proof uploads.</p>
                    </div>
                  )}

                  {/* Dispute Raised Details */}
                  {selectedBooking.disputeRaised && (
                    <div className="bg-red-50/50 p-4 rounded-xl border border-red-200 space-y-4">
                      <h4 className="text-xs font-bold text-red-800 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Dispute Details</h4>

                      <div className="space-y-3">
                        {selectedBooking.complaintProofs?.map((proof, pIdx) => (
                          <div key={pIdx} className="bg-white p-3 rounded-lg border border-red-100 text-xs">
                            <div className="flex justify-between font-bold text-red-600 mb-1">
                              <span className="uppercase">{proof.uploadedBy}</span>
                              <span className="text-[10px] text-gray-400">{formatDate(proof.createdAt)}</span>
                            </div>
                            <p className="text-gray-700">{proof.message}</p>
                          </div>
                        ))}
                      </div>

                      {selectedBooking.disputeStatus !== 'resolved' && selectedBooking.disputeStatus !== 'refunded' && selectedBooking.complaint && (
                        <div className="bg-white p-3 rounded-xl border border-red-200 space-y-2">
                          <textarea
                            value={disputeResponseText}
                            onChange={(e) => setDisputeResponseText(e.target.value)}
                            placeholder="Describe details for dispute resolution..."
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-red-300 min-h-[60px]"
                          />
                          <button
                            onClick={handleDisputeReply}
                            disabled={isSubmittingResponse || !disputeResponseText.trim()}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white py-1.5 rounded-lg text-xs font-bold"
                          >
                            Submit Dispute Response
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end rounded-b-2xl">
              {selectedBooking.status === 'pending' && (
                <button
                  disabled={actionLoading.id !== null || isLimitReached}
                  onClick={() => handleBookingAction(selectedBooking._id, 'accept')}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md flex items-center gap-1.5"
                >
                  {actionLoading.id === selectedBooking._id && actionLoading.type === 'accept' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Accept Booking</span>
                </button>
              )}
              {(selectedBooking.status === 'accepted' || selectedBooking.status === 'assigned') && (
                <button
                  disabled={actionLoading.id !== null || (selectedBooking.paymentMethod !== 'cash' && selectedBooking.paymentType !== 'pay_after_service' && !['paid', 'escrow_hold'].includes(selectedBooking.paymentStatus))}
                  onClick={() => handleBookingAction(selectedBooking._id, 'start')}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading.id === selectedBooking._id && actionLoading.type === 'start' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>Start Service</span>
                </button>
              )}
              {selectedBooking.status === 'in-progress' && (
                <button
                  disabled={actionLoading.id !== null}
                  onClick={() => handleBookingAction(selectedBooking._id, 'complete')}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md flex items-center gap-1.5"
                >
                  {actionLoading.id === selectedBooking._id && actionLoading.type === 'complete' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Complete Job</span>
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 text-secondary font-medium text-xs rounded-xl hover:bg-gray-100 transition-colors bg-white">
                Close
              </button>
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
        minCompletedImages={systemSettings?.bookingSettings?.minCompletedImages || 1}
        onConfirm={(images, location, pin, notes) => {
          const booking = selectedBooking || bookings['in-progress']?.find(b => b._id === proofModal.bookingId) || bookings.accepted?.find(b => b._id === proofModal.bookingId);
          const isCash = booking?.paymentMethod === 'cash' || booking?.paymentType === 'pay_after_service';
          if (isCash) {
            setConfirmDialog({
              isOpen: true,
              type: 'success',
              data: { bookingId: proofModal.bookingId, action: proofModal.action, additionalData: { images, location, pin, completionNotes: notes } },
              title: 'Confirm Cash Collection',
              message: `This is a Pay After Service booking. Have you collected the total amount of ₹${(booking.totalAmount || 0)} from the customer? Please confirm that you have received the payment before closing the job.`
            });
            setProofModal({ isOpen: false, action: null, bookingId: null });
          } else {
            executeBookingAction(proofModal.bookingId, proofModal.action, { images, location, pin, completionNotes: notes });
          }
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

      <ChatModal
        bookingId={chatRoomType === 'provider_customer' ? chatBookingId : null}
        roomType={chatRoomType}
        providerId={chatRoomType === 'provider_admin' ? user?._id : null}
        userRole="provider"
        isOpen={!!chatBookingId}
        onClose={() => { setChatBookingId(null); setChatRoomType('provider_customer'); }}
      />
    </div>
  );
};

export default ProviderBooking;