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
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-1">Feedback Management</h1>
                        <p className="text-gray-600">Manage and review customer feedback</p>
                    </div>
                    <button className="flex items-center space-x-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
                        <Download className="w-4 h-4" />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Feedback</p>
                            <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                        </div>
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Average Rating</p>
                            <p className="text-xl font-bold text-gray-800">{stats.averageRating}/5</p>
                        </div>
                        <Star className="w-6 h-6 text-yellow-600" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Provider Feedback</p>
                            <p className="text-xl font-bold text-gray-800">{stats.providerFeedback}</p>
                        </div>
                        <User className="w-6 h-6 text-green-600" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Service Feedback</p>
                            <p className="text-xl font-bold text-gray-800">{stats.serviceFeedback}</p>
                        </div>
                        <MessageSquare className="w-6 h-6 text-purple-600" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Filters</h3>
                    <button onClick={clearFilters} className="text-sm text-gray-600 hover:text-gray-800">
                        Clear All
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                        <select
                            value={filters.rating}
                            onChange={(e) => handleFilterChange('rating', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                        >
                            {ratingOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Feedback Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-800">All Feedback ({pagination.total})</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Customer</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Provider</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Service</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Provider Rating</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Service Rating</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={index} className="animate-pulse">
                                        <td className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="h-6 bg-gray-200 rounded w-16"></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="h-6 bg-gray-200 rounded w-16"></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : feedbacks.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                        No feedback found
                                    </td>
                                </tr>
                            ) : (
                                feedbacks.map((feedback) => (
                                    <tr key={feedback._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900">
                                                {feedback.customer?.name || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {feedback.customer?.email || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {feedback.providerFeedback?.provider?.name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {feedback.serviceFeedback?.service?.title || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {feedback.providerFeedback?.rating ? (
                                                <div className="flex items-center space-x-2">
                                                    {renderStars(feedback.providerFeedback.rating)}
                                                    <span className={`text-xs px-2 py-1 rounded-full border ${getRatingColor(feedback.providerFeedback.rating)}`}>
                                                        {feedback.providerFeedback.rating}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No rating</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {feedback.serviceFeedback?.rating ? (
                                                <div className="flex items-center space-x-2">
                                                    {renderStars(feedback.serviceFeedback.rating)}
                                                    <span className={`text-xs px-2 py-1 rounded-full border ${getRatingColor(feedback.serviceFeedback.rating)}`}>
                                                        {feedback.serviceFeedback.rating}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No rating</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {formatDate(feedback.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => fetchFeedbackDetails(feedback._id)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
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
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <div className="text-sm text-gray-700">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                            {pagination.total} results
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={prevPage}
                                disabled={pagination.page === 1}
                                className="p-2 rounded disabled:opacity-30 hover:bg-white border"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            
                            {getPaginationItems()}
                            
                            <button
                                onClick={nextPage}
                                disabled={pagination.page === pagination.pages}
                                className="p-2 rounded disabled:opacity-30 hover:bg-white border"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Feedback Details Modal */}
            {showModal && selectedFeedback && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Feedback Details</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
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