import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  HelpCircle, MessageSquare, Phone, Plus, Eye, Calendar,
  Clock, AlertCircle, CheckCircle, X, Upload, Loader2,
  ChevronRight, FileText, ShieldCheck, Headphones, ArrowLeft, Tag, ChevronDown
} from 'lucide-react';
import { getBookingsByStatus } from '../../services/BookingService';
import { getComplaint, getCustomerComplaints, submitComplaint as submitComplaintAPI } from '../../services/ComplaintService';

const SUPPORT_CATEGORIES = ["Payment", "Booking", "Account", "Other"];

const ProviderSupportPage = () => {
  const { token, user, isAuthenticated, API, API_URL_IMAGE, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openNewComplaint, setOpenNewComplaint] = useState(false);
  const [openComplaintDetail, setOpenComplaintDetail] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [activeTab, setActiveTab] = useState('tickets'); // tickets, chat, faqs

  const [formData, setFormData] = useState({
    bookingId: '', title: '', description: '', category: '', images: [], previewImages: []
  });
  const [formErrors, setFormErrors] = useState({ bookingId: '', title: '', description: '', category: '' });

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
    try {
      const fd = new FormData();
      fd.append('bookingId', formData.bookingId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('category', formData.category);
      formData.images.forEach(img => fd.append('images', img));

      await submitComplaintAPI(fd);
      toast.success('Support ticket submitted successfully!');
      setOpenNewComplaint(false);
      resetForm();
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit ticket');
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
      toast.error('Failed to fetch ticket details');
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

  const FAQS = [
    { q: "How to accept booking?", a: "Go to Booking Requests and click Accept." },
    { q: "How payout works?", a: "Payouts are processed weekly to your linked bank account." },
    { q: "How to update availability?", a: "You can update your working hours in Profile Settings." },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-poppins font-bold text-secondary">Support & Help</h1>
              <p className="text-xs text-gray-400">Partner Assistance Center</p>
            </div>
          </div>
          <button
            onClick={() => setOpenNewComplaint(true)}
            className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + Open Ticket
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <FileText className="h-5 w-5 text-primary" />, label: 'FAQs', sub: 'Guidelines', action: () => setActiveTab('faqs') },
            { icon: <MessageSquare className="h-5 w-5 text-accent" />, label: 'New Ticket', sub: 'Raise issue', action: () => setOpenNewComplaint(true) },
            { icon: <Headphones className="h-5 w-5 text-green-600" />, label: 'Chat', sub: 'Admin Help', action: () => setActiveTab('chat') },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className={`bg-white rounded-xl border border-gray-100 p-3 flex flex-col items-center text-center gap-1.5 hover:shadow-md transition-all active:scale-95 ${activeTab === item.label.toLowerCase() ? 'border-primary ring-1 ring-primary/20' : ''}`}
            >
              <div className="bg-gray-50 rounded-full p-2">{item.icon}</div>
              <span className="text-xs font-semibold text-secondary">{item.label}</span>
              <span className="text-[10px] text-gray-400">{item.sub}</span>
            </button>
          ))}
        </div>

        {activeTab === 'tickets' && (
          <div className="space-y-5">
            {/* My Tickets Section */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-semibold text-secondary">My Support History</h2>
                  <p className="text-xs text-gray-400">{complaints.length} tickets raised</p>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                  <p className="text-xs text-gray-400">Loading tickets...</p>
                </div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-secondary mb-1">No support tickets</p>
                  <p className="text-xs text-gray-400 mb-4">Need help with something?</p>
                  <button onClick={() => setOpenNewComplaint(true)} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium">
                    + Open Support Ticket
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {complaints.map((complaint) => {
                    const s = getStatusStyle(complaint.status);
                    return (
                      <div key={complaint._id}
                        onClick={() => viewComplaintDetails(complaint._id)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-secondary">{complaint.title}</p>
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
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-secondary">FAQs & Guidelines</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {FAQS.map((faq, idx) => (
                  <details key={idx} className="group">
                    <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                      <span className="text-sm font-medium text-secondary pr-4">{faq.q}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
            <button onClick={() => setActiveTab('tickets')} className="w-full text-center text-primary text-xs font-semibold py-2">View My Tickets</button>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-secondary">Admin Chat Support</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mt-1">Chat directly with our support team for any quick assistance.</p>
            </div>
            <button
              onClick={() => toast.info('Real-time chat is being initialized...')}
              className="bg-secondary text-white px-8 py-2.5 rounded-xl text-sm font-medium"
            >
              Start Conversation
            </button>
            <button onClick={() => setActiveTab('tickets')} className="block w-full text-primary text-xs font-semibold py-2">Go Back</button>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {openNewComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto" onClick={() => { setOpenNewComplaint(false); resetForm(); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-bold text-secondary">Raise Support Ticket</h3>
                <p className="text-xs text-gray-400">Response within 24 hours</p>
              </div>
              <button onClick={() => { setOpenNewComplaint(false); resetForm(); }} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Issue Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORT_CATEGORIES.map(cat => (
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
              {formData.category === 'Booking' && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">Related Booking (Optional)</label>
                  <select name="bookingId" value={formData.bookingId} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20">
                    <option value="">Select a booking</option>
                    {bookings.map(b => (
                      <option key={b._id} value={b._id}>{b.services?.[0]?.service?.title || 'Service'} - {formatDate(b.date)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Subject *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g., Payment delayed, App error" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20" />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Description *</label>
                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder="Please provide details about your issue" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 resize-none" />
                {formErrors.description && <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>}
              </div>

              {/* Images */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">Attachments (Optional)</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-primary/50">
                  <Upload className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Upload screenshot</span>
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

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => { setOpenNewComplaint(false); resetForm(); }} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSubmitTicket}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90"
              >
                Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {openComplaintDetail && selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={() => setOpenComplaintDetail(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-secondary">Ticket Details</h3>
                <p className="text-xs text-gray-400">#{selectedComplaint.complaintId || selectedComplaint._id.slice(-8)}</p>
              </div>
              <button onClick={() => setOpenComplaintDetail(false)} className="p-1.5 hover:bg-gray-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              <div className={`p-4 rounded-xl ${getStatusStyle(selectedComplaint.status).bg} border ${getStatusStyle(selectedComplaint.status).border}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <span className={`text-sm font-semibold ${getStatusStyle(selectedComplaint.status).text}`}>{selectedComplaint.status}</span>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Subject</h4>
                <p className="text-sm font-bold text-secondary">{selectedComplaint.title}</p>
                <h4 className="text-xs font-semibold text-gray-400 mt-4 mb-2">Description</h4>
                <p className="text-sm text-gray-600">{selectedComplaint.description}</p>
              </div>
              {selectedComplaint.images?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-300 mb-2">Attachments</h4>
                  <div className="flex gap-2 overflow-x-auto">
                    {selectedComplaint.images.map((img, idx) => (
                      <img key={idx} src={img} className="w-20 h-20 object-cover rounded-lg border" alt="" />
                    ))}
                  </div>
                </div>
              )}
              {selectedComplaint.resolutionNotes && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-600 mb-1">Admin Response</h4>
                  <p className="text-sm text-blue-700">{selectedComplaint.resolutionNotes}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={() => setOpenComplaintDetail(false)} className="w-full py-2 border rounded-lg text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderSupportPage;
