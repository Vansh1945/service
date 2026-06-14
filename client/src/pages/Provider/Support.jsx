import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  HelpCircle, MessageSquare,
  X, Upload,
  ChevronRight, FileText, ArrowLeft, ChevronDown
} from 'lucide-react';
import { getBookingsByStatus } from '../../services/BookingService';
import { getComplaint, getCustomerComplaints, submitComplaint as submitComplaintAPI, replyToComplaint } from '../../services/ComplaintService';
import { formatDate, formatDateTime, compressImage } from '../../utils/format';
import CDNImage from '../../components/CDNImage';
import ChatModal from '../../components/chat/ChatModal';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import Processing from '../../components/ui-skeletons/Processing';

const SUPPORT_CATEGORIES = ["Payment", "Booking", "Account", "Other"];

const ProviderSupportPage = () => {
  const { user, isAuthenticated, API_URL_IMAGE } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openNewComplaint, setOpenNewComplaint] = useState(false);
  const [openComplaintDetail, setOpenComplaintDetail] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [activeTab, setActiveTab] = useState('tickets'); // tickets, chat, faqs
  const [chatOpen, setChatOpen] = useState(false);

  const [formData, setFormData] = useState({
    bookingId: '', title: '', description: '', category: '', images: [], previewImages: []
  });
  const [formErrors, setFormErrors] = useState({ bookingId: '', title: '', description: '', category: '' });
  const [replyText, setReplyText] = useState('');
  const [replyImages, setReplyImages] = useState([]);
  const [replyPreviews, setReplyPreviews] = useState([]);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const fetchBookings = async () => {
    try {
      const response = await getBookingsByStatus('completed');
      if (response.data.success) {
        setBookings(response.data.data);
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
    }
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await getCustomerComplaints(); // Backend handles role
      if (response.data.success) {
        const complaintsWithFullUrls = response.data.data.map(complaint => ({
          ...complaint,
          images: complaint.images ? complaint.images.map(img => typeof img === 'string' ? `${API_URL_IMAGE}/${img.replace(/\\/g, '/')}` : (img.secure_url || img)) : []
        }));
        setComplaints(complaintsWithFullUrls);
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch complaints error:', err);
      setError(err.response?.data?.message || 'Failed to fetch tickets');
      setLoading(false);
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
    if (!formData.title.trim()) { newErrors.title = 'Ticket subject is required'; valid = false; }
    if (!formData.description.trim()) { newErrors.description = 'Description is required'; valid = false; }
    else if (formData.description.trim().length < 10) { newErrors.description = 'Please describe your issue in more detail'; valid = false; }
    if (!formData.category) { newErrors.category = 'Category is required'; valid = false; }
    setFormErrors(newErrors);
    return valid;
  };

  const handleSubmitTicket = async () => {
    if (!validateForm()) return;
    if (submittingTicket) return;
    setSubmittingTicket(true);
    try {
      // Compress support ticket attachment images
      const compressedImages = await Promise.all(
        formData.images.map(img => compressImage(img, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }))
      );

      const fd = new FormData();
      fd.append('bookingId', formData.bookingId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('category', formData.category);
      compressedImages.forEach(img => fd.append('images', img));

      await submitComplaintAPI(fd);
      toast.success('Support ticket submitted successfully!');
      setOpenNewComplaint(false);
      resetForm();
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const viewComplaintDetails = async (complaintId) => {
    try {
      const response = await getComplaint(complaintId);
      const c = response.data.data;
      // Handle image URLs (backend already returns secure_url for Cloudinary)
      setSelectedComplaint(c);
      setOpenComplaintDetail(true);
    } catch (err) {
      toast.error('Failed to fetch ticket details');
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) { toast.error('Please enter a reply message'); return; }
    setSubmittingReply(true);
    try {
      // Compress reply attachment images
      const compressedImages = await Promise.all(
        replyImages.map(img => compressImage(img, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }))
      );

      const fd = new FormData();
      fd.append('message', replyText);
      compressedImages.forEach(img => fd.append('images', img));

      await replyToComplaint(selectedComplaint._id, fd);
      toast.success('Reply submitted successfully!');
      setReplyText('');
      setReplyImages([]);
      setReplyPreviews([]);
      // Refresh details
      viewComplaintDetails(selectedComplaint._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleReplyImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [], validPreviews = [];
    files.forEach(file => {
      if (!file.type.match('image.*')) { toast.error('Images only'); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB per image'); return; }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });
    setReplyImages(prev => [...prev, ...validFiles]);
    setReplyPreviews(prev => [...prev, ...validPreviews]);
  };

  const resetForm = () => {
    setFormData({ bookingId: '', title: '', description: '', category: '', images: [], previewImages: [] });
    setFormErrors({ bookingId: '', title: '', description: '', category: '' });
  };


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

  const getStatusStyle = (status) => STATUS_CONFIG[status] || STATUS_CONFIG['Open'];

  const FAQS = [
    { q: "How to accept booking?", a: "Go to Booking Requests and click Accept." },
    { q: "How payout works?", a: "Payouts are processed weekly to your linked bank account." },
    { q: "How to update availability?", a: "You can update your working hours in Profile Settings." },
  ];

  return (
    <div className="min-h-screen bg-neutral-50/50 font-inter">
      {/* Header */}
      <div className="bg-white border-b border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-neutral-50 transition-colors">
              <ArrowLeft className="h-5 w-5 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-poppins font-bold text-secondary">Support & Help</h1>
              <p className="text-xs text-neutral-400">Partner Assistance Center</p>
            </div>
          </div>
          <button
            onClick={() => setOpenNewComplaint(true)}
            className="bg-primary text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-primary/95 transition-colors shadow-sm"
          >
            + Open Ticket
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border border-neutral-100 bg-white rounded-xl p-1 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'tickets' ? 'bg-primary text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'}`}
          >
            <FileText className="h-4 w-4" />
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab('faqs')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'faqs' ? 'bg-primary text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'}`}
          >
            <HelpCircle className="h-4 w-4" />
            FAQs & Help
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Direct Chat
          </button>
        </div>

        {activeTab === 'tickets' && (
          <div className="space-y-5">
            {/* My Tickets Section */}
            <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-secondary">My Support History</h2>
                  <p className="text-xs text-neutral-400">{complaints.length} tickets raised</p>
                </div>
              </div>

              {loading ? (
                <div className="py-12"><LoadingSpinner /></div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-neutral-100">
                    <MessageSquare className="h-6 w-6 text-neutral-400" />
                  </div>
                  <p className="text-sm font-semibold text-secondary mb-1">No support tickets found</p>
                  <p className="text-xs text-neutral-400 mb-5">Need help with something? Raise a support ticket.</p>
                  <button onClick={() => setOpenNewComplaint(true)} className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:bg-primary/95 transition-all">
                    + Open Support Ticket
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {complaints.map((complaint) => {
                    const s = getStatusStyle(complaint.status);
                    return (
                      <div key={complaint._id}
                        onClick={() => viewComplaintDetails(complaint._id)}
                        className="px-5 py-4 hover:bg-neutral-50/50 cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 bg-primary/5 rounded-xl flex items-center justify-center flex-shrink-0 border border-primary/10">
                            <FileText className="h-4.5 w-4.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-secondary truncate">{complaint.title}</p>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${s.bg} ${s.text} border ${s.border}`}>
                                {complaint.status === 'Solved' ? 'Resolved' :
                                  complaint.status === 'In-Progress' ? 'In Review' :
                                    complaint.status === 'Reopened' ? 'Reopened' :
                                      complaint.status === 'Closed' ? 'Closed' :
                                        complaint.status === 'submitted' ? 'Submitted' :
                                          complaint.status === 'under_review' ? 'Under Review' :
                                            complaint.status === 'provider_responded' ? 'Provider Responded' :
                                              complaint.status === 'admin_review' ? 'Admin Review' :
                                                complaint.status === 'resolved' ? 'Resolved' :
                                                  complaint.status === 'rejected' ? 'Rejected' :
                                                    complaint.status === 'refunded' ? 'Refunded' : complaint.status}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400">#{complaint.complaintId || complaint._id.slice(-8)} • {complaint.category}</p>
                            <p className="text-[11px] text-neutral-400 mt-1">{formatDateTime(complaint.createdAt)}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-neutral-300 flex-shrink-0 ml-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <h2 className="text-sm font-bold text-secondary">FAQs & Guidelines</h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {FAQS.map((faq, idx) => (
                  <details key={idx} className="group">
                    <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-neutral-50/50 transition-colors">
                      <span className="text-sm font-semibold text-secondary pr-4">{faq.q}</span>
                      <ChevronDown className="h-4 w-4 text-neutral-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-5 pb-4 text-xs sm:text-sm text-neutral-500 leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* New Ticket Modal */}
      {openNewComplaint && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto" onClick={() => { setOpenNewComplaint(false); resetForm(); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] my-auto border border-neutral-150 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base sm:text-lg font-poppins font-bold text-secondary">Raise Support Ticket</h3>
                <p className="text-xs text-neutral-400">Response within 24 hours</p>
              </div>
              <button onClick={() => { setOpenNewComplaint(false); resetForm(); }} className="p-1.5 hover:bg-neutral-50 rounded-full transition-colors text-neutral-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Issue Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORT_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setFormData(prev => ({ ...prev, category: cat, bookingId: '' })); setFormErrors(prev => ({ ...prev, category: '' })); }}
                      className={`text-xs font-semibold py-2.5 px-3 rounded-xl border transition-all ${formData.category === cat ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/25' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {formErrors.category && <p className="text-xs text-danger mt-1.5">{formErrors.category}</p>}
              </div>

              {/* Booking selection */}
              {formData.category === 'Booking' && (
                <div>
                  <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Related Booking (Optional)</label>
                  <select name="bookingId" value={formData.bookingId} onChange={handleInputChange} className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-secondary">
                    <option value="">Select a booking</option>
                    {bookings.map(b => (
                      <option key={b._id} value={b._id}>{b.services?.[0]?.service?.title || 'Service'} - {formatDate(b.date)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Subject *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g., Payment delayed, App error" className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none text-secondary" />
                {formErrors.title && <p className="text-xs text-danger mt-1.5">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Description *</label>
                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder="Please provide details about your issue" className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none text-secondary resize-none" />
                {formErrors.description && <p className="text-xs text-danger mt-1.5">{formErrors.description}</p>}
              </div>

              {/* Images */}
              <div>
                <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Attachments (Optional)</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-neutral-200 rounded-xl px-4 py-4.5 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-neutral-500">
                  <Upload className="h-4.5 w-4.5 text-neutral-400" />
                  <span className="text-xs font-medium">Upload screenshot</span>
                  <input type="file" multiple className="sr-only" onChange={handleImageUpload} accept="image/*" />
                </label>
                {formData.previewImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.previewImages.map((preview, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200">
                        <img src={preview} className="w-full h-full object-cover" alt="" />
                        <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-0.5 shadow-sm"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-neutral-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => { setOpenNewComplaint(false); resetForm(); }} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-xs sm:text-sm font-semibold hover:bg-neutral-50 transition-colors text-neutral-600">Cancel</button>
              <Processing
                onClick={handleSubmitTicket}
                loading={submittingTicket}
                loadingText="Submitting..."
                className="flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-primary hover:bg-primary/95 flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                Submit Ticket
              </Processing>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {openComplaintDetail && selectedComplaint && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={() => setOpenComplaintDetail(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-150 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-lg font-poppins font-bold text-secondary">Ticket Details</h3>
                <p className="text-xs text-neutral-400">#{selectedComplaint.complaintId || selectedComplaint._id.slice(-8)}</p>
              </div>
              <button onClick={() => setOpenComplaintDetail(false)} className="p-1.5 hover:bg-neutral-50 rounded-full transition-colors text-neutral-500"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
              <div className={`p-4 rounded-xl ${getStatusStyle(selectedComplaint.status).bg} border ${getStatusStyle(selectedComplaint.status).border}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-secondary">Status</span>
                  <span className={`text-sm font-bold uppercase tracking-wider ${getStatusStyle(selectedComplaint.status).text}`}>
                    {selectedComplaint.status === 'Solved' ? '✓ Resolved' :
                      selectedComplaint.status === 'In-Progress' ? '⏳ Being Reviewed' :
                        selectedComplaint.status === 'Reopened' ? '↩ Reopened' :
                          selectedComplaint.status === 'Closed' ? 'Closed' :
                            selectedComplaint.status === 'submitted' ? 'Submitted' :
                              selectedComplaint.status === 'under_review' ? 'Under Review' :
                                selectedComplaint.status === 'provider_responded' ? 'Provider Responded' :
                                  selectedComplaint.status === 'admin_review' ? 'Admin Review' :
                                    selectedComplaint.status === 'resolved' ? 'Resolved' :
                                      selectedComplaint.status === 'rejected' ? 'Rejected' :
                                        selectedComplaint.status === 'refunded' ? 'Refunded' : selectedComplaint.status}
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Subject</h4>
                <p className="text-sm font-bold text-secondary">{selectedComplaint.title}</p>
                {selectedComplaint.complaintType && selectedComplaint.complaintType !== 'N/A' && (
                  <span className="inline-block mt-1.5 text-[10px] font-bold bg-danger/5 text-danger px-2.5 py-0.5 rounded-full border border-danger/10 uppercase tracking-wider">
                    {selectedComplaint.complaintType.replace('_', ' ')}
                  </span>
                )}
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mt-4 mb-2">Description</h4>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {selectedComplaint.description?.includes(']')
                    ? selectedComplaint.description.split(']').slice(1).join(']').trim()
                    : selectedComplaint.description}
                </p>
              </div>

              {/* Evidence Comparison */}
              {selectedComplaint.evidenceComparison && (
                <div className="rounded-xl border border-neutral-100 overflow-hidden shadow-sm">
                  <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-100 flex justify-between items-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Evidence Comparison</p>
                    <span className="text-[9px] text-primary font-bold">Before | After | Proof</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-neutral-100 h-20">
                    <div className="p-2 flex flex-col items-center justify-center">
                      <p className="text-[8px] font-bold text-neutral-400 mb-1">BEFORE</p>
                      <div className="flex gap-1 overflow-x-auto w-full justify-center">
                        {selectedComplaint.evidenceComparison.beforeWorkImages?.length > 0 ? (
                          selectedComplaint.evidenceComparison.beforeWorkImages.map((img, i) => (
                            <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded-lg border border-neutral-200" alt="Before" />
                          ))
                        ) : <span className="text-[8px] text-neutral-350">None</span>}
                      </div>
                    </div>
                    <div className="p-2 flex flex-col items-center justify-center">
                      <p className="text-[8px] font-bold text-neutral-400 mb-1">AFTER</p>
                      <div className="flex gap-1 overflow-x-auto w-full justify-center">
                        {selectedComplaint.evidenceComparison.afterWorkImages?.length > 0 ? (
                          selectedComplaint.evidenceComparison.afterWorkImages.map((img, i) => (
                            <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded-lg border border-neutral-200" alt="After" />
                          ))
                        ) : <span className="text-[8px] text-neutral-350">None</span>}
                      </div>
                    </div>
                    <div className="p-2 flex flex-col items-center justify-center bg-danger/5">
                      <p className="text-[8px] font-bold text-danger/60 mb-1">CUSTOMER</p>
                      <div className="flex gap-1 overflow-x-auto w-full justify-center">
                        {selectedComplaint.evidenceComparison.complaintImages?.length > 0 ? (
                          selectedComplaint.evidenceComparison.complaintImages.map((img, i) => (
                            <CDNImage key={i} src={img} width={100} className="w-8 h-8 object-cover rounded-lg border border-danger/10" alt="Customer proof" />
                          ))
                        ) : <span className="text-[8px] text-neutral-350">None</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution History / Timeline */}
              {selectedComplaint.resolutionHistory?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-3">Resolution History</p>
                  <div className="relative pl-6">
                    <div className="absolute left-[10px] top-2 bottom-2 w-px bg-neutral-100" />
                    <div className="space-y-4">
                      {selectedComplaint.resolutionHistory.map((step, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[20px] top-1.5 w-2 h-2 rounded-full border-2 bg-white ${step.event.includes('Resolved') ? 'border-success' :
                            step.event.includes('Replied') ? 'border-primary' : 'border-neutral-300'
                            }`} />
                          <div className="flex justify-between items-start">
                            <p className="text-[11px] font-bold text-secondary">{step.event}</p>
                            <span className="text-[9px] text-neutral-400">{formatDateTime(step.timestamp)}</span>
                          </div>
                          {step.note && <p className="text-[10px] text-neutral-500 italic mt-0.5">"{step.note}"</p>}
                          <p className="text-[9px] text-neutral-400 mt-1 uppercase">By: {step.by}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Reply Form (Only if ticket is not closed) */}
              {!['Solved', 'Closed'].includes(selectedComplaint.status) && (
                <div className="border-t border-neutral-100 pt-5 mt-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Submit Your Response</h4>
                  <div className="space-y-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Explain your side or provide clarification..."
                      rows="3"
                      className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none text-secondary"
                    />

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors text-neutral-500">
                        <Upload className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="text-xs font-semibold">Attach Evidence</span>
                        <input type="file" multiple className="sr-only" onChange={handleReplyImageUpload} accept="image/*" />
                      </label>
                      <div className="flex gap-1.5 overflow-x-auto">
                        {replyPreviews.map((p, i) => (
                          <img key={i} src={p} className="w-8 h-8 object-cover rounded-lg border border-neutral-200" alt="" />
                        ))}
                      </div>
                    </div>

                    <Processing
                      onClick={handleReplySubmit}
                      disabled={!replyText.trim()}
                      loading={submittingReply}
                      loadingText="Submitting..."
                      className="w-full py-2.5 bg-primary text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:bg-primary/95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageSquare className="w-4 h-4" /> Submit Response
                    </Processing>
                    <p className="text-[9px] text-neutral-400 text-center italic">This response will be visible to the Customer and Support Team.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 bg-neutral-50/50">
              <button onClick={() => setOpenComplaintDetail(false)} className="w-full py-2.5 border border-neutral-200 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-neutral-50 transition-colors text-neutral-600">Close</button>
            </div>
          </div>
        </div>
      )}
      <ChatModal
        roomType="provider_admin"
        providerId={user?._id}
        userRole="provider"
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
};

export default ProviderSupportPage;
