import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { Plus, Edit, Trash2, Search, Check, RotateCcw, AlertCircle, Calendar, Wrench, Clock, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminComplaints = () => {
  const { API, isAdmin, logoutUser, showToast } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      logoutUser();
      return;
    }
    fetchComplaints();
  }, [isAdmin]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/complaint/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setComplaints(data.complaints);
      } else {
        showToast(data.message || 'Failed to fetch complaints', 'error');
      }
    } catch (error) {
      showToast('Error fetching complaints', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveComplaint = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/complaint/${selectedComplaint._id}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response: responseText })
      });

      const data = await response.json();
      if (data.success) {
        showToast('Complaint resolved successfully');
        setIsResolveModalOpen(false);
        setResponseText('');
        fetchComplaints();
      } else {
        showToast(data.message || 'Failed to resolve complaint', 'error');
      }
    } catch (error) {
      showToast('Error resolving complaint', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReopenComplaint = async (complaint) => {
    if (!window.confirm('Are you sure you want to reopen this complaint?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API}/complaint/complaints/${complaint._id}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        showToast('Complaint reopened successfully');
        fetchComplaints();
      } else {
        showToast(data.message || 'Failed to reopen complaint', 'error');
      }
    } catch (error) {
      showToast('Error reopening complaint', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredComplaints = complaints.filter(complaint => {
    const searchStr = searchText.toLowerCase();
    return (
      complaint.customer?.name?.toLowerCase().includes(searchStr) ||
      complaint.provider?.name?.toLowerCase().includes(searchStr) ||
      complaint.message?.toLowerCase().includes(searchStr) ||
      complaint._id.toLowerCase().includes(searchStr) ||
      (complaint.booking?.serviceType?.toLowerCase().includes(searchStr)) ||
      (complaint.booking?._id.toLowerCase().includes(searchStr))
    );
  });

  const getStatusBadge = (status) => {
    if (status === 'open') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="mr-1" size={12} />
          Open
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Check className="mr-1" size={12} />
        Resolved
      </span>
    );
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatBookingDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="min-h-screen bg-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">Complaints Management</h1>
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search complaints..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        {/* Complaints Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading && complaints.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading complaints...</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No complaints found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell">Provider</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Complaint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell">Booking</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredComplaints.map((complaint) => (
                    <tr key={complaint._id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{complaint.customer?.name}</div>
                            <div className="text-sm text-gray-500">{complaint.customer?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <div className="text-sm text-gray-900 font-medium">{complaint.provider?.name}</div>
                        <div className="text-sm text-gray-500">{complaint.provider?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 line-clamp-2">{complaint.message}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <button
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setIsBookingModalOpen(true);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Booking Details
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(complaint.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {complaint.status === 'open' ? (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setIsResolveModalOpen(true);
                              }}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Check className="mr-1" size={14} />
                              Resolve
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleReopenComplaint(complaint)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                              <RotateCcw className="mr-1" size={14} />
                              Reopen
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Complaint Modal */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsResolveModalOpen(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Resolve Complaint #{selectedComplaint?._id.substring(0, 8)}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Response</label>
                        <textarea
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="Enter your response to the complaint..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          required
                        />
                      </div>

                      <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Complaint Details</h4>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p><span className="font-medium">Customer:</span> {selectedComplaint?.customer?.name}</p>
                          <p><span className="font-medium">Provider:</span> {selectedComplaint?.provider?.name}</p>
                          <p><span className="font-medium">Message:</span> {selectedComplaint?.message}</p>
                          {selectedComplaint?.imageProof && (
                            <div className="mt-2">
                              <img
                                src={selectedComplaint.imageProof}
                                alt="Complaint proof"
                                className="max-w-full h-auto max-h-40 rounded border border-gray-200"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Booking Details</h4>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p className="flex items-center">
                            <Wrench className="mr-2" size={14} />
                            <span className="font-medium">Service:</span> {selectedComplaint?.booking?.serviceType}
                          </p>
                          <p className="flex items-center">
                            <Calendar className="mr-2" size={14} />
                            <span className="font-medium">Date:</span> {formatBookingDate(selectedComplaint?.booking?.date)}
                          </p>
                          <p className="flex items-center">
                            <Clock className="mr-2" size={14} />
                            <span className="font-medium">Time Slot:</span> {selectedComplaint?.booking?.timeSlot}
                          </p>
                          <p className="flex items-center">
                            <DollarSign className="mr-2" size={14} />
                            <span className="font-medium">Amount:</span> ₹{selectedComplaint?.booking?.amount}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleResolveComplaint}
                  disabled={loading || !responseText.trim()}
                >
                  {loading ? 'Resolving...' : 'Submit Resolution'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setIsResolveModalOpen(false);
                    setResponseText('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsBookingModalOpen(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Booking Details for Complaint #{selectedComplaint?._id.substring(0, 8)}
                    </h3>

                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Booking Information</h4>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p className="flex items-center">
                            <Wrench className="mr-2" size={14} />
                            <span className="font-medium">Service Type:</span> {selectedComplaint?.booking?.service}
                          </p>
                          <p className="flex items-center">
                            <Calendar className="mr-2" size={14} />
                            <span className="font-medium">Booking Date:</span> {formatBookingDate(selectedComplaint?.booking?.date)}
                          </p>
                          <p className="flex items-center">
                            <Clock className="mr-2" size={14} />
                            <span className="font-medium">Time Slot:</span> {selectedComplaint?.booking?.timeSlot}
                          </p>
                          <p className="flex items-center">
                            <DollarSign className="mr-2" size={14} />
                            <span className="font-medium">Amount Paid:</span> ₹{selectedComplaint?.booking?.amount}
                          </p>
                          <p className="flex items-center">
                            <span className="font-medium">Booking Status:</span>
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${selectedComplaint?.booking?.status === 'completed' ? 'bg-green-100 text-green-800' :
                                selectedComplaint?.booking?.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                              }`}>
                              {selectedComplaint?.booking?.status}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Customer Details</h4>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p><span className="font-medium">Name:</span> {selectedComplaint?.customer?.name}</p>
                          <p><span className="font-medium">Email:</span> {selectedComplaint?.customer?.email}</p>
                          <p><span className="font-medium">Phone:</span> {selectedComplaint?.customer?.phone}</p>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Provider Details</h4>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p><span className="font-medium">Name:</span> {selectedComplaint?.provider?.name}</p>
                          <p><span className="font-medium">Email:</span> {selectedComplaint?.provider?.email}</p>
                          <p><span className="font-medium">Phone:</span> {selectedComplaint?.provider?.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setIsBookingModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaints;