import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Star, MessageSquare, Plus, ArrowLeft, Calendar,
  User, Eye, Edit2, CheckCircle, Clock, ChevronRight, X
} from 'lucide-react';
import { formatDate } from '../../utils/format';
import { getCustomerBookings } from '../../services/BookingService';
import {
  submitFeedback as submitFeedbackService,
  getCustomerFeedbacks as getCustomerFeedbacksService,
  getFeedback as getFeedbackService,
  editFeedback as editFeedbackService
} from '../../services/FeedbackService';
import BookingCardSkeleton from '../../components/ui-skeletons/BookingCardSkeleton';
import Processing from '../../components/ui-skeletons/Processing';
import Rating from '../../components/Rating';

const Feedback = () => {
  const { token, API } = useAuth();
  const navigate = useNavigate();

  const [completedBookings, setCompletedBookings] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [detailedFeedback, setDetailedFeedback] = useState(null);
  const [isAddingFeedback, setIsAddingFeedback] = useState(false);
  const [selectedBookingForFeedback, setSelectedBookingForFeedback] = useState(null);
  const [editingForm, setEditingForm] = useState({
    providerRating: 0,
    providerComment: '',
    serviceRating: 0,
    serviceComment: ''
  });

  const [feedbackForm, setFeedbackForm] = useState({
    bookingId: '',
    providerRating: 0,
    providerComment: '',
    serviceRating: 0,
    serviceComment: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: 'completed' });
      const bookingsResponse = await getCustomerBookings(params);
      const bookingsData = bookingsResponse.data;
      setCompletedBookings(bookingsData.data || []);

      const feedbacksResponse = await getCustomerFeedbacksService();
      const feedbacksData = feedbacksResponse.data;
      setFeedbacks(feedbacksData.data || []);
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (bookingId) => {
    if (feedbackForm.providerRating === 0 || feedbackForm.serviceRating === 0) {
      toast.error('Please provide ratings for both provider and service');
      return;
    }

    try {
      setSubmitting(true);
      const response = await submitFeedbackService({
        bookingId,
        providerRating: feedbackForm.providerRating,
        providerComment: feedbackForm.providerComment,
        serviceRating: feedbackForm.serviceRating,
        serviceComment: feedbackForm.serviceComment
      });

      if (!response.data.success) throw new Error(response.data.message || 'Failed to submit feedback');
      toast.success('Feedback submitted successfully!');
      setFeedbackForm({ bookingId: '', providerRating: 0, providerComment: '', serviceRating: 0, serviceComment: '' });
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const getFeedbackForBooking = (bookingId) => {
    return feedbacks.find(feedback => {
      const fbBookingId = typeof feedback.booking === 'string' ? feedback.booking : feedback.booking?._id;
      return fbBookingId === bookingId;
    });
  };

  const getFeedback = async (feedbackId) => {
    try {
      const response = await getFeedbackService(feedbackId);
      const responseData = response.data;
      if (responseData.success) {
        setDetailedFeedback(responseData.data);
        setSelectedFeedback(responseData.data);
        setIsViewing(true);
      }
    } catch (error) {
      toast.error('Failed to load feedback details');
    }
  };

  const editFeedback = async (feedbackId) => {
    if (editingForm.providerRating === 0 || editingForm.serviceRating === 0) {
      toast.error('Please provide ratings for both provider and service');
      return;
    }

    try {
      setSubmitting(true);
      const response = await editFeedbackService(feedbackId, {
        providerRating: editingForm.providerRating,
        providerComment: editingForm.providerComment,
        serviceRating: editingForm.serviceRating,
        serviceComment: editingForm.serviceComment
      });

      if (!response.data.success) throw new Error(response.data.message || 'Failed to update feedback');
      toast.success('Feedback updated successfully!');
      setIsEditing(false);
      setSelectedFeedback(null);
      setDetailedFeedback(null);
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to update feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const openAddFeedbackModal = () => {
    setIsAddingFeedback(true);
    setSelectedBookingForFeedback(null);
    setFeedbackForm({ bookingId: '', providerRating: 0, providerComment: '', serviceRating: 0, serviceComment: '' });
  };

  const closeAddFeedbackModal = () => {
    setIsAddingFeedback(false);
    setSelectedBookingForFeedback(null);
  };

  const selectBookingForFeedback = (booking) => {
    setSelectedBookingForFeedback(booking);
    setFeedbackForm(prev => ({ ...prev, bookingId: booking._id }));
  };

  const submitFeedbackAndClose = async () => {
    if (!selectedBookingForFeedback) return;
    await submitFeedback(selectedBookingForFeedback._id);
    if (!submitting) closeAddFeedbackModal();
  };

  const startEditing = (feedback) => {
    setSelectedFeedback(feedback);
    setEditingForm({
      providerRating: feedback.providerFeedback.rating,
      providerComment: feedback.providerFeedback.comment || '',
      serviceRating: feedback.serviceFeedback.rating,
      serviceComment: feedback.serviceFeedback.comment || ''
    });
    setIsEditing(true);
    setIsViewing(false);
  };

  const closeModal = () => {
    setIsViewing(false);
    setIsEditing(false);
    setSelectedFeedback(null);
    setDetailedFeedback(null);
  };

  const renderStars = (rating, onChange, interactive = false) => {
    return <Rating rating={rating} onChange={onChange} interactive={interactive} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 font-inter">
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded-full w-28 animate-pulse"></div>
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

  const pendingCount = completedBookings.filter(b => !getFeedbackForBooking(b._id)).length;
  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((sum, f) => sum + (f.serviceFeedback?.rating || 0), 0) / feedbacks.length).toFixed(1)
    : '0.0';

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
                <h1 className="text-base font-bold text-secondary font-poppins">My Reviews</h1>
                <p className="text-xs text-gray-400">Share your experience</p>
              </div>
            </div>
            <button
              onClick={openAddFeedbackModal}
              className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Write Review
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Reviews</span>
              <div className="text-2xl font-bold text-secondary mt-1">{feedbacks.length}</div>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Avg Rating</span>
              <div className="text-2xl font-bold text-secondary mt-1">{avgRating}</div>
            </div>
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <Star className="w-5 h-5 fill-accent" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pending</span>
              <div className="text-2xl font-bold text-secondary mt-1">{pendingCount}</div>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rated Providers</span>
              <div className="text-2xl font-bold text-secondary mt-1">
                {Array.from(new Set(feedbacks.map(f => f.providerFeedback?.provider?._id))).length}
              </div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg text-secondary">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Pending Banner */}
        {pendingCount > 0 && (
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-sm font-bold text-primary">You have {pendingCount} pending review{pendingCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-500">Your feedback helps others choose better services.</p>
            </div>
            <button onClick={openAddFeedbackModal} className="w-full sm:w-auto bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
              Review Now
            </button>
          </div>
        )}

        {/* Reviews List */}
        {feedbacks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <Star className="w-6 h-6 text-gray-300" />
            </div>
            <h3 className="text-sm font-bold text-secondary mb-1">No reviews yet</h3>
            <p className="text-xs text-gray-400 mb-5">Your reviews will appear here</p>
            <button onClick={openAddFeedbackModal} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              Write First Review
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => {
              const service = feedback.serviceFeedback?.service;
              const provider = feedback.providerFeedback?.provider;
              return (
                <div key={feedback._id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-grow min-w-0">
                      <img
                        src={provider?.profilePicUrl || `https://ui-avatars.com/api/?name=${provider?.name || 'Provider'}&background=0D9488&color=fff`}
                        alt={provider?.name || 'Provider'}
                        className="w-10 h-10 rounded-full object-cover bg-gray-50 border border-gray-100 flex-shrink-0"
                      />
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-secondary truncate">{service?.title || 'Service'}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          <span>{provider?.name || 'Provider'}</span>
                        </p>
                        
                        <div className="mt-3 space-y-2">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Service Rating</span>
                              {renderStars(feedback.serviceFeedback.rating)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 italic">
                              "{feedback.serviceFeedback.comment || 'No comment provided'}"
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Provider Rating</span>
                              {renderStars(feedback.providerFeedback.rating)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 italic">
                              "{feedback.providerFeedback.comment || 'No comment provided'}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" />
                        {formatDate(feedback.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => getFeedback(feedback._id)} className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors border border-transparent hover:border-primary/10" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        {new Date() - new Date(feedback.createdAt) <= 7 * 24 * 60 * 60 * 1000 && (
                          <button onClick={() => startEditing(feedback)} className="p-1.5 text-accent hover:bg-accent/5 rounded-lg transition-colors border border-transparent hover:border-accent/10" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit/View Modal */}
      {(isViewing || isEditing || isAddingFeedback) && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={isAddingFeedback ? closeAddFeedbackModal : closeModal}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-secondary font-poppins">
                  {isViewing ? 'Review Details' : isEditing ? 'Edit Review' : 'Write a Review'}
                </h3>
                <p className="text-xs text-gray-400">
                  {isAddingFeedback && !selectedBookingForFeedback ? 'Select a booking' : 'Rate your experience'}
                </p>
              </div>
              <button onClick={isAddingFeedback ? closeAddFeedbackModal : closeModal} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* View Mode */}
              {isViewing && detailedFeedback && (
                <div className="space-y-5">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-secondary mb-2">Service Rating</h4>
                    <div className="flex items-center justify-between mb-2">
                      {renderStars(detailedFeedback.serviceFeedback.rating)}
                      <span className="text-xs text-gray-400">{detailedFeedback.serviceFeedback.rating}/5</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{detailedFeedback.serviceFeedback.comment || 'No comment provided'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-secondary mb-2">Provider Rating</h4>
                    <div className="flex items-center justify-between mb-2">
                      {renderStars(detailedFeedback.providerFeedback.rating)}
                      <span className="text-xs text-gray-400">{detailedFeedback.providerFeedback.rating}/5</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{detailedFeedback.providerFeedback.comment || 'No comment provided'}</p>
                  </div>
                  <div className="text-xs text-gray-400 text-center pt-2">
                    Reviewed on {formatDate(detailedFeedback.createdAt)}
                  </div>
                </div>
              )}

              {/* Booking Selection */}
              {isAddingFeedback && !selectedBookingForFeedback && (
                <div className="space-y-3">
                  {completedBookings.filter(b => !getFeedbackForBooking(b._id)).length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-gray-600">All bookings have been reviewed!</p>
                    </div>
                  ) : (
                    completedBookings.filter(b => !getFeedbackForBooking(b._id)).map((booking) => (
                      <button
                        key={booking._id}
                        onClick={() => selectBookingForFeedback(booking)}
                        className="w-full text-left p-4 border border-gray-100 rounded-xl hover:border-primary/50 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-secondary">{booking.services?.[0]?.service?.title || 'Service'}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(booking.date)}</span>
                              <span className="flex items-center gap-1"><User className="w-3 h-3" />{booking.provider?.name || 'Provider'}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Edit/Add Form */}
              {(isEditing || (isAddingFeedback && selectedBookingForFeedback)) && (
                <form onSubmit={(e) => { e.preventDefault(); isEditing ? editFeedback(selectedFeedback._id) : submitFeedbackAndClose(); }} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Service Rating *</label>
                    <div className="flex justify-center py-3 bg-gray-50 rounded-xl">
                      {renderStars(
                        isEditing ? editingForm.serviceRating : feedbackForm.serviceRating,
                        (r) => isEditing ? setEditingForm(prev => ({ ...prev, serviceRating: r })) : setFeedbackForm(prev => ({ ...prev, serviceRating: r })),
                        true
                      )}
                    </div>
                    <textarea
                      placeholder="Share your experience about the service..."
                      rows="3"
                      value={isEditing ? editingForm.serviceComment : feedbackForm.serviceComment}
                      onChange={(e) => isEditing ? setEditingForm(prev => ({ ...prev, serviceComment: e.target.value })) : setFeedbackForm(prev => ({ ...prev, serviceComment: e.target.value }))}
                      className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Provider Rating *</label>
                    <div className="flex justify-center py-3 bg-gray-50 rounded-xl">
                      {renderStars(
                        isEditing ? editingForm.providerRating : feedbackForm.providerRating,
                        (r) => isEditing ? setEditingForm(prev => ({ ...prev, providerRating: r })) : setFeedbackForm(prev => ({ ...prev, providerRating: r })),
                        true
                      )}
                    </div>
                    <textarea
                      placeholder="Share your experience about the provider..."
                      rows="3"
                      value={isEditing ? editingForm.providerComment : feedbackForm.providerComment}
                      onChange={(e) => isEditing ? setEditingForm(prev => ({ ...prev, providerComment: e.target.value })) : setFeedbackForm(prev => ({ ...prev, providerComment: e.target.value }))}
                      className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={isEditing ? closeModal : closeAddFeedbackModal} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <Processing
                      type="submit"
                      loading={submitting}
                      loadingText="Saving..."
                      className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                    >
                      {isEditing ? 'Update Review' : 'Submit Review'}
                    </Processing>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;