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
const CATEGORY_MAP = {
  "Service issue": { label: "Service Issue", icon: "🛠" },
  "Payment issue": { label: "Payment", icon: "💳" },
  "Refund request": { label: "Refund", icon: "💰" },
  "Suggestion": { label: "Suggestion", icon: "💡" },
  "Other": { label: "Other", icon: "📞" },
};

const getCustomStatusStyle = (status) => {
  const norm = (status || '').toLowerCase();
  if (['pending', 'open', 'reopened', 'submitted'].includes(norm)) {
    return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', dot: 'bg-warning', label: 'Pending' };
  }
  if (['under_review', 'in-progress', 'under-review', 'provider_responded', 'admin_review'].includes(norm)) {
    return { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', dot: 'bg-info', label: 'Under Review' };
  }
  if (['resolved', 'solved', 'refunded'].includes(norm)) {
    return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', dot: 'bg-success', label: 'Resolved' };
  }
  if (['rejected'].includes(norm)) {
    return { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20', dot: 'bg-danger', label: 'Rejected' };
  }
  return { bg: 'bg-neutral-100', text: 'text-neutral-600', border: 'border-neutral-200', dot: 'bg-neutral-400', label: 'Closed' };
};

const getStatusEmoji = (status) => {
  const norm = (status || '').toLowerCase();
  if (['resolved', 'solved', 'refunded'].includes(norm)) return '🟢';
  if (['rejected'].includes(norm)) return '🔴';
  if (['closed'].includes(norm)) return '⚫';
  return '🟡';
};

const formatCustomDateTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} • ${hours}:${minutes} ${ampm}`;
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




  const getStatusStyle = getCustomStatusStyle;

  const isFormDisabled =
    ((formData.category === 'Service issue' || formData.category === 'Refund request') && !formData.bookingId.trim()) ||
    !formData.title.trim() || !formData.description.trim() || !formData.category || submittingComplaint;

  return (
    <div className="min-h-screen bg-gray-50 font-inter">

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
                <h1 className="text-sm font-extrabold text-neutral-900 tracking-tight font-poppins">Complaint Center</h1>
                <p className="text-[10px] text-neutral-400">Need help? We're here for you.</p>
              </div>
            </div>
            <button
              onClick={() => setOpenNewComplaint(true)}
              className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Create Ticket
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">

        {/* My Support History Header */}
        <div className="flex justify-between items-center bg-transparent">
          <div>
            <h2 className="text-sm font-bold text-secondary flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              My Support History
            </h2>
            <p className="text-[10px] text-neutral-400">Track and manage your previous tickets</p>
          </div>
          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {complaints.length} Total
          </span>
        </div>

        {/* Support History Content */}
        {loading ? (
          <div className="bg-white rounded-xl border border-neutral-100 p-6 shadow-sm"><LoadingSpinner /></div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-neutral-100 p-6 text-center shadow-sm">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-red-500">{error}</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 p-8 text-center shadow-sm">
            <div className="w-10 h-10 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-2.5">
              <MessageSquare className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-xs font-semibold text-secondary">No history found</p>
            <p className="text-[10px] text-neutral-400">Tickets you create will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {complaints.map((complaint) => {
              const s = getStatusStyle(complaint.status);
              
              // Priority / Category Badge mapping
              let catBadgeColor = "bg-neutral-100 text-neutral-600 border-neutral-200";
              if (complaint.category === "Refund request" || complaint.category === "Payment issue") {
                catBadgeColor = "bg-danger/10 text-danger border-danger/20";
              } else if (complaint.category === "Service issue") {
                catBadgeColor = "bg-primary/10 text-primary border-primary/20";
              } else if (complaint.category === "Suggestion") {
                catBadgeColor = "bg-success/10 text-success border-success/20";
              }

              const bId = complaint.bookingId || complaint.booking?._id;
              const bTitle = complaint.booking?.services?.[0]?.service?.title || 'Service';

              return (
                <div
                  key={complaint._id}
                  onClick={() => viewComplaintDetails(complaint._id)}
                  className="bg-white rounded-xl border border-neutral-200/80 p-4 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div>
                    {/* Ticket Header: Complaint ID & Status / Category badges */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[10px] font-bold text-neutral-400 font-mono tracking-tight">
                        #{complaint.complaintId || complaint._id.slice(-8)}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${catBadgeColor}`}>
                          {complaint.category}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${s.bg} ${s.text} ${s.border}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>

                    {/* Title & Service Details */}
                    <h4 className="text-xs font-bold text-neutral-800 line-clamp-1 mb-1 group-hover:text-primary transition-colors">
                      {complaint.title || 'Support Request'}
                    </h4>
                    
                    {bId && (
                      <div className="flex flex-col gap-0.5 mb-2 text-[10px] text-neutral-500 bg-neutral-50 p-2 rounded-lg border border-neutral-100/50">
                        <p className="font-semibold text-neutral-700 truncate">{bTitle}</p>
                        <p className="opacity-80">Booking: #{complaint.booking?.bookingId || bId.slice(-8)}</p>
                      </div>
                    )}

                    <p className="text-[10px] text-neutral-500 line-clamp-2 leading-relaxed mb-3">
                      {complaint.description?.includes(']')
                        ? complaint.description.split(']').slice(1).join(']').trim()
                        : complaint.description}
                    </p>
                  </div>

                  {/* Bottom row: Created date & View Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px]">
                    <span className="text-neutral-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(complaint.createdAt)}
                    </span>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); viewComplaintDetails(complaint._id); }}
                      className="text-primary font-bold hover:underline flex items-center gap-0.5"
                    >
                      View Details
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
              <p className="text-xs text-gray-300">Chat directly with Support Team</p>
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
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[9999]"
          role="button"
          tabIndex={0}
          onClick={() => { setOpenNewComplaint(false); resetForm(); }}
          onKeyUp={(e) => { if (e.key === 'Escape') { setOpenNewComplaint(false); resetForm(); } }}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMPLAINT_CATEGORIES.map(cat => {
                    const item = CATEGORY_MAP[cat] || { label: cat, icon: "❓" };
                    const isSelected = formData.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setFormData(prev => ({ ...prev, category: cat, bookingId: '' })); setFormErrors(prev => ({ ...prev, category: '' })); }}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${isSelected ? 'border-primary bg-primary/5 text-primary shadow-sm font-semibold scale-[1.02]' : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'}`}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-[10px] md:text-xs tracking-tight">{item.label}</span>
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
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    <option value="">Select Reason</option>
                    <option value="poor_quality">Poor Quality</option>
                    <option value="incomplete_work">Incomplete Work</option>
                    <option value="provider_late">Provider Late</option>
                    <option value="payment_issue">Payment Issue</option>
                    <option value="overcharged_service">Overcharged Service</option>
                    <option value="behaviour_issue">Behaviour Issue</option>
                    <option value="other">Other</option>
                  </select>
                  {formErrors.complaintType && <p className="text-xs text-red-500 mt-1">{formErrors.complaintType}</p>}
                </div>
              )}

              {/* Booking selection */}
              {(formData.category === 'Service issue' || formData.category === 'Refund request') && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">Select Booking *</label>
                  {formData.bookingId ? (
                    (() => {
                      const selectedBooking = bookings.find(b => b._id === formData.bookingId);
                      return (
                        <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-center justify-between">
                          <div className="grid grid-cols-2 gap-4 flex-1">
                            <div>
                              <span className="block text-[9px] uppercase font-bold text-neutral-400">Booking ID</span>
                              <span className="text-xs font-semibold text-neutral-700">#{selectedBooking?.bookingId || selectedBooking?._id?.slice(-8) || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase font-bold text-neutral-400">Service Name</span>
                              <span className="text-xs font-semibold text-neutral-700 truncate block">{selectedBooking?.services?.[0]?.service?.title || 'Service'}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, bookingId: '' }))}
                            className="text-primary text-[10px] font-bold hover:underline ml-2"
                          >
                            Change
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <div>
                      <select name="bookingId" value={formData.bookingId} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary/20 bg-white">
                        <option value="">Select a booking</option>
                        {bookings.flatMap(b => (b.status === 'completed' || b.status === 'cancelled') ? [
                          <option key={b._id} value={b._id}>{b.services?.[0]?.service?.title || 'Service'} - {formatDate(b.date)}</option>
                        ] : [])}
                      </select>
                      {formErrors.bookingId && <p className="text-xs text-red-500 mt-1">{formErrors.bookingId}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="Brief summary of your issue" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">
                  {formData.category === 'Refund request' ? 'Reason for Refund *' : 'Description *'}
                </label>
                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder={formData.category === 'Refund request' ? "Please provide the reason for your refund request (min 20 chars)" : "Please provide detailed information about your issue (min 20 chars)"} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary/20 resize-none" />
                {formErrors.description && <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>}
              </div>

              {/* Images */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Attachments (Optional)</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl px-4 py-6 cursor-pointer hover:border-primary/50 hover:bg-neutral-50/50 transition-all text-center">
                  <Upload className="h-5 w-5 text-neutral-400 mb-1.5" />
                  <span className="text-xs font-semibold text-neutral-700">Upload images</span>
                  <span className="text-[10px] text-neutral-400 mt-0.5">JPG, PNG up to 5MB (Max 5)</span>
                  <input type="file" multiple className="sr-only" onChange={handleImageUpload} accept="image/*" />
                </label>
                {formData.previewImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.previewImages.map((preview, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 shadow-sm group">
                        <img src={preview} className="w-full h-full object-cover" alt="" />
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)} 
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
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
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[9999]"
          role="button"
          tabIndex={0}
          onClick={() => setOpenComplaintDetail(false)}
          onKeyUp={(e) => { if (e.key === 'Escape') { setOpenComplaintDetail(false); } }}
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

              {/* ── Support Status Card ── */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 shadow-sm space-y-3">
                <div className="flex items-center gap-1.5 border-b border-neutral-200/50 pb-2">
                  <span className="text-sm">{getStatusEmoji(selectedComplaint.status)}</span>
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${getStatusStyle(selectedComplaint.status).text}`}>
                    {getStatusStyle(selectedComplaint.status).label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[10px]">
                  <div>
                    <span className="block text-neutral-400 font-medium mb-0.5">Complaint ID</span>
                    <span className="font-bold text-neutral-800 font-mono">
                      {selectedComplaint.complaintId || `CMP-2026-${selectedComplaint._id.slice(-4).toUpperCase()}`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-neutral-400 font-medium mb-0.5">Expected Response</span>
                    <span className="font-bold text-neutral-800">Within 24 Hours</span>
                  </div>
                  <div>
                    <span className="block text-neutral-400 font-medium mb-0.5">Assigned To</span>
                    <span className="font-bold text-neutral-800">Support Team</span>
                  </div>
                  <div>
                    <span className="block text-neutral-400 font-medium mb-0.5">Last Updated</span>
                    <span className="font-bold text-neutral-800">
                      {formatCustomDateTime(selectedComplaint.updatedAt || selectedComplaint.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Your Message ── */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Your Message</p>
                  {selectedComplaint.complaintType && selectedComplaint.complaintType !== 'N/A' && (
                    <span className="text-[9px] font-bold bg-danger/10 text-danger px-2 py-0.5 rounded-full border border-danger/20 uppercase">
                      {selectedComplaint.complaintType.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-750 leading-relaxed">
                  {selectedComplaint.description?.includes(']')
                    ? selectedComplaint.description.split(']').slice(1).join(']').trim()
                    : selectedComplaint.description}
                </p>
              </div>

              {/* ── Evidence Section ── */}
              <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-sm space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Evidence Comparison</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Before */}
                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-neutral-400 uppercase mb-1.5">Before</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {selectedComplaint.evidenceComparison?.beforeWorkImages?.length > 0 ? (
                        selectedComplaint.evidenceComparison.beforeWorkImages.map((img, i) => (
                          <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="Before" onClick={() => setPreviewImage(img)} />
                        ))
                      ) : <span className="text-[9px] text-neutral-450 italic">None</span>}
                    </div>
                  </div>
                  
                  {/* After */}
                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-neutral-400 uppercase mb-1.5">After</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {selectedComplaint.evidenceComparison?.afterWorkImages?.length > 0 ? (
                        selectedComplaint.evidenceComparison.afterWorkImages.map((img, i) => (
                          <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="After" onClick={() => setPreviewImage(img)} />
                        ))
                      ) : <span className="text-[9px] text-neutral-455 italic">None</span>}
                    </div>
                  </div>

                  {/* Customer Upload */}
                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-neutral-400 uppercase mb-1.5">Customer Upload</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {selectedComplaint.images?.length > 0 ? (
                        selectedComplaint.images.map((img, i) => (
                          <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="Customer" onClick={() => setPreviewImage(img)} />
                        ))
                      ) : <span className="text-[9px] text-neutral-450 italic">None</span>}
                    </div>
                  </div>

                  {/* Provider Upload */}
                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-neutral-400 uppercase mb-1.5">Provider Upload</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {selectedComplaint.booking?.complaintProofs?.filter(p => p.uploadedBy === 'provider')?.length > 0 ? (
                        selectedComplaint.booking.complaintProofs.filter(p => p.uploadedBy === 'provider').map((proof, i) => (
                          <CDNImage key={i} src={proof.secure_url || proof.url} width={100} className="w-8 h-8 object-cover rounded border cursor-pointer hover:border-primary transition-all" alt="Provider" onClick={() => setPreviewImage(proof.secure_url || proof.url)} />
                        ))
                      ) : <span className="text-[9px] text-neutral-450 italic">None</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Resolution Timeline ── */}
              <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-sm space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Resolution Timeline</p>
                {(() => {
                  const status = (selectedComplaint.status || '').toLowerCase();
                  const b = selectedComplaint.booking || {};
                  
                  const timelineSteps = [
                    { label: 'Complaint Created', done: true, active: false, color: 'bg-success' },
                    { 
                      label: 'Under Review', 
                      done: ['under_review', 'in-progress', 'provider_responded', 'admin_review', 'resolved', 'solved', 'refunded', 'rejected', 'closed'].includes(status),
                      active: ['open', 'submitted'].includes(status),
                      color: 'bg-info'
                    },
                    { 
                      label: 'Assigned', 
                      done: ['provider_responded', 'admin_review', 'resolved', 'solved', 'refunded', 'rejected', 'closed'].includes(status) || b.complaintProofs?.some(p => p.uploadedBy === 'provider'),
                      active: ['under_review', 'in-progress'].includes(status),
                      color: 'bg-primary'
                    },
                    { 
                      label: 'Resolved', 
                      done: ['resolved', 'solved', 'refunded', 'rejected', 'closed'].includes(status),
                      active: ['provider_responded', 'admin_review'].includes(status),
                      color: 'bg-success'
                    },
                    { 
                      label: 'Closed', 
                      done: ['closed'].includes(status),
                      active: ['resolved', 'solved', 'refunded', 'rejected'].includes(status),
                      color: 'bg-neutral-500'
                    }
                  ];

                  let activeIndex = -1;
                  for (let i = 0; i < timelineSteps.length; i++) {
                    if (!timelineSteps[i].done) {
                      activeIndex = i;
                      break;
                    }
                  }
                  if (activeIndex !== -1) {
                    timelineSteps[activeIndex].active = true;
                  } else {
                    timelineSteps[timelineSteps.length - 1].active = true;
                  }

                  return (
                    <div className="relative pl-6">
                      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-neutral-200" />
                      <div className="space-y-4">
                        {timelineSteps.map((step, i) => {
                          const isDone = step.done;
                          const isActive = step.active;
                          const dotColor = isDone ? step.color : 'bg-neutral-300';
                          return (
                            <div key={i} className="relative flex items-center gap-3">
                              <div className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${isDone ? 'border-transparent' : 'border-neutral-305 bg-white'} ${dotColor}`}>
                                {isDone ? (
                                  <CheckCircle className="w-2.5 h-2.5 text-white" />
                                ) : (
                                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-neutral-400'}`} />
                                )}
                              </div>
                              <p className={`text-xs ${isActive ? 'text-primary font-bold' : isDone ? 'text-neutral-800 font-semibold' : 'text-neutral-450'}`}>
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Refund Summary Card ── */}
              {(selectedComplaint.booking?.paymentStatus === 'refunded' || (selectedComplaint.booking?.cancellationProgress?.refundAmount > 0)) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-primary/15">
                    <Wallet className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-primary">Refund Summary</p>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-500">Amount Refunded</span>
                      <span className="text-sm font-black text-primary">
                        ₹{selectedComplaint.transaction?.type === 'refund'
                          ? selectedComplaint.transaction.amount
                          : (selectedComplaint.booking.cancellationProgress?.refundAmount || selectedComplaint.booking.totalAmount || '0')}
                      </span>
                    </div>
                    {selectedComplaint.booking.adminRefundDecision && selectedComplaint.booking.adminRefundDecision !== 'none' && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Refund Type</span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${selectedComplaint.booking.adminRefundDecision === 'approved'
                          ? 'bg-success/10 text-success border-success/20'
                          : selectedComplaint.booking.adminRefundDecision === 'partial'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-danger/10 text-danger border-danger/20'
                          }`}>
                          {selectedComplaint.booking.adminRefundDecision === 'approved' ? 'Full Refund'
                            : selectedComplaint.booking.adminRefundDecision === 'partial' ? 'Partial Refund'
                              : 'No Refund'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500">Refund Method</span>
                      <span className="font-semibold text-neutral-700">Wallet Balance</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500">Status</span>
                      <span className="font-bold text-primary flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Completed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Support Response (Admin Response Chat Card) ── */}
              {selectedComplaint.resolutionNotes && (
                <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm max-w-[90%] mr-auto">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      ST
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-800">Support Team</span>
                      <span className="text-[8px] text-neutral-450 ml-2">
                        {selectedComplaint.updatedAt ? formatDateTime(selectedComplaint.updatedAt) : 'Just now'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed pl-8">
                    {selectedComplaint.resolutionNotes}
                  </p>
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
          onKeyUp={(e) => { if (e.key === 'Escape') { setPreviewImage(null); } }}
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