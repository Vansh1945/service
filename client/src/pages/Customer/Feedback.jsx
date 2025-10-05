import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';

const Feedback = () => {
  const { token ,API} = useAuth();

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
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

  // Feedback form state
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

      // Fetch completed bookings
      const bookingsResponse = await fetch(`${API}/booking/customer?status=completed`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!bookingsResponse.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const bookingsData = await bookingsResponse.json();
      setCompletedBookings(bookingsData.data || []);

      // Fetch existing feedbacks
      const feedbacksResponse = await fetch(`${API}/feedback/my-feedbacks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!feedbacksResponse.ok) {
        throw new Error('Failed to fetch feedbacks');
      }

      const feedbacksData = await feedbacksResponse.json();
      setFeedbacks(feedbacksData.data || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (type, rating) => {
    setFeedbackForm(prev => ({
      ...prev,
      [type]: rating
    }));
  };

  const handleCommentChange = (type, comment) => {
    setFeedbackForm(prev => ({
      ...prev,
      [type]: comment
    }));
  };

  const submitFeedback = async (bookingId) => {
    if (feedbackForm.providerRating === 0 || feedbackForm.serviceRating === 0) {
      toast.error('Please provide ratings for both provider and service');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId,
          providerRating: feedbackForm.providerRating,
          providerComment: feedbackForm.providerComment,
          serviceRating: feedbackForm.serviceRating,
          serviceComment: feedbackForm.serviceComment
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit feedback');
      }

      toast.success('Feedback submitted successfully!');
      setFeedbackForm({
        bookingId: '',
        providerRating: 0,
        providerComment: '',
        serviceRating: 0,
        serviceComment: ''
      });

      // Refresh data
      await fetchData();

    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const getFeedbackForBooking = (bookingId) => {
    return feedbacks.find(feedback => feedback.booking === bookingId);
  };

  const getBookingsWithoutFeedback = () => {
    return completedBookings.filter(booking => !getFeedbackForBooking(booking._id));
  };

  const openAddFeedbackModal = () => {
    setIsAddingFeedback(true);
    setSelectedBookingForFeedback(null);
    setFeedbackForm({
      bookingId: '',
      providerRating: 0,
      providerComment: '',
      serviceRating: 0,
      serviceComment: ''
    });
  };

  const closeAddFeedbackModal = () => {
    setIsAddingFeedback(false);
    setSelectedBookingForFeedback(null);
    setFeedbackForm({
      bookingId: '',
      providerRating: 0,
      providerComment: '',
      serviceRating: 0,
      serviceComment: ''
    });
  };

  const selectBookingForFeedback = (booking) => {
    setSelectedBookingForFeedback(booking);
    setFeedbackForm(prev => ({ ...prev, bookingId: booking._id }));
  };

  const submitFeedbackAndClose = async () => {
    if (!selectedBookingForFeedback) return;

    await submitFeedback(selectedBookingForFeedback._id);
    if (!submitting) {
      closeAddFeedbackModal();
    }
  };

  const getFeedback = async (feedbackId) => {
    try {
      const response = await fetch(`${API}/feedback/${feedbackId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feedback details');
      }

      const data = await response.json();
      setDetailedFeedback(data.data);
      setSelectedFeedback(data.data);
      setIsViewing(true);
    } catch (error) {
      console.error('Error fetching feedback:', error);
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

      const response = await fetch(`${API}/feedback/edit/${feedbackId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          providerRating: editingForm.providerRating,
          providerComment: editingForm.providerComment,
          serviceRating: editingForm.serviceRating,
          serviceComment: editingForm.serviceComment
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update feedback');
      }

      toast.success('Feedback updated successfully!');
      setIsEditing(false);
      setSelectedFeedback(null);
      setDetailedFeedback(null);
      setEditingForm({
        providerRating: 0,
        providerComment: '',
        serviceRating: 0,
        serviceComment: ''
      });

      // Refresh data
      await fetchData();

    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error(error.message || 'Failed to update feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRatingChange = (type, rating) => {
    setEditingForm(prev => ({
      ...prev,
      [type]: rating
    }));
  };

  const handleEditCommentChange = (type, comment) => {
    setEditingForm(prev => ({
      ...prev,
      [type]: comment
    }));
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
    setEditingForm({
      providerRating: 0,
      providerComment: '',
      serviceRating: 0,
      serviceComment: ''
    });
  };

  const renderStars = (rating, onChange, interactive = false) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onChange(star)}
            className={`text-2xl ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} ${
              star <= rating ? 'text-accent' : 'text-secondary/30'
            }`}
            disabled={!interactive}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-secondary">Loading your completed bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-inter">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md overflow-hidden p-6">
          <h1 className="text-3xl font-poppins font-bold text-secondary mb-8 text-center">
            Service Feedback
          </h1>

          {/* Add New Feedback Button */}
          <div className="mb-8 text-center">
            <button
              onClick={openAddFeedbackModal}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            >
              Add New Feedback
            </button>
          </div>

          {/* Submitted Feedbacks Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-secondary mb-4">Submitted Feedbacks</h2>

            {feedbacks.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="text-secondary/50 text-6xl mb-4">📝</div>
                <h3 className="text-xl font-medium text-secondary mb-2">
                  No Feedbacks Submitted Yet
                </h3>
                <p className="text-secondary">
                  Click "Add New Feedback" to submit your first feedback.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((feedback) => {
                  const serviceTitle = feedback.serviceFeedback?.service?.title || 'Service';
                  const providerName = feedback.providerFeedback?.provider?.name || 'Provider';

                  return (
                    <div key={feedback._id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {serviceTitle}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Provider:</span> {providerName}
                            </div>
                            <div>
                              <span className="font-medium">Date:</span> {formatDate(feedback.booking?.date)}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4 lg:mt-0">
                          <button
                            onClick={() => getFeedback(feedback._id)}
                            className="px-3 py-1 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20"
                          >
                            View Details
                          </button>
                          {new Date() - new Date(feedback.createdAt) <= 7 * 24 * 60 * 60 * 1000 && (
                            <button
                              onClick={() => startEditing(feedback)}
                              className="px-3 py-1 text-sm bg-accent/10 text-accent rounded-md hover:bg-accent/20"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Provider Rating</h5>
                          {renderStars(feedback.providerFeedback.rating)}
                          {feedback.providerFeedback.comment && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              "{feedback.providerFeedback.comment}"
                            </p>
                          )}
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Service Rating</h5>
                          {renderStars(feedback.serviceFeedback.rating)}
                          {feedback.serviceFeedback.comment && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              "{feedback.serviceFeedback.comment}"
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-4">
                        Submitted on {formatDate(feedback.createdAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal for viewing/editing feedback */}
        {(isViewing || isEditing) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {isViewing ? 'Feedback Details' : 'Edit Feedback'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                {isViewing && detailedFeedback && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Provider Feedback</h3>
                        <div className="mb-2">
                          <span className="font-medium">Rating:</span>
                          {renderStars(detailedFeedback.providerFeedback.rating)}
                        </div>
                        {detailedFeedback.providerFeedback.comment && (
                          <div>
                            <span className="font-medium">Comment:</span>
                            <p className="text-gray-600 mt-1 italic">
                              "{detailedFeedback.providerFeedback.comment}"
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Service Feedback</h3>
                        <div className="mb-2">
                          <span className="font-medium">Rating:</span>
                          {renderStars(detailedFeedback.serviceFeedback.rating)}
                        </div>
                        {detailedFeedback.serviceFeedback.comment && (
                          <div>
                            <span className="font-medium">Comment:</span>
                            <p className="text-gray-600 mt-1 italic">
                              "{detailedFeedback.serviceFeedback.comment}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Submitted on {formatDate(detailedFeedback.createdAt)}</p>
                      <p>Last updated on {formatDate(detailedFeedback.updatedAt)}</p>
                    </div>
                  </div>
                )}

                {isEditing && selectedFeedback && (
                  <form onSubmit={(e) => { e.preventDefault(); editFeedback(selectedFeedback._id); }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Provider Rating *
                        </label>
                        {renderStars(editingForm.providerRating, handleEditRatingChange, true)}
                        <textarea
                          placeholder="Comments about the provider (optional)"
                          value={editingForm.providerComment}
                          onChange={(e) => handleEditCommentChange('providerComment', e.target.value)}
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                          maxLength="500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Rating *
                        </label>
                        {renderStars(editingForm.serviceRating, handleEditRatingChange, true)}
                        <textarea
                          placeholder="Comments about the service (optional)"
                          value={editingForm.serviceComment}
                          onChange={(e) => handleEditCommentChange('serviceComment', e.target.value)}
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                          maxLength="500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Updating...' : 'Update Feedback'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal for adding new feedback */}
        {isAddingFeedback && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New Feedback</h2>
                <button
                  onClick={closeAddFeedbackModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {!selectedBookingForFeedback ? (
                <>
                  <h3 className="text-lg font-semibold mb-4">Select a Booking</h3>
                  {getBookingsWithoutFeedback().length === 0 ? (
                    <p className="text-gray-600">No completed bookings available for feedback.</p>
                  ) : (
                    <ul className="space-y-4 max-h-96 overflow-y-auto">
                      {getBookingsWithoutFeedback().map((booking) => {
                        const serviceTitle = booking.services && booking.services.length > 0 && booking.services[0].service
                          ? booking.services[0].service.title
                          : 'Service';
                        return (
                          <li key={booking._id} className="border border-gray-300 rounded p-4 cursor-pointer hover:bg-gray-100"
                            onClick={() => selectBookingForFeedback(booking)}>
                            <div className="font-semibold">{serviceTitle}</div>
                              <div className="text-sm text-gray-600">
                              Date: {formatDate(booking.date)} | Provider: {booking.provider?.name || 'N/A'}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-4">Provide Feedback for Booking</h3>
                  <form onSubmit={(e) => { e.preventDefault(); submitFeedbackAndClose(); }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Provider Rating *
                        </label>
                        {renderStars(feedbackForm.providerRating, (rating) => handleRatingChange('providerRating', rating), true)}
                        <textarea
                          placeholder="Comments about the provider (optional)"
                          value={feedbackForm.providerComment}
                          onChange={(e) => handleCommentChange('providerComment', e.target.value)}
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                          maxLength="500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Rating *
                        </label>
                        {renderStars(feedbackForm.serviceRating, (rating) => handleRatingChange('serviceRating', rating), true)}
                        <textarea
                          placeholder="Comments about the service (optional)"
                          value={feedbackForm.serviceComment}
                          onChange={(e) => handleCommentChange('serviceComment', e.target.value)}
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                          maxLength="500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={closeAddFeedbackModal}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feedback;
