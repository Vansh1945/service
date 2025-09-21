import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
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
  ChevronLeft,
  ChevronRight,
  Download,
  Shield,
  FileText,
  Banknote,
  Wallet,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminProviders = () => {
  const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';
  const token = localStorage.getItem("adminToken") || localStorage.getItem("token");

  // State management
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('approved'); // Default to approved
  const [serviceFilter, setServiceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    active: 0
  });

  // Check admin access
  useEffect(() => {
    fetchProviders();
  }, []);

  // Filter and search providers
  useEffect(() => {
    let filtered = [...providers];

    // Apply status filter - default to approved only
    if (statusFilter === 'approved') {
      filtered = filtered.filter(provider => provider.approved);
    } else if (statusFilter === 'pending') {
      filtered = filtered.filter(provider => !provider.approved && provider.kycStatus === 'pending');
    } else if (statusFilter === 'rejected') {
      filtered = filtered.filter(provider => provider.kycStatus === 'rejected');
    } else if (statusFilter === 'active') {
      filtered = filtered.filter(provider => provider.isActive);
    }
    // If statusFilter is 'all', show all providers

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(provider =>
        provider.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.phone?.includes(searchTerm)
      );
    }

    // Apply service filter
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(provider => 
        provider.services && provider.services.includes(serviceFilter)
      );
    }

    // Apply rating filter
    if (ratingFilter !== 'all') {
      const minRating = parseInt(ratingFilter);
      filtered = filtered.filter(provider => 
        provider.averageRating >= minRating && provider.averageRating < minRating + 1
      );
    }

    setFilteredProviders(filtered);
  }, [providers, searchTerm, statusFilter, serviceFilter, ratingFilter]);

  // Calculate stats whenever providers change
  useEffect(() => {
    const newStats = {
      total: providers.length,
      approved: providers.filter(p => p.approved).length,
      pending: providers.filter(p => !p.approved && p.kycStatus === 'pending').length,
      rejected: providers.filter(p => p.kycStatus === 'rejected').length,
      active: providers.filter(p => p.isActive).length
    };
    setStats(newStats);
  }, [providers]);

  // Fetch all providers
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/admin/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.status}`);
      }

      const data = await response.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error('Fetch providers error:', error);
      toast.error(error.message || 'Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  };

  // Handle view click
  const handleViewClick = (provider) => {
    setSelectedProvider(provider);
    setShowViewModal(true);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return 'N/A';
    const { street, city, state, postalCode, country } = address;
    return [street, city, state, postalCode, country].filter(Boolean).join(', ');
  };

  // Get service badges
  const getServiceBadges = (services) => {
    if (!services || services.length === 0) return null;
    
    return services.map(service => (
      <span
        key={service}
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 mr-1 mb-1"
      >
        {service}
      </span>
    ));
  };

  // Get status badge
  const getStatusBadge = (provider) => {
    if (provider.kycStatus === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </span>
      );
    }
    
    if (provider.approved) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </span>
      );
    }
    
    if (provider.kycStatus === 'pending') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <UserX className="w-3 h-3 mr-1" />
        Inactive
      </span>
    );
  };

  // Get rating stars
  const getRatingStars = (rating) => {
    if (!rating || rating === 0) return 'No ratings yet';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < fullStars ? 'text-yellow-400 fill-yellow-400' : (i === fullStars && hasHalfStar ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')}`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating.toFixed(1)})</span>
      </div>
    );
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProviders = filteredProviders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProviders.length / itemsPerPage);

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
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Providers</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.approved}</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.pending}</p>
              </div>
              <div className="p-2 md:p-3 bg-yellow-100 rounded-full">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.rejected}</p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full">
                <UserX className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.active}</p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                <input
                  type="text"
                  placeholder="Search providers by name, email or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="approved">Approved</option>
                <option value="all">All Providers</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="active">Active</option>
              </select>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Services</option>
                <option value="Electrical">Electrical</option>
                <option value="AC">AC</option>
                <option value="Appliance Repair">Appliance Repair</option>
                <option value="Other">Other</option>
              </select>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Stars</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading providers...</p>
          </div>
        )}

        {/* Providers Table */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {currentProviders.length === 0 ? (
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
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentProviders.map((provider) => (
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
                            {getRatingStars(provider.averageRating)}
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between bg-gray-50 gap-3">
                    <div className="text-sm text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredProviders.length)} of {filteredProviders.length} results
                    </div>
                    <div className="flex items-center space-x-1 md:space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-2 py-1 md:px-3 md:py-2 text-sm rounded-lg ${currentPage === page
                              ? 'bg-primary text-white'
                              : 'text-gray-600 hover:text-primary hover:bg-gray-100'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* View Provider Modal */}
        {showViewModal && selectedProvider && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Provider Details"
            size="xlarge"
          >
            <div className="space-y-6">
              {/* Header Section */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl border border-teal-200">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <img
                      className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
                      src={selectedProvider.profilePicUrl || '/default-avatar.png'}
                      alt={selectedProvider.name}
                      onError={(e) => {
                        e.target.src = '/default-avatar.png';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold text-secondary">{selectedProvider.name}</h3>
                        <div className="flex items-center mt-2">
                          {getStatusBadge(selectedProvider)}
                          {selectedProvider.averageRating > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
                              <Star className="w-3 h-3 mr-1 fill-yellow-400" />
                              {selectedProvider.averageRating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Member since</p>
                        <p className="font-medium text-gray-900">{formatDate(selectedProvider.registrationDate || selectedProvider.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Briefcase className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Experience</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedProvider.experience || 0} years
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Completed Jobs</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedProvider.completedBookings || 0}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <XCircle className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Canceled Jobs</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedProvider.canceledBookings || 0}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Star className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Rating</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedProvider.averageRating > 0 ? selectedProvider.averageRating.toFixed(1) : 'No ratings yet'}
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="text-lg font-semibold text-secondary mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-sm text-gray-900">{selectedProvider.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-sm text-gray-900">{selectedProvider.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <p className="text-sm text-gray-900">{formatAddress(selectedProvider.address)}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Date of Birth</p>
                      <p className="text-sm text-gray-900">{formatDate(selectedProvider.dateOfBirth)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="text-lg font-semibold text-secondary mb-4">Professional Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Services Offered</p>
                    <div className="flex flex-wrap gap-2">
                      {getServiceBadges(selectedProvider.services)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Service Area</p>
                    <p className="text-sm text-gray-900">{selectedProvider.serviceArea || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">KYC Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedProvider.kycStatus === 'approved' 
                        ? 'bg-green-100 text-green-800' 
                        : selectedProvider.kycStatus === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedProvider.kycStatus?.charAt(0).toUpperCase() + selectedProvider.kycStatus?.slice(1) || 'N/A'}
                    </span>
                    {selectedProvider.rejectionReason && (
                      <p className="text-sm text-red-600 mt-1">
                        Reason: {selectedProvider.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Test Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedProvider.testPassed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedProvider.testPassed ? 'Passed' : 'Not Passed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              {selectedProvider.bankDetails && (
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <h4 className="text-lg font-semibold text-secondary mb-4">Bank Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Account Name</p>
                      <p className="text-sm text-gray-900">{selectedProvider.bankDetails.accountName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Account Number</p>
                      <p className="text-sm text-gray-900 font-mono">{selectedProvider.bankDetails.accountNo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Bank Name</p>
                      <p className="text-sm text-gray-900">{selectedProvider.bankDetails.bankName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">IFSC Code</p>
                      <p className="text-sm text-gray-900 font-mono">{selectedProvider.bankDetails.ifsc || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Verification Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedProvider.bankDetails.verified 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedProvider.bankDetails.verified ? 'Verified' : 'Pending Verification'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    medium: 'sm:max-w-lg',
    large: 'sm:max-w-2xl',
    xlarge: 'sm:max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} sm:w-full`}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-secondary">{title}</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProviders;