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
  DialogActions
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
      setFeedbacks(data.data);
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
      const response = await fetch(`${API}/booking/{bookingId}/status?completed`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch eligible bookings');
      }

      const data = await response.json();
      setBookingsForFeedback(data.data);
    } catch (err) {
      showToast(err.message, 'error');
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

      const data = await response.json();
      showToast('Feedback submitted successfully!');
      setOpenDialog(false);
      fetchFeedbacks();
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

      const data = await response.json();
      showToast('Feedback updated successfully!');
      navigate('/customer/feedbacks');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
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
      fetchEligibleBookings();
    }
  }, [feedbackId, isAuthenticated]);

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
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Provider Feedback
          </Typography>
          <Box mb={2}>
            <Typography component="legend">Rating</Typography>
            <Rating
              name="providerRating"
              value={Number(formData.providerRating)}
              precision={0.5}
              onChange={(event, newValue) => handleRatingChange('providerRating', newValue)}
              icon={<StarIcon fontSize="inherit" />}
              emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.55 }} />}
            />
          </Box>
          <TextField
            fullWidth
            label="Comments about the provider (optional)"
            name="providerComment"
            value={formData.providerComment}
            onChange={handleInputChange}
            multiline
            rows={3}
            variant="outlined"
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Service Feedback
          </Typography>
          <Box mb={2}>
            <Typography component="legend">Rating</Typography>
            <Rating
              name="serviceRating"
              value={Number(formData.serviceRating)}
              precision={0.5}
              onChange={(event, newValue) => handleRatingChange('serviceRating', newValue)}
              icon={<StarIcon fontSize="inherit" />}
              emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.55 }} />}
            />
          </Box>
          <TextField
            fullWidth
            label="Comments about the service (optional)"
            name="serviceComment"
            value={formData.serviceComment}
            onChange={handleInputChange}
            multiline
            rows={3}
            variant="outlined"
          />
        </Grid>

        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSubmitting}
            sx={{ mr: 2 }}
          >
            {isSubmitting ? <CircularProgress size={24} /> : isEdit ? 'Update Feedback' : 'Submit Feedback'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => isEdit ? navigate('/customer/feedbacks') : setOpenDialog(false)}
          >
            Cancel
          </Button>
        </Grid>
      </Grid>
    </Box>
  );

  // Feedback card component
  const FeedbackCard = ({ feedback }) => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="h6">
            {feedback.serviceFeedback.service?.title || 'Service'}
          </Typography>
          <Chip
            label={format(new Date(feedback.createdAt), 'MMM dd, yyyy')}
            size="small"
            variant="outlined"
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2">Provider Rating</Typography>
            <Box display="flex" alignItems="center">
              <Rating
                value={feedback.providerFeedback.rating}
                precision={0.5}
                readOnly
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.55 }} />}
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                {feedback.providerFeedback.rating.toFixed(1)}
              </Typography>
            </Box>
            {feedback.providerFeedback.comment && (
              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                "{feedback.providerFeedback.comment}"
              </Typography>
            )}
            {feedback.providerFeedback.isEdited && (
              <Chip label="Edited" size="small" sx={{ mt: 1 }} />
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2">Service Rating</Typography>
            <Box display="flex" alignItems="center">
              <Rating
                value={feedback.serviceFeedback.rating}
                precision={0.5}
                readOnly
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.55 }} />}
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                {feedback.serviceFeedback.rating.toFixed(1)}
              </Typography>
            </Box>
            {feedback.serviceFeedback.comment && (
              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                "{feedback.serviceFeedback.comment}"
              </Typography>
            )}
            {feedback.serviceFeedback.isEdited && (
              <Chip label="Edited" size="small" sx={{ mt: 1 }} />
            )}
            {!feedback.serviceFeedback.isApproved && (
              <Chip label="Pending Approval" color="warning" size="small" sx={{ mt: 1 }} />
            )}
          </Grid>
        </Grid>

        <Box mt={2} display="flex" justifyContent="flex-end">
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/customer/feedbacks/${feedback._id}`)}
          >
            View Details
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  // Booking selection dialog
  const BookingSelectionDialog = () => (
    <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Select Booking to Provide Feedback</DialogTitle>
      <DialogContent>
        {bookingsForFeedback.length === 0 ? (
          <Typography>No completed bookings available for feedback</Typography>
        ) : (
          <Paper sx={{ p: 2 }}>
            {bookingsForFeedback.map(booking => (
              <Box 
                key={booking._id} 
                sx={{ 
                  p: 2, 
                  mb: 1, 
                  border: '1px solid', 
                  borderColor: selectedBooking?._id === booking._id ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
                onClick={() => setSelectedBooking(booking)}
              >
                <Typography variant="subtitle1">
                  {booking.services[0]?.service?.title || 'Service'}
                </Typography>
                <Typography variant="body2">
                  {format(new Date(booking.date), 'MMM dd, yyyy')} at {booking.time}
                </Typography>
              </Box>
            ))}
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={() => setOpenDialog(false)} 
          disabled={!selectedBooking}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Render based on route
  if (feedbackId && editingFeedback) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box mb={4}>
          <Typography variant="h4" gutterBottom>
            Edit Feedback
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can update your feedback for this service
          </Typography>
        </Box>
        
        <FeedbackForm isEdit />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">My Feedbacks</Typography>
        <Button 
          variant="contained" 
          onClick={() => {
            setSelectedBooking(null);
            setOpenDialog(true);
          }}
          disabled={bookingsForFeedback.length === 0}
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
            You haven't submitted any feedbacks for your completed bookings.
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => setOpenDialog(true)}
            disabled={bookingsForFeedback.length === 0}
          >
            Submit Your First Feedback
          </Button>
        </Paper>
      ) : (
        <>
          {feedbacks.map(feedback => (
            <FeedbackCard key={feedback._id} feedback={feedback} />
          ))}
        </>
      )}

      <BookingSelectionDialog />

      {openDialog && selectedBooking && (
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogContent>
            <Box mb={3}>
              <Typography variant="subtitle1">
                Booking: {selectedBooking.services[0]?.service?.title || 'Service'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(new Date(selectedBooking.date), 'MMM dd, yyyy')} at {selectedBooking.time}
              </Typography>
            </Box>
            <FeedbackForm />
          </DialogContent>
        </Dialog>
      )}
    </Container>
  );
};

export default FeedbackManagement;