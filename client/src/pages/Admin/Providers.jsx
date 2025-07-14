import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Star,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Award,
  AlertTriangle,
  User,
  FileText,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { useAuth } from '../../store/auth';

const AdminProvidersPage = () => {
  const { API } = useAuth();
  const [providers, setProviders] = useState([]);
  const [pendingProviders, setPendingProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resumeViewUrl, setResumeViewUrl] = useState(null);

  useEffect(() => {
    fetchProviders();
    fetchPendingProviders();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/admin/providers?page=${currentPage}&limit=10&search=${searchTerm}&status=${statusFilter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProviders(data.providers);
        setTotalPages(data.pages);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingProviders = async () => {
    try {
      const response = await fetch(`${API}/admin/providers/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setPendingProviders(data.providers);
      }
    } catch (error) {
      console.error('Error fetching pending providers:', error);
    }
  };

  const fetchProviderDetails = async (providerId) => {
    try {
      const response = await fetch(`${API}/admin/providers/${providerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSelectedProvider(data.data);
      }
    } catch (error) {
      console.error('Error fetching provider details:', error);
    }
  };

  const handleApproveProvider = async () => {
    try {
      const response = await fetch(`${API}/admin/providers/${selectedProvider.provider._id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: approvalAction,
          remarks: approvalRemarks
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowApprovalModal(false);
        setApprovalRemarks('');
        fetchProviders();
        fetchPendingProviders();
        alert(`Provider ${approvalAction} successfully!`);
      }
    } catch (error) {
      console.error('Error updating provider status:', error);
    }
  };

  const openApprovalModal = (action, provider) => {
    setSelectedProvider({ provider });
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const viewResume = async (providerId) => {
    try {
      const response = await fetch(`${API}/admin/providers/${providerId}/resume`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resume');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setResumeViewUrl(url);
    } catch (error) {
      console.error('Error viewing resume:', error);
      alert('Failed to view resume');
    }
  };

  const downloadResume = async (providerId) => {
    try {
      const response = await fetch(`${API}/admin/providers/${providerId}/resume`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download resume');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `resume_${providerId}.pdf`;

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger click
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading resume:', error);
      alert('Failed to download resume');
    }
  };

  const closeResumeViewer = () => {
    if (resumeViewUrl) {
      window.URL.revokeObjectURL(resumeViewUrl);
      setResumeViewUrl(null);
    }
  };

  const ProviderCard = ({ provider, isPending = false }) => (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{provider.name}</h3>
              <p className="text-gray-600 flex items-center">
                <Mail className="w-4 h-4 mr-1" />
                {provider.email}
              </p>
              <p className="text-gray-600 flex items-center">
                <Phone className="w-4 h-4 mr-1" />
                {provider.phone}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              provider.approved 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-400 text-yellow-900'
            }`}>
              {provider.approved ? 'Approved' : 'Pending'}
            </span>
            {provider.testPassed && (
              <span className="px-3 py-1 bg-blue-200 text-blue-900 rounded-full text-xs font-medium">
                Test Passed
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2" />
            {provider.serviceArea}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Award className="w-4 h-4 mr-2" />
            {provider.experience} years exp.
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            {new Date(provider.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <DollarSign className="w-4 h-4 mr-2" />
            ₹{provider.wallet || 0}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Services:</p>
          <p className="text-sm font-medium text-gray-800">{provider.services}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fetchProviderDetails(provider._id)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-900 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </button>
          
          {provider.resume && (
            <>
              <button
                onClick={() => viewResume(provider._id)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-800 transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Resume
              </button>
              <button
                onClick={() => downloadResume(provider._id)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-800 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </button>
            </>
          )}
          
          {isPending && (
            <>
              <button
                onClick={() => openApprovalModal('approved', provider)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-800 transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </button>
              <button
                onClick={() => openApprovalModal('rejected', provider)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-800 transition-colors"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const ProviderDetailsModal = () => {
    if (!selectedProvider) return null;

    const { provider, statistics } = selectedProvider;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Provider Details</h2>
              <button
                onClick={() => setSelectedProvider(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Basic Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="w-5 h-5 mr-3 text-blue-900" />
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{provider.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 mr-3 text-blue-900" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{provider.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-5 h-5 mr-3 text-blue-900" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{provider.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-3 text-blue-900" />
                    <div>
                      <p className="text-sm text-gray-600">Service Area</p>
                      <p className="font-medium">{provider.serviceArea}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">₹{statistics?.totalEarnings || 0}</p>
                    <p className="text-sm text-gray-600">Total Earnings</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{statistics?.completedJobs || 0}</p>
                    <p className="text-sm text-gray-600">Completed Jobs</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-2xl font-bold text-yellow-500">{statistics?.totalBookings || 0}</p>
                    <p className="text-sm text-gray-600">Total Bookings</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-2xl font-bold text-indigo-900">{statistics?.acceptanceRate || 0}%</p>
                    <p className="text-sm text-gray-600">Acceptance Rate</p>
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Professional Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Services</p>
                    <p className="font-medium">{provider.services}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Experience</p>
                    <p className="font-medium">{provider.experience} years</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Wallet Balance</p>
                    <p className="font-medium">₹{provider.wallet || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Commission Rate</p>
                    <p className="font-medium">{provider.commissionRate || 'Not set'}%</p>
                  </div>
                </div>
              </div>

              {/* Status Information */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Status Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Approval Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      provider.approved 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-400 text-yellow-900'
                    }`}>
                      {provider.approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Test Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      provider.testPassed 
                        ? 'bg-blue-200 text-blue-900' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {provider.testPassed ? 'Passed' : 'Not Taken'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Account Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      provider.isDeleted 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {provider.isDeleted ? 'Deleted' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resume Section */}
            {provider.resume && (
              <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Resume</h3>
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-900" />
                  <button
                    onClick={() => viewResume(provider._id)}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-800 transition-colors"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    View Resume
                  </button>
                  <button
                    onClick={() => downloadResume(provider._id)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-800 transition-colors"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!provider.approved && (
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => openApprovalModal('approved', provider)}
                  className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-800 transition-colors"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Approve Provider
                </button>
                <button
                  onClick={() => openApprovalModal('rejected', provider)}
                  className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-800 transition-colors"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject Provider
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ResumeViewerModal = () => {
    if (!resumeViewUrl) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">Resume Viewer</h3>
            <button
              onClick={closeResumeViewer}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1">
            <iframe 
              src={resumeViewUrl} 
              className="w-full h-full"
              title="Resume Viewer"
            />
          </div>
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = resumeViewUrl;
                a.download = 'resume.pdf';
                a.click();
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              Download
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ApprovalModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {approvalAction === 'approved' ? 'Approve' : 'Reject'} Provider
          </h3>
          <p className="text-gray-600 mb-4">
            Are you sure you want to {approvalAction === 'approved' ? 'approve' : 'reject'} this provider?
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Add any remarks..."
            />
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleApproveProvider}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                approvalAction === 'approved' 
                  ? 'bg-green-600 hover:bg-green-800' 
                  : 'bg-red-600 hover:bg-red-800'
              }`}
            >
              {approvalAction === 'approved' ? 'Approve' : 'Reject'}
            </button>
            <button
              onClick={() => setShowApprovalModal(false)}
              className="flex-1 py-3 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const Pagination = () => (
    <div className="flex items-center justify-between mt-8">
      <div className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="flex items-center px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </button>
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Provider Management</h1>
          <p className="text-gray-600">Manage service providers and their applications</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Providers</p>
                <p className="text-2xl font-bold text-blue-600">{providers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-500">{pendingProviders.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{providers.filter(p => p.approved).length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Test Passed</p>
                <p className="text-2xl font-bold text-indigo-900">{providers.filter(p => p.testPassed).length}</p>
              </div>
              <Award className="w-8 h-8 text-indigo-900" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'all' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              All Providers
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'pending' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Pending Approval ({pendingProviders.length})
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'all' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {providers.map(provider => (
                  <ProviderCard key={provider._id} provider={provider} />
                ))}
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {pendingProviders.map(provider => (
                  <ProviderCard key={provider._id} provider={provider} isPending={true} />
                ))}
              </div>
            )}

            {activeTab === 'all' && <Pagination />}
          </>
        )}

        {/* Modals */}
        {selectedProvider && <ProviderDetailsModal />}
        {showApprovalModal && <ApprovalModal />}
        {resumeViewUrl && <ResumeViewerModal />}
      </div>
    </div>
  );
};

export default AdminProvidersPage;