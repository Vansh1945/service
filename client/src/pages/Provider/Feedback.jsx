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
import StatsCard from '../../components/ui/StatsCard';

// Hoisted Components
const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }) => {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all rounded-full whitespace-nowrap border border-transparent ${isActive
                ? 'bg-primary text-white shadow-sm font-extrabold'
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-white hover:border-neutral-100'
                }`}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
        </button>
    );
};

const RatingBadge = ({ rating }) => {
    let label = 'Feedback';
    let color = 'bg-neutral-100 text-neutral-600 border-neutral-200';
    if (rating === 5) {
        label = 'Excellent';
        color = 'bg-success/10 text-success border-success/20';
    } else if (rating === 4) {
        label = 'Very Good';
        color = 'bg-info/10 text-info border-info/20';
    } else if (rating === 3) {
        label = 'Good';
        color = 'bg-warning/10 text-warning border-warning/20';
    } else if (rating <= 2) {
        label = 'Needs Improvement';
        color = 'bg-danger/10 text-danger border-danger/20';
    }

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${color}`}>
            {label}
        </span>
    );
};

const FeedbackCard = ({ feedback }) => (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:translate-y-[-2px] transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start gap-4">
            <img
                src={feedback.customerAvatar || `https://ui-avatars.com/api/?name=${feedback.customerName || 'Customer'}&background=0D9488&color=fff`}
                alt={feedback.customerName}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-neutral-50 border border-neutral-100 flex-shrink-0"
            />
            <div className="flex-grow min-w-0 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 w-full">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-neutral-800 font-poppins">{feedback.customerName}</span>
                        <span className="text-neutral-300 hidden sm:inline">•</span>
                        <span className="text-xs font-medium text-neutral-500 bg-neutral-50 px-2.5 py-0.5 rounded-md border border-neutral-100">{feedback.service}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase font-poppins tracking-wider">
                            ID: #{feedback.bookingId.slice(-8)}
                        </span>
                        <span className="text-[10px] text-neutral-450 font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            {formatDate(feedback.date)}
                        </span>
                    </div>
                </div>

                <div className="mt-3 bg-neutral-50/50 rounded-xl p-3 border border-neutral-100/50 hover:bg-primary/5 transition-all duration-200">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <Rating rating={feedback.rating} />
                        <RatingBadge rating={feedback.rating} />
                    </div>
                    <p className="text-xs font-medium text-neutral-600 italic leading-relaxed">
                        "{feedback.comment}"
                    </p>
                    {feedback.isEdited && (
                        <p className="text-[10px] text-neutral-400 mt-1 italic text-right font-medium">(Edited)</p>
                    )}
                </div>
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
            const response = await FeedbackService.getProviderFeedbacks({
                page: currentPage,
                limit: itemsPerPage,
                rating: filterRating,
                timeRange,
                search: searchTerm
            });
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
                setTotalItems(data.total || formattedFeedbacks.length);
            }
        } catch (error) {
            setError(error.message);
            showToast('Failed to load feedbacks', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await FeedbackService.getProviderAverageRating();
            const data = response.data;
            if (data.success && data.data) {
                const stats = data.data;
                setRatingsStats({
                    overallRating: stats.averageRating || 0,
                    totalReviews: stats.ratingCount || 0,
                    ratingBreakdown: stats.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                    monthlyTrend: stats.monthlyTrend || [],
                    weeklyPerformance: stats.weeklyPerformance || { currentWeek: 0, lastWeek: 0, trend: 'same' },
                    thisMonthReviews: stats.thisMonthReviews || 0
                });
            }
        } catch (error) {
            console.error('Failed to load rating stats:', error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchProviderFeedbacks();
        }
    }, [token, currentPage, filterRating, timeRange, searchTerm]);

    useEffect(() => {
        if (token) {
            loadStats();
        }
    }, [token]);

    const paginatedFeedback = feedbackData;



    if (isLoading) {
        return (
            <div className="min-h-screen bg-neutral-50 font-inter">
                <div className="bg-white border-b border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="h-6 bg-neutral-200 rounded-lg w-32 animate-pulse"></div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 bg-white border border-neutral-100 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] animate-pulse flex items-center justify-between">
                                <div className="space-y-2 flex-grow">
                                    <div className="h-3 bg-neutral-200 rounded w-16"></div>
                                    <div className="h-6 bg-neutral-250 rounded w-12"></div>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-neutral-200 shrink-0"></div>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-4">
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
        <div className="min-h-screen bg-neutral-50 font-inter pb-12">
            {/* Header */}
            <div className="bg-white border-b border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-neutral-100 transition-colors text-neutral-700">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-base font-bold text-neutral-800 font-poppins">Customer Feedback</h1>
                                <p className="text-xs text-neutral-500 font-medium">Track and analyze your customer reviews</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Reviews"
                        value={ratingsStats.totalReviews}
                        icon={MessageSquare}
                        iconBg="bg-primary/10"
                        iconColor="text-primary"
                    />
                    <StatsCard
                        title="Avg Rating"
                        value={ratingsStats.overallRating.toFixed(1)}
                        icon={Star}
                        iconBg="bg-accent/10"
                        iconColor="text-accent"
                    />
                    <StatsCard
                        title="This Month"
                        value={ratingsStats.thisMonthReviews}
                        icon={Calendar}
                        iconBg="bg-warning/10"
                        iconColor="text-warning"
                    />
                    <StatsCard
                        title="5-Star Ratio"
                        value={`${ratingsStats.totalReviews > 0 ? Math.round((ratingsStats.ratingBreakdown[5] / ratingsStats.totalReviews) * 100) : 0}%`}
                        icon={TrendingUp}
                        iconBg="bg-neutral-100"
                        iconColor="text-secondary"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 bg-neutral-100/50 p-1 rounded-full w-fit border border-neutral-200/30">
                    <TabButton id="ratings" label="Analytics" icon={TrendingUp} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="feedback" label="All Feedback" icon={MessageSquare} activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>

                {/* Analytics Tab */}
                {activeTab === 'ratings' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch animate-fade-in">
                        <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] h-full flex flex-col justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-neutral-450 uppercase tracking-wider mb-4 font-poppins">Rating Distribution</h3>
                                <div className="space-y-3.5">
                                    {[5, 4, 3, 2, 1].map(rating => {
                                        const count = ratingsStats.ratingBreakdown[rating];
                                        const percentage = ratingsStats.totalReviews > 0 ? (count / ratingsStats.totalReviews) * 100 : 0;
                                        return (
                                            <div key={rating} className="flex items-center gap-3">
                                                <div className="flex items-center w-12 text-xs font-bold text-neutral-700 font-poppins">
                                                    <Star className="w-3.5 h-3.5 text-warning fill-warning mr-1.5" />
                                                    <span>{rating}</span>
                                                </div>
                                                <div className="flex-1 bg-neutral-100 rounded-full h-2">
                                                    <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                                                </div>
                                                <span className="text-xs font-semibold text-neutral-400 w-10 text-right font-inter">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] h-full flex flex-col justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-neutral-450 uppercase tracking-wider mb-4 flex items-center gap-2 font-poppins">
                                    <TrendingUp className="w-4 h-4 text-primary" /> Monthly Trend
                                </h3>
                                <div className="grid grid-cols-3 gap-3 md:gap-4">
                                    {ratingsStats.monthlyTrend.map((month, index) => (
                                        <div key={index} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100/50 hover:bg-primary/5 transition-all duration-300 flex flex-col justify-center items-center">
                                            <div className="text-sm font-black text-primary font-poppins">{month.rating ? month.rating.toFixed(1) : '0.0'}</div>
                                            <div className="text-[9px] font-medium text-neutral-500 mt-0.5">{month.count} reviews</div>
                                            <div className="text-[10px] text-neutral-700 mt-2 font-bold font-poppins uppercase tracking-wider">{month.month}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Feedback Tab */}
                {activeTab === 'feedback' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Filters */}
                        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col md:flex-row gap-3">
                                {/* Search Input */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by customer, service, or booking ID..."
                                        className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-white text-neutral-800 placeholder-neutral-400 h-9.5"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>

                                {/* Select Filters */}
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                    <div className="relative flex-1 sm:flex-initial">
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-450 pointer-events-none" />
                                        <select
                                            className="w-full sm:w-auto pl-9 pr-9 py-2 border border-neutral-200 rounded-xl text-xs font-semibold appearance-none bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 cursor-pointer h-9.5"
                                            value={filterRating}
                                            onChange={e => { setFilterRating(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="all">All Ratings</option>
                                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 && 's'}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 rotate-90" />
                                        </div>
                                    </div>

                                    <div className="relative flex-1 sm:flex-initial">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-450 pointer-events-none" />
                                        <select
                                            className="w-full sm:w-auto pl-9 pr-9 py-2 border border-neutral-200 rounded-xl text-xs font-semibold appearance-none bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 cursor-pointer h-9.5"
                                            value={timeRange}
                                            onChange={e => { setTimeRange(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="all">All Time</option>
                                            <option value="month">Last Month</option>
                                            <option value="week">Last Week</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Feedback List */}
                        <div className="space-y-4">
                            {paginatedFeedback.length > 0 ? (
                                paginatedFeedback.map(feedback => <FeedbackCard key={feedback.id} feedback={feedback} />)
                            ) : (
                                <div className="bg-white rounded-2xl p-12 text-center border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                                    <div className="w-14 h-14 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-100/50">
                                        <MessageSquare className="w-6 h-6 text-neutral-350" />
                                    </div>
                                    <h3 className="text-sm font-bold text-neutral-800 mb-1 font-poppins">No Feedback Found</h3>
                                    <p className="text-xs font-medium text-neutral-500 max-w-xs mx-auto">Try adjusting your filters or search query to see reviews.</p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="mt-4">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalItems}
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

