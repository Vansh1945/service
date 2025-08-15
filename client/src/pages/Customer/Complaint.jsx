import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
  Avatar,
  Badge
} from '@mui/material';
import {
  Add,
  Close,
  Image as ImageIcon,
  Visibility,
  Replay,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -3,
    top: 13,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: '0 4px',
  },
}));

const ComplaintsPage = () => {
  const { token, user, logoutUser, isAuthenticated, showToast, API, API_URL_IMAGE } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openNewComplaint, setOpenNewComplaint] = useState(false);
  const [openComplaintDetail, setOpenComplaintDetail] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [formData, setFormData] = useState({
    bookingId: '',
    message: '',
    imageProof: null,
    previewImage: null
  });
  const [formErrors, setFormErrors] = useState({
    bookingId: '',
    message: ''
  });
  const [reopenReason, setReopenReason] = useState('');

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch complaints
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/complaint/my-complaints`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // Add full image URL to each complaint
      const complaintsWithFullUrls = response.data.complaints.map(complaint => ({
        ...complaint,
        imageUrl: complaint.imageProof 
          ? `${API_URL_IMAGE}/${complaint.imageProof.replace(/\\/g, '/')}`
          : null
      }));
      setComplaints(complaintsWithFullUrls);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
      setError(err.response?.data?.message || 'Failed to fetch complaints');
      setLoading(false);
      if (err.response?.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        logoutUser();
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchComplaints();
    }
  }, [isAuthenticated]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate image type and size
      if (!file.type.match('image.*')) {
        setSnackbar({
          open: true,
          message: 'Please upload an image file',
          severity: 'error'
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setSnackbar({
          open: true,
          message: 'Image size should be less than 5MB',
          severity: 'error'
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        imageProof: file,
        previewImage: URL.createObjectURL(file)
      }));
    }
  };

  // Remove selected image
  const removeImage = () => {
    if (formData.previewImage) {
      URL.revokeObjectURL(formData.previewImage);
    }
    setFormData(prev => ({
      ...prev,
      imageProof: null,
      previewImage: null
    }));
  };

  // Validate form
  const validateForm = () => {
    let valid = true;
    const newErrors = {
      bookingId: '',
      message: ''
    };

    if (!formData.bookingId.trim()) {
      newErrors.bookingId = 'Booking ID is required';
      valid = false;
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Complaint message is required';
      valid = false;
    } else if (formData.message.trim().length < 20) {
      newErrors.message = 'Message must be at least 20 characters';
      valid = false;
    }

    setFormErrors(newErrors);
    return valid;
  };

  // Submit new complaint
  const submitComplaint = async () => {
    if (!validateForm()) return;

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('bookingId', formData.bookingId);
      formDataToSend.append('message', formData.message);
      if (formData.imageProof) {
        formDataToSend.append('imageProof', formData.imageProof);
      }

      const response = await axios.post(`${API}/complaint`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSnackbar({
        open: true,
        message: 'Complaint submitted successfully!',
        severity: 'success'
      });
      setOpenNewComplaint(false);
      resetForm();
      fetchComplaints();
    } catch (err) {
      console.error('Failed to submit complaint:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to submit complaint',
        severity: 'error'
      });
      if (err.response?.status === 401) {
        logoutUser();
      }
    }
  };

  // View complaint details
  const viewComplaintDetails = async (complaintId) => {
    try {
      const response = await axios.get(`${API}/complaint/${complaintId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // Add full image URL to the complaint
      const complaintWithFullUrl = {
        ...response.data.complaint,
        imageUrl: response.data.complaint.imageProof 
          ? `${API_URL_IMAGE}/${response.data.complaint.imageProof.replace(/\\/g, '/')}`
          : null
      };
      setSelectedComplaint(complaintWithFullUrl);
      setOpenComplaintDetail(true);
    } catch (err) {
      console.error('Failed to fetch complaint details:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to fetch complaint details',
        severity: 'error'
      });
    }
  };

  // Reopen complaint
  const reopenComplaint = async () => {
    if (!reopenReason.trim()) {
      setSnackbar({
        open: true,
        message: 'Please provide a reason for reopening',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await axios.put(
        `${API}/complaint/${selectedComplaint._id}/reopen`,
        { reason: reopenReason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setSnackbar({
        open: true,
        message: 'Complaint reopened successfully!',
        severity: 'success'
      });
      setOpenComplaintDetail(false);
      setReopenReason('');
      fetchComplaints();
    } catch (err) {
      console.error('Failed to reopen complaint:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to reopen complaint',
        severity: 'error'
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      bookingId: '',
      message: '',
      imageProof: null,
      previewImage: null
    });
    setFormErrors({
      bookingId: '',
      message: ''
    });
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'warning';
      case 'resolved': return 'success';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          My Complaints
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => setOpenNewComplaint(true)}
        >
          New Complaint
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Typography color="error">{error}</Typography>
        </Box>
      ) : complaints.length === 0 ? (
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No Complaints Found
          </Typography>
          <Typography color="textSecondary" mb={3}>
            You haven't submitted any complaints yet.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => setOpenNewComplaint(true)}
          >
            Submit Your First Complaint
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {complaints.map((complaint) => (
            <Grid item xs={12} sm={6} md={4} key={complaint._id}>
              <Card elevation={3}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" component="div">
                      Complaint #{complaint._id.substring(0, 8)}
                    </Typography>
                    <Chip
                      label={complaint.status.toUpperCase()}
                      color={getStatusColor(complaint.status)}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {formatDate(complaint.createdAt)}
                  </Typography>
                  <Typography variant="body1" gutterBottom sx={{ mt: 1 }}>
                    {complaint.message.length > 100
                      ? `${complaint.message.substring(0, 100)}...`
                      : complaint.message}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Booking: {complaint.booking}
                  </Typography>
                  {complaint.imageUrl && (
                    <Box sx={{ mt: 2 }}>
                      <StyledBadge badgeContent="Image" color="primary">
                        <ImageIcon color="action" />
                      </StyledBadge>
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => viewComplaintDetails(complaint._id)}
                  >
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* New Complaint Dialog */}
      <Dialog
        open={openNewComplaint}
        onClose={() => {
          setOpenNewComplaint(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Submit New Complaint
          <IconButton
            aria-label="close"
            onClick={() => {
              setOpenNewComplaint(false);
              resetForm();
            }}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Booking ID"
                name="bookingId"
                value={formData.bookingId}
                onChange={handleInputChange}
                error={!!formErrors.bookingId}
                helperText={formErrors.bookingId}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Complaint Details"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                error={!!formErrors.message}
                helperText={formErrors.message || 'Minimum 20 characters'}
                required
                multiline
                rows={4}
              />
            </Grid>
            <Grid item xs={12}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="complaint-image-upload"
                type="file"
                onChange={handleImageUpload}
              />
              <label htmlFor="complaint-image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImageIcon />}
                >
                  Upload Image Proof
                </Button>
              </label>
              {formData.previewImage && (
                <Box sx={{ mt: 2, position: 'relative', display: 'inline-block' }}>
                  <img
                    src={formData.previewImage}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '200px' }}
                  />
                  <IconButton
                    size="small"
                    onClick={removeImage}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      },
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenNewComplaint(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={submitComplaint}
            variant="contained"
            color="primary"
            disabled={!formData.bookingId || !formData.message}
          >
            Submit Complaint
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complaint Detail Dialog */}
      <Dialog
        open={openComplaintDetail}
        onClose={() => setOpenComplaintDetail(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedComplaint && (
          <>
            <DialogTitle>
              Complaint Details
              <IconButton
                aria-label="close"
                onClick={() => setOpenComplaintDetail(false)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  color: (theme) => theme.palette.grey[500],
                }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Complaint Information
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>ID:</strong> {selectedComplaint._id}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Status:</strong>{' '}
                    <Chip
                      label={selectedComplaint.status.toUpperCase()}
                      color={getStatusColor(selectedComplaint.status)}
                      size="small"
                    />
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Submitted:</strong> {formatDate(selectedComplaint.createdAt)}
                  </Typography>
                  {selectedComplaint.resolvedAt && (
                    <Typography variant="body1" gutterBottom>
                      <strong>Resolved:</strong> {formatDate(selectedComplaint.resolvedAt)}
                    </Typography>
                  )}
                  <Typography variant="body1" gutterBottom>
                    <strong>Booking ID:</strong> {selectedComplaint.booking}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Provider Information
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Name:</strong> {selectedComplaint.provider?.name || 'N/A'}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Contact:</strong> {selectedComplaint.provider?.phone || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    Complaint Message
                  </Typography>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body1">
                      {selectedComplaint.message}
                    </Typography>
                  </Paper>
                </Grid>
                {selectedComplaint.imageUrl && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Image Proof
                    </Typography>
                    <Box sx={{ maxWidth: '100%', overflow: 'hidden', textAlign: 'center' }}>
                      <img
                        src={selectedComplaint.imageUrl}
                        alt="Complaint proof"
                        style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '0 auto' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/placeholder-image.jpg';
                        }}
                      />
                    </Box>
                  </Grid>
                )}
                {selectedComplaint.responseByAdmin && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Admin Response
                    </Typography>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="body1">
                        {selectedComplaint.responseByAdmin}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {selectedComplaint.status === 'resolved' && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Reopen Complaint
                    </Typography>
                    <TextField
                      fullWidth
                      label="Reason for reopening"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      multiline
                      rows={3}
                      helperText="Please explain why you're reopening this complaint"
                    />
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              {selectedComplaint.status === 'resolved' && (
                <Button
                  onClick={reopenComplaint}
                  variant="outlined"
                  color="warning"
                  startIcon={<Replay />}
                  disabled={!reopenReason.trim()}
                >
                  Reopen Complaint
                </Button>
              )}
              <Button
                onClick={() => setOpenComplaintDetail(false)}
                variant="contained"
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          iconMapping={{
            success: <CheckCircle fontSize="inherit" />,
            error: <ErrorIcon fontSize="inherit" />,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ComplaintsPage;
