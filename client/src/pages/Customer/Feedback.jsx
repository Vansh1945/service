import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import {
  Star as StarIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  RateReview as RateReviewIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import { format, subDays, isAfter } from 'date-fns';

const FeedbackManagement = () => {
  const { token, user, API, logoutUser } = useAuth();
  const navigate = useNavigate();

  // State management
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    providerRating: 0,
    providerComment: '',
    serviceRating: 0,
    serviceComment: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingsForFeedback, setBookingsForFeedback] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openBookingDialog, setOpenBookingDialog] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch customer's feedbacks
  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/feedback/my-feedbacks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
        }
        throw new Error('Failed to fetch feedbacks');
      }

      const data = await response.json();
      setFeedbacks(data.data || []);
    } catch (err) {
      setError(err.message);
      showSnackbar(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings eligible for feedback
  const fetchEligibleBookings = async () => {
    try {
      const response = await fetch(`${API}/booking/customer?status=completed`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch eligible bookings');

      const data = await response.json();
      const feedbackBookingIds = feedbacks
        .filter(f => f.booking) // This ensures f.booking is not null
        .map(f => f.booking._id);

      const eligibleBookings = data.data.filter(
        booking => !feedbackBookingIds.includes(booking._id)
      );
//...
      
      setBookingsForFeedback(eligibleBookings || []);
    } catch (err) {
      console.error('Error fetching eligible bookings:', err);
      setBookingsForFeedback([]);
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (formData.providerRating === 0) {
      errors.providerRating = 'Please rate the provider';
    }
    
    if (formData.serviceRating === 0) {
      errors.serviceRating = 'Please rate the service';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit new feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!selectedBooking) {
      showSnackbar('Please select a booking first', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const formPayload = {
        bookingId: selectedBooking._id,
        providerRating: formData.providerRating,
        providerComment: formData.providerComment,
        serviceRating: formData.serviceRating,
        serviceComment: formData.serviceComment
      };

      const response = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit feedback');
      }

      showSnackbar('Feedback submitted successfully!', 'success');
      setOpenDialog(false);
      setSelectedBooking(null);
      setFormData({
        providerRating: 0,
        providerComment: '',
        serviceRating: 0,
        serviceComment: ''
      });
      fetchFeedbacks();
    } catch (err) {
      showSnackbar(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing feedback
  const handleUpdateFeedback = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      const formPayload = {
        providerRating: formData.providerRating,
        providerComment: formData.providerComment,
        serviceRating: formData.serviceRating,
        serviceComment: formData.serviceComment
      };

      const response = await fetch(`${API}/feedback/edit/${editingFeedback._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update feedback');
      }

      showSnackbar('Feedback updated successfully!', 'success');
      setOpenEditModal(false);
      fetchFeedbacks();
    } catch (err) {
      showSnackbar(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if feedback can be edited (within 7 days)
  const canEditFeedback = (feedback) => {
    const feedbackDate = new Date(feedback.createdAt);
    const sevenDaysAgo = subDays(new Date(), 7);
    return isAfter(feedbackDate, sevenDaysAgo);
  };

  // Show snackbar notification
  const showSnackbar = (message, severity) => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Close snackbar
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle booking selection
  const handleBookingSelect = (booking) => {
    setSelectedBooking(booking);
    setOpenBookingDialog(false);
    setOpenDialog(true);
  };

  // Open edit modal
  const handleOpenEditModal = (feedback) => {
    setEditingFeedback(feedback);
    setFormData({
      providerRating: feedback.providerFeedback.rating,
      providerComment: feedback.providerFeedback.comment || '',
      serviceRating: feedback.serviceFeedback.rating,
      serviceComment: feedback.serviceFeedback.comment || ''
    });
    setFormErrors({});
    setOpenEditModal(true);
  };

  // Initialize component
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchFeedbacks();
  }, [user]);

  // Fetch eligible bookings whenever feedbacks change
  useEffect(() => {
    if (feedbacks.length >= 0) {
      fetchEligibleBookings();
    }
  }, [feedbacks]);

  // Star Rating Component
  const StarRating = ({ rating, onChange, error, maxStars = 5 }) => (
    <div>
      <div className="flex items-center">
        {[...Array(maxStars)].map((_, index) => {
          const starValue = index + 1;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(starValue)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <StarIcon
                className={`h-8 w-8 ${
                  starValue <= rating 
                    ? 'text-yellow-400 fill-current' 
                    : 'text-gray-300'
                }`}
              />
            </button>
          );
        })}
        <span className="ml-2 text-sm font-medium text-secondary">
          {rating || 0} out of {maxStars}
        </span>
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );

  // Feedback Form Component
  const FeedbackForm = ({ isEdit = false, booking }) => (
    <form onSubmit={isEdit ? handleUpdateFeedback : handleSubmitFeedback} className="space-y-6">
      {booking && (
        <div className="bg-primary/10 p-4 rounded-lg mb-4">
          <h4 className="font-semibold text-primary">Booking Details</h4>
          <p className="text-sm text-secondary">
            {booking.services?.[0]?.service?.title} • {format(new Date(booking.date), 'MMM dd, yyyy')}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6">
        {/* Service Feedback Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-secondary mb-4 flex items-center">
            <WorkIcon className="mr-2 text-primary" />
            Rate the Service
          </h3>
          
          <div className="mb-4">
            <p className="text-sm font-medium text-secondary mb-2">
              How satisfied are you with the service? *
            </p>
            <StarRating 
              rating={formData.serviceRating} 
              onChange={(value) => {
                setFormData(prev => ({ ...prev, serviceRating: value }));
                if (formErrors.serviceRating) {
                  setFormErrors(prev => ({ ...prev, serviceRating: '' }));
                }
              }}
              error={formErrors.serviceRating}
            />
          </div>
          
          <div>
            <label htmlFor="serviceComment" className="block text-sm font-medium text-secondary mb-2">
              Share your experience (optional)
            </label>
            <textarea
              id="serviceComment"
              name="serviceComment"
              value={formData.serviceComment}
              onChange={(e) => setFormData(prev => ({ ...prev, serviceComment: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              placeholder="Tell us what you liked or didn't like about the service..."
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {formData.serviceComment.length}/500 characters
            </p>
          </div>
        </div>

        {/* Provider Feedback Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-secondary mb-4 flex items-center">
            <PersonIcon className="mr-2 text-primary" />
            Rate the Service Provider
          </h3>
          
          <div className="mb-4">
            <p className="text-sm font-medium text-secondary mb-2">
              How would you rate the provider's service? *
            </p>
            <StarRating 
              rating={formData.providerRating} 
              onChange={(value) => {
                setFormData(prev => ({ ...prev, providerRating: value }));
                if (formErrors.providerRating) {
                  setFormErrors(prev => ({ ...prev, providerRating: '' }));
                }
              }}
              error={formErrors.providerRating}
            />
          </div>
          
          <div>
            <label htmlFor="providerComment" className="block text-sm font-medium text-secondary mb-2">
              Tell us about the provider (optional)
            </label>
            <textarea
              id="providerComment"
              name="providerComment"
              value={formData.providerComment}
              onChange={(e) => setFormData(prev => ({ ...prev, providerComment: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              placeholder="Was the provider professional, punctual, and helpful?"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {formData.providerComment.length}/500 characters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => isEdit ? setOpenEditModal(false) : setOpenDialog(false)}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-secondary bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEdit ? 'Updating...' : 'Submitting...'}
              </span>
            ) : isEdit ? 'Update Review' : 'Submit Review'}
          </button>
        </div>
      </div>
    </form>
  );

  // Feedback Card Component
  const FeedbackCard = ({ feedback }) => {
    const editable = canEditFeedback(feedback);
    
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4 border border-gray-100 transition-all hover:shadow-md">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold text-secondary">
              {feedback.serviceFeedback?.service?.title || 'Service'}
            </h3>
            <div className="flex items-center mt-1 text-sm text-gray-600">
              <CalendarIcon className="h-4 w-4 mr-1" />
              <span>{format(new Date(feedback.booking?.date || feedback.createdAt), 'MMM dd, yyyy')}</span>
            </div>
          </div>
          <div className="flex space-x-2 mt-2 md:mt-0">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              editable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {editable ? 'Editable' : 'View Only'}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 my-4"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Service Rating */}
          <div>
            <h4 className="text-md font-semibold text-secondary mb-2">
              Service Review
            </h4>
            <div className="flex items-center mb-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={`h-5 w-5 ${star <= (feedback.serviceFeedback?.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="ml-2 text-sm font-medium text-secondary">
                {feedback.serviceFeedback?.rating?.toFixed(1) || 'N/A'}
              </span>
            </div>
            
            {feedback.serviceFeedback?.comment && (
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-2">
                "{feedback.serviceFeedback.comment}"
                {feedback.serviceFeedback.isEdited && (
                  <span className="text-xs text-gray-500 ml-1">(edited)</span>
                )}
              </p>
            )}
          </div>

          {/* Provider Rating */}
          <div>
            <h4 className="text-md font-semibold text-secondary mb-2">
              Provider Review
            </h4>
            <div className="flex items-center mb-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={`h-5 w-5 ${star <= (feedback.providerFeedback?.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="ml-2 text-sm font-medium text-secondary">
                {feedback.providerFeedback?.rating?.toFixed(1) || 'N/A'}
              </span>
            </div>
            
            {feedback.providerFeedback?.comment && (
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-2">
                "{feedback.providerFeedback.comment}"
                {feedback.providerFeedback.isEdited && (
                  <span className="text-xs text-gray-500 ml-1">(edited)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {editable && (
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => handleOpenEditModal(feedback)}
              className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              <EditIcon className="h-4 w-4 mr-1" />
              Edit Review
            </button>
          </div>
        )}
      </div>
    );
  };

  // Booking Selection Dialog
  const BookingSelectionDialog = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity ${openBookingDialog ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-secondary">
            Select Booking to Review
          </h3>
          <button
            onClick={() => setOpenBookingDialog(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow">
          {bookingsForFeedback.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="mt-4 text-md font-semibold text-secondary">
                No Bookings Available for Review
              </h4>
              <p className="mt-2 text-sm text-gray-600">
                You've reviewed all your completed bookings or don't have any bookings ready for review yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookingsForFeedback.map(booking => (
                <div 
                  key={booking._id}
                  onClick={() => handleBookingSelect(booking)}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                      {booking.services?.[0]?.service?.title?.charAt(0) || 'S'}
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-semibold text-secondary">
                        {booking.services?.[0]?.service?.title || 'Service'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {format(new Date(booking.date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600">
                        Provider: {booking.provider?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Feedback Submission Dialog
  const FeedbackSubmissionDialog = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity ${openDialog ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          {selectedBooking && (
            <button 
              onClick={() => {
                setOpenDialog(false);
                setOpenBookingDialog(true);
              }}
              className="mr-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowBackIcon />
            </button>
          )}
          <h3 className="text-lg font-semibold text-secondary">
            {selectedBooking ? `Review for ${selectedBooking.services?.[0]?.service?.title}` : 'Submit Feedback'}
          </h3>
          <button
            onClick={() => setOpenDialog(false)}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow">
          <FeedbackForm booking={selectedBooking} />
        </div>
      </div>
    </div>
  );

  // Edit Feedback Modal
  const EditFeedbackModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity ${openEditModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-secondary">
            Edit Your Review
          </h3>
          <button
            onClick={() => setOpenEditModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow">
          <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg">
            You can update your review within 7 days of submission.
          </p>
          <FeedbackForm isEdit />
        </div>
      </div>
    </div>
  );

  // Snackbar Notification
  const SnackbarNotification = () => (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-opacity duration-300 ${snackbar.open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`px-4 py-3 rounded-lg shadow-md flex items-center ${
        snackbar.severity === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 
        'bg-green-100 text-green-800 border border-green-200'
      }`}>
        {snackbar.severity === 'error' ? (
          <ThumbDownIcon className="h-5 w-5 mr-2" />
        ) : (
          <ThumbUpIcon className="h-5 w-5 mr-2" />
        )}
        <span>{snackbar.message}</span>
        <button
          onClick={handleSnackbarClose}
          className="ml-4 text-gray-500 hover:text-gray-700"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Filter feedbacks based on active tab
  const filteredFeedbacks = activeTab === 'editable' 
    ? feedbacks.filter(f => canEditFeedback(f))
    : feedbacks;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-secondary">
            My Reviews
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your service and provider reviews
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-6 inline-flex mx-auto">
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:text-primary'
              }`}
            >
              All Reviews ({feedbacks.length})
            </button>
            <button
              onClick={() => setActiveTab('editable')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'editable'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:text-primary'
              }`}
            >
              Editable ({feedbacks.filter(f => canEditFeedback(f)).length})
            </button>
          </nav>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center my-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        ) : (
          <>
            {filteredFeedbacks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
                  <RateReviewIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-secondary">
                  {activeTab === 'all' ? 'No Reviews Yet' : 'No Editable Reviews'}
                </h3>
                <p className="mt-2 text-gray-600 mb-4">
                  {activeTab === 'all' 
                    ? "You haven't reviewed any of your completed bookings. Share your experience to help others."
                    : "You don't have any reviews that can be edited. Reviews can only be edited within 7 days of submission."
                  }
                </p>
                {activeTab === 'all' && (
                  <button
                    onClick={() => setOpenBookingDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
                  >
                    <EditIcon className="h-4 w-4 mr-1" />
                    Write Your First Review
                  </button>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-secondary mb-4">
                  {activeTab === 'all' ? 'All Reviews' : 'Editable Reviews'} ({filteredFeedbacks.length})
                </h3>
                {filteredFeedbacks.map(feedback => (
                  <FeedbackCard key={feedback._id} feedback={feedback} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Modals */}
        <BookingSelectionDialog />
        <FeedbackSubmissionDialog />
        <EditFeedbackModal />
        <SnackbarNotification />

        {/* Floating action button */}
        <button
          onClick={() => setOpenBookingDialog(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 md:w-auto md:h-auto md:px-4 md:py-3 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-transform hover:scale-105"
        >
          <AddIcon className="h-6 w-6 md:mr-1" />
          <span className="hidden md:inline">Write Review</span>
        </button>
      </div>
    </div>
  );
};

export default FeedbackManagement;