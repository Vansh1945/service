import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { Rating } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton
} from '@mui/material';
import { format } from 'date-fns';

const FeedbackManagement = () => {
  const { token, user, API, showToast, isAuthenticated, logoutUser } = useAuth();
  const navigate = useNavigate();
  const { feedbackId } = useParams();

  // State management
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    providerRating: 5,
    providerComment: '',
    serviceRating: 5,
    serviceComment: ''
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingsForFeedback, setBookingsForFeedback] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openBookingDialog, setOpenBookingDialog] = useState(false);

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
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch single feedback (when viewing/editing)
  const fetchFeedback = async (id) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/feedback/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
        }
        throw new Error('Failed to fetch feedback');
      }

      const data = await response.json();
      setEditingFeedback(data.data);
      
      // Pre-fill form for editing
      setFormData({
        providerRating: data.data.providerFeedback.rating,
        providerComment: data.data.providerFeedback.comment || '',
        serviceRating: data.data.serviceFeedback.rating,
        serviceComment: data.data.serviceFeedback.comment || ''
      });
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings eligible for feedback
  const fetchEligibleBookings = async () => {
    try {
      const response = await fetch(`${API}/booking/my-bookings?status=completed`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch eligible bookings');
      }

      const data = await response.json();
      
      // Filter out bookings that already have feedback
      const existingFeedbackBookingIds = feedbacks.map(f => f.booking._id);
      const eligibleBookings = data.data.filter(
        booking => !existingFeedbackBookingIds.includes(booking._id)
      );
      
      setBookingsForFeedback(eligibleBookings || []);
    } catch (err) {
      console.error('Error fetching eligible bookings:', err);
      setBookingsForFeedback([]);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle rating changes
  const handleRatingChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit new feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    
    if (!selectedBooking) {
      showToast('Please select a booking first', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookingId: selectedBooking._id,
          ...formData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit feedback');
      }

      showToast('Feedback submitted successfully!', 'success');
      setOpenDialog(false);
      setSelectedBooking(null);
      setFormData({
        providerRating: 5,
        providerComment: '',
        serviceRating: 5,
        serviceComment: ''
      });
      fetchFeedbacks();
      fetchEligibleBookings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing feedback
  const handleUpdateFeedback = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API}/feedback/${editingFeedback._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update feedback');
      }

      showToast('Feedback updated successfully!', 'success');
      navigate('/customer/feedbacks');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if feedback can be edited (within 7 days)
  const canEditFeedback = (feedback) => {
    const daysOld = (Date.now() - new Date(feedback.createdAt)) / (1000 * 60 * 60 * 24);
    return daysOld <= 7;
  };

  // Initialize component
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (feedbackId) {
      fetchFeedback(feedbackId);
    } else {
      fetchFeedbacks();
    }
  }, [feedbackId, isAuthenticated]);

  useEffect(() => {
    if (feedbacks.length > 0) {
      fetchEligibleBookings();
    }
  }, [feedbacks]);

  // Handle booking selection
  const handleBookingSelect = (booking) => {
    setSelectedBooking(booking);
    setOpenBookingDialog(false);
    setOpenDialog(true);
  };

  // Render loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Render error state
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // Feedback form component
  const FeedbackForm = ({ isEdit = false }) => (
    <Box component="form" onSubmit={isEdit ? handleUpdateFeedback : handleSubmitFeedback}>
      <Grid container spacing={3}>
        {/* Provider Feedback Section */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom color="primary">
            Rate the Service Provider
          </Typography>
          <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Box mb={2}>
              <Typography component="legend" variant="body2" gutterBottom>
                How would you rate the provider's professionalism and service quality?
              </Typography>
              <Rating
                name="providerRating"
                value={Number(formData.providerRating) || 5}
                precision={0.5}
                onChange={(event, newValue) => handleRatingChange('providerRating', newValue || 5)}
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.3 }} />}
                size="large"
              />
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {formData.providerRating} out of 5 stars
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Tell us about your experience with the provider (optional)"
              name="providerComment"
              value={formData.providerComment}
              onChange={handleInputChange}
              multiline
              rows={3}
              variant="outlined"
              placeholder="Was the provider punctual? Professional? Friendly? Any specific feedback..."
              inputProps={{ maxLength: 500 }}
              helperText={`${formData.providerComment.length}/500 characters`}
            />
          </Paper>
        </Grid>

        {/* Service Feedback Section */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom color="primary">
            Rate the Service
          </Typography>
          <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Box mb={2}>
              <Typography component="legend" variant="body2" gutterBottom>
                How satisfied are you with the overall service provided?
              </Typography>
              <Rating
                name="serviceRating"
                value={Number(formData.serviceRating) || 5}
                precision={0.5}
                onChange={(event, newValue) => handleRatingChange('serviceRating', newValue || 5)}
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.3 }} />}
                size="large"
              />
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {formData.serviceRating} out of 5 stars
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Share your thoughts about the service (optional)"
              name="serviceComment"
              value={formData.serviceComment}
              onChange={handleInputChange}
              multiline
              rows={3}
              variant="outlined"
              placeholder="Quality of work, value for money, would you recommend this service..."
              inputProps={{ maxLength: 500 }}
              helperText={`${formData.serviceComment.length}/500 characters`}
            />
          </Paper>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => isEdit ? navigate('/customer/feedbacks') : setOpenDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
            >
              {isSubmitting ? 'Submitting...' : isEdit ? 'Update Feedback' : 'Submit Feedback'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  // Feedback card component
  const FeedbackCard = ({ feedback }) => (
    <Card sx={{ mb: 3, boxShadow: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {feedback.serviceFeedback?.service?.title || 'Service'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Booking Date: {format(new Date(feedback.booking?.date || feedback.createdAt), 'MMM dd, yyyy')}
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Chip
              label={format(new Date(feedback.createdAt), 'MMM dd, yyyy')}
              size="small"
              variant="outlined"
            />
            {canEditFeedback(feedback) && (
              <Chip
                label="Editable"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          {/* Provider Rating */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Provider Rating
            </Typography>
            <Box display="flex" alignItems="center" mb={1}>
              <Rating
                value={feedback.providerFeedback?.rating || 0}
                precision={0.5}
                readOnly
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.3 }} />}
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                ({feedback.providerFeedback?.rating?.toFixed(1) || 'N/A'})
              </Typography>
            </Box>
            {feedback.providerFeedback?.comment && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1, 
                  fontStyle: 'italic', 
                  backgroundColor: 'grey.100', 
                  p: 1, 
                  borderRadius: 1 
                }}
              >
                "{feedback.providerFeedback.comment}"
              </Typography>
            )}
            {feedback.providerFeedback?.isEdited && (
              <Chip label="Edited" size="small" color="info" sx={{ mt: 1 }} />
            )}
          </Grid>

          {/* Service Rating */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Service Rating
            </Typography>
            <Box display="flex" alignItems="center" mb={1}>
              <Rating
                value={feedback.serviceFeedback?.rating || 0}
                precision={0.5}
                readOnly
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.3 }} />}
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                ({feedback.serviceFeedback?.rating?.toFixed(1) || 'N/A'})
              </Typography>
            </Box>
            {feedback.serviceFeedback?.comment && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1, 
                  fontStyle: 'italic', 
                  backgroundColor: 'grey.100', 
                  p: 1, 
                  borderRadius: 1 
                }}
              >
                "{feedback.serviceFeedback.comment}"
              </Typography>
            )}
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              {feedback.serviceFeedback?.isEdited && (
                <Chip label="Edited" size="small" color="info" />
              )}
              {feedback.serviceFeedback?.isApproved === false && (
                <Chip label="Pending Approval" color="warning" size="small" />
              )}
              {feedback.serviceFeedback?.isApproved && (
                <Chip label="Approved" color="success" size="small" />
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/customer/feedbacks/${feedback._id}`)}
          >
            View Details
          </Button>
          {canEditFeedback(feedback) && (
            <Button
              size="small"
              variant="contained"
              onClick={() => navigate(`/customer/feedbacks/${feedback._id}`)}
            >
              Edit Feedback
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  // Booking selection dialog
  const BookingSelectionDialog = () => (
    <Dialog 
      open={openBookingDialog} 
      onClose={() => setOpenBookingDialog(false)} 
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>Select a Booking to Review</DialogTitle>
      <DialogContent>
        {bookingsForFeedback.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              No Bookings Available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You don't have any completed bookings that need feedback, or you've already provided feedback for all your bookings.
            </Typography>
          </Box>
        ) : (
          <List>
            {bookingsForFeedback.map(booking => (
              <ListItemButton 
                key={booking._id}
                onClick={() => handleBookingSelect(booking)}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    borderColor: 'primary.main'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar>
                    {booking.service?.title?.charAt(0) || 'S'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={booking.service?.title || 'Service'}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        Date: {format(new Date(booking.date), 'MMM dd, yyyy')}
                      </Typography>
                      <Typography variant="body2">
                        Provider: {booking.provider?.name || 'Unknown'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenBookingDialog(false)}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );

  // Feedback submission dialog
  const FeedbackSubmissionDialog = () => (
    <Dialog 
      open={openDialog} 
      onClose={() => setOpenDialog(false)} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">Submit Your Feedback</Typography>
        {selectedBooking && (
          <Typography variant="body2" color="text.secondary">
            For: {selectedBooking.service?.title} - {format(new Date(selectedBooking.date), 'MMM dd, yyyy')}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <FeedbackForm />
      </DialogContent>
    </Dialog>
  );

  // Render based on route
  if (feedbackId && editingFeedback) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box mb={4}>
          <Typography variant="h4" gutterBottom>
            Edit Your Feedback
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can update your feedback within 7 days of submission. After editing, service feedback will need admin re-approval.
          </Typography>
        </Box>
        
        <Paper sx={{ p: 3 }}>
          <FeedbackForm isEdit />
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            My Feedbacks
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your service and provider reviews
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={() => setOpenBookingDialog(true)}
          size="large"
        >
          Add New Feedback
        </Button>
      </Box>

      {feedbacks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No Feedbacks Yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You haven't submitted any feedbacks for your completed bookings. Share your experience to help other customers and improve our services.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => setOpenBookingDialog(true)}
            size="large"
          >
            Submit Your First Feedback
          </Button>
        </Paper>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom>
            Your Reviews ({feedbacks.length})
          </Typography>
          {feedbacks.map(feedback => (
            <FeedbackCard key={feedback._id} feedback={feedback} />
          ))}
        </Box>
      )}

      <BookingSelectionDialog />
      <FeedbackSubmissionDialog />
    </Container>
  );
};

export default FeedbackManagement;