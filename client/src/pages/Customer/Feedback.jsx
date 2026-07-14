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
    // Open immediately using local feedbacks data for 0ms lag
    const localFb = feedbacks.find(f => f._id === feedbackId);
    if (localFb) {
      setDetailedFeedback(localFb);
      setSelectedFeedback(localFb);
      setIsViewing(true);
    }
    
    try {
      const response = await getFeedbackService(feedbackId);
      const responseData = response.data;
      if (responseData.success) {
        setDetailedFeedback(responseData.data);
        setSelectedFeedback(responseData.data);
        if (!localFb) {
          setIsViewing(true);
        }
      }
    } catch (error) {
      if (!localFb) {
        toast.error('Failed to load feedback details');
      }
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
      <div className="min-h-screen bg-neutral-50 font-inter">
        <div className="bg-white border-b border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="h-5 bg-neutral-200 rounded w-24 animate-pulse"></div>
            <div className="h-7 bg-neutral-200 rounded-full w-24 animate-pulse"></div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          <div className="h-14 bg-neutral-200 rounded-[18px] animate-pulse"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-neutral-200 rounded-[18px] animate-pulse"></div>
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
    <div className="min-h-screen bg-neutral-50 font-inter text-neutral-800 antialiased pb-20 sm:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate(-1)} 
                className="p-1 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-neutral-600" />
              </button>
              <div>
                <h1 className="text-sm font-extrabold text-neutral-900 tracking-tight font-poppins">My Reviews</h1>
                <p className="text-[10px] text-neutral-400">Share your experience</p>
              </div>
            </div>
            <button
              onClick={openAddFeedbackModal}
              className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Write Review
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-3.5 space-y-3">
        {/* Summary Card */}
        <div className="bg-white rounded-[18px] p-3 border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] grid grid-cols-4 gap-2 text-center">
          <div className="border-r border-neutral-100 last:border-0 flex flex-col justify-center py-0.5">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Avg Rating</span>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <Star className="w-3.5 h-3.5 text-accent fill-accent" />
              <span className="text-xs font-bold text-neutral-900">{avgRating}</span>
            </div>
          </div>
          <div className="border-r border-neutral-100 last:border-0 flex flex-col justify-center py-0.5">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Reviews</span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-neutral-900">{feedbacks.length}</span>
            </div>
          </div>
          <div className="border-r border-neutral-100 last:border-0 flex flex-col justify-center py-0.5">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Pending</span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-danger" />
              <span className="text-xs font-bold text-neutral-900">{pendingCount}</span>
            </div>
          </div>
          <div className="last:border-0 flex flex-col justify-center py-0.5">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Providers</span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-bold text-neutral-900">
                {Array.from(new Set(feedbacks.map(f => f.providerFeedback?.provider?._id))).length}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Review Card */}
        {completedBookings.filter(b => !getFeedbackForBooking(b._id)).slice(0, 1).map((pendingBooking) => (
          <div key={pendingBooking._id} className="bg-primary/5 border border-primary/10 p-2.5 rounded-[18px] flex items-center justify-between gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-1.5 w-1.5 relative flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-neutral-900 truncate">
                  {pendingBooking.services?.[0]?.service?.title || 'Service'}
                </p>
                <p className="text-[9px] text-neutral-400 mt-0.5">
                  Completed on {formatDate(pendingBooking.date)} • Review Pending
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                selectBookingForFeedback(pendingBooking);
                setIsAddingFeedback(true);
              }}
              className="bg-primary hover:bg-primary/90 text-white px-3 py-1 rounded-full text-[11px] font-semibold transition-colors shadow-sm flex-shrink-0"
            >
              Write Review
            </button>
          </div>
        ))}

        {/* Reviews List */}
        {feedbacks.length === 0 ? (
          <div className="bg-white rounded-[18px] border border-neutral-100 p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <div className="w-10 h-10 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-neutral-100">
              <Star className="w-5 h-5 text-neutral-300" />
            </div>
            <h3 className="text-xs font-bold text-neutral-900 mb-0.5">No reviews yet</h3>
            <p className="text-[10px] text-neutral-400 mb-3.5">Your reviews will appear here</p>
            <button 
              onClick={openAddFeedbackModal} 
              className="bg-primary text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Write First Review
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {feedbacks.map((feedback) => {
              const service = feedback.serviceFeedback?.service;
              const provider = feedback.providerFeedback?.provider;
              const bookingId = typeof feedback.booking === 'string' ? feedback.booking : feedback.booking?._id;
              const booking = completedBookings.find(b => b._id === bookingId) || feedback.booking;
              const overallRating = ((feedback.serviceFeedback?.rating + feedback.providerFeedback?.rating) / 2).toFixed(1);

              return (
                <div key={feedback._id} className="bg-white rounded-[18px] border border-neutral-100 p-3 hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Service Image / Icon */}
                    <div className="relative w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 text-primary flex-shrink-0 border border-primary/20 overflow-hidden">
                      {service?.images?.[0] ? (
                        <img
                          src={service.images[0]}
                          alt={service?.title || 'Service'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-extrabold text-neutral-900 truncate max-w-[200px]">
                          {service?.title || 'Service'}
                        </h3>
                        <span className="px-1.5 py-0.5 bg-success/10 text-success rounded-full text-[9px] font-bold">
                          {booking?.status || 'Completed'}
                        </span>
                      </div>
                      <p className="text-[9px] text-neutral-400 mt-0.5">
                        Booked on {booking?.date ? formatDate(booking.date) : formatDate(feedback.createdAt)}
                      </p>
                      
                      {/* Provider Profile Info */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <img
                          src={provider?.profilePicUrl || `https://ui-avatars.com/api/?name=${provider?.name || 'Provider'}&background=0D9488&color=fff`}
                          alt={provider?.name || 'Provider'}
                          className="w-4 h-4 rounded-full object-cover border border-neutral-100 flex-shrink-0"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(provider?.name || 'P')}&background=F3F4F6&color=4B5563`;
                          }}
                        />
                        <span className="text-[10px] font-medium text-neutral-500 truncate max-w-[120px]">
                          {provider?.name || 'Provider'}
                        </span>
                        {(provider?.kycStatus === 'approved' || provider?.trustedProvider) && (
                          <span className="inline-flex items-center text-primary" title="Verified Professional">
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-2 md:pt-0 border-neutral-50 flex-shrink-0">
                    <div className="flex flex-col min-w-[110px]">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                        <span className="text-xs font-bold text-neutral-900">{overallRating}</span>
                      </div>
                      <p className="text-[9px] text-neutral-500 italic truncate max-w-[150px] mt-0.5" title={feedback.serviceFeedback?.comment}>
                        "{feedback.serviceFeedback?.comment || 'No comment provided'}"
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => getFeedback(feedback._id)} 
                        className="p-1 text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary/20" 
                        title="View Detailed Rating"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {new Date() - new Date(feedback.createdAt) <= 7 * 24 * 60 * 60 * 1000 && (
                        <button 
                          onClick={() => startEditing(feedback)} 
                          className="p-1 text-success hover:bg-success/5 rounded-lg transition-colors border border-success/20" 
                          title="Edit Review"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[9999]" onClick={isAddingFeedback ? closeAddFeedbackModal : closeModal}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-[18px] rounded-t-[18px] shadow-2xl flex flex-col max-h-[85vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900 font-poppins">
                  {isViewing ? 'Review Details' : isEditing ? 'Edit Review' : 'Write a Review'}
                </h3>
                <p className="text-[10px] text-neutral-400">
                  {isAddingFeedback && !selectedBookingForFeedback ? 'Select a booking to review' : 'Rate your experience'}
                </p>
              </div>
              <button 
                onClick={isAddingFeedback ? closeAddFeedbackModal : closeModal} 
                className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-4 py-3.5 space-y-4">
              {/* View Mode */}
              {isViewing && detailedFeedback && (
                <div className="space-y-4">
                  {/* Comment Details */}
                  <div className="space-y-2">
                    <div className="bg-neutral-50 rounded-xl p-2.5">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Service Rating & Comment</span>
                      <div className="flex items-center justify-between mt-0.5">
                        {renderStars(detailedFeedback.serviceFeedback.rating)}
                        <span className="text-xs font-bold text-neutral-700">{detailedFeedback.serviceFeedback.rating}/5</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-1 italic">
                        "{detailedFeedback.serviceFeedback.comment || 'No comment provided'}"
                      </p>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-2.5">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Provider Rating & Comment</span>
                      <div className="flex items-center justify-between mt-0.5">
                        {renderStars(detailedFeedback.providerFeedback.rating)}
                        <span className="text-xs font-bold text-neutral-700">{detailedFeedback.providerFeedback.rating}/5</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-1 italic">
                        "{detailedFeedback.providerFeedback.comment || 'No comment provided'}"
                      </p>
                    </div>
                  </div>

                  {/* Before / After Photos placeholder */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-neutral-900 font-poppins">Photos</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-neutral-400 font-medium block mb-1">Before Photos</span>
                        <div className="border border-dashed border-neutral-200 rounded-xl h-16 flex flex-col items-center justify-center bg-neutral-50 text-neutral-400">
                          <svg className="w-4 h-4 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[8px]">No photos uploaded</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 font-medium block block mb-1">After Photos</span>
                        <div className="border border-dashed border-neutral-200 rounded-xl h-16 flex flex-col items-center justify-center bg-neutral-50 text-neutral-400">
                          <svg className="w-4 h-4 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[8px]">No photos uploaded</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-neutral-400 text-center pt-1 border-t border-neutral-50">
                    Reviewed on {formatDate(detailedFeedback.createdAt)}
                  </div>
                </div>
              )}

              {/* Booking Selection */}
              {isAddingFeedback && !selectedBookingForFeedback && (
                <div className="space-y-2">
                  {completedBookings.filter(b => !getFeedbackForBooking(b._id)).length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle className="w-10 h-10 text-success mx-auto mb-2" />
                      <p className="text-xs text-neutral-600 font-medium">All bookings have been reviewed!</p>
                    </div>
                  ) : (
                    completedBookings.filter(b => !getFeedbackForBooking(b._id)).map((booking) => (
                      <button
                        key={booking._id}
                        onClick={() => selectBookingForFeedback(booking)}
                        className="w-full text-left p-3 border border-neutral-100 rounded-xl hover:border-primary/50 hover:shadow-sm transition-all flex items-center justify-between"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-neutral-900">{booking.services?.[0]?.service?.title || 'Service'}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-neutral-400 font-roboto">
                            <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{formatDate(booking.date)}</span>
                            <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{booking.provider?.name || 'Provider'}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400" />
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Edit/Add Form */}
              {(isEditing || (isAddingFeedback && selectedBookingForFeedback)) && (
                <form onSubmit={(e) => { e.preventDefault(); isEditing ? editFeedback(selectedFeedback._id) : submitFeedbackAndClose(); }} className="space-y-4 font-inter">
                  {/* Service Rating */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1.5">Service Rating *</label>
                    <div className="flex justify-center py-2.5 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => {
                              const r = star;
                              if (isEditing) {
                                setEditingForm(prev => ({ ...prev, serviceRating: r }));
                              } else {
                                setFeedbackForm(prev => ({ ...prev, serviceRating: r }));
                              }
                            }}
                            className="transition-transform hover:scale-110"
                          >
                            <Star 
                              className={`w-7 h-7 ${(isEditing ? editingForm.serviceRating : feedbackForm.serviceRating) >= star ? 'fill-accent text-accent' : 'text-neutral-200'}`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      placeholder="Share your experience about the service..."
                      rows="2"
                      value={isEditing ? editingForm.serviceComment : feedbackForm.serviceComment}
                      onChange={(e) => isEditing ? setEditingForm(prev => ({ ...prev, serviceComment: e.target.value })) : setFeedbackForm(prev => ({ ...prev, serviceComment: e.target.value }))}
                      className="w-full mt-2 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                    />
                  </div>

                  {/* Provider Rating */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1.5">Provider Rating *</label>
                    <div className="flex justify-center py-2.5 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => {
                              const r = star;
                              if (isEditing) {
                                setEditingForm(prev => ({ ...prev, providerRating: r }));
                              } else {
                                setFeedbackForm(prev => ({ ...prev, providerRating: r }));
                              }
                            }}
                            className="transition-transform hover:scale-110"
                          >
                            <Star 
                              className={`w-7 h-7 ${(isEditing ? editingForm.providerRating : feedbackForm.providerRating) >= star ? 'fill-accent text-accent' : 'text-neutral-200'}`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      placeholder="Share your experience about the provider..."
                      rows="2"
                      value={isEditing ? editingForm.providerComment : feedbackForm.providerComment}
                      onChange={(e) => isEditing ? setEditingForm(prev => ({ ...prev, providerComment: e.target.value })) : setFeedbackForm(prev => ({ ...prev, providerComment: e.target.value }))}
                      className="w-full mt-2 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-1">
                    <button 
                      type="button" 
                      onClick={isEditing ? closeModal : closeAddFeedbackModal} 
                      className="flex-1 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium hover:bg-neutral-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <Processing
                      type="submit"
                      loading={submitting}
                      loadingText="Saving..."
                      className="flex-1 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
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