import React, { useState, useEffect } from 'react';
import {
    Star, Calendar, User, MessageSquare, TrendingUp, Filter,
    Search, AlertCircle, ChevronLeft, ChevronRight, BarChart3,
    Award, Target, ThumbsUp, Clock, PieChart
} from 'lucide-react';
import { useAuth } from '../../store/auth';

const ProviderFeedback = () => {
    const { API, token, showToast } = useAuth();
    const [activeTab, setActiveTab] = useState('ratings');
    const [filterRating, setFilterRating] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all'); // 'week', 'month', 'all'

    // State for feedback data
    const [feedbackData, setFeedbackData] = useState([]);
    const [ratingsStats, setRatingsStats] = useState({
        overallRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        monthlyTrend: [],
        weeklyPerformance: { currentWeek: 0, lastWeek: 0, trend: 'up' },
        thisMonthReviews: 0
    });

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // API Functions
    const fetchProviderFeedbacks = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch(`${API}/feedback/provider/my-feedbacks`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                const formattedFeedbacks = data.data.map(feedback => ({
                    id: feedback._id,
                    customerName: feedback.customer?.name || 'Anonymous',
                    customerAvatar: feedback.customer?.profilePicUrl,
                    bookingId: feedback.booking?._id || 'N/A',
                    service: feedback.booking?.services?.[0]?.service?.title || 'Service',
                    date: feedback.createdAt,
                    rating: feedback.providerFeedback?.rating || 0,
                    comment: feedback.providerFeedback?.comment || 'No comment provided',
                    isEdited: feedback.providerFeedback?.isEdited || false,
                    bookingDate: feedback.booking?.date || 'N/A'
                }));
                setFeedbackData(formattedFeedbacks);
                calculateStats(formattedFeedbacks);
            } else {
                throw new Error(data.message || 'Failed to fetch feedbacks');
            }
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
            setError(error.message);
            showToast('Failed to load feedbacks', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProviderRating = async () => {
        try {
            const response = await fetch(`${API}/feedback/provider/average-rating`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                return {
                    averageRating: data.data.averageRating || 0,
                    ratingCount: data.data.ratingCount || 0
                };
            } else {
                throw new Error(data.message || 'Failed to fetch rating');
            }
        } catch (error) {
            console.error('Error fetching rating:', error);
            return { averageRating: 0, ratingCount: 0 };
        }
    };

    // Calculate statistics from feedback data
    const calculateStats = async (feedbacks) => {
        const ratingData = await fetchProviderRating();
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1)); // Set to Monday
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
            weeklyPerformance: {
                currentWeek: parseFloat(currentWeekAvg.toFixed(1)),
                lastWeek: parseFloat(lastWeekAvg.toFixed(1)),
                trend: weeklyTrend
            },
            thisMonthReviews
        });
    };

    // Load data on component mount
    useEffect(() => {
        if (token) fetchProviderFeedbacks();
    }, [token]);

    // Filtering logic
    const filterFeedbackByTimeRange = (feedbacks) => {
        const now = new Date();
        if (timeRange === 'all') return feedbacks;
        let startDate = new Date(now);
        if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
        else if (timeRange === 'month') startDate.setMonth(now.getMonth() - 1);
        return feedbacks.filter(f => new Date(f.date) >= startDate);
    };

    const filteredFeedback = feedbackData
        .filter(item => filterRating === 'all' || item.rating === parseInt(filterRating))
        .filter(item =>
            item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.bookingId.toLowerCase().includes(searchTerm.toLowerCase())
        );
    
    const finalFilteredFeedback = filterFeedbackByTimeRange(filteredFeedback);
    
    // Pagination logic
    const totalPages = Math.ceil(finalFilteredFeedback.length / itemsPerPage);
    const paginatedFeedback = finalFilteredFeedback.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Helpers
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    
    const StarRating = ({ rating, size = 'w-5 h-5', showNumber = false }) => (
        <div className="flex items-center">
            <div className="flex">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`${size} ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
                ))}
            </div>
            {showNumber && <span className="ml-2 text-sm font-medium text-secondary">{rating.toFixed(1)}</span>}
        </div>
    );
    
    // Sub-components
    const LoadingSkeleton = () => (
        <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-40 bg-slate-200 rounded-xl"></div>
                <div className="h-40 bg-slate-200 rounded-xl"></div>
            </div>
            <div className="h-48 bg-slate-200 rounded-xl"></div>
        </div>
    );

    const ErrorMessage = () => (
        <div className="text-center py-20 bg-background rounded-xl shadow-lg border border-slate-200">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary mb-2">Something went wrong</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
                onClick={fetchProviderFeedbacks}
                className="px-5 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors duration-200"
            >
                Try Again
            </button>
        </div>
    );

    const FeedbackView = () => (
        <div className="space-y-6">
            <div className="bg-background/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl shadow-lg border border-slate-100">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by customer, service, or booking ID..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <select
                                className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg appearance-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                                value={filterRating}
                                onChange={e => { setFilterRating(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all">All Ratings</option>
                                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 && 's'}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <select
                                className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg appearance-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
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

            <div className="space-y-4">
                {paginatedFeedback.map((feedback) => (
                    <div key={feedback.id} className="bg-background/90 backdrop-blur-sm rounded-xl shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="p-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                                <div className="flex items-center space-x-4">
                                    {feedback.customerAvatar ? (
                                        <img src={feedback.customerAvatar} alt={feedback.customerName} className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100" />
                                    ) : (
                                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center ring-2 ring-slate-100">
                                            <User className="w-6 h-6 text-primary" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-semibold text-secondary">{feedback.customerName}</h4>
                                        <p className="text-sm text-slate-500">Booking ID: <span className="font-mono">{feedback.bookingId}</span></p>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <StarRating rating={feedback.rating} />
                                    <p className="text-sm text-slate-500 mt-1">{formatDate(feedback.date)}</p>
                                </div>
                            </div>
                            <div className="bg-slate-50/70 p-4 rounded-lg">
                                <div className="flex items-start space-x-3">
                                    <MessageSquare className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-secondary text-sm leading-relaxed">{feedback.comment}</p>
                                        {feedback.isEdited && <p className="text-xs text-slate-500 mt-2 italic">(Edited)</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-8">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-2 border border-slate-200 rounded-lg disabled:opacity-50 flex items-center hover:bg-slate-100 transition">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </button>
                    <span className="text-slate-500 text-sm">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-2 border border-slate-200 rounded-lg disabled:opacity-50 flex items-center hover:bg-slate-100 transition">
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                </div>
            )}

            {finalFilteredFeedback.length === 0 && !isLoading && (
                <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <MessageSquare className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-secondary mb-1">No Feedback Found</h3>
                    <p className="text-slate-500">Try adjusting your filters to see results.</p>
                </div>
            )}
        </div>
    );

    const RatingsTracker = () => {
        const TrendIcon = ({ trend }) => {
            if (trend === 'up') return <TrendingUp className="w-5 h-5 text-green-500" />;
            if (trend === 'down') return <TrendingUp className="w-5 h-5 text-red-500 transform -scale-y-100" />;
            return <BarChart3 className="w-5 h-5 text-slate-500" />;
        };

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Award} title="Overall Score" value={ratingsStats.overallRating.toFixed(1)} subtext={<StarRating rating={Math.round(ratingsStats.overallRating)} size="w-4 h-4" />} color="primary" />
                    <StatCard icon={BarChart3} title="Total Reviews" value={ratingsStats.totalReviews} subtext="All-time feedback" color="accent" />
                    <StatCard icon={ThumbsUp} title="5-Star Reviews" value={`${ratingsStats.totalReviews > 0 ? Math.round((ratingsStats.ratingBreakdown[5] / ratingsStats.totalReviews) * 100) : 0}%`} subtext={`${ratingsStats.ratingBreakdown[5]} reviews`} color="yellow" />
                    <StatCard icon={Target} title="This Month" value={ratingsStats.thisMonthReviews} subtext="New reviews" color="secondary" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-background/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-300">
                        <h3 className="text-lg font-semibold mb-4 text-secondary flex items-center">
                            <PieChart className="w-5 h-5 mr-2 text-primary" /> Rating Distribution
                        </h3>
                        <div className="space-y-3">
                            {[5, 4, 3, 2, 1].map(rating => {
                                const count = ratingsStats.ratingBreakdown[rating];
                                const percentage = ratingsStats.totalReviews > 0 ? (count / ratingsStats.totalReviews) * 100 : 0;
                                return (
                                    <div key={rating} className="flex items-center gap-3">
                                        <div className="flex items-center w-12 text-sm"><Star className="w-4 h-4 text-yellow-400 mr-1" /> {rating}</div>
                                        <div className="flex-1 bg-slate-200 rounded-full h-2.5"><div className="bg-primary h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div></div>
                                        <span className="text-sm font-medium text-secondary w-12 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="lg:col-span-2 bg-background/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-300">
                        <h3 className="text-lg font-semibold mb-4 text-secondary flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2 text-primary" /> Monthly Rating Trend
                        </h3>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                            {ratingsStats.monthlyTrend.map((month, index) => (
                                <div key={index} className="group">
                                    <div className="relative bg-slate-100/70 rounded-lg p-3 transition-all duration-300 group-hover:bg-primary/10 group-hover:-translate-y-1">
                                        <div className="text-2xl font-bold text-primary">{month.rating || '0.0'}</div>
                                        <div className="text-xs text-slate-500">{month.count} reviews</div>
                                    </div>
                                    <div className="text-sm text-secondary mt-2">{month.month}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const StatCard = ({ icon: Icon, title, value, subtext, color }) => {
        const colors = {
            primary: { bg: 'bg-primary/10', text: 'text-primary' },
            accent: { bg: 'bg-accent/10', text: 'text-accent' },
            yellow: { bg: 'bg-yellow-400/10', text: 'text-yellow-500' },
            secondary: { bg: 'bg-secondary/10', text: 'text-secondary' }
        };
        const selectedColor = colors[color] || colors.primary;

        return (
            <div className="bg-background/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500">{title}</p>
                        <div className={`text-3xl font-bold ${selectedColor.text} my-1`}>{value}</div>
                        <div className="text-xs text-slate-500">{subtext}</div>
                    </div>
                    <div className={`p-3 rounded-full ${selectedColor.bg}`}>
                        <Icon className={`w-6 h-6 ${selectedColor.text}`} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-secondary mb-1">
                        Feedback Dashboard
                    </h1>
                    <p className="text-slate-500">
                        Track and analyze your customer feedback performance ✨
                    </p>
                </div>

                <div className="mb-8">
                    <div className="bg-background/80 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-slate-100 inline-flex space-x-1">
                        <TabButton id="ratings" label="Analytics" icon={TrendingUp} />
                        <TabButton id="feedback" label="All Feedback" icon={MessageSquare} />
                    </div>
                </div>
                
                {/* Show error message if there's an error */}
                {error ? (
                    <ErrorMessage />
                ) : isLoading ? (
                    <LoadingSkeleton />
                ) : activeTab === 'feedback' ? (
                    <FeedbackView />
                ) : (
                    <RatingsTracker />
                )}
            </div>
        </div>
    );

    function TabButton({ id, label, icon: Icon }) {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center space-x-2 ${
                    isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-secondary hover:bg-slate-100'
                }`}
            >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
            </button>
        );
    }
};

export default ProviderFeedback;