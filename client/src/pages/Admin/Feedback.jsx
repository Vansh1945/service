import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { Search, Star, User, MessageSquare, Filter, Eye, X, ChevronLeft, ChevronRight, Download, Calendar } from 'lucide-react';

const AdminFeedback = () => {
    const { token, API, showToast } = useAuth();
    const [feedbacks, setFeedbacks] = useState([]);
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        averageRating: 0,
        providerFeedback: 0,
        serviceFeedback: 0
    });
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState({
        rating: '',
        type: '',
        search: '',
        startDate: '',
        endDate: ''
    });

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    });

    const ratingOptions = [
        { value: '', label: 'All Ratings' },
        { value: '5', label: '5 Stars' },
        { value: '4', label: '4 Stars' },
        { value: '3', label: '3 Stars' },
        { value: '2', label: '2 Stars' },
        { value: '1', label: '1 Star' }
    ];

    const typeOptions = [
        { value: '', label: 'All Types' },
        { value: 'provider', label: 'Provider Feedback' },
        { value: 'service', label: 'Service Feedback' }
    ];

    const fetchFeedbacks = async () => {
        try {
            setLoading(true);
            
            const queryParams = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString()
            });

            if (filters.rating) queryParams.append('rating', filters.rating);
            if (filters.type) queryParams.append('type', filters.type);
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.startDate) queryParams.append('startDate', filters.startDate);
            if (filters.endDate) queryParams.append('endDate', filters.endDate);

            const response = await fetch(`${API}/feedback/admin/all-feedbacks?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const fetchedFeedbacks = data.data || [];
                
                setFeedbacks(fetchedFeedbacks);
                setPagination(prev => ({
                    ...prev,
                    total: data.total || 0,
                    pages: data.pages || 1
                }));

                calculateStats(fetchedFeedbacks);
            } else {
                throw new Error('Failed to fetch feedbacks');
            }
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
            showToast('Failed to fetch feedbacks', 'error');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (feedbacksData) => {
        const newStats = {
            total: feedbacksData.length,
            averageRating: 0,
            providerFeedback: 0,
            serviceFeedback: 0
        };

        let totalRating = 0;
        let ratingCount = 0;

        feedbacksData.forEach(feedback => {
            if (feedback.providerFeedback?.rating) {
                totalRating += feedback.providerFeedback.rating;
                ratingCount++;
                newStats.providerFeedback++;
            }

            if (feedback.serviceFeedback?.rating) {
                totalRating += feedback.serviceFeedback.rating;
                ratingCount++;
                newStats.serviceFeedback++;
            }
        });

        newStats.averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0;
        setStats(newStats);
    };

    const fetchFeedbackDetails = async (feedbackId) => {
        try {
            const response = await fetch(`${API}/feedback/admin/${feedbackId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedFeedback(data.data);
                setShowModal(true);
            } else {
                throw new Error('Failed to fetch feedback details');
            }
        } catch (error) {
            console.error('Error fetching feedback details:', error);
            showToast('Failed to fetch feedback details', 'error');
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const clearFilters = () => {
        setFilters({
            rating: '',
            type: '',
            search: '',
            startDate: '',
            endDate: ''
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const goToPage = (page) => {
        setPagination(prev => ({ ...prev, page }));
    };

    const nextPage = () => {
        if (pagination.page < pagination.pages) {
            setPagination(prev => ({ ...prev, page: prev.page + 1 }));
        }
    };

    const prevPage = () => {
        if (pagination.page > 1) {
            setPagination(prev => ({ ...prev, page: prev.page - 1 }));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const renderStars = (rating) => {
        return (
            <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-3 h-3 ${
                            star <= rating 
                                ? 'fill-current text-yellow-500' 
                                : 'text-gray-300'
                        }`}
                    />
                ))}
            </div>
        );
    };

    const getRatingColor = (rating) => {
        if (rating >= 4) return 'text-green-600 bg-green-50 border-green-200';
        if (rating >= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        if (rating >= 2) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    useEffect(() => {
        fetchFeedbacks();
    }, [filters, pagination.page, pagination.limit]);

    const getPaginationItems = () => {
        const items = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            items.push(
                <button
                    key={i}
                    onClick={() => goToPage(i)}
                    className={`px-3 py-1 rounded ${
                        pagination.page === i
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border'
                    }`}
                >
                    {i}
                </button>
            );
        }

        return items;
    };

    return (
        <div className="min-h-screen p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Feedback Management</h1>
                            <p className="text-gray-600 mt-1">Manage and review customer feedback</p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center">
                                <div className="p-2 rounded-full bg-blue-100">
                                    <MessageSquare className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Total Feedback</p>
                                    <p className="text-lg font-bold text-secondary">{stats.total}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center">
                                <div className="p-2 rounded-full bg-amber-100">
                                    <Star className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Average Rating</p>
                                    <p className="text-lg font-bold text-secondary">{stats.averageRating}/5</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center">
                                <div className="p-2 rounded-full bg-green-100">
                                    <User className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Provider Feedback</p>
                                    <p className="text-lg font-bold text-secondary">{stats.providerFeedback}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center">
                                <div className="p-2 rounded-full bg-purple-100">
                                    <MessageSquare className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Service Feedback</p>
                                    <p className="text-lg font-bold text-secondary">{stats.serviceFeedback}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-secondary">Filters</h3>
                    <button
                        onClick={clearFilters}
                        className="text-sm text-primary hover:text-teal-700 transition-colors"
                    >
                        Clear All
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Search</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search feedback..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Rating</label>
                        <select
                            value={filters.rating}
                            onChange={(e) => handleFilterChange('rating', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                            {ratingOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                            {typeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">From</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">To</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Feedback Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-secondary">
                        All Feedback ({pagination.total})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Provider
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Service
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Provider Rating
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Service Rating
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={index} className="animate-pulse">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-6 bg-gray-200 rounded w-16"></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-6 bg-gray-200 rounded w-16"></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : feedbacks.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center">
                                        <div className="flex flex-col items-center">
                                            <MessageSquare className="w-12 h-12 text-gray-400 mb-4" />
                                            <h3 className="text-lg font-medium text-secondary mb-2">No Feedback Found</h3>
                                            <p className="text-sm text-gray-500">
                                                {Object.values(filters).some(filter => filter !== '') 
                                                    ? 'Try adjusting your filters to see more results.' 
                                                    : 'No feedback has been submitted yet.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                feedbacks.map((feedback) => (
                                    <tr key={feedback._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-secondary">
                                                {feedback.customer?.name || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {feedback.customer?.email || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                            {feedback.providerFeedback?.provider?.name || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                            {feedback.serviceFeedback?.service?.title || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {feedback.providerFeedback?.rating ? (
                                                <div className="flex items-center space-x-2">
                                                    {renderStars(feedback.providerFeedback.rating)}
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRatingColor(feedback.providerFeedback.rating)}`}>
                                                        {feedback.providerFeedback.rating}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No rating</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {feedback.serviceFeedback?.rating ? (
                                                <div className="flex items-center space-x-2">
                                                    {renderStars(feedback.serviceFeedback.rating)}
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRatingColor(feedback.serviceFeedback.rating)}`}>
                                                        {feedback.serviceFeedback.rating}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No rating</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                            {formatDate(feedback.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => fetchFeedbackDetails(feedback._id)}
                                                className="text-primary hover:text-teal-700 transition-colors p-1 rounded"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-secondary">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} results
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={prevPage}
                                    disabled={pagination.page === 1}
                                    className="flex items-center px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Previous
                                </button>

                                {getPaginationItems()}

                                <button
                                    onClick={nextPage}
                                    disabled={pagination.page === pagination.pages}
                                    className="flex items-center px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Feedback Details Modal */}
            {showModal && selectedFeedback && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-medium text-secondary">Feedback Details</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Customer Info */}
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Customer Information</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-600">Name:</span>
                                        <p className="font-medium">{selectedFeedback.customer?.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Email:</span>
                                        <p className="font-medium">{selectedFeedback.customer?.email || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Provider Feedback */}
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Provider Feedback</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Provider:</span>
                                        <span className="font-medium">{selectedFeedback.providerFeedback?.provider?.name || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Rating:</span>
                                        <div className="flex items-center space-x-2">
                                            {renderStars(selectedFeedback.providerFeedback?.rating || 0)}
                                            <span className="font-medium">{selectedFeedback.providerFeedback?.rating || 'N/A'}/5</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Comment:</span>
                                        <p className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                                            {selectedFeedback.providerFeedback?.comment || 'No comment provided'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Service Feedback */}
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Service Feedback</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Service:</span>
                                        <span className="font-medium">{selectedFeedback.serviceFeedback?.service?.title || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Rating:</span>
                                        <div className="flex items-center space-x-2">
                                            {renderStars(selectedFeedback.serviceFeedback?.rating || 0)}
                                            <span className="font-medium">{selectedFeedback.serviceFeedback?.rating || 'N/A'}/5</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Comment:</span>
                                        <p className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                                            {selectedFeedback.serviceFeedback?.comment || 'No comment provided'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Submission Info */}
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Submission Information</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-600">Submitted:</span>
                                        <p className="font-medium">{formatDate(selectedFeedback.createdAt)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Last Updated:</span>
                                        <p className="font-medium">{formatDate(selectedFeedback.updatedAt)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-end space-x-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminFeedback;