import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { 
  Receipt, 
  Download, 
  Edit, 
  Save, 
  X, 
  Search, 
  Filter,
  FileText,
  User,
  Building,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Plus,
  RefreshCw,
  Package,
  CreditCard,
  Trash2,
  Upload,
  QrCode,
  Banknote,
  Smartphone,
  Hash,
  ShoppingCart
} from 'lucide-react';

const AdminInvoice = () => {
  const { token, API, logoutUser, showToast } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [createProductInvoiceModalOpen, setCreateProductInvoiceModalOpen] = useState(false);
  const [paymentDetailsModalOpen, setPaymentDetailsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalAmount, setTotalAmount] = useState(0);
  const [activeTab, setActiveTab] = useState('service');
  
  // Product Invoice Form State
  const [productInvoiceForm, setProductInvoiceForm] = useState({
    customer: '',
    provider: '',
    products: [{ name: '', quantity: 1, rate: 0 }],
    tax: 0,
    discount: 0,
    notes: ''
  });
  
  // Payment Details Form State
  const [paymentDetailsForm, setPaymentDetailsForm] = useState({
    upiId: '',
    bankAccountNo: '',
    ifscCode: '',
    accountHolderName: '',
    qrCodeFile: null
  });
  
  // Customers and Providers for dropdowns
  const [customers, setCustomers] = useState([]);
  const [providers, setProviders] = useState([]);

  // Fetch all invoices
  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchProviders();
  }, []);

  // Filter and search invoices
  useEffect(() => {
    let filtered = [...invoices];
    
    // Apply tab filter
    if (activeTab === 'service') {
      filtered = filtered.filter(invoice => 
        !invoice.productsUsed || invoice.productsUsed.length === 0
      );
    } else if (activeTab === 'product') {
      filtered = filtered.filter(invoice => 
        invoice.productsUsed && invoice.productsUsed.length > 0
      );
    } else if (activeTab === 'pending') {
      filtered = filtered.filter(invoice => 
        invoice.paymentStatus === 'pending' && 
        invoice.productsUsed && 
        invoice.productsUsed.length > 0
      );
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.provider?.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.service?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.booking?._id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.paymentStatus === statusFilter);
    }
    
    setFilteredInvoices(filtered);
    
    // Calculate total amount
    const total = filtered.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    setTotalAmount(total);
  }, [invoices, searchTerm, statusFilter, activeTab]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/invoice/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
        }
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.data || []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch(`${API}/admin/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const handleEditClick = (invoice) => {
    setSelectedInvoice(invoice);
    setEditForm({
      serviceAmount: invoice.serviceAmount,
      tax: invoice.tax,
      discount: invoice.discount,
      notes: invoice.notes || ''
    });
    setEditModalOpen(true);
  };

  const handleViewClick = (invoice) => {
    setSelectedInvoice(invoice);
    setViewModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${API}/invoice/${selectedInvoice._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update invoice');
      }
      
      const updatedInvoice = await response.json();
      
      setInvoices(prev => prev.map(inv => 
        inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
      ));
      
      showToast('Invoice updated successfully!', 'success');
      setEditModalOpen(false);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDownload = async (invoiceId) => {
    try {
      window.open(`${API}/invoice/customer/${invoiceId}/download`, '_blank');
    } catch (error) {
      showToast('Failed to download invoice', 'error');
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API}/invoice/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete invoice');
      }

      setInvoices(prev => prev.filter(inv => inv._id !== invoiceId));
      showToast('Invoice deleted successfully!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'partially_paid':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'partially_paid':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Header */}
        <div className="relative mb-8">
          <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-600/30 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl shadow-lg">
                  <Receipt className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Invoice Management
                  </h1>
                  <p className="text-gray-300 text-lg">Manage and track all invoices</p>
                </div>
              </div>
              <button
                onClick={fetchInvoices}
                disabled={loading}
                className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl hover:from-emerald-400 hover:to-teal-400 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Invoices</p>
                <p className="text-2xl font-bold text-white">{filteredInvoices.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-white">₹{totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Paid Invoices</p>
                <p className="text-2xl font-bold text-white">
                  {invoices.filter(inv => inv.paymentStatus === 'paid').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Pending Invoices</p>
                <p className="text-2xl font-bold text-white">
                  {invoices.filter(inv => inv.paymentStatus === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 p-6 mb-8">
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTab('service')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'service'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Service Invoices</span>
            </button>
            <button
              onClick={() => setActiveTab('product')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'product'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Product Invoices</span>
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'pending'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending Payment</span>
            </button>
            {activeTab === 'product' && (
              <button
                onClick={() => setCreateProductInvoiceModalOpen(true)}
                className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 transition-all duration-200 flex items-center space-x-2 ml-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Product Invoice</span>
              </button>
            )}
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by invoice number, customer, provider, service, or booking ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="partially_paid">Partially Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500 border-t-transparent"></div>
            </div>
          ) : currentInvoices.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No invoices found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50 border-b border-slate-600/30">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Invoice #</th>
                      {activeTab === 'service' && (
                        <>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Service Name</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Booking ID</th>
                        </>
                      )}
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Customer</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Provider</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Amount</th>
                      {activeTab === 'service' && (
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Payment Method</th>
                      )}
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-600/30">
                    {currentInvoices.map((invoice, index) => (
                      <tr key={invoice._id} className="hover:bg-slate-700/30 transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Receipt className="w-4 h-4 text-blue-400 mr-2" />
                            <span className="font-medium text-white">{invoice.invoiceNo}</span>
                          </div>
                        </td>
                        {activeTab === 'service' && (
                          <>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <Package className="w-4 h-4 text-gray-400 mr-2" />
                                <span className="text-gray-300">{invoice.service?.title || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <Hash className="w-4 h-4 text-gray-400 mr-2" />
                                <span className="text-gray-300 font-mono text-sm">
                                  {invoice.booking?._id?.slice(-8) || 'N/A'}
                                </span>
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-300">{invoice.customer?.name || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Building className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-300">{invoice.provider?.businessName || invoice.provider?.name || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-emerald-400">
                            ₹{invoice.totalAmount.toLocaleString()}
                          </span>
                        </td>
                        {activeTab === 'service' && (
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {invoice.paymentDetails && invoice.paymentDetails.length > 0 ? (
                                <>
                                  {invoice.paymentDetails[0].method === 'online' ? (
                                    <CreditCard className="w-4 h-4 text-blue-400 mr-2" />
                                  ) : invoice.paymentDetails[0].method === 'upi' ? (
                                    <Smartphone className="w-4 h-4 text-green-400 mr-2" />
                                  ) : (
                                    <Banknote className="w-4 h-4 text-yellow-400 mr-2" />
                                  )}
                                  <span className="text-gray-300 capitalize">
                                    {invoice.paymentDetails[0].method}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(invoice.paymentStatus)}`}>
                            {getStatusIcon(invoice.paymentStatus)}
                            <span className="ml-2 capitalize">
                              {invoice.paymentStatus.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-300">{formatDate(invoice.generatedAt)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewClick(invoice)}
                              className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors duration-200"
                              title="View Invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(activeTab === 'pending' || (activeTab === 'product' && invoice.paymentStatus === 'pending')) && (
                              <button
                                onClick={() => handleEditClick(invoice)}
                                className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors duration-200"
                                title="Edit Invoice"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {(activeTab === 'pending' || (activeTab === 'product' && invoice.paymentStatus === 'pending')) && (
                              <button
                                onClick={() => handleDeleteInvoice(invoice._id)}
                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors duration-200"
                                title="Delete Invoice"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(invoice._id)}
                              className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors duration-200"
                              title="Download Invoice"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-600/30 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredInvoices.length)} of {filteredInvoices.length} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg ${
                          currentPage === page
                            ? 'bg-purple-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 w-full max-w-md">
              <div className="p-6 border-b border-slate-600/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Edit Invoice</h3>
                  <button
                    onClick={() => setEditModalOpen(false)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Service Amount
                  </label>
                  <input
                    type="number"
                    name="serviceAmount"
                    value={editForm.serviceAmount}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tax
                  </label>
                  <input
                    type="number"
                    name="tax"
                    value={editForm.tax}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Discount
                  </label>
                  <input
                    type="number"
                    name="discount"
                    value={editForm.discount}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={editForm.notes}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-600/30 flex justify-end space-x-3">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-400 hover:to-pink-400 transition-all duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {viewModalOpen && selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/30 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-600/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Invoice Details</h3>
                  <button
                    onClick={() => setViewModalOpen(false)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Invoice Number</label>
                    <p className="text-white font-semibold">{selectedInvoice.invoiceNo}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                    <p className="text-white">{formatDate(selectedInvoice.generatedAt)}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Customer</label>
                    <p className="text-white">{selectedInvoice.customer?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Provider</label>
                    <p className="text-white">{selectedInvoice.provider?.businessName || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Service</label>
                    <p className="text-white">{selectedInvoice.service?.title || 'N/A'}</p>
                  </div>
                  {selectedInvoice.booking && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Booking ID</label>
                      <p className="text-white font-mono text-sm">{selectedInvoice.booking._id?.slice(-8) || 'N/A'}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Service Amount</label>
                    <p className="text-emerald-400 font-semibold">₹{selectedInvoice.serviceAmount}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tax</label>
                    <p className="text-white">₹{selectedInvoice.tax}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Discount</label>
                    <p className="text-white">₹{selectedInvoice.discount}</p>
                  </div>
                </div>

                {/* Products Section for Product Invoices */}
                {selectedInvoice.productsUsed && selectedInvoice.productsUsed.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Products Used</label>
                    <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
                      {selectedInvoice.productsUsed.map((product, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-slate-600/30 last:border-b-0">
                          <div>
                            <p className="text-white font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-gray-400 text-sm">{product.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-white">
                              {product.quantity} × ₹{product.rate} = ₹{product.total}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Details Section for Service Invoices */}
                {selectedInvoice.paymentDetails && selectedInvoice.paymentDetails.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Payment Details</label>
                    <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
                      {selectedInvoice.paymentDetails.map((payment, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {payment.method === 'online' ? (
                                <CreditCard className="w-4 h-4 text-blue-400" />
                              ) : payment.method === 'upi' ? (
                                <Smartphone className="w-4 h-4 text-green-400" />
                              ) : (
                                <Banknote className="w-4 h-4 text-yellow-400" />
                              )}
                              <span className="text-white capitalize">{payment.method}</span>
                            </div>
                            <span className="text-emerald-400 font-semibold">₹{payment.amount}</span>
                          </div>
                          
                          {payment.method === 'online' && payment.transactionId && (
                            <div className="pl-6 space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-400 text-sm">Transaction ID:</span>
                                <span className="text-white text-sm font-mono">{payment.transactionId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400 text-sm">Date:</span>
                                <span className="text-white text-sm">{formatDate(payment.date)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400 text-sm">Status:</span>
                                <span className={`text-sm capitalize ${
                                  payment.status === 'success' ? 'text-emerald-400' : 
                                  payment.status === 'pending' ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {payment.status}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-600/30 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-300">Total Amount:</span>
                    <span className="text-2xl font-bold text-emerald-400">₹{selectedInvoice.totalAmount}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Payment Status</label>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedInvoice.paymentStatus)}`}>
                    {getStatusIcon(selectedInvoice.paymentStatus)}
                    <span className="ml-2 capitalize">
                      {selectedInvoice.paymentStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {selectedInvoice.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
                    <p className="text-white">{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-600/30 flex justify-end">
                <button
                  onClick={() => handleDownload(selectedInvoice._id)}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInvoice;