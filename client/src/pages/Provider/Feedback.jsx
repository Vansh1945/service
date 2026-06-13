import React, { useState, useEffect } from 'react';
import {
    Star, Calendar, User, MessageSquare, Search, AlertCircle,
    ChevronLeft, ChevronRight, TrendingUp, Clock, Filter, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../context/auth';
import Pagination from '../../components/Pagination';
import * as FeedbackService from '../../services/FeedbackService';
import { formatDate } from '../../utils/format';
import BookingCardSkeleton from '../../components/ui-skeletons/BookingCardSkeleton';
import usePagination from '../../hooks/usePagination';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../../components/Error';
import Rating from '../../components/Rating';

// Hoisted Components
const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }) => {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors border ${isActive ? 'bg-primary/5 text-primary border-primary/20' : 'text-gray-500 hover:bg-gray-100 border-transparent'}`}
        >
            <Icon className="w-3.5 h-3.5" /> {label}
        </button>
    );
};

const FeedbackCard = ({ feedback }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all shadow-sm">
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-grow min-w-0">
                <img
                    src={feedback.customerAvatar || `https://ui-avatars.com/api/?name=${feedback.customerName || 'Customer'}&background=0D9488&color=fff`}
                    alt={feedback.customerName}
                    className="w-10 h-10 rounded-full object-cover bg-gray-50 border border-gray-100 flex-shrink-0"
                />
                <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-secondary truncate">
                        ID: #{feedback.bookingId.slice(-8)}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{feedback.customerName}</span>
                        <span className="text-gray-300">•</span>
                        <span className="truncate">{feedback.service}</span>
                    </p>

                    <div className="mt-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rating</span>
                                <Rating rating={feedback.rating} />
                            </div>
                            <p className="text-xs text-gray-600 mt-1 italic">
                                "{feedback.comment}"
                            </p>
                        </div>
                        {feedback.isEdited && (
                            <p className="text-[10px] text-gray-400 mt-1 italic text-right">(Edited)</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3" />
                    {formatDate(feedback.date)}
                </span>
            </div>
        </div>
    </div>
);

const ProviderFeedback = () => {
    const { token, showToast } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ratings');
    const [filterRating, setFilterRating] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all');
    const [feedbackData, setFeedbackData] = useState([]);
    const [ratingsStats, setRatingsStats] = useState({
        overallRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        monthlyTrend: [],
        weeklyPerformance: { currentWeek: 0, lastWeek: 0, trend: 'up' },
        thisMonthReviews: 0
    });
    const {
        currentPage,
        setCurrentPage,
        limit: itemsPerPage,
        totalPages,
        setTotalItems,
        onPageChange
    } = usePagination(1, 10);

    // StarRating component removed; using Rating component directly

    const fetchProviderFeedbacks = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await FeedbackService.getProviderFeedbacks();
            const data = response.data;

            if (data.success) {
                const formattedFeedbacks = data.data.map(feedback => ({
                    id: feedback._id,
                    customerName: feedback.customer?.name || 'Anonymous',
                    customerAvatar: feedback.customer?.profilePicUrl,
                    bookingId: feedback.booking?.bookingId || 'N/A',
                    service: feedback.booking?.services?.[0]?.service?.title || 'Service',
                    date: feedback.createdAt,
                    rating: feedback.providerFeedback?.rating || 0,
                    comment: feedback.providerFeedback?.comment || '',
                    isEdited: feedback.providerFeedback?.isEdited || false,
                    bookingDate: feedback.booking?.date || 'N/A'
                }));
                setFeedbackData(formattedFeedbacks);
                calculateStats(formattedFeedbacks);
            }
        } catch (error) {
            setError(error.message);
            showToast('Failed to load feedbacks', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProviderRating = async () => {
        try {
            const response = await FeedbackService.getProviderAverageRating();
            const data = response.data;
            if (data.success) {
                return { averageRating: data.data.averageRating || 0, ratingCount: data.data.ratingCount || 0 };
            }
            return { averageRating: 0, ratingCount: 0 };
        } catch (error) {
            return { averageRating: 0, ratingCount: 0 };
        }
    };

    const calculateStats = async (feedbacks) => {
        const ratingData = await fetchProviderRating();
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1));
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        let thisMonthReviews = 0, currentWeekRatingSum = 0, currentWeekRatingCount = 0, lastWeekRatingSum = 0, lastWeekRatingCount = 0;

        feedbacks.forEach(feedback => {
            const feedbackDate = new Date(feedback.date);
            const feedbackRating = feedback.rating;
            if (feedbackRating >= 1 && feedbackRating <= 5) breakdown[feedbackRating]++;
            if (feedbackDate.getMonth() === currentMonth && feedbackDate.getFullYear() === currentYear) thisMonthReviews++;
            if (feedbackDate >= startOfWeek) {
                currentWeekRatingSum += feedbackRating;
                currentWeekRatingCount++;
            } else if (feedbackDate >= startOfLastWeek && feedbackDate < startOfWeek) {
                lastWeekRatingSum += feedbackRating;
                lastWeekRatingCount++;
            }
        });

        const currentWeekAvg = currentWeekRatingCount > 0 ? currentWeekRatingSum / currentWeekRatingCount : 0;
        const lastWeekAvg = lastWeekRatingCount > 0 ? lastWeekRatingSum / lastWeekRatingCount : 0;
        let weeklyTrend = currentWeekAvg > lastWeekAvg ? 'up' : (currentWeekAvg < lastWeekAvg ? 'down' : 'same');

        const monthlyTrendData = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthName = months[date.getMonth()];
            const year = date.getFullYear();
            const monthFeedbacks = feedbacks.filter(f => {
                const fd = new Date(f.date);
                return fd.getMonth() === date.getMonth() && fd.getFullYear() === year;
            });
            const avgRating = monthFeedbacks.length > 0 ? monthFeedbacks.reduce((sum, f) => sum + f.rating, 0) / monthFeedbacks.length : 0;
            monthlyTrendData.push({ month: monthName, rating: parseFloat(avgRating.toFixed(1)), count: monthFeedbacks.length });
        }

        setRatingsStats({
            overallRating: ratingData.averageRating,
            totalReviews: ratingData.ratingCount,
            ratingBreakdown: breakdown,
            monthlyTrend: monthlyTrendData,
            weeklyPerformance: { currentWeek: parseFloat(currentWeekAvg.toFixed(1)), lastWeek: parseFloat(lastWeekAvg.toFixed(1)), trend: weeklyTrend },
            thisMonthReviews
        });
    };

    useEffect(() => {
        if (token) fetchProviderFeedbacks();
    }, [token]);

    const filterFeedbackByTimeRange = (feedbacks) => {
        const now = new Date();
        if (timeRange === 'all') return feedbacks;
        let startDate = new Date(now);
        if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
        else if (timeRange === 'month') startDate.setMonth(now.getMonth() - 1);
        return feedbacks.filter(f => new Date(f.date) >= startDate);
    };

    const filteredFeedback = feedbackData
        .filter(item => item.comment && item.comment.trim() !== '')
        .filter(item => filterRating === 'all' || item.rating === parseInt(filterRating))
        .filter(item => item.service.toLowerCase().includes(searchTerm.toLowerCase()) || item.bookingId.toLowerCase().includes(searchTerm.toLowerCase()));

    const finalFilteredFeedback = filterFeedbackByTimeRange(filteredFeedback);
    const paginatedFeedback = finalFilteredFeedback.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setTotalItems(finalFilteredFeedback.length);
    }, [finalFilteredFeedback.length, setTotalItems]);

    // TabButton hoisted to module scope

    // FeedbackCard hoisted to module scope

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 font-inter">
                <div className="bg-white border-b border-gray-100 shadow-sm">
                    <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                    </div>
                </div>
                <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <BookingCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                title="Failed to Load"
                message={error}
                onRetry={fetchProviderFeedbacks}
                retryText="Try Again"
                onBack={() => navigate(-1)}
                backText="Go Back"
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-inter">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                                <ArrowLeft className="w-5 h-5 text-secondary" />
                            </button>
                            <div>
                                <h1 className="text-base font-bold text-secondary font-poppins">Customer Feedback</h1>
                                <p className="text-xs text-gray-400">Track and analyze your customer reviews</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Reviews</span>
                            <div className="text-2xl font-bold text-secondary mt-1">{ratingsStats.totalReviews}</div>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Avg Rating</span>
                            <div className="text-2xl font-bold text-secondary mt-1">{ratingsStats.overallRating.toFixed(1)}</div>
                        </div>
                        <div className="p-2 bg-accent/10 rounded-lg text-accent">
                            <Star className="w-5 h-5 fill-accent" />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">This Month</span>
                            <div className="text-2xl font-bold text-secondary mt-1">{ratingsStats.thisMonthReviews}</div>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">5-Star Ratio</span>
                            <div className="text-2xl font-bold text-secondary mt-1">
                                {ratingsStats.totalReviews > 0 ? Math.round((ratingsStats.ratingBreakdown[5] / ratingsStats.totalReviews) * 100) : 0}%
                            </div>
                        </div>
                        <div className="p-2 bg-gray-100 rounded-lg text-secondary">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <TabButton id="ratings" label="Analytics" icon={TrendingUp} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="feedback" label="All Feedback" icon={MessageSquare} activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>

                {/* Analytics Tab */}
                {activeTab === 'ratings' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Rating Distribution</h3>
                            <div className="space-y-3">
                                {[5, 4, 3, 2, 1].map(rating => {
                                    const count = ratingsStats.ratingBreakdown[rating];
                                    const percentage = ratingsStats.totalReviews > 0 ? (count / ratingsStats.totalReviews) * 100 : 0;
                                    return (
                                        <div key={rating} className="flex items-center gap-3">
                                            <div className="flex items-center w-12 text-xs font-semibold text-secondary">
                                                <Star className="w-3.5 h-3.5 text-yellow-400 mr-1 fill-yellow-400" /> {rating}
                                            </div>
                                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                                                <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-gray-400 w-10 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" /> Monthly Trend
                            </h3>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                                {ratingsStats.monthlyTrend.map((month, index) => (
                                    <div key={index}>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-lg font-bold text-primary">{month.rating || '0.0'}</div>
                                            <div className="text-[10px] text-gray-400">{month.count} reviews</div>
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1 font-semibold">{month.month}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Feedback Tab */}
                {activeTab === 'feedback' && (
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by customer, service, or booking ID..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <select
                                            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs appearance-none bg-white font-medium text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            value={filterRating}
                                            onChange={e => { setFilterRating(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="all">All Ratings</option>
                                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 && 's'}</option>)}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <select
                                            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs appearance-none bg-white font-medium text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            value={timeRange}
                                            onChange={e => { setTimeRange(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="all">All Time</option>
                                            <option value="month">Last Month</option>
                                            <option value="week">Last Week</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Feedback List */}
                        <div className="space-y-4">
                            {paginatedFeedback.length > 0 ? (
                                paginatedFeedback.map(feedback => <FeedbackCard key={feedback.id} feedback={feedback} />)
                            ) : (
                                <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                        <MessageSquare className="w-6 h-6 text-gray-300" />
                                    </div>
                                    <h3 className="text-sm font-bold text-secondary mb-1">No Feedback Found</h3>
                                    <p className="text-xs text-gray-400">Try adjusting your filters to see results.</p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="mt-4">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={finalFilteredFeedback.length}
                                limit={itemsPerPage}
                                onPageChange={onPageChange}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProviderFeedback;

