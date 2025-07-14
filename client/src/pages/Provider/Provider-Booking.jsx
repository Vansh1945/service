import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { 
  Search, Calendar, Clock, MapPin, User, 
  CheckCircle2, XCircle, Eye, ChevronLeft, 
  ChevronRight, Filter, AlertCircle, BadgeCheck,
  DollarSign, Phone, Mail, Home
} from 'lucide-react';

const ProviderBookingsPage = () => {
  const { API, logoutUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Fetch bookings from API
  const fetchBookings = async (page = 1, search = '') => {
    try {
      const response = await fetch(
        `${API}/booking/provider?page=${page}&limit=${pagination.limit}&search=${search}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 401) {
        logoutUser();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setBookings(data.data || []);
      setPagination(prev => ({
        ...prev,
        page: data.page,
        total: data.total,
        pages: data.pages
      }));
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  // Handle booking actions
  const handleBookingAction = async (bookingId, action) => {
    try {
      const response = await fetch(`${API}/booking/provider/${bookingId}/${action}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} booking`);
      }

      fetchBookings(pagination.page, searchTerm);
    } catch (error) {
      console.error(`Error ${action} booking:`, error);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchBookings(1, value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchBookings(newPage, searchTerm);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="h-4 w-4" /> },
      accepted: { color: 'bg-blue-100 text-blue-800', icon: <BadgeCheck className="h-4 w-4" /> },
      completed: { color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
      cancelled: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> }
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[status]?.color || 'bg-gray-100 text-gray-800'}`}>
        {statusConfig[status]?.icon}
        <span className="ml-1 capitalize">{status}</span>
      </span>
    );
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  return (
    <div className="min-h-screen bg-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-2">
            Booking Management
          </h1>
          <p className="text-gray-600">
            View and manage all your service bookings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-blue-100">
            <div className="flex items-center">
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <Calendar className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-xl md:text-2xl font-semibold text-blue-900">{pagination.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-yellow-100">
            <div className="flex items-center">
              <div className="p-2 md:p-3 bg-yellow-100 rounded-full">
                <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-xl md:text-2xl font-semibold text-yellow-800">
                  {bookings.filter(b => b.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-blue-100">
            <div className="flex items-center">
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <BadgeCheck className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Accepted</p>
                <p className="text-xl md:text-2xl font-semibold text-blue-800">
                  {bookings.filter(b => b.status === 'accepted').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-green-100">
            <div className="flex items-center">
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Earnings</p>
                <p className="text-xl md:text-2xl font-semibold text-green-800">
                  ₹{bookings
                    .filter(b => b.status === 'completed')
                    .reduce((sum, b) => sum + (b.servicePrice - (b.discountAmount || 0)), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-4 md:mb-6 border border-blue-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
              <input
                type="text"
                placeholder="Search bookings by customer, service, or ID..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-9 md:pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-blue-50">
                <Filter className="h-4 w-4 mr-2 text-gray-500" />
                Filters
              </button>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Status</option>
                <option>Pending</option>
                <option>Accepted</option>
                <option>Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-blue-100">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 bg-blue-50">
            <h2 className="text-base md:text-lg font-medium text-blue-900">
              All Bookings ({pagination.total})
            </h2>
          </div>

          {bookings.length === 0 ? (
            <div className="p-8 md:p-12 text-center">
              <Calendar className="h-10 w-10 md:h-12 md:w-12 text-gray-400 mx-auto mb-3 md:mb-4" />
              <p className="text-gray-500">No bookings found</p>
              <p className="text-sm text-gray-400 mt-1">You currently have no service bookings</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      Booking Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider hidden md:table-cell">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking._id} className="hover:bg-blue-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-blue-900">
                              {formatDate(booking.date)}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {booking.time || 'Flexible'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-blue-900">
                              {booking.customer?.name || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {booking._id.slice(-8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-900">
                          {booking.service?.title || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          ₹{booking.servicePrice?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleBookingAction(booking._id, 'accept')}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Accept
                              </button>
                              <button
                                onClick={() => handleBookingAction(booking._id, 'cancel')}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Decline
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-white px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-blue-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="ml-3 relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-blue-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium text-blue-900">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium text-blue-900">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium text-blue-900">{pagination.total}</span>{' '}
                    results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {[...Array(pagination.pages)].map((_, i) => {
                      if (pagination.pages <= 7 || 
                          i === 0 || 
                          i === pagination.pages - 1 || 
                          Math.abs(pagination.page - (i + 1)) <= 2) {
                        return (
                          <button
                            key={i + 1}
                            onClick={() => handlePageChange(i + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pagination.page === i + 1
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50'
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      }
                      if (Math.abs(pagination.page - (i + 1)) === 3) {
                        return (
                          <span key={i + 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Booking Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                            Booking Information
                          </h4>
                          <div className="text-sm text-gray-900 space-y-1">
                            <p><span className="font-medium">ID:</span> {selectedBooking._id}</p>
                            <p><span className="font-medium">Date:</span> {formatDate(selectedBooking.date)}</p>
                            <p><span className="font-medium">Time:</span> {selectedBooking.time || 'Flexible'}</p>
                            <p><span className="font-medium">Status:</span> <StatusBadge status={selectedBooking.status} /></p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center">
                            <User className="h-4 w-4 mr-2 text-blue-500" />
                            Customer Details
                          </h4>
                          <div className="text-sm text-gray-900 space-y-1">
                            <p><span className="font-medium">Name:</span> {selectedBooking.customer?.name || 'N/A'}</p>
                            <p><span className="font-medium">Phone:</span> {selectedBooking.customer?.phone || 'N/A'}</p>
                            <p><span className="font-medium">Email:</span> {selectedBooking.customer?.email || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center">
                            <Home className="h-4 w-4 mr-2 text-blue-500" />
                            Service Details
                          </h4>
                          <div className="text-sm text-gray-900 space-y-1">
                            <p><span className="font-medium">Service:</span> {selectedBooking.service?.title || 'N/A'}</p>
                            <p><span className="font-medium">Price:</span> ₹{selectedBooking.servicePrice?.toFixed(2) || '0.00'}</p>
                            {selectedBooking.discountAmount > 0 && (
                              <p><span className="font-medium">Discount:</span> ₹{selectedBooking.discountAmount.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                            Service Location
                          </h4>
                          <div className="text-sm text-gray-900 space-y-1">
                            <p>{selectedBooking.address?.street || 'N/A'}</p>
                            <p>{selectedBooking.address?.city || 'N/A'}, {selectedBooking.address?.state || 'N/A'}</p>
                            <p>{selectedBooking.address?.postalCode || 'N/A'}, {selectedBooking.address?.country || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setSelectedBooking(null)}
                >
                  Close
                </button>
                {selectedBooking.status === 'pending' && (
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => {
                      handleBookingAction(selectedBooking._id, 'accept');
                      setSelectedBooking(null);
                    }}
                  >
                    Accept Booking
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderBookingsPage;