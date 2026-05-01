import React, { useState, useEffect } from 'react';
import {
    Star, Calendar, User, MessageSquare, Search, AlertCircle,
    ChevronLeft, ChevronRight, TrendingUp, Clock, Filter, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/auth';
import Pagination from '../../components/Pagination';
import * as FeedbackService from '../../services/FeedbackService';

const ProviderFeedback = () => {
    const { API, token, showToast } = useAuth();
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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const StarRating = ({ rating, size = 'w-4 h-4', showNumber = false }) => (
        <div className="flex items-center gap-1">
            <div className="flex">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`${size} ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                ))}
            </div>
            {showNumber && <span className="text-sm font-medium text-secondary">{rating.toFixed(1)}</span>}
        </div>
    );

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
    const totalPages = Math.ceil(finalFilteredFeedback.length / itemsPerPage);
    const paginatedFeedback = finalFilteredFeedback.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const TabButton = ({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
            <button onClick={() => setActiveTab(id)} className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-secondary/60 hover:text-secondary hover:bg-gray-100'}`}>
                <Icon className="w-4 h-4" /> {label}
            </button>
        );
    };

    const StatCard = ({ icon: Icon, title, value, subtext, color }) => {
        const colors = {
            primary: { bg: 'bg-primary/10', text: 'text-primary' },
            accent: { bg: 'bg-accent/10', text: 'text-accent' },
            yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
            secondary: { bg: 'bg-gray-100', text: 'text-secondary' }
        };
        const selectedColor = colors[color] || colors.primary;
        return (
            <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-secondary/50 uppercase tracking-wide">{title}</p>
                        <p className={`text-xl font-bold mt-1 ${selectedColor.text}`}>{value}</p>
                        <div className="text-xs text-secondary/40 mt-0.5">{subtext}</div>
                    </div>
                    <div className={`p-2.5 rounded-xl ${selectedColor.bg}`}>
                        <Icon className={`w-5 h-5 ${selectedColor.text}`} />
                    </div>
                </div>
            </div>
        );
    };

    const FeedbackCard = ({ feedback }) => (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-secondary">ID: #{feedback.bookingId.slice(-8)}</p>
                        <p className="text-xs text-secondary/40">{feedback.service}</p>
                    </div>
                </div>
                <div className="text-right">
                    <StarRating rating={feedback.rating} />
                    <p className="text-xs text-secondary/40 mt-1">{formatDate(feedback.date)}</p>
                </div>
            </div>
            <div className="mt-3 pl-13">
                <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-secondary/40 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-secondary/70">{feedback.comment}</p>
                </div>
                {feedback.isEdited && <p className="text-xs text-secondary/40 mt-1 italic">(Edited)</p>}
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background font-inter flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="mt-3 text-secondary/50 text-sm">Loading feedback...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background font-inter flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-secondary mb-2">Something went wrong</h3>
                    <p className="text-secondary/60 mb-4">{error}</p>
                    <button onClick={fetchProviderFeedbacks} className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90">Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen font-inter">
            <div className="max-w-5xl mx-auto px-4 py-4 md:py-6 space-y-5">

                {/* Header */}
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-secondary font-poppins">Customer Feedback</h1>
                    <p className="text-secondary/50 text-sm mt-1">Track and analyze your customer reviews</p>
                </div>

                {/* Summary Card */}
                <div className="bg-white rounded-xl p-5 border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-xs text-secondary/50 uppercase tracking-wide">Average Rating</p>
                                <p className="text-2xl font-bold text-primary">{ratingsStats.overallRating.toFixed(1)}</p>
                            </div>
                            <StarRating rating={Math.round(ratingsStats.overallRating)} size="w-5 h-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-secondary/50 uppercase tracking-wide">Total Reviews</p>
                            <p className="text-2xl font-bold text-secondary">{ratingsStats.totalReviews}</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <TabButton id="ratings" label="Analytics" icon={TrendingUp} />
                    <TabButton id="feedback" label="All Feedback" icon={MessageSquare} />
                </div>

                {/* Analytics Tab */}
                {activeTab === 'ratings' && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard icon={TrendingUp} title="Overall Score" value={ratingsStats.overallRating.toFixed(1)} subtext={<StarRating rating={Math.round(ratingsStats.overallRating)} />} color="primary" />
                            <StatCard icon={MessageSquare} title="Total Reviews" value={ratingsStats.totalReviews} subtext="All-time feedback" color="accent" />
                            <StatCard icon={Star} title="5-Star Reviews" value={`${ratingsStats.totalReviews > 0 ? Math.round((ratingsStats.ratingBreakdown[5] / ratingsStats.totalReviews) * 100) : 0}%`} subtext={`${ratingsStats.ratingBreakdown[5]} reviews`} color="yellow" />
                            <StatCard icon={Calendar} title="This Month" value={ratingsStats.thisMonthReviews} subtext="New reviews" color="secondary" />
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100">
                            <h3 className="font-medium text-secondary mb-4">Rating Distribution</h3>
                            <div className="space-y-3">
                                {[5, 4, 3, 2, 1].map(rating => {
                                    const count = ratingsStats.ratingBreakdown[rating];
                                    const percentage = ratingsStats.totalReviews > 0 ? (count / ratingsStats.totalReviews) * 100 : 0;
                                    return (
                                        <div key={rating} className="flex items-center gap-3">
                                            <div className="flex items-center w-12 text-sm">
                                                <Star className="w-4 h-4 text-yellow-400 mr-1" /> {rating}
                                            </div>
                                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                                                <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }} />
                                            </div>
                                            <span className="text-sm font-medium text-secondary w-10 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100">
                            <h3 className="font-medium text-secondary mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" /> Monthly Trend
                            </h3>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                                {ratingsStats.monthlyTrend.map((month, index) => (
                                    <div key={index}>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xl font-bold text-primary">{month.rating || '0.0'}</div>
                                            <div className="text-xs text-secondary/40">{month.count} reviews</div>
                                        </div>
                                        <div className="text-xs text-secondary/60 mt-1">{month.month}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Feedback Tab */}
                {activeTab === 'feedback' && (
                    <div className="space-y-5">
                        {/* Filters */}
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" />
                                    <input
                                        type="text"
                                        placeholder="Search by customer, service, or booking ID..."
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" />
                                        <select
                                            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm appearance-none bg-white"
                                            value={filterRating}
                                            onChange={e => { setFilterRating(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="all">All Ratings</option>
                                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 && 's'}</option>)}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" />
                                        <select
                                            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm appearance-none bg-white"
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
                        <div className="space-y-3">
                            {paginatedFeedback.length > 0 ? (
                                paginatedFeedback.map(feedback => <FeedbackCard key={feedback.id} feedback={feedback} />)
                            ) : (
                                <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
                                    <MessageSquare className="w-12 h-12 text-secondary/20 mx-auto mb-3" />
                                    <h3 className="font-medium text-secondary mb-1">No Feedback Found</h3>
                                    <p className="text-sm text-secondary/50">Try adjusting your filters to see results.</p>
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
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProviderFeedback;