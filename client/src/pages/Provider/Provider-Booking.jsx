import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../store/auth';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  DollarSign,
  Eye,
  Check,
  X,
  AlertCircle,
  Percent,
  Wallet,
  Tag,
  ChevronDown,
  ChevronUp,
  Filter,
  ClipboardList,
  Timer,
  CheckCheck,
  HelpCircle,
  Copy,
  Zap,
  Wrench,
  Play,
  CreditCard,
  CheckSquare,
  AlertTriangle,
  Star,
  Package,
  Search,
  Activity,
  Banknote,
  Download,
  FileText,
  Loader,
  BarChart2,
  DownloadCloud
} from 'lucide-react';

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, title, message, type = 'default' }) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'success':
        return <Check className="w-6 h-6 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      default:
        return <HelpCircle className="w-6 h-6 text-primary" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl max-w-md w-full border border-gray-200">
        <div className="p-6">
          <div className="flex items-center mb-4">
            {getIcon()}
            <h3 className="text-lg font-semibold text-secondary ml-3">{title}</h3>
          </div>
          <div className={`p-4 rounded-lg border ${getTypeStyles()} mb-6`}>
            <p className="text-sm">{message}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-secondary hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${type === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary hover:bg-primary/90'
                }`}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Summary Cards Component
const SummaryCards = ({ stats, formatCurrency }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Total Bookings</p>
            <p className="text-lg font-bold text-primary">{stats.totalBookings}</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Completed</p>
            <p className="text-lg font-bold text-primary">{stats.completedBookings}</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <Check className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Pending</p>
            <p className="text-lg font-bold text-primary">{stats.pendingBookings}</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <Timer className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Cash Collected</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(stats.totalCashCollected)}</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <Banknote className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Commission</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(stats.commissionPayable)}</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <Percent className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Net Earnings</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(stats.netEarnings)}</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <BarChart2 className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Download Reports Component
const DownloadReports = ({
  dateFilter,
  setDateFilter,
  downloadReport,
  downloading,
  showToast
}) => {

  const handleDownload = () => {
    downloadReport('booking');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary flex items-center">
          <DownloadCloud className="w-5 h-5 mr-2 text-primary" />
          Download Reports
        </h3>
      </div>

      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <label className="text-sm font-medium text-secondary">Date Range:</label>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter({
                ...dateFilter,
                startDate: e.target.value
              })}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <span className="text-sm text-gray-500 self-center">to</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter({
                ...dateFilter,
                endDate: e.target.value
              })}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            onClick={() => setDateFilter({ startDate: '', endDate: '' })}
            className="text-sm text-primary hover:text-primary/80 self-start sm:self-center"
          >
            Clear
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Note: Date range must be between 7 days and 2 months for downloads
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-secondary text-sm">Booking Report</h4>
              <p className="text-xs text-gray-500">Detailed booking breakdown</p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={!dateFilter.startDate || !dateFilter.endDate || downloading}
            className="w-full bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-md text-xs flex items-center justify-center gap-1 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloading ? 'Downloading...' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Pagination component
const Pagination = ({ bookingsPerPage, totalBookings, paginate, currentPage }) => {
  const pageNumbers = [];
  const totalPages = Math.ceil(totalBookings / bookingsPerPage);

  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex justify-center items-center py-4">
      <button
        onClick={() => paginate(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 mx-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Prev
      </button>
      {pageNumbers.map(number => (
        <button
          key={number}
          onClick={() => paginate(number)}
          className={`px-3 py-1 mx-1 rounded-md ${
            currentPage === number
              ? 'bg-primary text-white border border-primary'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {number}
        </button>
      ))}
      <button
        onClick={() => paginate(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 mx-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

// Main Provider Booking Component
const ProviderBooking = () => {
  const { token, API, showToast, user } = useAuth();
  const [bookings, setBookings] = useState({
    pending: [],
    accepted: [],
    'in-progress': [],
    completed: [],
    cancelled: []
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    booking: true,
    customer: true,
    service: true,
    payment: true,
    address: true
  });
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: '', data: null });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedBookings: 0,
    pendingBookings: 0,
    totalCashCollected: 0,
    commissionPayable: 0,
    netEarnings: 0
  });
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [downloading, setDownloading] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookingsPerPage] = useState(10);

  const calculateSubtotal = useCallback((booking) => {
    if (!booking?.services) return 0;
    return booking.services.reduce((sum, item) => {
      return sum + (item.price * item.quantity) - (item.discountAmount || 0);
    }, 0).toFixed(2);
  }, []);

  const calculateNetAmount = useCallback((booking) => {
    if (!booking) return 0;
    const totalAmount = booking.totalAmount || calculateSubtotal(booking);
    const commissionAmount = booking.commission?.amount || 0;
    return (totalAmount - commissionAmount).toFixed(2);
  }, [calculateSubtotal]);

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const fetchBookings = useCallback(async (status) => {
    try {
      setError(null);
      const response = await fetch(`${API}/booking/provider/status/${status}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch ${status} bookings`);
      }

      const data = await response.json();
      const newBookings = data.data || [];

      setBookings(prev => ({
        ...prev,
        [status]: newBookings
      }));

      return newBookings;
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
      return [];
    }
  }, [API, token, showToast]);

  const calculateStats = useCallback((allBookings) => {
    const completedBookings = allBookings.filter(b => b.status === 'completed');
    const pendingBookings = allBookings.filter(b => b.status === 'pending');

    const totalCashCollected = completedBookings
      .filter(booking => booking.paymentMethod === 'cash' && booking.paymentStatus === 'paid')
      .reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

    const commissionPayable = completedBookings
      .filter(booking => booking.paymentMethod === 'cash' && booking.paymentStatus === 'paid')
      .reduce((sum, booking) => sum + (booking.commission?.amount || 0), 0);

    const netEarnings = totalCashCollected - commissionPayable;

    return {
      totalBookings: allBookings.length,
      completedBookings: completedBookings.length,
      pendingBookings: pendingBookings.length,
      totalCashCollected,
      commissionPayable,
      netEarnings
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (token) {
        setLoading(true);
        try {
          const today = new Date();
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(today.getDate() - 7);

          const formatDate = (date) => date.toISOString().split('T')[0];

          setDateFilter({
            startDate: formatDate(oneWeekAgo),
            endDate: formatDate(today)
          });

          const allBookings = await Promise.all([
            fetchBookings('pending'),
            fetchBookings('accepted'),
            fetchBookings('in-progress'),
            fetchBookings('completed'),
            fetchBookings('cancelled')
          ]);

          const flattenedBookings = allBookings.flat();
          setStats(calculateStats(flattenedBookings));
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [token, fetchBookings, calculateStats]);

  const downloadReport = useCallback(async (reportType) => {
    try {
      if (!dateFilter.startDate || !dateFilter.endDate) {
        showToast('Please select a date range first', 'error');
        return;
      }

      setDownloading(true);

      let url, filename;
      if (reportType === 'providerBooking' || reportType === 'booking') {
        url = `${API}/booking/provider/booking-report?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`;
        filename = `provider_booking_report_${dateFilter.startDate}_to_${dateFilter.endDate}.xlsx`;
      } else {
        showToast('Invalid report type', 'error');
        setDownloading(false);
        return;
      }

      const response = await fetch(
        url,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download report');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      showToast('Report downloaded successfully', 'success');
    } catch (err) {
      console.error('Error downloading report:', err);
      showToast(err.message || 'Failed to download report', 'error');
    } finally {
      setDownloading(false);
    }
  }, [API, token, dateFilter, showToast]);

  const executeBookingAction = useCallback(async (bookingId, action, additionalData = {}) => {
    try {
      if (!bookingId) {
        showToast('Booking ID is missing. Please refresh and try again.', 'error');
        return;
      }

      let endpoint, method, body = {};

      switch (action) {
        case 'accept':
          endpoint = `${API}/booking/provider/${bookingId}/accept`;
          method = 'PATCH';
          if (selectedBooking?.time) body.time = selectedBooking.time;
          break;
        case 'reject':
          endpoint = `${API}/booking/provider/${bookingId}/reject`;
          method = 'PATCH';
          body.reason = additionalData.reason || 'Provider rejected';
          break;
        case 'start':
          endpoint = `${API}/booking/provider/${bookingId}/start`;
          method = 'PATCH';
          break;
        case 'complete':
          endpoint = `${API}/booking/provider/${bookingId}/complete`;
          method = 'PATCH';
          break;
        default:
          throw new Error('Invalid action');
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.message || `Failed to ${action} booking`;

        if (response.status === 409) {
          showToast(errorMessage, 'warning');
          throw new Error(errorMessage);
        }

        if (response.status === 404) {
          errorMessage = action === 'complete'
            ? 'Booking Not Available for Completion'
            : 'Booking Not Found';
        } else if (response.status === 403) {
          errorMessage = 'Permission Denied';
        } else if (response.status === 400) {
          errorMessage = 'Invalid Request';
        }

        showToast(errorMessage, 'error');
        throw new Error(errorMessage);
      }

      const result = await response.json();
      showToast(result.message || `Booking ${action}ed successfully`, 'success');

      await Promise.all([
        fetchBookings('pending'),
        fetchBookings('accepted'),
        fetchBookings('in-progress'),
        fetchBookings('completed'),
        fetchBookings('cancelled')
      ]);

      setShowModal(false);
      setSelectedBooking(null);
      setConfirmDialog({ isOpen: false, type: '', data: null });

    } catch (err) {
      console.error(`Error ${action}ing booking ${bookingId}:`, err);
    }
  }, [API, token, selectedBooking, showToast, fetchBookings]);

  const handleBookingAction = useCallback(async (bookingId, action, additionalData = {}) => {
    if (['reject', 'complete'].includes(action)) {
      setConfirmDialog({
        isOpen: true,
        type: action === 'reject' ? 'danger' : 'success',
        data: { bookingId, action, additionalData },
        title: action === 'reject' ? 'Reject Booking' : 'Complete Service',
        message: action === 'reject'
          ? 'Are you sure you want to reject this booking? This action cannot be undone.'
          : 'Are you sure you want to mark this service as completed?'
      });
      return;
    }

    if (action === 'accept' || action === 'start') {
      setBookings(prev => {
        const updatedBookings = { ...prev };

        if (action === 'accept') {
          const bookingIndex = updatedBookings.pending.findIndex(b => b._id === bookingId);
          if (bookingIndex !== -1) {
            const [booking] = updatedBookings.pending.splice(bookingIndex, 1);
            updatedBookings.accepted.unshift({
              ...booking,
              status: 'accepted',
              provider: user._id
            });
          }
        } else if (action === 'start') {
          const bookingIndex = updatedBookings.accepted.findIndex(b => b._id === bookingId);
          if (bookingIndex !== -1) {
            const [booking] = updatedBookings.accepted.splice(bookingIndex, 1);
            updatedBookings['in-progress'].unshift({
              ...booking,
              status: 'in-progress'
            });
          }
        }

        return updatedBookings;
      });
    }

    await executeBookingAction(bookingId, action, additionalData);
  }, [executeBookingAction, user]);

  const handleConfirmAction = useCallback(() => {
    const { data } = confirmDialog;
    if (data) {
      executeBookingAction(data.bookingId, data.action, data.additionalData);
    }
  }, [confirmDialog, executeBookingAction]);

  const getBookingDetails = useCallback(async (bookingId) => {
    try {
      const response = await fetch(`${API}/booking/provider-booking/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch booking details');
      }

      const data = await response.json();
      setSelectedBooking(data.data || null);
      setShowModal(true);
    } catch (err) {
      showToast(err.message, 'error');
      setShowModal(false);
    }
  }, [API, token, showToast]);

  const formatAddress = useCallback((address) => {
    if (!address) return 'Address not specified';
    if (typeof address === 'string') return address;

    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country
    ].filter(Boolean);

    return parts.join(', ') || 'Address not specified';
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStatusIcon = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <Timer className="w-4 h-4" />;
      case 'accepted': return <CheckCheck className="w-4 h-4" />;
      case 'in-progress': return <Activity className="w-4 h-4" />;
      case 'completed': return <Check className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  }, []);

  const getServiceIcon = useCallback((category) => {
    switch (category?.toLowerCase()) {
      case 'electrical':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'appliance repair':
      case 'repair':
      case 'maintenance':
        return <Wrench className="w-5 h-5 text-orange-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
    }
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  const formatTime = useCallback((timeString) => {
    if (!timeString) return '--:--';
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(hours, minutes);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return timeString;
    }
  }, []);

  const formatDuration = useCallback((hours) => {
    if (!hours) return 'N/A';
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours > 0 ? `${wholeHours} hr` : ''} ${minutes > 0 ? `${minutes} min` : ''}`.trim();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const currentBookings = useMemo(() => {
    let filtered = activeTab === 'all'
      ? Object.values(bookings).flat()
      : bookings[activeTab] || [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking =>
        (booking.customer?.name?.toLowerCase().includes(query)) ||
        (booking.services?.some(service =>
          service.service?.title?.toLowerCase().includes(query))) ||
        (booking._id?.toLowerCase().includes(query)));
    }

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    if (filter === 'today') {
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.date).toISOString().split('T')[0];
        return bookingDate === todayString;
      });
    } else if (filter === 'upcoming') {
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.date).toISOString().split('T')[0];
        return bookingDate >= todayString;
      });
    } else if (filter === 'past') {
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.date).toISOString().split('T')[0];
        return bookingDate < todayString;
      });
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return filtered;
  }, [bookings, activeTab, searchQuery, filter]);

  const indexOfLastBooking = currentPage * bookingsPerPage;
  const indexOfFirstBooking = indexOfLastBooking - bookingsPerPage;
  const paginatedBookings = currentBookings.slice(indexOfFirstBooking, indexOfLastBooking);

  const paginate = pageNumber => setCurrentPage(pageNumber);

  // Simple Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center">
          <Loader className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-secondary text-lg">Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-100">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm max-w-md border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-secondary mb-2">Connection Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Service Dashboard</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage your service bookings efficiently</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-secondary hover:bg-gray-50"
              >
                <BarChart2 className="w-4 h-4" />
                {showSummary ? 'Hide Summary' : 'Show Summary'}
              </button>
              <button
                onClick={() => setShowReports(!showReports)}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-secondary hover:bg-gray-50"
              >
                <DownloadCloud className="w-4 h-4" />
                {showReports ? 'Hide Reports' : 'Show Reports'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards Section */}
        {showSummary && (
          <SummaryCards stats={stats} formatCurrency={formatCurrency} />
        )}

        {/* Download Reports Section */}
        {showReports && (
          <DownloadReports
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            downloadReport={downloadReport}
            downloading={downloading}
            showToast={showToast}
          />
        )}

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search bookings..."
                  className="block w-full pl-9 sm:pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white font-medium w-full"
                >
                  <option value="all">All Bookings ({Object.values(bookings).flat().length})</option>
                  <option value="pending">Pending ({bookings.pending.length})</option>
                  <option value="accepted">Accepted ({bookings.accepted.length})</option>
                  <option value="in-progress">In Progress ({bookings['in-progress'].length})</option>
                  <option value="completed">Completed ({bookings.completed.length})</option>
                  <option value="cancelled">Cancelled ({bookings.cancelled.length})</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white font-medium w-full"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {currentBookings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center border border-gray-200">
              <div className="text-gray-400 mb-4">
                <ClipboardList className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-secondary mb-2">
                No bookings found
              </h3>
              <p className="text-gray-500 max-w-md mx-auto text-sm">
                {activeTab === 'all'
                  ? searchQuery
                    ? `No bookings match your search "${searchQuery}".`
                    : filter !== 'all'
                      ? `No bookings found for the selected time filter "${filter}".`
                      : "You don't have any bookings at the moment. New bookings will appear here."
                  : activeTab === 'pending'
                    ? "You don't have any pending bookings at the moment. New bookings will appear here."
                    : activeTab === 'accepted'
                      ? "You don't have any accepted bookings. Once you accept pending bookings, they'll appear here."
                      : activeTab === 'in-progress'
                        ? "No services are currently in progress. Start accepted bookings to see them here."
                        : activeTab === 'completed'
                          ? "You haven't completed any bookings yet. Completed services will be listed here."
                          : "No cancelled bookings found."}
              </p>
            </div>
          ) : (
            paginatedBookings.map((booking) => (
              <div
                key={booking._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          <span className="ml-1 capitalize">{booking.status === 'in-progress' ? 'In Progress' : booking.status || 'unknown'}</span>
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          ID: {booking._id.slice(-8)}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(booking._id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy Booking ID"
                        >
                          <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                        <div className="flex items-center text-gray-700">
                          <div className="p-1 sm:p-2 bg-orange-100 rounded-lg mr-2 sm:mr-3">
                            {getServiceIcon(booking.services?.[0]?.service?.category)}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Service</p>
                            <p className="font-medium text-sm sm:text-base">
                              {booking.services?.map(s => s.service?.title).join(', ') || 'Service'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center text-gray-700 sm:col-span-2">
                          <div className="p-1 sm:p-2 bg-red-100 rounded-lg mr-2 sm:mr-3">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Address</p>
                            <p className="font-medium text-sm sm:text-base truncate">{formatAddress(booking.address)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        {booking.paymentMethod === 'cash' ? (
                          <div className="flex items-center text-green-600 text-xs bg-green-50 px-2 py-1 rounded-md">
                            <Banknote className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            <span className="font-medium">Cash on Delivery</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded-md">
                            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            <span className="font-medium">Online Payment</span>
                          </div>
                        )}
                        {booking.paymentStatus === 'paid' && (
                          <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2 min-w-[160px] sm:min-w-[200px]">
                      <button
                        onClick={() => getBookingDetails(booking._id)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-secondary bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        View Details
                      </button>

                      {booking.status === 'pending' && (!booking.provider || booking.provider === user?._id) && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleBookingAction(booking._id, 'accept')}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                          >
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            Accept
                          </button>
                          {booking.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => handleBookingAction(booking._id, 'reject', { reason: 'Provider declined' })}
                              className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              Reject
                            </button>
                          )}
                        </div>
                      )}

                      {booking.status === 'accepted' && (
                        <button
                          onClick={() => handleBookingAction(booking._id, 'start')}
                          className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                          <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          Start Service
                        </button>
                      )}

                      {booking.status === 'in-progress' && (
                        <button
                          onClick={() => handleBookingAction(booking._id, 'complete')}
                          className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                          <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          Complete Service
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 sm:px-6 py-2 sm:py-3 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0">
                    <div className="text-xs text-gray-500">
                      Created: {formatDate(booking.createdAt)}
                    </div>
                    <div className="text-sm font-medium text-secondary">
                      Total: {formatCurrency(booking.totalAmount)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
           <Pagination
                bookingsPerPage={bookingsPerPage}
                totalBookings={currentBookings.length}
                paginate={paginate}
                currentPage={currentPage}
            />
        </div>
      </div>

      {/* Booking Details Modal */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-secondary flex items-center">
                  <ClipboardList className="w-6 h-6 mr-2 text-primary" />
                  Booking Details
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-md"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Booking Information Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('booking')}
                  >
                    <h3 className="text-lg font-semibold text-secondary flex items-center">
                      <ClipboardList className="w-5 h-5 mr-2 text-primary" />
                      Booking Information
                    </h3>
                    {expandedSections.booking ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {expandedSections.booking && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3">
                          <Tag className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Booking ID</p>
                          <p className="font-medium">{selectedBooking._id}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-amber-100 rounded-lg mr-3">
                          {getStatusIcon(selectedBooking.status)}
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <p className="font-medium capitalize">
                            {selectedBooking.status === 'in-progress' ? 'In Progress' : selectedBooking.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg mr-3">
                          <Calendar className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Service Date</p>
                          <p className="font-medium">{formatDate(selectedBooking.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg mr-3">
                          <Clock className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Booking Time Slot</p>
                          <p className="font-medium">{formatTime(selectedBooking.time)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Information Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('customer')}
                  >
                    <h3 className="text-lg font-semibold text-secondary flex items-center">
                      <User className="w-5 h-5 mr-2 text-primary" />
                      Customer Information
                    </h3>
                    {expandedSections.customer ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {expandedSections.customer && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['accepted', 'in-progress', 'assigned'].includes(selectedBooking.status) && (
                        <>
                          <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg mr-3">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Name</p>
                              <p className="font-medium">
                                {selectedBooking.customer?.name || 'Not specified'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg mr-3">
                              <Phone className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Phone</p>
                              <p className="font-medium">
                                {selectedBooking.customer?.phone}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className="p-2 bg-red-100 rounded-lg mr-3">
                              <Mail className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Email</p>
                              <p className="font-medium">
                                {selectedBooking.customer?.email || 'Not specified'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg mr-3">
                              <Star className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Customer Since</p>
                              <p className="font-medium">
                                {selectedBooking.customer?.createdAt
                                  ? formatDate(selectedBooking.customer.createdAt)
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedBooking.status === "pending" && (
                        <div className="col-span-full text-center py-4 text-gray-500">
                          <p>
                            Customer details will be visible after you accept the booking.
                          </p>
                        </div>
                      )}

                      {selectedBooking.status === "completed" && (
                        <div className="col-span-full text-center py-4 text-gray-500">
                          <p>
                            Customer information is hidden because the service has been completed for privacy reasons.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Service Information Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('service')}
                  >
                    <h3 className="text-lg font-semibold text-secondary flex items-center">
                      {getServiceIcon(selectedBooking.services?.[0]?.service?.category)}
                      <span className="ml-2">Service Information</span>
                    </h3>
                    {expandedSections.service ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {expandedSections.service && (
                    <div className="mt-4 space-y-4">
                      {selectedBooking.services?.map((service, index) => (
                        <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-secondary">
                                {service.service?.title || 'Service'}
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {service.service?.description || 'No description available'}
                              </p>
                              {service.service?.duration && (
                                <div className="flex items-center mt-2 text-sm text-blue-600">
                                  <Timer className="w-4 h-4 mr-1" />
                                  <span>Duration: {formatDuration(service.service.duration)}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-medium text-secondary">
                                {formatCurrency(service.price)}
                              </p>
                              <p className="text-sm text-gray-500">
                                Qty: {service.quantity || 1}
                              </p>
                            </div>
                          </div>
                          {service.discountAmount > 0 && (
                            <div className="flex items-center mt-2 text-sm text-green-600">
                              <Percent className="w-4 h-4 mr-1" />
                              <span>Discount: {formatCurrency(service.discountAmount)}</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {selectedBooking.notes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <div className="p-2 bg-blue-100 rounded-lg mr-3">
                              <HelpCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-secondary text-sm">Additional Instructions</h4>
                              <p className="text-sm text-gray-700 mt-1">
                                {selectedBooking.notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Information Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('payment')}
                  >
                    <h3 className="text-lg font-semibold text-secondary flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-primary" />
                      Payment Information
                    </h3>
                    {expandedSections.payment ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {expandedSections.payment && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <Wallet className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Payment Method</p>
                            <p className="font-medium capitalize">
                              {selectedBooking.paymentMethod || 'Not specified'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="p-2 bg-green-100 rounded-lg mr-3">
                            <CheckSquare className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Payment Status</p>
                            <p className="font-medium capitalize">
                              {selectedBooking.paymentStatus || 'Not specified'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex justify-between py-2">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(calculateSubtotal(selectedBooking))}</span>
                        </div>
                        {selectedBooking.commission?.amount > 0 && (
                          <div className="flex justify-between py-2 text-gray-600">
                            <span>Platform Commission ({selectedBooking.commission?.rule?.type === 'percentage' ? `${selectedBooking.commission?.rule?.value || 0}%` : `₹${selectedBooking.commission?.rule?.value || 0}`}):</span>
                            <span>-{formatCurrency(selectedBooking.commission?.amount || 0)}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 border-t border-gray-200 mt-2">
                          <span className="text-secondary font-medium">Net Amount:</span>
                          <span className="text-secondary font-bold">{formatCurrency(calculateNetAmount(selectedBooking))}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Address Information Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('address')}
                  >
                    <h3 className="text-lg font-semibold text-secondary flex items-center">
                      <MapPin className="w-5 h-5 mr-2 text-primary" />
                      Service Address
                    </h3>
                    {expandedSections.address ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {expandedSections.address && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium">
                          {formatAddress(selectedBooking.address)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                {selectedBooking.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleBookingAction(selectedBooking._id, 'accept')}
                      className="flex-1 px-4 py-2 bg-primary border border-transparent text-sm font-medium rounded-md text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      <Check className="w-4 h-4 mr-2 inline" />
                      Accept Booking
                    </button>
                    <button
                      onClick={() => handleBookingAction(selectedBooking._id, 'reject', { reason: 'Provider declined' })}
                      className="flex-1 px-4 py-2 bg-red-600 border border-transparent text-sm font-medium rounded-md text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <X className="w-4 h-4 mr-2 inline" />
                      Reject Booking
                    </button>
                  </>
                )}

                {selectedBooking.status === 'accepted' && (
                  <button
                    onClick={() => handleBookingAction(selectedBooking._id, 'start')}
                    className="flex-1 px-4 py-2 bg-primary border border-transtext-sm font-medium rounded-md text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Play className="w-4 h-4 mr-2 inline" />
                    Start Service
                  </button>
                )}

                {selectedBooking.status === 'in-progress' && (
                  <button
                    onClick={() => handleBookingAction(selectedBooking._id, 'complete')}
                    className="flex-1 px-4 py-2 bg-primary border border-transparent text-sm font-medium rounded-md text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Check className="w-4 h-4 mr-2 inline" />
                    Mark as Completed
                  </button>
                )}

                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-secondary bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
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