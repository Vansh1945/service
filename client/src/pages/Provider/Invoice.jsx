import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Eye,
  Plus,
  Trash2,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Package,
  DollarSign,
  Save,
  X,
  Search,
  Filter,
  Loader2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Edit,
  Check,
  AlertCircle,
  CreditCard,
  Smartphone,
  Building,
  QrCode,
  Upload,
  Receipt,
  ShoppingCart
} from 'lucide-react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import logo from '../../assets/logo.png';

const ProviderInvoiceSystem = () => {
  const { token, API, user } = useAuth();
  const [activeTab, setActiveTab] = useState('service');
  const [serviceInvoices, setServiceInvoices] = useState([]);
  const [productInvoices, setProductInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [productToAdd, setProductToAdd] = useState({
    name: '',
    description: '',
    quantity: 1,
    rate: 0,
    unit: 'piece'
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const invoicesPerPage = 5;
  const invoiceRef = useRef();

  // Product Invoice Creation Form
  const [productInvoiceForm, setProductInvoiceForm] = useState({
    customerId: '',
    products: [{ name: '', description: '', quantity: 1, rate: 0 }],
    tax: 0,
    discount: 0,
    notes: ''
  });

  // Payment Details Form
  const [paymentDetailsForm, setPaymentDetailsForm] = useState({
    upiId: '',
    qrCodeImage: null,
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      accountHolderName: '',
      bankName: ''
    }
  });

  // Fetch invoices from backend
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        
        // Fetch service invoices
        const serviceResponse = await fetch(`${API}/invoice/provider/service`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Fetch product invoices
        const productResponse = await fetch(`${API}/invoice/provider/product`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!serviceResponse.ok || !productResponse.ok) {
          throw new Error('Failed to fetch invoices');
        }

        const serviceData = await serviceResponse.json();
        const productData = await productResponse.json();
        
        setServiceInvoices(serviceData.data || []);
        setProductInvoices(productData.data || []);
      } catch (error) {
        toast.error(error.message);
        console.error('Error fetching invoices:', error);
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
        console.error('Error fetching customers:', error);
      }
    };

    if (token) {
      fetchInvoices();
      fetchCustomers();
    }
  }, [token, API]);

  // Get current invoices based on active tab
  const getCurrentInvoices = () => {
    const invoices = activeTab === 'service' ? serviceInvoices : productInvoices;
    
    const filtered = invoices.filter(invoice => {
      const matchesSearch =
        invoice.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activeTab === 'service' && invoice.service?.title?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = filterStatus === 'all' || invoice.paymentStatus === filterStatus;
      return matchesSearch && matchesFilter;
    });

    return filtered;
  };

  const filteredInvoices = getCurrentInvoices();
  
  // Pagination logic
  const indexOfLastInvoice = currentPage * invoicesPerPage;
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice);
  const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);

  const fetchInvoiceDetails = async (invoiceId) => {
    try {
      const response = await fetch(`${API}/invoice/provider/${invoiceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoice details');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const addProductToInvoice = async () => {
    if (!productToAdd.name || productToAdd.rate <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const endpoint = editingProductId 
        ? `${API}/invoice/${selectedInvoice._id}/products/${editingProductId}`
        : `${API}/invoice/${selectedInvoice._id}/products`;

      const method = editingProductId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productToAdd.name,
          description: productToAdd.description,
          quantity: productToAdd.quantity,
          rate: productToAdd.rate,
          unit: productToAdd.unit
        })
      });

      if (!response.ok) {
        throw new Error(editingProductId ? 'Failed to update product' : 'Failed to add product');
      }

      const updatedInvoice = await response.json();
      setSelectedInvoice(updatedInvoice.data);
      
      // Update the correct invoice list
      if (activeTab === 'service') {
        setServiceInvoices(prev => prev.map(inv =>
          inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
        ));
      } else {
        setProductInvoices(prev => prev.map(inv =>
          inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
        ));
      }

      toast.success(editingProductId ? 'Product updated successfully' : 'Product added successfully');
      setProductToAdd({ name: '', description: '', quantity: 1, rate: 0, unit: 'piece' });
      setEditingProductId(null);
      setShowProductModal(false);
    } catch (error) {
      toast.error(error.message);
      console.error('Error adding/updating product:', error);
    }
  };

  const removeProduct = async (productId) => {
    try {
      const response = await fetch(
        `${API}/invoice/${selectedInvoice._id}/products/${productId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove product');
      }

      const updatedInvoice = await response.json();
      setSelectedInvoice(updatedInvoice.data);
      
      // Update the correct invoice list
      if (activeTab === 'service') {
        setServiceInvoices(prev => prev.map(inv =>
          inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
        ));
      } else {
        setProductInvoices(prev => prev.map(inv =>
          inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
        ));
      }

      toast.success('Product removed successfully');
    } catch (error) {
      toast.error(error.message);
      console.error('Error removing product:', error);
    }
  };

  const downloadInvoice = async (invoiceId) => {
    try {
      const response = await fetch(`${API}/invoice/customer/${invoiceId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Invoice downloaded successfully');
    } catch (error) {
      toast.error(error.message);
      console.error('Error downloading invoice:', error);
    }
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${selectedInvoice.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .invoice-container { max-width: 800px; margin: 0 auto; background: #fff; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .logo { height: 60px; }
            h1 { color: #4f46e5; margin: 0; }
            .section { margin-bottom: 30px; }
            .section-title { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f3f4f6; text-align: left; padding: 10px; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row { font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            ${invoiceRef.current.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 100);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const openInvoiceModal = async (invoice) => {
    try {
      const invoiceData = await fetchInvoiceDetails(invoice._id);
      setSelectedInvoice(invoiceData.data);
      setShowInvoiceModal(true);
    } catch (error) {
      toast.error(error.message);
      console.error('Error fetching invoice details:', error);
    }
  };

  const editProduct = (product) => {
    setProductToAdd({
      name: product.name,
      description: product.description || '',
      quantity: product.quantity,
      rate: product.rate,
      unit: product.unit || 'piece'
    });
    setEditingProductId(product._id);
    setShowProductModal(true);
  };

  const createProductInvoice = async () => {
    try {
      // Validate form
      if (!productInvoiceForm.customerId || productInvoiceForm.products.some(p => !p.name || p.rate <= 0)) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API}/invoice/provider/product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: productInvoiceForm.customerId,
          products: productInvoiceForm.products,
          tax: productInvoiceForm.tax,
          discount: productInvoiceForm.discount,
          notes: productInvoiceForm.notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create product invoice');
      }

      const newInvoice = await response.json();
      setProductInvoices(prev => [newInvoice.data, ...prev]);
      setProductInvoiceForm({
        customerId: '',
        products: [{ name: '', description: '', quantity: 1, rate: 0 }],
        tax: 0,
        discount: 0,
        notes: ''
      });
      toast.success('Product invoice created successfully');
    } catch (error) {
      toast.error(error.message);
      console.error('Error creating product invoice:', error);
    }
  };

  const updateProductInvoice = async (invoiceId) => {
    try {
      const response = await fetch(`${API}/invoice/provider/product/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productInvoiceForm)
      });

      if (!response.ok) {
        throw new Error('Failed to update product invoice');
      }

      const updatedInvoice = await response.json();
      setProductInvoices(prev => prev.map(inv => 
        inv._id === invoiceId ? updatedInvoice.data : inv
      ));
      toast.success('Product invoice updated successfully');
    } catch (error) {
      toast.error(error.message);
      console.error('Error updating product invoice:', error);
    }
  };

  const deleteProductInvoice = async (invoiceId) => {
    try {
      const response = await fetch(`${API}/invoice/provider/product/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete product invoice');
      }

      setProductInvoices(prev => prev.filter(inv => inv._id !== invoiceId));
      toast.success('Product invoice deleted successfully');
    } catch (error) {
      toast.error(error.message);
      console.error('Error deleting product invoice:', error);
    }
  };

  const confirmCashPayment = async (invoiceId) => {
    try {
      const response = await fetch(`${API}/invoice/provider/${invoiceId}/confirm-cash`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to confirm cash payment');
      }

      const updatedInvoice = await response.json();
      
      // Update the correct invoice list
      if (activeTab === 'service') {
        setServiceInvoices(prev => prev.map(inv =>
          inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
        ));
      } else {
        setProductInvoices(prev => prev.map(inv =>
          inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
        ));
      }

      if (selectedInvoice?._id === invoiceId) {
        setSelectedInvoice(updatedInvoice.data);
      }

      toast.success('Cash payment confirmed successfully');
    } catch (error) {
      toast.error(error.message);
      console.error('Error confirming cash payment:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'partially_paid': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const calculateSubtotal = (invoice) => {
    return (invoice.serviceAmount || 0) + 
      (invoice.productsUsed?.reduce((sum, p) => sum + (p.total || p.quantity * p.rate), 0) || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Invoice Management</h1>
          <p className="text-gray-600">View, manage and download your invoices</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTab('service')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'service'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Product Invoices</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by customer name, invoice ID, or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          {currentInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-500">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {currentInvoices.map(invoice => (
                <div key={invoice._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-semibold text-gray-900">{invoice.invoiceNo}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.paymentStatus)}`}>
                          {invoice.paymentStatus?.charAt(0).toUpperCase() + invoice.paymentStatus?.slice(1).replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                        <div className="flex items-center text-gray-600">
                          <User className="w-4 h-4 mr-2 text-indigo-600" />
                          <div>
                            <p className="text-sm text-gray-500">Customer</p>
                            <p className="font-medium">{invoice.customer?.name || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-2 text-indigo-600" />
                          <div>
                            <p className="text-sm text-gray-500">Date</p>
                            <p className="font-medium">{formatDate(invoice.generatedAt)}</p>
                          </div>
                        </div>
                        {activeTab === 'service' && (
                          <div className="flex items-center text-gray-600">
                            <FileText className="w-4 h-4 mr-2 text-indigo-600" />
                            <div>
                              <p className="text-sm text-gray-500">Service</p>
                              <p className="font-medium">{invoice.service?.title || 'N/A'}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center text-green-600">
                          <DollarSign className="w-4 h-4 mr-2" />
                          <div>
                            <p className="text-sm text-gray-500">Total</p>
                            <p className="font-bold">₹{invoice.totalAmount?.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => openInvoiceModal(invoice)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </button>
                      <button
                        onClick={() => downloadInvoice(invoice._id)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredInvoices.length > invoicesPerPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-4xl my-8 border border-gray-300">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Invoice Details</h3>
              <div className="flex space-x-2">
                {activeTab === 'product' && (
                  <button
                    onClick={() => {
                      setProductToAdd({ name: '', description: '', quantity: 1, rate: 0, unit: 'piece' });
                      setEditingProductId(null);
                      setShowProductModal(true);
                    }}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </button>
                )}
                <button
                  onClick={() => downloadInvoice(selectedInvoice._id)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={printInvoice}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Invoice Content */}
            <div ref={invoiceRef} className="p-8">
              {/* Invoice Header */}
              <div className="flex flex-col md:flex-row justify-between items-start mb-8">
                <div className="mb-6 md:mb-0">
                  <img src={logo} alt="Company Logo" className="h-12 mb-4" />
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">INVOICE</h1>
                  <p className="text-gray-600">Invoice #: {selectedInvoice.invoiceNo}</p>
                  <p className="text-gray-600">Date: {formatDate(selectedInvoice.generatedAt)}</p>
                  <p className="text-gray-600">Due Date: {formatDate(selectedInvoice.dueDate)}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-900">{user.businessName || user.name}</h2>
                  <p className="text-gray-600">{user.address}</p>
                  <p className="text-gray-600">
                    <Phone className="inline w-4 h-4 mr-1" />
                    {user.phone}
                  </p>
                  <p className="text-gray-600">
                    <Mail className="inline w-4 h-4 mr-1" />
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Customer and Service Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="w-5 h-5 mr-2 text-indigo-600" />
                    Bill To:
                  </h3>
                  <p className="font-medium text-gray-900">{selectedInvoice.customer?.name}</p>
                  <p className="text-gray-600">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    {selectedInvoice.customer?.address}
                  </p>
                  <p className="text-gray-600">
                    <Phone className="inline w-4 h-4 mr-1" />
                    {selectedInvoice.customer?.phone}
                  </p>
                  <p className="text-gray-600">
                    <Mail className="inline w-4 h-4 mr-1" />
                    {selectedInvoice.customer?.email}
                  </p>
                </div>

                {selectedInvoice.service && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-indigo-600" />
                      Service Details:
                    </h3>
                    <p className="font-medium text-gray-900">{selectedInvoice.service?.title}</p>
                    <p className="text-gray-600">Category: {selectedInvoice.service?.category}</p>
                    <p className="text-gray-600">
                      <Calendar className="inline w-4 h-4 mr-1" />
                      Booking Date: {formatDate(selectedInvoice.booking?.date)}
                    </p>
                    <p className="text-gray-600">
                      Duration: {selectedInvoice.service?.duration} minutes
                    </p>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="mb-8 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Description</th>
                      <th className="p-3 text-center text-sm font-semibold text-gray-700">Qty</th>
                      <th className="p-3 text-center text-sm font-semibold text-gray-700">Unit</th>
                      <th className="p-3 text-right text-sm font-semibold text-gray-700">Rate (₹)</th>
                      <th className="p-3 text-right text-sm font-semibold text-gray-700">Amount (₹)</th>
                      {activeTab === 'product' && (
                        <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {/* Service Row */}
                    {selectedInvoice.service && (
                      <tr>
                        <td className="p-3 text-gray-800 font-medium">
                          {selectedInvoice.service?.title}
                          <p className="text-sm text-gray-500">Service Fee</p>
                        </td>
                        <td className="p-3 text-center text-gray-600">1</td>
                        <td className="p-3 text-center text-gray-600">service</td>
                        <td className="p-3 text-right text-gray-600">₹{selectedInvoice.serviceAmount?.toFixed(2)}</td>
                        <td className="p-3 text-right text-gray-600">₹{selectedInvoice.serviceAmount?.toFixed(2)}</td>
                        {activeTab === 'product' && <td className="p-3 text-center">-</td>}
                      </tr>
                    )}

                    {/* Products Rows */}
                    {selectedInvoice.productsUsed?.map(product => (
                      <tr key={product._id}>
                        <td className="p-3 text-gray-800">
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-gray-500">{product.description}</p>
                          )}
                        </td>
                        <td className="p-3 text-center text-gray-600">{product.quantity}</td>
                        <td className="p-3 text-center text-gray-600">{product.unit || 'piece'}</td>
                        <td className="p-3 text-right text-gray-600">₹{product.rate?.toFixed(2)}</td>
                        <td className="p-3 text-right text-gray-600">₹{(product.quantity * product.rate).toFixed(2)}</td>
                        {activeTab === 'product' && (
                          <td className="p-3 text-center flex justify-center space-x-2">
                            <button
                              onClick={() => editProduct(product)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Edit product"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => removeProduct(product._id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Remove product"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-full md:w-1/2 lg:w-1/3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">
                      ₹{calculateSubtotal(selectedInvoice).toFixed(2)}
                    </span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-medium text-red-600">
                        -₹{selectedInvoice.discount?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {selectedInvoice.tax > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium">
                        ₹{selectedInvoice.tax?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-4 border-b border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-indigo-600">
                      ₹{selectedInvoice.totalAmount?.toFixed(2)}
                    </span>
                  </div>
                  {selectedInvoice.commission?.amount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">
                        Platform Commission ({selectedInvoice.commission.type === 'percentage' ? 
                        `${selectedInvoice.commission.value}%` : `₹${selectedInvoice.commission.value}`}):
                      </span>
                      <span className="font-medium text-red-600">
                        -₹{selectedInvoice.commission.amount?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-4 border-b border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Net Amount:</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{selectedInvoice.netAmount?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="font-medium text-green-600">
                      ₹{selectedInvoice.paymentDetails?.reduce((sum, p) =>
                        p.status === 'success' ? sum + (p.amount || 0) : sum, 0
                      )?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Amount Due:</span>
                    <span className={`font-bold ${
                      selectedInvoice.totalAmount - 
                      selectedInvoice.paymentDetails?.reduce((sum, p) =>
                        p.status === 'success' ? sum + (p.amount || 0) : sum, 0
                      ) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      ₹{Math.max(0,
                        selectedInvoice.totalAmount -
                        selectedInvoice.paymentDetails?.reduce((sum, p) =>
                          p.status === 'success' ? sum + (p.amount || 0) : sum, 0
                        )
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {selectedInvoice.paymentDetails?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                    Payment Details
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Date</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Method</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Transaction ID</th>
                          <th className="p-3 text-right text-sm font-semibold text-gray-700">Amount (₹)</th>
                          <th className="p-3 text-center text-sm font-semibold text-gray-700">Status</th>
                          {selectedInvoice.paymentStatus === 'pending' && (
                            <th className="p-3 text-center text-sm font-semibold text-gray-700">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedInvoice.paymentDetails.map((payment, index) => (
                          <tr key={index}>
                            <td className="p-3 text-gray-600">{formatDate(payment.date)}</td>
                            <td className="p-3 text-gray-600 capitalize">{payment.method}</td>
                            <td className="p-3 text-gray-600">{payment.transactionId || 'N/A'}</td>
                            <td className="p-3 text-right text-gray-600">₹{payment.amount?.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                payment.status === 'success' ? 'bg-green-100 text-green-800' :
                                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                              </span>
                            </td>
                            {selectedInvoice.paymentStatus === 'pending' && payment.method === 'cash' && payment.status === 'pending' && (
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => confirmCashPayment(selectedInvoice._id)}
                                  className="text-sm text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg transition-colors"
                                >
                                  Confirm
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">{selectedInvoice.notes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-gray-500 text-sm border-t border-gray-200 pt-6">
                <p>Thank you for your business!</p>
                <p className="mt-1">Please make payments to the account details provided separately.</p>
                <p className="mt-4 text-xs">This is a computer generated invoice and does not require a signature.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingProductId ? 'Edit Product' : 'Add Product/Material'}
              </h3>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProductId(null);
                  setProductToAdd({ name: '', description: '', quantity: 1, rate: 0, unit: 'piece' });
                }}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name*</label>
                <input
                  type="text"
                  value={productToAdd.name}
                  onChange={(e) => setProductToAdd({ ...productToAdd, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={productToAdd.description}
                  onChange={(e) => setProductToAdd({ ...productToAdd, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter description (optional)"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity*</label>
                  <input
                    type="number"
                    value={productToAdd.quantity}
                    onChange={(e) => setProductToAdd({ ...productToAdd, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <select
                    value={productToAdd.unit}
                    onChange={(e) => setProductToAdd({ ...productToAdd, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kg</option>
                    <option value="liter">Liter</option>
                    <option value="meter">Meter</option>
                    <option value="feet">Feet</option>
                    <option value="bottle">Bottle</option>
                    <option value="packet">Packet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rate per Unit (₹)*</label>
                <input
                  type="number"
                  value={productToAdd.rate}
                  onChange={(e) => setProductToAdd({ ...productToAdd, rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  Total Amount: ₹{(productToAdd.quantity * productToAdd.rate).toFixed(2)}
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    setEditingProductId(null);
                    setProductToAdd({ name: '', description: '', quantity: 1, rate: 0, unit: 'piece' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addProductToInvoice}
                  className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  {editingProductId ? (
                    <>
                      <Check className="w-4 h-4 mr-2 inline" />
                      Update Product
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2 inline" />
                      Add Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderInvoiceSystem;