import React, { useState, useEffect } from 'react';
import { Star, Calendar, User, MessageSquare, TrendingUp, Filter, Search } from 'lucide-react';

const ProviderFeedback = () => {
  const [activeTab, setActiveTab] = useState('feedback');
  const [filterRating, setFilterRating] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data - replace with API calls
  const [feedbackData, setFeedbackData] = useState([
    {
      id: 1,
      customerName: 'Raj Singh',
      bookingId: 'BK001',
      service: 'Home Cleaning',
      date: '2025-07-28',
      rating: 5,
      feedback: 'Excellent service! Very thorough cleaning and professional attitude.',
      bookingAmount: 1500
    },
    {
      id: 2,
      customerName: 'Priya Sharma',
      bookingId: 'BK002',
      service: 'Plumbing Repair',
      date: '2025-07-25',
      rating: 4,
      feedback: 'Good work, but arrived slightly late. Overall satisfied with the repair.',
      bookingAmount: 800
    },
    {
      id: 3,
      customerName: 'Amit Kumar',
      bookingId: 'BK003',
      service: 'Electrical Work',
      date: '2025-07-22',
      rating: 5,
      feedback: 'Outstanding service! Fixed the issue quickly and explained everything clearly.',
      bookingAmount: 1200
    },
    {
      id: 4,
      customerName: 'Neha Gupta',
      bookingId: 'BK004',
      service: 'AC Repair',
      date: '2025-07-20',
      rating: 3,
      feedback: 'Service was okay, but took longer than expected. AC is working now.',
      bookingAmount: 2000
    },
    {
      id: 5,
      customerName: 'Vikash Patel',
      bookingId: 'BK005',
      service: 'Home Cleaning',
      date: '2025-07-18',
      rating: 5,
      feedback: 'Amazing work! House looks spotless. Will definitely book again.',
      bookingAmount: 1800
    }
  ]);

  const [ratingsStats, setRatingsStats] = useState({
    overallRating: 4.4,
    totalReviews: 147,
    ratingBreakdown: {
      5: 85,
      4: 35,
      3: 15,
      2: 8,
      1: 4
    },
    monthlyTrend: [
      { month: 'Jan', rating: 4.2 },
      { month: 'Feb', rating: 4.3 },
      { month: 'Mar', rating: 4.1 },
      { month: 'Apr', rating: 4.5 },
      { month: 'May', rating: 4.4 },
      { month: 'Jun', rating: 4.6 },
      { month: 'Jul', rating: 4.4 }
    ]
  });

  const filteredFeedback = feedbackData.filter(item => {
    const matchesRating = filterRating === 'all' || item.rating === parseInt(filterRating);
    const matchesSearch = item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.bookingId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRating && matchesSearch;
  });

  const StarRating = ({ rating, size = 'w-5 h-5' }) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const FeedbackView = () => (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, service, or booking ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Feedback Cards */}
      <div className="space-y-4">
        {filteredFeedback.map((feedback) => (
          <div key={feedback.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{feedback.customerName}</h3>
                    <p className="text-sm text-gray-500">Booking ID: {feedback.bookingId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <StarRating rating={feedback.rating} />
                  <p className="text-sm text-gray-500 mt-1">{feedback.date}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Service: {feedback.service}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Amount: ₹{feedback.bookingAmount}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start space-x-2">
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-1" />
                  <p className="text-gray-700 text-sm leading-relaxed">{feedback.feedback}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFeedback.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No feedback found matching your criteria.</p>
        </div>
      )}
    </div>
  );

  const RatingsTracker = () => (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">{ratingsStats.overallRating}</div>
          <StarRating rating={Math.round(ratingsStats.overallRating)} size="w-6 h-6" />
          <p className="text-gray-500 mt-2">Overall Rating</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{ratingsStats.totalReviews}</div>
          <p className="text-gray-500">Total Reviews</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {Math.round((ratingsStats.ratingBreakdown[5] / ratingsStats.totalReviews) * 100)}%
          </div>
          <p className="text-gray-500">5-Star Reviews</p>
        </div>
      </div>

      {/* Rating Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Rating Breakdown</h3>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = ratingsStats.ratingBreakdown[rating];
            const percentage = (count / ratingsStats.totalReviews) * 100;
            return (
              <div key={rating} className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 w-16">
                  <span className="text-sm font-medium">{rating}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-12">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Monthly Rating Trend
        </h3>
        <div className="grid grid-cols-7 gap-4">
          {ratingsStats.monthlyTrend.map((month, index) => (
            <div key={index} className="text-center">
              <div className="text-sm text-gray-500 mb-2">{month.month}</div>
              <div className="bg-blue-100 rounded-lg p-3">
                <div className="text-lg font-semibold text-blue-600">{month.rating}</div>
                <StarRating rating={Math.round(month.rating)} size="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Trends */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Top Performing Services</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm">Home Cleaning</span>
                <div className="flex items-center space-x-2">
                  <StarRating rating={5} size="w-3 h-3" />
                  <span className="text-sm font-medium">4.8</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm">Electrical Work</span>
                <div className="flex items-center space-x-2">
                  <StarRating rating={5} size="w-3 h-3" />
                  <span className="text-sm font-medium">4.6</span>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Areas for Improvement</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm">Punctuality</span>
                <span className="text-sm text-orange-600">3 mentions</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-sm">Communication</span>
                <span className="text-sm text-red-600">2 mentions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Provider Dashboard</h1>
          <p className="text-gray-600">Monitor your performance and customer feedback</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('feedback')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'feedback'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Feedback View</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('ratings')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ratings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Ratings Tracker</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'feedback' ? <FeedbackView /> : <RatingsTracker />}
      </div>
    </div>
  );
};

export default ProviderFeedback;