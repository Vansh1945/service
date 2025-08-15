import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Settings, 
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

const AdminCommissionPage = () => {
  const { API, token, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('rules');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [commissionRules, setCommissionRules] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerCommission, setProviderCommission] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalCommission: 0,
    totalProviders: 0,
    activeRules: 0,
    totalProcessedCommissions: 0,
    avgCommissionRate: 0
  });
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  
  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  
  // Form state matching backend model
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'percentage',
    value: 10,
    applyTo: 'all',
    performanceTier: '',
    specificProvider: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    performanceTier: '',
    bookingSearch: '',
    invoiceSearch: ''
  });

  // Available options matching backend enum
  const performanceTiers = ['basic', 'standard', 'premium'];

  // Fetch commission rules
  const fetchCommissionRules = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.isActive && { isActive: filters.isActive }),
        ...(filters.performanceTier && { performanceTier: filters.performanceTier })
      });

      const response = await fetch(`${API}/commission/rules/list?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setCommissionRules(data.data);
        setPagination(data.pagination);
        
        // Calculate stats
        const activeCount = data.data.filter(rule => rule.isActive).length;
        setStats(prev => ({ 
          ...prev, 
          activeRules: activeCount,
          totalRules: data.pagination.total
        }));
        
        // Calculate average commission rate
        if (data.data.length > 0) {
          const percentageRules = data.data.filter(rule => rule.type === 'percentage');
          const avgRate = percentageRules.length > 0 
            ? percentageRules.reduce((sum, rule) => sum + rule.value, 0) / percentageRules.length
            : 0;
          setStats(prev => ({ ...prev, avgCommissionRate: avgRate.toFixed(1) }));
        }
      }
    } catch (error) {
      showToast('Failed to fetch commission rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch providers
  const fetchProviders = async () => {
    try {
      const response = await fetch(`${API}/admin/providers?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProviders(data.data || []);
        setStats(prev => ({ 
          ...prev, 
          totalProviders: (data.data || []).length 
        }));
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    }
  };

  // Fetch provider commission details
  const fetchProviderCommission = async (providerId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/commission/provider/${providerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProviderCommission(data.data);
      }
    } catch (error) {
      showToast('Failed to fetch provider commission details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create/update commission rule
  const handleSaveRule = async () => {
    if (!ruleForm.name || !ruleForm.value || ruleForm.value < 0) {
      showToast('Please fill all required fields with valid values', 'error');
      return;
    }

    if (ruleForm.applyTo === 'performanceTier' && !ruleForm.performanceTier) {
      showToast('Performance tier is required when applyTo is performanceTier', 'error');
      return;
    }

    if (ruleForm.applyTo === 'specificProvider' && !ruleForm.specificProvider) {
      showToast('Provider is required when applyTo is specificProvider', 'error');
      return;
    }

    setLoading(true);
    try {
      const method = editingRule ? 'PUT' : 'POST';
      const url = editingRule 
        ? `${API}/commission/rules/${editingRule._id}`
        : `${API}/commission/rules`;
      
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description,
        type: ruleForm.type,
        value: ruleForm.value,
        applyTo: ruleForm.applyTo,
        ...(ruleForm.applyTo === 'performanceTier' && { performanceTier: ruleForm.performanceTier }),
        ...(ruleForm.applyTo === 'specificProvider' && { specificProvider: ruleForm.specificProvider })
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        showToast(`Rule ${editingRule ? 'updated' : 'created'} successfully`);
        setShowRuleModal(false);
        setEditingRule(null);
        resetRuleForm();
        fetchCommissionStats();
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to save rule', 'error');
      }
    } catch (error) {
      showToast('Failed to save rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle rule status
  const toggleRuleStatus = async (ruleId) => {
    try {
      const response = await fetch(`${API}/commission/rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message || 'Rule status updated');
        fetchCommissionStats();
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to toggle rule status', 'error');
      }
    } catch (error) {
      showToast('Failed to toggle rule status', 'error');
    }
  };

  // Delete commission rule
  const deleteCommissionRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this commission rule?')) return;
    
    try {
      const response = await fetch(`${API}/commission/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showToast('Commission rule deleted successfully');
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to delete rule', 'error');
      }
    } catch (error) {
      showToast('Failed to delete commission rule', 'error');
    }
  };

  // Process commission for booking
  const processBookingCommission = async (bookingId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/commission/process/${bookingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showToast('Commission processed successfully');
        fetchCommissionStats();
        fetchBookings();
        fetchInvoices();
      } else {
        showToast(data.message || 'Failed to process commission', 'error');
      }
    } catch (error) {
      showToast('Failed to process commission', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings with commission status
  const fetchBookings = async () => {
    try {
      const queryParams = new URLSearchParams({
        status: 'completed',
        limit: 50,
        ...(filters.bookingSearch && { search: filters.bookingSearch })
      });

      const response = await fetch(`${API}/admin/bookings?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBookings(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setBookings([]);
    }
  };

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      const queryParams = new URLSearchParams({
        ...(filters.invoiceSearch && { search: filters.invoiceSearch })
      });

      const response = await fetch(`${API}/admin/invoices?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setInvoices(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setInvoices([]);
    }
  };

  // Fetch commission statistics
  const fetchCommissionStats = async () => {
    try {
      const response = await fetch(`${API}/admin/commission/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(prev => ({
          ...prev,
          totalCommission: data.totalCommission || 0,
          totalProcessedCommissions: data.totalProcessed || 0,
          avgCommissionRate: data.avgRate?.toFixed(1) || 0
        }));
      }
    } catch (error) {
      console.error('Failed to fetch commission stats:', error);
    }
  };

  // Reset form
  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      type: 'percentage',
      value: 10,
      applyTo: 'all',
      performanceTier: '',
      specificProvider: ''
    });
  };

  // Open edit modal
  const openEditModal = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name || '',
      description: rule.description || '',
      type: rule.type || 'percentage',
      value: rule.value || 10,
      applyTo: rule.applyTo || 'all',
      performanceTier: rule.performanceTier || '',
      specificProvider: rule.specificProvider?._id || ''
    });
    setShowRuleModal(true);
  };

  // Filter rules
  const filteredRules = commissionRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(filters.search.toLowerCase());
    const matchesActive = filters.isActive === '' || rule.isActive.toString() === filters.isActive;
    const matchesTier = filters.performanceTier === '' || rule.performanceTier === filters.performanceTier;
    
    return matchesSearch && matchesActive && matchesTier;
  });

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = filters.bookingSearch === '' || 
      booking._id.toLowerCase().includes(filters.bookingSearch.toLowerCase()) ||
      booking.provider?.name.toLowerCase().includes(filters.bookingSearch.toLowerCase());
    return matchesSearch;
  });

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = filters.invoiceSearch === '' || 
      invoice._id.toLowerCase().includes(filters.invoiceSearch.toLowerCase()) ||
      invoice.provider?.name.toLowerCase().includes(filters.invoiceSearch.toLowerCase());
    return matchesSearch;
  });

  // Initial data fetch
  useEffect(() => {
    fetchCommissionRules();
    fetchProviders();
    fetchBookings();
    fetchInvoices();
    fetchCommissionStats();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchCommissionRules(1, pagination.limit);
  }, [filters.isActive, filters.performanceTier]);

  useEffect(() => {
    fetchBookings();
  }, [filters.bookingSearch]);

  useEffect(() => {
    fetchInvoices();
  }, [filters.invoiceSearch]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commission Management</h1>
          <p className="text-gray-600">Manage commission rules and provider earnings</p>
        </div>
        <button
          onClick={() => {
            resetRuleForm();
            setShowRuleModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Commission Rule
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Commission</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{stats.totalCommission.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-50">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Rules</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeRules}</p>
            </div>
            <div className="p-3 rounded-full bg-green-50">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Providers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProviders}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-50">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Commission Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgCommissionRate}%</p>
            </div>
            <div className="p-3 rounded-full bg-orange-50">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rules'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            Commission Rules
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'providers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Provider Commissions
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'processing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Commission Processing
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invoices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Download className="w-4 h-4" />
            Commission Invoices
          </button>
        </nav>
      </div>

      {/* Commission Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search rules..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.isActive}
                  onChange={(e) => setFilters({...filters, isActive: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier</label>
                <select
                  value={filters.performanceTier}
                  onChange={(e) => setFilters({...filters, performanceTier: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Tiers</option>
                  {performanceTiers.map(tier => (
                    <option key={tier} value={tier}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rule Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Apply To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRules.length > 0 ? (
                    filteredRules.map((rule) => (
                      <tr key={rule._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                              {rule.description && (
                                <div className="text-sm text-gray-500 truncate max-w-xs">{rule.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {rule.type === 'percentage' ? `${rule.value}%` : `₹${rule.value.toFixed(2)}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              rule.applyTo === 'all' ? 'bg-blue-100 text-blue-800' : 
                              rule.applyTo === 'performanceTier' ? 'bg-purple-100 text-purple-800' : 
                              'bg-green-100 text-green-800'
                            }`}>
                              {rule.applyTo === 'all' ? 'All Providers' : 
                               rule.applyTo === 'performanceTier' ? 'Performance Tier' : 'Specific Provider'}
                            </span>
                            {rule.performanceTier && (
                              <span className="text-xs text-gray-500">
                                Tier: {rule.performanceTier}
                              </span>
                            )}
                            {rule.specificProvider && (
                              <span className="text-xs text-gray-500">
                                Provider: {rule.specificProvider.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(rule.createdAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(rule)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleRuleStatus(rule._id)}
                              className={rule.isActive ? 
                                'text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50' : 
                                'text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50'}
                              title={rule.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {rule.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteCommissionRule(rule._id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                        No commission rules found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => fetchCommissionRules(pagination.page - 1, pagination.limit)}
                    disabled={pagination.page <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchCommissionRules(pagination.page + 1, pagination.limit)}
                    disabled={pagination.page >= pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => fetchCommissionRules(pagination.page - 1, pagination.limit)}
                        disabled={pagination.page <= 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        let pageNum;
                        if (pagination.pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.pages - 2) {
                          pageNum = pagination.pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => fetchCommissionRules(pageNum, pagination.limit)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pagination.page === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => fetchCommissionRules(pagination.page + 1, pagination.limit)}
                        disabled={pagination.page >= pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider Commission Tab */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* Provider Selection */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Select Provider</h3>
            <div className="flex gap-4">
              <select
                value={selectedProvider || ''}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  if (e.target.value) {
                    fetchProviderCommission(e.target.value);
                  } else {
                    setProviderCommission(null);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a provider...</option>
                {providers.map(provider => (
                  <option key={provider._id} value={provider._id}>
                    {provider.name} - {provider.performanceTier || 'Standard'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Provider Commission Details */}
          {providerCommission ? (
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Commission Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Provider Information</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Name</p>
                      <p className="text-sm text-gray-900">{providerCommission.provider.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Performance Tier</p>
                      <span className={`px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs`}>
                        {providerCommission.provider.performanceTier || 'Standard'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Earnings</p>
                      <p className="text-sm text-gray-900">
                        ₹{providerCommission.totalEarnings?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Current Commission</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Rate</p>
                      <p className="text-sm text-gray-900">
                        {providerCommission.currentCommission.value}
                        {providerCommission.currentCommission.type === 'percentage' ? '%' : ' ₹'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Rule</p>
                      <p className="text-sm text-gray-900">
                        {providerCommission.currentCommission.name || 'Default Commission'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Commission Paid</p>
                      <p className="text-sm text-gray-900">
                        ₹{providerCommission.totalCommissionPaid?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* All Active Rules */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">All Active Rules</h4>
                {providerCommission.allActiveRules && providerCommission.allActiveRules.length > 0 ? (
                  <div className="space-y-3">
                    {providerCommission.allActiveRules.map((rule) => (
                      <div key={rule._id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm text-gray-900">{rule.name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'} commission
                              {rule.applyTo === 'performanceTier' && rule.performanceTier && ` | Tier: ${rule.performanceTier}`}
                              {rule.applyTo === 'specificProvider' && rule.specificProvider && ` | Provider: ${rule.specificProvider.name}`}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">No active rules found.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100 text-center">
              <p className="text-gray-500">Select a provider to view commission details</p>
            </div>
          )}
        </div>
      )}

      {/* Commission Processing Tab */}
      {activeTab === 'processing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Process Commission for Completed Bookings</h3>
            
            {/* Booking Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Bookings</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by booking ID or provider..."
                  value={filters.bookingSearch}
                  onChange={(e) => setFilters({...filters, bookingSearch: e.target.value})}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-600">
                {filteredBookings.filter(b => !b.invoice).length} bookings need commission processing
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Total Processed: {stats.totalProcessedCommissions}
                </span>
                <button 
                  onClick={() => {
                    fetchBookings();
                    fetchCommissionStats();
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {filteredBookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings
                      .filter(booking => booking.status === 'completed' && !booking.invoice)
                      .map((booking) => (
                      <tr key={booking._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              #{booking._id?.slice(-8)}
                            </div>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(booking._id);
                                showToast('Booking ID copied to clipboard');
                              }}
                              className="ml-2 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                              title="Copy ID"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(booking.createdAt), 'dd MMM yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{booking.provider?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">
                            {booking.provider?.performanceTier || 'Standard'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{booking.service?.name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ₹{booking.totalAmount?.toFixed(2) || '0.00'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Completed
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => processBookingCommission(booking._id)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                            disabled={loading}
                          >
                            Process Commission
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No completed bookings found that need commission processing.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commission Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Commission Invoices</h3>
            
            {/* Invoice Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Invoices</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by invoice ID or provider..."
                  value={filters.invoiceSearch}
                  onChange={(e) => setFilters({...filters, invoiceSearch: e.target.value})}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-600">
                {filteredInvoices.length} invoices found
              </p>
              <button 
                onClick={fetchInvoices}
                className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            {filteredInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            #{invoice._id?.slice(-8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {invoice.booking?.service?.name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            Booking: #{invoice.booking?._id?.slice(-8) || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {invoice.provider?.name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {invoice.provider?.performanceTier || 'Standard'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ₹{invoice.totalAmount?.toFixed(2) || '0.00'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            ₹{invoice.commission?.amount?.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {invoice.commission?.rate || '0'}{invoice.commission?.type === 'percentage' ? '%' : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {format(new Date(invoice.createdAt), 'dd MMM yyyy')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No commission invoices found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commission Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingRule ? 'Edit Commission Rule' : 'Add Commission Rule'}
              </h3>
              <button
                onClick={() => {
                  setShowRuleModal(false);
                  setEditingRule(null);
                  resetRuleForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name*</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Premium Providers Commission"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description of this rule"
                  rows="3"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commission Type*</label>
                  <select
                    value={ruleForm.type}
                    onChange={(e) => setRuleForm({...ruleForm, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commission Value* {ruleForm.type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    value={ruleForm.value}
                    onChange={(e) => setRuleForm({...ruleForm, value: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step={ruleForm.type === 'percentage' ? '0.1' : '1'}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Apply To*</label>
                <select
                  value={ruleForm.applyTo}
                  onChange={(e) => setRuleForm({...ruleForm, applyTo: e.target.value, performanceTier: '', specificProvider: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="all">All Providers</option>
                  <option value="performanceTier">Performance Tier</option>
                  <option value="specificProvider">Specific Provider</option>
                </select>
              </div>
              
              {ruleForm.applyTo === 'performanceTier' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier*</label>
                  <select
                    value={ruleForm.performanceTier}
                    onChange={(e) => setRuleForm({...ruleForm, performanceTier: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Performance Tier</option>
                    {performanceTiers.map(tier => (
                      <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {ruleForm.applyTo === 'specificProvider' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider*</label>
                  <select
                    value={ruleForm.specificProvider}
                    onChange={(e) => setRuleForm({...ruleForm, specificProvider: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Provider</option>
                    {providers.map(provider => (
                      <option key={provider._id} value={provider._id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRuleModal(false);
                  setEditingRule(null);
                  resetRuleForm();
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={loading || !ruleForm.name || !ruleForm.value || ruleForm.value < 0 ||
                  (ruleForm.applyTo === 'performanceTier' && !ruleForm.performanceTier) ||
                  (ruleForm.applyTo === 'specificProvider' && !ruleForm.specificProvider)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-lg">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCommissionPage;