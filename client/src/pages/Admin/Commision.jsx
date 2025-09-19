import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Settings, 
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Target,
  Award,
  BarChart2,
  Percent,
  Crown,
  User,
  Eye,
  Filter,
  Info
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
  const [showRuleDetailsModal, setShowRuleDetailsModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [viewingRule, setViewingRule] = useState(null);
  
  // Form state matching backend model
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'percentage',
    value: 10,
    applyTo: 'all',
    performanceTier: '',
    specificProvider: '',
    effectiveFrom: new Date(),
    effectiveUntil: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    applyTo: '',
    bookingSearch: ''
  });

  // Available options matching backend enum
  const performanceTiers = ['basic', 'standard', 'premium'];
  const applyToOptions = ['all', 'performanceTier', 'specificProvider'];

  // Fetch commission rules
  const fetchCommissionRules = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.isActive && { isActive: filters.isActive }),
        ...(filters.applyTo && { applyTo: filters.applyTo })
      });

      const response = await fetch(`${API}/commission/rules?${queryParams}`, {
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

  // Fetch specific commission rule by ID
  const fetchCommissionRuleById = async (ruleId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/commission/rules/${ruleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setViewingRule(data.data);
        setShowRuleDetailsModal(true);
      } else {
        showToast(data.message || 'Failed to fetch rule details', 'error');
      }
    } catch (error) {
      showToast('Failed to fetch rule details', 'error');
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

  // Create commission rule
  const createCommissionRule = async () => {
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
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description,
        type: ruleForm.type,
        value: ruleForm.value,
        applyTo: ruleForm.applyTo,
        ...(ruleForm.applyTo === 'performanceTier' && { performanceTier: ruleForm.performanceTier }),
        ...(ruleForm.applyTo === 'specificProvider' && { specificProvider: ruleForm.specificProvider }),
        effectiveFrom: ruleForm.effectiveFrom,
        ...(ruleForm.effectiveUntil && { effectiveUntil: ruleForm.effectiveUntil })
      };

      const response = await fetch(`${API}/commission/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Rule created successfully');
        setShowRuleModal(false);
        resetRuleForm();
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to create rule', 'error');
      }
    } catch (error) {
      showToast('Failed to create rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update commission rule
  const updateCommissionRule = async () => {
    if (!ruleForm.name || !ruleForm.value || ruleForm.value < 0) {
      showToast('Please fill all required fields with valid values', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description,
        type: ruleForm.type,
        value: ruleForm.value,
        applyTo: ruleForm.applyTo,
        ...(ruleForm.applyTo === 'performanceTier' && { performanceTier: ruleForm.performanceTier }),
        ...(ruleForm.applyTo === 'specificProvider' && { specificProvider: ruleForm.specificProvider }),
        effectiveFrom: ruleForm.effectiveFrom,
        ...(ruleForm.effectiveUntil && { effectiveUntil: ruleForm.effectiveUntil })
      };

      const response = await fetch(`${API}/commission/rules/${editingRule._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Rule updated successfully');
        setShowRuleModal(false);
        setEditingRule(null);
        resetRuleForm();
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to update rule', 'error');
      }
    } catch (error) {
      showToast('Failed to update rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle rule status
  const toggleRuleStatus = async (ruleId) => {
    try {
      const response = await fetch(`${API}/commission/rules/${ruleId}/toggle-status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message || 'Rule status updated');
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
      const response = await fetch(`${API}/commission/process-booking/${bookingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showToast('Commission processed successfully');
        fetchBookings();
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

  // Reset form
  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      type: 'percentage',
      value: 10,
      applyTo: 'all',
      performanceTier: '',
      specificProvider: '',
      effectiveFrom: new Date(),
      effectiveUntil: ''
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
      specificProvider: rule.specificProvider?._id || '',
      effectiveFrom: rule.effectiveFrom || new Date(),
      effectiveUntil: rule.effectiveUntil || ''
    });
    setShowRuleModal(true);
  };

  // View rule details
  const viewRuleDetails = (rule) => {
    fetchCommissionRuleById(rule._id);
  };

  // Filter rules
  const filteredRules = commissionRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         rule.description?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesActive = filters.isActive === '' || rule.isActive.toString() === filters.isActive;
    const matchesApplyTo = filters.applyTo === '' || rule.applyTo === filters.applyTo;
    
    return matchesSearch && matchesActive && matchesApplyTo;
  });

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = filters.bookingSearch === '' || 
      booking._id.toLowerCase().includes(filters.bookingSearch.toLowerCase()) ||
      booking.provider?.name.toLowerCase().includes(filters.bookingSearch.toLowerCase());
    return matchesSearch;
  });

  // Initial data fetch
  useEffect(() => {
    fetchCommissionRules();
    fetchProviders();
    fetchBookings();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchCommissionRules(1, pagination.limit);
  }, [filters.isActive, filters.applyTo]);

  useEffect(() => {
    fetchBookings();
  }, [filters.bookingSearch]);

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-secondary">Commission Management</h1>
              <p className="text-gray-600">Manage commission rules and provider earnings</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  fetchCommissionRules();
                  fetchProviders();
                  fetchBookings();
                }}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => {
                  resetRuleForm();
                  setEditingRule(null);
                  setShowRuleModal(true);
                }}
                className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Commission Rule
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-teal-100">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Commission</p>
                  <p className="text-lg font-bold text-secondary">₹{stats.totalCommission.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Active Rules</p>
                  <p className="text-lg font-bold text-secondary">{stats.activeRules}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-purple-100">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Providers</p>
                  <p className="text-lg font-bold text-secondary">{stats.totalProviders}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-amber-100">
                  <Percent className="w-5 h-5 text-amber-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Avg Commission Rate</p>
                  <p className="text-lg font-bold text-secondary">{stats.avgCommissionRate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rules'
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Commission Rules
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'providers'
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Provider Commissions
            </button>
            <button
              onClick={() => setActiveTab('processing')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'processing'
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Commission Processing
            </button>
          </div>
        </div>

        {/* Commission Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6">
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
                      className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.isActive}
                    onChange={(e) => setFilters({...filters, isActive: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                    </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apply To</label>
                  <select
                    value={filters.applyTo}
                    onChange={(e) => setFilters({...filters, applyTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">All Types</option>
                    {applyToOptions.map(option => (
                      <option key={option} value={option}>
                        {option === 'all' ? 'All Providers' : 
                         option === 'performanceTier' ? 'Performance Tier' : 
                         'Specific Provider'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Rules Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Commission Rules</h3>
              </div>
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
                    {loading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="animate-pulse">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-2">
                              <div className="h-8 w-8 bg-gray-200 rounded"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded"></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : filteredRules.length > 0 ? (
                      filteredRules.map((rule) => (
                        <tr key={rule._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                            {rule.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">{rule.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {rule.type === 'percentage' ? `${rule.value}%` : `₹${rule.value.toFixed(2)}`}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">{rule.type}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {rule.applyTo === 'all' && 'All Providers'}
                              {rule.applyTo === 'performanceTier' && 'Performance Tier'}
                              {rule.applyTo === 'specificProvider' && 'Specific Provider'}
                            </span>
                            {rule.performanceTier && (
                              <div className="text-xs text-gray-500 mt-1">
                                {rule.performanceTier.charAt(0).toUpperCase() + rule.performanceTier.slice(1)} Tier
                              </div>
                            )}
                            {rule.specificProvider && (
                              <div className="text-xs text-gray-500 mt-1">
                                {rule.specificProvider.name}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rule.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(rule.createdAt), 'dd MMM yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => viewRuleDetails(rule)}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Details"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(rule)}
                                className="text-primary hover:text-teal-700"
                                title="Edit Rule"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleRuleStatus(rule._id)}
                                className={rule.isActive ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}
                                title={rule.isActive ? 'Deactivate Rule' : 'Activate Rule'}
                              >
                                {rule.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => deleteCommissionRule(rule._id)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center">
                          <div className="flex flex-col items-center">
                            <Settings className="w-12 h-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Commission Rules Found</h3>
                            <p className="text-sm text-gray-500 mb-4">Get started by creating your first commission rule.</p>
                            <button
                              onClick={() => {
                                resetRuleForm();
                                setEditingRule(null);
                                setShowRuleModal(true);
                              }}
                              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-teal-700"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Create First Rule
                            </button>
                          </div>
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
                                  ? 'z-10 bg-primary border-primary text-white'
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

        {/* Provider Commissions Tab */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Provider Commission Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Provider</label>
                  <select
                    value={selectedProvider || ''}
                    onChange={(e) => {
                      setSelectedProvider(e.target.value);
                      if (e.target.value) {
                        fetchProviderCommission(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select a provider</option>
                    {providers.map(provider => (
                      <option key={provider._id} value={provider._id}>
                        {provider.name} - {provider.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {providerCommission && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-blue-100">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-blue-900">Wallet Balance</p>
                        <p className="text-lg font-bold text-blue-900">
                          ₹{providerCommission.provider?.wallet?.toLocaleString('en-IN') || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-green-100">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-900">Current Commission</p>
                        <p className="text-lg font-bold text-green-900">
                          {providerCommission.currentCommission?.displayValue || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-purple-100">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-purple-900">Performance Tier</p>
                        <p className="text-lg font-bold text-purple-900 capitalize">
                          {providerCommission.provider?.performanceTier || 'standard'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Commission Processing Tab */}
        {activeTab === 'processing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Process Commission for Completed Bookings</h3>
                <button
                  onClick={fetchBookings}
                  className="bg-primary text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-teal-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={filters.bookingSearch}
                    onChange={(e) => setFilters({...filters, bookingSearch: e.target.value})}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

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
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <tr key={booking._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {booking._id.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {booking.provider?.name || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {booking.provider?.email || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{booking.totalAmount?.toLocaleString('en-IN') || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              booking.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {booking.status === 'completed' && (
                              <button
                                onClick={() => processBookingCommission(booking._id)}
                                disabled={loading}
                                className="text-accent hover:text-orange-700 disabled:opacity-50"
                              >
                                Process Commission
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                          No bookings found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Commission Rule Modal */}
        {showRuleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingRule ? 'Edit Commission Rule' : 'Add Commission Rule'}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Enter rule name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={ruleForm.description}
                    onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    rows="3"
                    placeholder="Enter description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type *</label>
                    <select
                      value={ruleForm.type}
                      onChange={(e) => setRuleForm({...ruleForm, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value * {ruleForm.type === 'percentage' ? '(%)' : '(₹)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={ruleForm.type === 'percentage' ? '0.1' : '1'}
                      value={ruleForm.value}
                      onChange={(e) => setRuleForm({...ruleForm, value: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder={ruleForm.type === 'percentage' ? '10.5' : '1000'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apply To *</label>
                  <select
                    value={ruleForm.applyTo}
                    onChange={(e) => setRuleForm({...ruleForm, applyTo: e.target.value, performanceTier: '', specificProvider: ''})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="all">All Providers</option>
                    <option value="performanceTier">Performance Tier</option>
                    <option value="specificProvider">Specific Provider</option>
                  </select>
                </div>

                {ruleForm.applyTo === 'performanceTier' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Performance Tier *</label>
                    <select
                      value={ruleForm.performanceTier}
                      onChange={(e) => setRuleForm({...ruleForm, performanceTier: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select tier</option>
                      {performanceTiers.map(tier => (
                        <option key={tier} value={tier}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {ruleForm.applyTo === 'specificProvider' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                    <select
                      value={ruleForm.specificProvider}
                      onChange={(e) => setRuleForm({...ruleForm, specificProvider: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select provider</option>
                      {providers.map(provider => (
                        <option key={provider._id} value={provider._id}>
                          {provider.name} - {provider.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                    <input
                      type="date"
                      value={ruleForm.effectiveFrom ? new Date(ruleForm.effectiveFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => setRuleForm({...ruleForm, effectiveFrom: new Date(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective Until (Optional)</label>
                    <input
                      type="date"
                      value={ruleForm.effectiveUntil ? new Date(ruleForm.effectiveUntil).toISOString().split('T')[0] : ''}
                      onChange={(e) => setRuleForm({...ruleForm, effectiveUntil: e.target.value ? new Date(e.target.value) : ''})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowRuleModal(false);
                    setEditingRule(null);
                    resetRuleForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={editingRule ? updateCommissionRule : createCommissionRule}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Commission Rule Details Modal */}
        {showRuleDetailsModal && viewingRule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">Commission Rule Details</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <p className="text-sm text-gray-900">{viewingRule.name}</p>
                </div>

                {viewingRule.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-sm text-gray-900">{viewingRule.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type</label>
                    <p className="text-sm text-gray-900 capitalize">{viewingRule.type}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                    <p className="text-sm text-gray-900">
                      {viewingRule.type === 'percentage' ? `${viewingRule.value}%` : `₹${viewingRule.value.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
                  <p className="text-sm text-gray-900 capitalize">
                    {viewingRule.applyTo === 'all' && 'All Providers'}
                    {viewingRule.applyTo === 'performanceTier' && 'Performance Tier'}
                    {viewingRule.applyTo === 'specificProvider' && 'Specific Provider'}
                  </p>
                </div>

                {viewingRule.performanceTier && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Performance Tier</label>
                    <p className="text-sm text-gray-900 capitalize">{viewingRule.performanceTier}</p>
                  </div>
                )}

                {viewingRule.specificProvider && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specific Provider</label>
                    <p className="text-sm text-gray-900">{viewingRule.specificProvider.name}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      viewingRule.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {viewingRule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                    <p className="text-sm text-gray-900">{viewingRule.createdBy?.name || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                    <p className="text-sm text-gray-900">
                      {viewingRule.effectiveFrom ? format(new Date(viewingRule.effectiveFrom), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective Until</label>
                    <p className="text-sm text-gray-900">
                      {viewingRule.effectiveUntil ? format(new Date(viewingRule.effectiveUntil), 'dd MMM yyyy') : 'No expiration'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                    <p className="text-sm text-gray-900">
                      {viewingRule.createdAt ? format(new Date(viewingRule.createdAt), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                    <p className="text-sm text-gray-900">
                      {viewingRule.updatedAt ? format(new Date(viewingRule.updatedAt), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowRuleDetailsModal(false);
                    setViewingRule(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCommissionPage;