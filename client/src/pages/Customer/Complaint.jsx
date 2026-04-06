import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  HelpCircle, MessageSquare, Phone, Plus, Eye, Calendar,
  Clock, AlertCircle, CheckCircle, X, Upload, Loader2,
  ChevronRight, FileText, ShieldCheck, Headphones, ArrowLeft, Tag
} from 'lucide-react';
import { getCustomerBookings } from '../../services/BookingService';
import { getComplaint, getCustomerComplaints } from '../../services/ComplaintService';

const COMPLAINT_CATEGORIES = ["Service issue", "Payment issue", "Delivery issue", "Suggestion", "Other"];

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
    bookingId: '', title: '', description: '', category: '', images: [], previewImages: []
  });
  const [formErrors, setFormErrors] = useState({ bookingId: '', title: '', description: '', category: '' });
  const [reopenReason, setReopenReason] = useState('');

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const fetchBookings = async () => {
    try {
      const response = await getCustomerBookings();
      const responseData = response.data;
      if (responseData.success && Array.isArray(responseData.data)) {
        setBookings(responseData.data);
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
      toast.error('Failed to load bookings');
    }
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await getCustomerComplaints();
      const responseData = response.data;
      if (responseData.success && Array.isArray(responseData.data)) {
        const complaintsWithFullUrls = responseData.data.map(complaint => ({
          ...complaint,
          images: complaint.images ? complaint.images.map(img => typeof img === 'string' ? `${API_URL_IMAGE}/${img.replace(/\\/g, '/')}` : (img.secure_url || img)) : []
        }));
        setComplaints(complaintsWithFullUrls);
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch complaints error:', err);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [], validPreviews = [];
    files.forEach(file => {
      if (!file.type.match('image.*')) { toast.error('Images only'); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB per image'); return; }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles],
      previewImages: [...prev.previewImages, ...validPreviews]
    }));
  };

  const removeImage = (index) => {
    if (formData.previewImages[index]) URL.revokeObjectURL(formData.previewImages[index]);
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previewImages: prev.previewImages.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    let valid = true;
    const newErrors = { bookingId: '', title: '', description: '', category: '' };
    if (formData.category === 'Service issue' && !formData.bookingId.trim()) {
      newErrors.bookingId = 'Booking ID is required for service-related complaints';
      valid = false;
    }
    if (!formData.title.trim()) { newErrors.title = 'Title is required'; valid = false; }
    else if (formData.title.trim().length < 5) { newErrors.title = 'Minimum 5 characters'; valid = false; }
    if (!formData.description.trim()) { newErrors.description = 'Description is required'; valid = false; }
    else if (formData.description.trim().length < 20) { newErrors.description = 'Minimum 20 characters'; valid = false; }
    if (!formData.category) { newErrors.category = 'Category is required'; valid = false; }
    setFormErrors(newErrors);
    return valid;
  };

  const submitComplaint = async () => {
    if (!validateForm()) return;
    try {
      const fd = new FormData();
      fd.append('bookingId', formData.bookingId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('category', formData.category);
      formData.images.forEach(img => fd.append('images', img));
      await submitComplaint(fd);
      toast.success('Complaint submitted successfully!');
      setOpenNewComplaint(false);
      resetForm();
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
      if (err.response?.status === 401) logoutUser();
    }
  };

  const viewComplaintDetails = async (complaintId) => {
    try {
      const response = await getComplaint(complaintId);
      const c = {
        ...response.data.data,
        images: response.data.data.images ? response.data.data.images.map(img => typeof img === 'string' ? `${API_URL_IMAGE}/${img.replace(/\\/g, '/')}` : img.secure_url) : []
      };
      setSelectedComplaint(c);
      setOpenComplaintDetail(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch details');
    }
  };

  const reopenComplaint = async () => {
    if (!reopenReason.trim()) { toast.error('Please provide a reason'); return; }
    try {
      await reopenComplaint(selectedComplaint._id, { reason: reopenReason });
      toast.success('Complaint reopened!');
      setOpenComplaintDetail(false);
      setReopenReason('');
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reopen');
    }
  };

  const resetForm = () => {
    setFormData({ bookingId: '', title: '', description: '', category: '', images: [], previewImages: [] });
    setFormErrors({ bookingId: '', title: '', description: '', category: '' });
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  const STATUS_CONFIG = {
    'Open': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
    'In-Progress': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    'Solved': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
    'Reopened': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
    'Closed': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' },
  };

  const getStatusStyle = (status) => STATUS_CONFIG[status] || STATUS_CONFIG['Open'];

  const isFormDisabled =
    (formData.category === 'Service issue' && !formData.bookingId.trim()) ||
    !formData.title.trim() || !formData.description.trim() || !formData.category;

  return (
    <div className="min-h-screen bg-gray-50 font-inter">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-poppins font-bold text-secondary">Help & Support</h1>
              <p className="text-xs text-gray-400">We're here to help</p>
            </div>
          </div>
          <button
            onClick={() => setOpenNewComplaint(true)}
            className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + New Ticket
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <FileText className="h-5 w-5 text-primary" />, label: 'FAQs', sub: 'Coming Soon', action: () => toast.info('FAQs coming soon!') },
            { icon: <MessageSquare className="h-5 w-5 text-accent" />, label: 'New Ticket', sub: 'Report issue', action: () => setOpenNewComplaint(true) },
            { icon: <Headphones className="h-5 w-5 text-green-600" />, label: 'Live Chat', sub: 'Coming Soon', action: () => toast.info('Support chat coming soon!') },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col items-center text-center gap-1.5 hover:shadow-md transition-all active:scale-95"
            >
              <div className="bg-gray-50 rounded-full p-2">{item.icon}</div>
              <span className="text-xs font-semibold text-secondary">{item.label}</span>
              <span className="text-[10px] text-gray-400">{item.sub}</span>
            </button>
          ))}
        </div>

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Hi, {user?.name?.split(' ')[0] || 'User'}!</p>
              <p className="text-xs text-gray-600 mt-0.5">Need help? Create a ticket and we'll respond within 24 hours.</p>
            </div>
            <button onClick={() => setOpenNewComplaint(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-medium">Get Help</button>
          </div>
        </div>

        {/* Recent Bookings Help */}
        {bookings.filter(b => b.status === 'completed').length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-secondary">Need help with recent booking?</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {bookings.filter(b => b.status === 'completed').slice(0, 2).map((booking) => (
                <div key={booking._id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary">{booking.services?.[0]?.service?.title || 'Service'}</p>
                    <p className="text-xs text-gray-400">{formatDate(booking.date)}</p>
                  </div>
                  <button
                    onClick={() => { setFormData(prev => ({ ...prev, bookingId: booking._id, category: 'Service issue' })); setOpenNewComplaint(true); }}
                    className="text-primary text-xs font-medium"
                  >
                    Get Help →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Tickets Section */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-secondary">My Tickets</h2>
              <p className="text-xs text-gray-400">{complaints.length} tickets</p>
            </div>
            {/* Refresh button removed */}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-xs text-gray-400">Loading tickets...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
              <p className="text-xs text-red-500">{error}</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-secondary mb-1">No tickets yet</p>
              <p className="text-xs text-gray-400 mb-4">Have an issue? Create a support ticket</p>
              <button onClick={() => setOpenNewComplaint(true)} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium">
                + New Ticket
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {complaints.map((complaint) => {
                const s = getStatusStyle(complaint.status);
                return (
                  <div
                    key={complaint._id}
                    onClick={() => viewComplaintDetails(complaint._id)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-secondary">{complaint.title || 'Support Request'}</p>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                            {complaint.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">#{complaint.complaintId || complaint._id.slice(-8)} • {complaint.category}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(complaint.createdAt)}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Support Contact */}
        <div className="bg-secondary text-white rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-full p-2">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Still need help?</p>
              <p className="text-xs text-gray-300">Support features coming soon</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toast.info('Feature coming soon!')}
              className="border border-white/20 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Chat
            </button>
            <button
              onClick={() => toast.info('Feature coming soon!')}
              className="bg-white text-secondary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
            >
              Call
            </button>
          </div>
        </div>
      </div>

      {/* New Complaint Modal */}
      {openNewComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={() => { setOpenNewComplaint(false); resetForm(); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-secondary">New Ticket</h3>
                <p className="text-xs text-gray-400">We'll respond within 24 hours</p>
              </div>
              <button onClick={() => { setOpenNewComplaint(false); resetForm(); }} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLAINT_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setFormData(prev => ({ ...prev, category: cat, bookingId: '' })); setFormErrors(prev => ({ ...prev, category: '' })); }}
                      className={`text-xs font-medium py-2 px-3 rounded-lg border transition-all ${formData.category === cat ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {formErrors.category && <p className="text-xs text-red-500 mt-1">{formErrors.category}</p>}
              </div>

              {/* Booking selection */}
              {formData.category === 'Service issue' && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">Select Booking *</label>
                  <select name="bookingId" value={formData.bookingId} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20">
                    <option value="">Select a booking</option>
                    {bookings.filter(b => b.status === 'completed').map(b => (
                      <option key={b._id} value={b._id}>{b.services?.[0]?.service?.title || 'Service'} - {formatDate(b.date)}</option>
                    ))}
                  </select>
                  {formErrors.bookingId && <p className="text-xs text-red-500 mt-1">{formErrors.bookingId}</p>}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="Brief summary of your issue" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20" />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Description *</label>
                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder="Please provide detailed information about your issue" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 resize-none" />
                {formErrors.description && <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>}
              </div>

              {/* Images */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Attachments (Optional)</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-primary/50">
                  <Upload className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Upload images (JPG, PNG up to 5MB)</span>
                  <input type="file" multiple className="sr-only" onChange={handleImageUpload} accept="image/*" />
                </label>
                {formData.previewImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.previewImages.map((preview, idx) => (
                      <div key={idx} className="relative w-16 h-16">
                        <img src={preview} className="w-full h-full object-cover rounded-lg border" alt="" />
                        <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setOpenNewComplaint(false); resetForm(); }} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitComplaint} disabled={isFormDisabled} className={`flex-1 py-2 rounded-lg text-sm font-medium text-white ${isFormDisabled ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Detail Modal */}
      {openComplaintDetail && selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={() => setOpenComplaintDetail(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-secondary">Ticket Details</h3>
                <p className="text-xs text-gray-400">#{selectedComplaint.complaintId || selectedComplaint._id.slice(-8)}</p>
              </div>
              <button onClick={() => setOpenComplaintDetail(false)} className="p-1.5 hover:bg-gray-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Status */}
              <div className={`p-4 rounded-xl ${getStatusStyle(selectedComplaint.status).bg} border ${getStatusStyle(selectedComplaint.status).border}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <span className={`text-sm font-semibold ${getStatusStyle(selectedComplaint.status).text}`}>{selectedComplaint.status}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Category: {selectedComplaint.category}</span>
                  <span>Submitted: {formatDate(selectedComplaint.createdAt)}</span>
                </div>
              </div>

              {/* Message */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Message</h4>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-secondary mb-2">{selectedComplaint.title}</p>
                  <p className="text-sm text-gray-600">{selectedComplaint.description}</p>
                </div>
              </div>

              {/* Images */}
              {selectedComplaint.images?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">Attachments</h4>
                  <div className="flex gap-2 overflow-x-auto">
                    {selectedComplaint.images.map((img, idx) => (
                      <img key={idx} src={img} className="w-20 h-20 object-cover rounded-lg border" alt="" />
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Response */}
              {selectedComplaint.responseByAdmin && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-600 mb-2">Admin Response</h4>
                  <p className="text-sm text-blue-700">{selectedComplaint.responseByAdmin}</p>
                </div>
              )}

              {/* Reopen Section */}
              {selectedComplaint.status === 'Solved' && (
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">Not satisfied?</h4>
                  <textarea rows="2" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Why do you want to reopen this ticket?" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 resize-none" />
                  <button onClick={reopenComplaint} disabled={!reopenReason.trim()} className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">Reopen Ticket</button>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={() => setOpenComplaintDetail(false)} className="w-full py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsPage;