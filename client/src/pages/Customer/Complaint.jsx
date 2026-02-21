import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Plus,
  Eye,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  X,
  Upload,
  RefreshCw,
  Loader2
} from 'lucide-react';

// Complaint categories and priorities from backend
const COMPLAINT_CATEGORIES = [
  "Service issue",
  "Payment issue",
  "Delivery issue",
  "Suggestion",
  "Other"
];

// Priority removed as per requirements

const ComplaintsPage = () => {
  const { token, user, logoutUser, isAuthenticated, API, API_URL_IMAGE } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openNewComplaint, setOpenNewComplaint] = useState(false);
  const [openComplaintDetail, setOpenComplaintDetail] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [formData, setFormData] = useState({
    bookingId: '',
    title: '',
    description: '',
    category: '',
    images: [],
    previewImages: []
  });
  const [formErrors, setFormErrors] = useState({
    bookingId: '',
    title: '',
    description: '',
    category: ''
  });
  const [reopenReason, setReopenReason] = useState('');

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/booking/customer`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setBookings(response.data.bookings || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      toast.error('Failed to load bookings');
    }
  };

  // Fetch complaints
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/complaint/my-complaints`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const complaintsWithFullUrls = response.data.data.map(complaint => ({
        ...complaint,
        images: complaint.images ? complaint.images.map(img => typeof img === 'string' ? `${API_URL_IMAGE}/${img.replace(/\\/g, '/')}` : img.secure_url) : []
      }));
      setComplaints(complaintsWithFullUrls);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
      setError(err.response?.data?.message || 'Failed to fetch complaints');
      setLoading(false);
      if (err.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        logoutUser();
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookings();
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
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const validFiles = [];
      const validPreviews = [];

      files.forEach(file => {
        if (!file.type.match('image.*')) {
          toast.error('Please upload only image files');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Each image size should be less than 5MB');
          return;
        }
        validFiles.push(file);
        validPreviews.push(URL.createObjectURL(file));
      });

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...validFiles],
        previewImages: [...prev.previewImages, ...validPreviews]
      }));
    }
  };

  // Remove selected image
  const removeImage = (index) => {
    if (formData.previewImages[index]) {
      URL.revokeObjectURL(formData.previewImages[index]);
    }
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previewImages: prev.previewImages.filter((_, i) => i !== index)
    }));
  };

  // Validate form
  const validateForm = () => {
    let valid = true;
    const newErrors = {
      bookingId: '',
      title: '',
      description: '',
      category: ''
    };

    // Booking ID is mandatory for service-related complaints
    if (formData.category === 'Service issue' && !formData.bookingId.trim()) {
      newErrors.bookingId = 'Booking ID is required for service-related complaints';
      valid = false;
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
      valid = false;
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
      valid = false;
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
      valid = false;
    } else if (formData.description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
      valid = false;
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
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
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
      if (formData.images && formData.images.length > 0) {
        formData.images.forEach((image, index) => {
          formDataToSend.append('images', image);
        });
      }

      await axios.post(`${API}/complaint`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Complaint submitted successfully!');
      setOpenNewComplaint(false);
      resetForm();
      fetchComplaints();
    } catch (err) {
      console.error('Failed to submit complaint:', err);
      toast.error(err.response?.data?.message || 'Failed to submit complaint');
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
      const complaintWithFullUrls = {
        ...response.data.data,
        images: response.data.data.images ? response.data.data.images.map(img => typeof img === 'string' ? `${API_URL_IMAGE}/${img.replace(/\\/g, '/')}` : img.secure_url) : []
      };
      setSelectedComplaint(complaintWithFullUrls);
      setOpenComplaintDetail(true);
    } catch (err) {
      console.error('Failed to fetch complaint details:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch complaint details');
    }
  };

  // Reopen complaint
  const reopenComplaint = async () => {
    if (!reopenReason.trim()) {
      toast.error('Please provide a reason for reopening');
      return;
    }

    try {
      await axios.put(
        `${API}/complaint/${selectedComplaint._id}/reopen`,
        { reason: reopenReason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      toast.success('Complaint reopened successfully!');
      setOpenComplaintDetail(false);
      setReopenReason('');
      fetchComplaints();
    } catch (err) {
      console.error('Failed to reopen complaint:', err);
      toast.error(err.response?.data?.message || 'Failed to reopen complaint');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      bookingId: '',
      title: '',
      description: '',
      category: '',
      images: [],
      previewImages: []
    });
    setFormErrors({
      bookingId: '',
      title: '',
      description: '',
      category: ''
    });
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
      case 'Open': return 'bg-yellow-100 text-yellow-800';
      case 'In-Progress': return 'bg-blue-100 text-blue-800';
      case 'Solved': return 'bg-green-100 text-green-800';
      case 'Reopened': return 'bg-orange-100 text-orange-800';
      case 'Closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-inter">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-poppins font-bold text-secondary mb-2">Help & Support Center</h1>
              <p className="text-gray-600 font-inter text-lg">Get help with your bookings, report issues, or contact our support team</p>
            </div>
            <button
              onClick={() => setOpenNewComplaint(true)}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-poppins font-semibold shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="h-5 w-5" />
              Raise Complaint
            </button>
          </div>
        </div>

        {/* Support Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center mb-4">
              <div className="bg-primary/10 p-3 rounded-xl mr-4 group-hover:bg-primary/20 transition-colors duration-200">
                <HelpCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-poppins font-semibold text-secondary">FAQ & Policies</h3>
            </div>
            <p className="text-gray-600 mb-4 font-inter">Find answers to common questions about refunds, cancellations, and safety policies.</p>
            <button className="text-primary hover:text-primary/80 font-poppins font-medium transition-colors duration-200">View FAQs →</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center mb-4">
              <div className="bg-accent/10 p-3 rounded-xl mr-4 group-hover:bg-accent/20 transition-colors duration-200">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-poppins font-semibold text-secondary">Raise Complaint</h3>
            </div>
            <p className="text-gray-600 mb-4 font-inter">Report fraud, bad service, or any issues with your booking.</p>
            <button
              onClick={() => setOpenNewComplaint(true)}
              className="text-accent hover:text-accent/80 font-poppins font-medium transition-colors duration-200"
            >
              Submit Complaint →
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center mb-4">
              <div className="bg-green-100 p-3 rounded-xl mr-4 group-hover:bg-green-200 transition-colors duration-200">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-poppins font-semibold text-secondary">Live Support</h3>
            </div>
            <p className="text-gray-600 mb-4 font-inter">Need immediate help? Chat or call our support team 24/7.</p>
            <div className="flex space-x-4">
              <button className="text-green-600 hover:text-green-700 font-poppins font-medium transition-colors duration-200">Chat Now</button>
              <button className="text-green-600 hover:text-green-700 font-poppins font-medium transition-colors duration-200">Call Support</button>
            </div>
          </div>
        </div>

        {/* Complaints List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-poppins font-bold text-secondary">My Complaint Tickets</h2>
                <p className="text-gray-600 font-inter mt-1">Track and manage all your submitted complaints</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MessageSquare className="h-4 w-4" />
                <span>{complaints.length} total complaints</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col justify-center items-center py-16">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-gray-600 font-inter">Loading your complaints...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-poppins font-semibold text-secondary mb-2">Error Loading Complaints</h3>
              <p className="text-red-600 font-inter">{error}</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-gray-50 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-secondary mb-2">No complaints found</h3>
              <p className="text-gray-600 font-inter mb-8">You haven't submitted any complaints yet. Start by raising your first complaint.</p>
              <button
                onClick={() => setOpenNewComplaint(true)}
                className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-poppins font-semibold shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Submit Your First Complaint
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {complaints.map((complaint) => (
                <div key={complaint._id} className="p-8 hover:bg-gray-50/50 transition-all duration-200 group">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors duration-200">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                            <h3 className="text-lg font-poppins font-semibold text-secondary">
                              Complaint #{complaint._id.substring(0, 8)}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-poppins font-medium self-start ${getStatusColor(complaint.status)}`}>
                              {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 font-inter mb-3">
                            Booking: {complaint.booking?.bookingId || complaint.booking || 'N/A'}
                          </p>
                          <p className="text-gray-700 font-inter leading-relaxed">
                            {complaint.description && complaint.description.length > 120
                              ? `${complaint.description.substring(0, 120)}...`
                              : complaint.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-4 lg:items-end">
                      <div className="flex items-center gap-2 text-sm text-gray-500 font-inter">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(complaint.createdAt)}</span>
                      </div>
                      <button
                        onClick={() => viewComplaintDetails(complaint._id)}
                        className="inline-flex items-center px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-poppins font-medium transition-all duration-200 group-hover:shadow-sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Complaint Modal */}
        {openNewComplaint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-secondary">Submit New Complaint</h3>
                <button
                  onClick={() => {
                    setOpenNewComplaint(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6">
                {formData.category === 'Service issue' && (
                  <div className="mb-6">
                    <label htmlFor="bookingId" className="block text-sm font-medium text-secondary mb-1">
                      Select Booking <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="bookingId"
                      name="bookingId"
                      value={formData.bookingId}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border ${formErrors.bookingId ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary`}
                    >
                      <option value="">Select a booking</option>
                      {bookings.map((booking) => (
                        <option key={booking._id} value={booking._id}>
                          {booking.bookingId} - {booking.serviceName} - {formatDate(booking.date)}
                        </option>
                      ))}
                    </select>
                    {formErrors.bookingId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.bookingId}</p>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <label htmlFor="title" className="block text-sm font-medium text-secondary mb-1">
                    Complaint Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.title ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary`}
                    placeholder="Brief title for your complaint (minimum 5 characters)"
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                  )}
                  {!formErrors.title && (
                    <p className="mt-1 text-sm text-gray-500">Minimum 5 characters required</p>
                  )}
                </div>

                <div className="mb-6">
                  <label htmlFor="category" className="block text-sm font-medium text-secondary mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.category ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary`}
                  >
                    <option value="">Select a category</option>
                    {COMPLAINT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {formErrors.category && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.category}</p>
                  )}
                </div>



                <div className="mb-6">
                  <label htmlFor="description" className="block text-sm font-medium text-secondary mb-1">
                    Complaint Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows="4"
                    value={formData.description}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.description ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary`}
                    placeholder="Describe your complaint in detail (minimum 20 characters)"
                  ></textarea>
                  {formErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                  )}
                  {!formErrors.description && (
                    <p className="mt-1 text-sm text-gray-500">Minimum 20 characters required</p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Image Proof (Optional)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary"
                        >
                          <span>Upload files</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            multiple
                            className="sr-only"
                            onChange={handleImageUpload}
                            accept="image/*"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each</p>
                    </div>
                  </div>
                  {formData.previewImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {formData.previewImages.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-md"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50/80 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setOpenNewComplaint(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={submitComplaint}
                  disabled={(formData.category === 'Service issue' && !formData.bookingId.trim()) || !formData.title.trim() || !formData.description.trim() || !formData.category}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${(formData.category === 'Service issue' && !formData.bookingId.trim()) || !formData.title.trim() || !formData.description.trim() || !formData.category ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
                >
                  Submit Complaint
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complaint Detail Modal */}
        {openComplaintDetail && selectedComplaint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl max-w-3xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-secondary">Complaint Details</h3>
                <button
                  onClick={() => setOpenComplaintDetail(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-md font-medium text-secondary mb-3">Complaint Information</h4>
                    <div className="space-y-2">
                      <p className="text-sm"><span className="font-medium">ID:</span> {selectedComplaint._id}</p>
                      <p className="text-sm flex items-center">
                        <span className="font-medium">Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(selectedComplaint.status)}`}>
                          {selectedComplaint.status.charAt(0).toUpperCase() + selectedComplaint.status.slice(1)}
                        </span>
                      </p>
                      <p className="text-sm"><span className="font-medium">Submitted:</span> {formatDate(selectedComplaint.createdAt)}</p>
                      {selectedComplaint.resolvedAt && (
                        <p className="text-sm"><span className="font-medium">Resolved:</span> {formatDate(selectedComplaint.resolvedAt)}</p>
                      )}
                      {selectedComplaint.category === 'Service issue' && (
                        <p className="text-sm"><span className="font-medium">Booking ID:</span> {selectedComplaint.booking?.bookingId || selectedComplaint.booking || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  {selectedComplaint.category === 'Service issue' && (
                    <div>
                      <h4 className="text-md font-medium text-secondary mb-3">Provider Information</h4>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Name:</span> {selectedComplaint.provider?.name || 'N/A'}</p>
                        <p className="text-sm"><span className="font-medium">Contact:</span> {selectedComplaint.provider?.phone || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <h4 className="text-md font-medium text-secondary mb-3">Complaint Message</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-gray-700">{selectedComplaint.description || 'No description provided'}</p>
                  </div>
                </div>

                {selectedComplaint.images && selectedComplaint.images.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-secondary mb-3">Image Proof</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedComplaint.images.map((imageUrl, index) => (
                        <div key={index} className="flex justify-center">
                          <img
                            src={imageUrl}
                            alt={`Complaint proof ${index + 1}`}
                            className="max-w-full h-auto max-h-64 rounded-md object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/placeholder-image.jpg';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedComplaint.responseByAdmin && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-secondary mb-3">Admin Response</h4>
                    <div className="bg-blue-50 p-4 rounded-md">
                      <p className="text-gray-700">{selectedComplaint.responseByAdmin}</p>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h4 className="text-md font-medium text-secondary mb-3">Timeline</h4>
                  <div className="space-y-3">
                    {selectedComplaint.statusHistory && selectedComplaint.statusHistory.map((history, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(history.status)}`}></div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-secondary">
                            Status changed to {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(history.updatedAt)}</p>
                          {history.status === 'Solved' && selectedComplaint.resolutionNotes && (
                            <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                              <p className="text-sm text-gray-700">
                                <strong>Resolution Notes:</strong> {selectedComplaint.resolutionNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedComplaint.status === 'Solved' && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-secondary mb-3">Reopen Complaint</h4>
                    <textarea
                      rows="3"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Please explain why you're reopening this complaint"
                    ></textarea>
                    <p className="mt-1 text-sm text-gray-500">Your complaint will be reopened for review</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50/80 px-6 py-4 flex flex-col md:flex-row md:justify-between space-y-3 md:space-y-0">
                {selectedComplaint.status === 'Solved' && (
                  <button
                    onClick={reopenComplaint}
                    disabled={!reopenReason.trim()}
                    className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${!reopenReason.trim() ? 'bg-yellow-300 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500`}
                  >
                    Reopen Complaint
                  </button>
                )}
                <button
                  onClick={() => setOpenComplaintDetail(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintsPage;