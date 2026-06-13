import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  HelpCircle, MessageSquare, Phone, Plus, Eye, Calendar,
  Clock, AlertCircle, CheckCircle, X, Upload, Loader2,
  ChevronRight, FileText, ShieldCheck, Headphones, ArrowLeft, Tag,
  Wallet, ImageIcon, BadgeCheck, RotateCcw, Star
} from 'lucide-react';
import { getCustomerBookings } from '../../services/BookingService';
import { getComplaint, getCustomerComplaints, submitComplaint as submitComplaintAPI, reopenComplaint as reopenComplaintAPI } from '../../services/ComplaintService';
import { formatDate, formatDateTime, compressImage } from '../../utils/format';
import CDNImage from '../../components/CDNImage';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import Processing from '../../components/ui-skeletons/Processing';
import ChatModal from '../../components/chat/ChatModal';

const COMPLAINT_CATEGORIES = ["Service issue", "Payment issue", "Refund request", "Suggestion", "Other"];

const STATUS_CONFIG = {
  'Open': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  'In-Progress': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Solved': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  'Reopened': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Closed': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' },
  submitted: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  under_review: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  provider_responded: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  admin_review: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  refunded: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
};

const STATUS_LABELS = {
  'Open': 'Open',
  'In-Progress': 'In Review',
  'Solved': 'Resolved',
  'Reopened': 'Reopened',
  'Closed': 'Closed',
  'submitted': 'Submitted',
  'under_review': 'Under Review',
  'provider_responded': 'Provider Responded',
  'admin_review': 'Admin Review',
  'resolved': 'Resolved',
  'rejected': 'Rejected',
  'refunded': 'Refunded',
};

const STATUS_DETAIL_LABELS = {
  'Open': '○ Open',
  'In-Progress': '⏳ Being Reviewed',
  'Solved': '✓ Issue Resolved',
  'Reopened': '↩ Reopened',
  'Closed': 'Closed',
  'submitted': 'Submitted',
  'under_review': 'Under Review',
  'provider_responded': 'Provider Responded',
  'admin_review': 'Admin Review',
  'resolved': 'Resolved',
  'rejected': 'Rejected',
  'refunded': 'Refunded',
};

const ComplaintsPage = () => {
  const { token, user, logoutUser, isAuthenticated, API, API_URL_IMAGE } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId') || searchParams.get('complaintId');

  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openNewComplaint, setOpenNewComplaint] = useState(false);
  const [openComplaintDetail, setOpenComplaintDetail] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [formData, setFormData] = useState({
    bookingId: '', title: '', description: '', category: '', complaintType: '', images: [], previewImages: []
  });
  const [formErrors, setFormErrors] = useState({ bookingId: '', title: '', description: '', category: '', complaintType: '' });
  const [reopenReason, setReopenReason] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [chatRoomInfo, setChatRoomInfo] = useState(null);

  useEffect(() => {
    if (entityId) {
      viewComplaintDetails(entityId);
    }
  }, [entityId]);

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

    if (formData.images.length + files.length > 5) {
      toast.error('You can upload a maximum of 5 screenshot proofs.');
      return;
    }

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
    if ((formData.category === 'Service issue' || formData.category === 'Refund request') && !formData.bookingId.trim()) {
      newErrors.bookingId = 'Booking ID is required for service or refund-related complaints';
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

  const handleSubmitComplaint = async () => {
    if (!validateForm()) return;
    if (submittingComplaint) return;
    setSubmittingComplaint(true);
    try {
      // Compress complaint attachment images
      const compressedImages = await Promise.all(
        formData.images.map(img => compressImage(img, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }))
      );

      const fd = new FormData();
      fd.append('bookingId', formData.bookingId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('category', formData.category);
      if (formData.complaintType) fd.append('complaintType', formData.complaintType);
      compressedImages.forEach(img => fd.append('images', img));
      await submitComplaintAPI(fd);
      toast.success('Complaint submitted successfully!');
      setOpenNewComplaint(false);
      resetForm();
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
      if (err.response?.status === 401) logoutUser();
    } finally {
      setSubmittingComplaint(false);
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

  const handleReopenComplaint = async () => {
    if (!reopenReason.trim()) { toast.error('Please provide a reason'); return; }
    try {
      await reopenComplaintAPI(selectedComplaint._id, { reason: reopenReason });
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




  const getStatusStyle = (status) => STATUS_CONFIG[status] || STATUS_CONFIG['Open'];

  const isFormDisabled =
    ((formData.category === 'Service issue' || formData.category === 'Refund request') && !formData.bookingId.trim()) ||
    !formData.title.trim() || !formData.description.trim() || !formData.category || submittingComplaint;

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

        {/* My Support History Section - Moved to Top */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-sm font-bold text-secondary flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                My Support History
              </h2>
              <p className="text-[10px] text-gray-400">Track and manage your previous tickets</p>
            </div>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {complaints.length} Total
            </span>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
              <p className="text-xs text-red-500">{error}</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-secondary">No history found</p>
              <p className="text-[10px] text-gray-400">Tickets you create will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {complaints.map((complaint) => {
                const s = getStatusStyle(complaint.status);
                return (
                  <div
                    key={complaint._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => viewComplaintDetails(complaint._id)}
                    onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); viewComplaintDetails(complaint._id); } }}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 ${complaint.status === 'Solved' ? 'bg-green-50' : 'bg-primary/5'} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <FileText className={`h-4 w-4 ${complaint.status === 'Solved' ? 'text-green-600' : 'text-primary'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-secondary truncate max-w-[150px]">{complaint.title || 'Support Request'}</p>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${s.bg} ${s.text}`}>
                            {STATUS_LABELS[complaint.status] || complaint.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          #{complaint.complaintId || complaint._id.slice(-8)} • {complaint.category}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5 opacity-60 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(complaint.createdAt)}
                        </p>

                        {/* Refund outcome pill — customer-friendly */}
                        {complaint.booking?.adminRefundDecision && complaint.booking.adminRefundDecision !== 'none' && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {complaint.booking.adminRefundDecision === 'approved' && (
                              <span className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100 font-bold">✓ Refund Approved</span>
                            )}
                            {complaint.booking.adminRefundDecision === 'partial' && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 font-bold">◑ Partial Refund</span>
                            )}
                            {complaint.booking.adminRefundDecision === 'rejected' && (
                              <span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 font-bold">✗ No Refund</span>
                            )}
                            {complaint.booking.cancellationProgress?.refundAmount > 0 && (
                              <span className="text-[9px] font-black text-primary">₹{complaint.booking.cancellationProgress.refundAmount} credited</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <FileText className="h-5 w-5 text-primary" />, label: 'FAQs', sub: 'Coming Soon', action: () => toast.info('FAQs coming soon!') },
            { icon: <MessageSquare className="h-5 w-5 text-accent" />, label: 'New Ticket', sub: 'Report issue', action: () => setOpenNewComplaint(true) },
            { icon: <Headphones className="h-5 w-5 text-green-600" />, label: 'Live Chat', sub: 'Chat with Admin', action: () => setChatRoomInfo({ roomType: 'customer_admin' }) },
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

        {/* Support Contact */}
        <div className="bg-secondary text-white rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-full p-2">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Still need help?</p>
              <p className="text-xs text-gray-300">Chat directly with admin support</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChatRoomInfo({ roomType: 'customer_admin' })}
              className="border border-white/20 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Chat
            </button>
            <button
              onClick={() => toast.info('Phone support hotline coming soon!')}
              className="bg-white text-secondary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
            >
              Call
            </button>
          </div>
        </div>
      </div>

      {/* New Complaint Modal */}
      {openNewComplaint && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" 
          role="button"
          tabIndex={0}
          onClick={() => { setOpenNewComplaint(false); resetForm(); }}
          onKeyUp={(e) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { setOpenNewComplaint(false); resetForm(); } }}
        >
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
                <div className="grid grid-cols-1 gap-2">
                  {COMPLAINT_CATEGORIES.map(cat => {
                    let subLabel = "";
                    if (cat === "Service issue") subLabel = "Work defects, quality issues, incomplete work, or provider behavior";
                    else if (cat === "Refund request") subLabel = "Cancellations, refunds, or wallet payout disputes";
                    else if (cat === "Payment issue") subLabel = "Double charge, incorrect billing, or payment failure";
                    else if (cat === "Suggestion") subLabel = "Ideas or suggestions to improve our services";
                    else if (cat === "Other") subLabel = "General questions and other support issues";

                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setFormData(prev => ({ ...prev, category: cat, bookingId: '' })); setFormErrors(prev => ({ ...prev, category: '' })); }}
                        className={`text-left p-3 rounded-xl border transition-all flex flex-col gap-0.5 ${formData.category === cat ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        <span className="text-xs font-bold">{cat}</span>
                        {subLabel && <span className="text-[10px] text-gray-400 font-normal leading-relaxed">{subLabel}</span>}
                      </button>
                    );
                  })}
                </div>
                {formErrors.category && <p className="text-xs text-red-500 mt-1">{formErrors.category}</p>}
              </div>

              {/* Complaint Type */}
              {formData.category === 'Service issue' && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">Reason for Complaint *</label>
                  <select
                    name="complaintType"
                    value={formData.complaintType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select Reason</option>
                    <option value="bad_work">Bad Work Quality</option>
                    <option value="late_arrival">Late Arrival</option>
                    <option value="rude_behavior">Rude Behavior</option>
                    <option value="incomplete_work">Incomplete Work</option>
                    <option value="overcharge">Overcharging</option>
                  </select>
                  {formErrors.complaintType && <p className="text-xs text-red-500 mt-1">{formErrors.complaintType}</p>}
                </div>
              )}

              {/* Booking selection */}
              {(formData.category === 'Service issue' || formData.category === 'Refund request') && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">Select Booking *</label>
                  <select name="bookingId" value={formData.bookingId} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20">
                    <option value="">Select a booking</option>
                    {bookings.flatMap(b => (b.status === 'completed' || b.status === 'cancelled') ? [
                      <option key={b._id} value={b._id}>{b.services?.[0]?.service?.title || 'Service'} - {formatDate(b.date)}</option>
                    ] : [])}
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
                <label className="block text-xs font-semibold text-secondary mb-1.5">
                  {formData.category === 'Refund request' ? 'Reason for Refund *' : 'Description *'}
                </label>
                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder={formData.category === 'Refund request' ? "Please provide the reason for your refund request (min 20 chars)" : "Please provide detailed information about your issue (min 20 chars)"} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 resize-none" />
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
              <Processing onClick={handleSubmitComplaint} disabled={isFormDisabled && !submittingComplaint} loading={submittingComplaint} loadingText="Submitting..." className={`flex-1 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-1.5 ${isFormDisabled && !submittingComplaint ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}>
                Submit
              </Processing>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Detail Modal */}
      {openComplaintDetail && selectedComplaint && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" 
          role="button"
          tabIndex={0}
          onClick={() => setOpenComplaintDetail(false)}
          onKeyUp={(e) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { setOpenComplaintDetail(false); } }}
        >
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-secondary">Ticket Details</h3>
                <p className="text-xs text-gray-400">#{selectedComplaint.complaintId || selectedComplaint._id.slice(-8)}</p>
              </div>
              <button onClick={() => setOpenComplaintDetail(false)} className="p-1.5 hover:bg-gray-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* ── Status Header ── */}
              <div className={`rounded-xl p-4 border ${getStatusStyle(selectedComplaint.status).bg} ${getStatusStyle(selectedComplaint.status).border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{selectedComplaint.category}</p>
                    <p className="text-sm font-bold text-secondary truncate">{selectedComplaint.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Submitted {formatDateTime(selectedComplaint.createdAt)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${getStatusStyle(selectedComplaint.status).bg} ${getStatusStyle(selectedComplaint.status).text} border ${getStatusStyle(selectedComplaint.status).border}`}>
                    {STATUS_DETAIL_LABELS[selectedComplaint.status] || '○ Open'}
                  </span>
                </div>
              </div>

              {/* ── Your Message ── */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Your Message</p>
                  {selectedComplaint.complaintType && selectedComplaint.complaintType !== 'N/A' && (
                    <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 uppercase">
                      {selectedComplaint.complaintType.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedComplaint.description?.includes(']')
                    ? selectedComplaint.description.split(']').slice(1).join(']').trim()
                    : selectedComplaint.description}
                </p>
              </div>

              {/* ── Your Attachments ── */}
              {selectedComplaint.images?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Your Attachments
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedComplaint.images.map((img, idx) => (
                      <CDNImage key={idx} src={img} width={200} className="w-20 h-20 flex-shrink-0 object-cover rounded-xl border-2 border-gray-100 cursor-pointer hover:border-primary transition-all" alt="attachment" onClick={() => setPreviewImage(img)} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Evidence Comparison ── */}
              {selectedComplaint.evidenceComparison && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex justify-between items-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Evidence Comparison</p>
                    <span className="text-[9px] text-primary font-bold">Before | After | Complaint</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-100 h-24">
                    <div className="p-2 flex flex-col items-center">
                      <p className="text-[8px] font-bold text-gray-400 mb-1 uppercase">Before</p>
                      <div className="flex gap-1 overflow-x-auto w-full justify-center">
                        {selectedComplaint.evidenceComparison.beforeWorkImages?.length > 0 ? (
                          selectedComplaint.evidenceComparison.beforeWorkImages.map((img, i) => (
                            <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="Before" onClick={() => setPreviewImage(img)} />
                          ))
                        ) : <span className="text-[8px] text-gray-300 italic">None</span>}
                      </div>
                    </div>
                    <div className="p-2 flex flex-col items-center">
                      <p className="text-[8px] font-bold text-gray-400 mb-1 uppercase">After</p>
                      <div className="flex gap-1 overflow-x-auto w-full justify-center">
                        {selectedComplaint.evidenceComparison.afterWorkImages?.length > 0 ? (
                          selectedComplaint.evidenceComparison.afterWorkImages.map((img, i) => (
                            <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="After" onClick={() => setPreviewImage(img)} />
                          ))
                        ) : <span className="text-[8px] text-gray-300 italic">None</span>}
                      </div>
                    </div>
                    <div className="p-2 flex flex-col items-center bg-red-50/30">
                      <p className="text-[8px] font-bold text-red-400 mb-1 uppercase">Proof</p>
                      <div className="flex gap-1 overflow-x-auto w-full justify-center">
                        {selectedComplaint.evidenceComparison.complaintImages?.length > 0 ? (
                          selectedComplaint.evidenceComparison.complaintImages.map((img, i) => (
                            <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded border border-red-100 cursor-pointer hover:border-primary transition-all" alt="Proof" onClick={() => setPreviewImage(img)} />
                          ))
                        ) : <span className="text-[8px] text-gray-300 italic">None</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Resolution Timeline ── */}
              {selectedComplaint.resolutionHistory?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Resolution History</p>
                  <div className="relative pl-6">
                    <div className="absolute left-[10px] top-2 bottom-2 w-px bg-gray-100" />
                    <div className="space-y-4">
                      {selectedComplaint.resolutionHistory.map((step, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[20px] top-1.5 w-2 h-2 rounded-full border-2 bg-white ${step.event.includes('Resolved') || step.event.includes('Solved') ? 'border-green-500' :
                              step.event.includes('Replied') ? 'border-primary' : 'border-gray-300'
                            }`} />
                          <div className="flex justify-between items-start mb-0.5">
                            <p className={`text-[11px] font-bold ${step.event.includes('Resolved') ? 'text-green-600' : 'text-secondary'
                              }`}>{step.event}</p>
                            <span className="text-[9px] text-gray-400">{formatDateTime(step.timestamp)}</span>
                          </div>
                          {step.note && <p className="text-[10px] text-gray-500 leading-relaxed italic">"{step.note}"</p>}
                          {step.images?.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {step.images.map((img, j) => (
                                <CDNImage key={j} src={img} width={100} className="w-6 h-6 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="Proof" onClick={() => setPreviewImage(img)} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Refund Summary Card ── */}
              {(selectedComplaint.booking?.paymentStatus === 'refunded' || (selectedComplaint.booking?.cancellationProgress?.refundAmount > 0)) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-primary/15">
                    <Wallet className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-primary">Refund Summary</p>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Amount — from transaction, cancellationProgress or totalAmount fallback */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Amount Refunded</span>
                      <span className="text-base font-black text-primary">
                        ₹{selectedComplaint.transaction?.type === 'refund'
                          ? (selectedComplaint.transaction.isRupees || ['cash', 'wallet'].includes(selectedComplaint.transaction.paymentMethod?.toLowerCase())
                            ? selectedComplaint.transaction.amount
                            : selectedComplaint.transaction.amount / 100)
                          : (selectedComplaint.booking.cancellationProgress?.refundAmount || selectedComplaint.booking.totalAmount || '0')}
                      </span>
                    </div>
                    {/* Refund Type — from adminRefundDecision */}
                    {selectedComplaint.booking.adminRefundDecision && selectedComplaint.booking.adminRefundDecision !== 'none' && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Refund Type</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${selectedComplaint.booking.adminRefundDecision === 'approved'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : selectedComplaint.booking.adminRefundDecision === 'partial'
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-red-50 text-red-600 border-red-100'
                          }`}>
                          {selectedComplaint.booking.adminRefundDecision === 'approved' ? '✓ Full Refund'
                            : selectedComplaint.booking.adminRefundDecision === 'partial' ? '◑ Partial Refund'
                              : '✗ No Refund'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Refund Method</span>
                      <span className="text-xs font-bold text-secondary">Wallet Balance</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Status</span>
                      <span className="text-xs font-bold text-primary flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Completed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Resolution Journey Timeline ── */}
              {selectedComplaint.booking?.disputeRaised && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Resolution Journey</p>
                  {(() => {
                    const b = selectedComplaint.booking;
                    const steps = [
                      { label: 'Complaint Submitted', done: true, icon: FileText },
                      { label: 'Provider Response', done: b.complaintProofs?.some(p => p.uploadedBy === 'provider'), icon: MessageSquare },
                      { label: 'Under Review by Support', done: ['resolved', 'closed'].includes(b.disputeStatus), active: b.disputeStatus === 'pending', icon: ShieldCheck },
                      { label: b.adminRefundDecision === 'approved' ? 'Full Refund Approved' : b.adminRefundDecision === 'partial' ? 'Partial Refund Approved' : b.adminRefundDecision === 'rejected' ? 'No Refund Applicable' : 'Decision Pending', done: !!b.adminRefundDecision && b.adminRefundDecision !== 'none', icon: BadgeCheck },
                      { label: b.paymentStatus === 'refunded' ? 'Refund Credited to Wallet' : 'Awaiting Refund', done: b.paymentStatus === 'refunded', icon: Wallet },
                    ];
                    return (
                      <div className="relative pl-6">
                        <div className="absolute left-[10px] top-2.5 bottom-2.5 w-px bg-gray-200" />
                        <div className="space-y-4">
                          {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                              <div key={i} className="relative flex items-start gap-3">
                                <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${step.done ? 'bg-primary border-primary' : step.active ? 'bg-white border-primary animate-pulse' : 'bg-white border-gray-200'}`}>
                                  {step.done ? <CheckCircle className="w-3 h-3 text-white" /> : <div className={`w-1.5 h-1.5 rounded-full ${step.active ? 'bg-primary' : 'bg-gray-300'}`} />}
                                </div>
                                <p className={`text-xs pt-0.5 ${step.done ? 'text-secondary font-semibold' : step.active ? 'text-primary font-semibold' : 'text-gray-400'}`}>{step.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Support Response ── */}
              {selectedComplaint.resolutionNotes && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Our Response</p>
                  <p className="text-sm text-blue-700 leading-relaxed">{selectedComplaint.resolutionNotes}</p>
                </div>
              )}

              {/* ── Reopen ── */}
              {selectedComplaint.status === 'Solved' && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <p className="text-xs font-bold text-orange-700 mb-1">Not satisfied with the resolution?</p>
                  <p className="text-[10px] text-orange-500 mb-3">You can reopen this ticket within 7 days.</p>
                  <textarea rows="2" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Tell us why you're not satisfied..." className="w-full px-3 py-2 text-sm border border-orange-200 bg-white rounded-lg focus:ring-2 focus:ring-orange-300 resize-none" />
                  <Processing onClick={handleReopenComplaint} disabled={!reopenReason.trim()} loading={false} className="mt-2 w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5" /> Reopen Ticket
                  </Processing>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => {
                  setOpenComplaintDetail(false);
                  setChatRoomInfo({
                    bookingId: selectedComplaint.bookingId || selectedComplaint.booking?._id,
                    roomType: 'complaint_admin',
                    complaintId: selectedComplaint._id
                  });
                }}
                className="flex-1 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" /> Resolve with Admin
              </button>
              <button onClick={() => setOpenComplaintDetail(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Image Preview Gallery Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999]" 
          role="button"
          tabIndex={0}
          onClick={() => setPreviewImage(null)}
          onKeyUp={(e) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { setPreviewImage(null); } }}
        >
          <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
          <CDNImage src={previewImage} width={1600} lazy={false} className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="Preview" onClick={e => e.stopPropagation()} />
        </div>
      )}
      <ChatModal
        bookingId={chatRoomInfo?.bookingId}
        roomType={chatRoomInfo?.roomType || 'complaint_admin'}
        complaintId={chatRoomInfo?.complaintId}
        customerId={user?._id}
        userRole="customer"
        isOpen={!!chatRoomInfo}
        onClose={() => setChatRoomInfo(null)}
      />
    </div>
  );
};

export default ComplaintsPage;