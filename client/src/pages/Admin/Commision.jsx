import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Settings, 
  Award,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react';

const AdminCommissionPage = () => {
  const { API, token, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('rules');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [commissionRules, setCommissionRules] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerCommission, setProviderCommission] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalCommission: 0,
    totalProviders: 0,
    activeRules: 0,
    avgCommissionRate: 20 // Default average
  });
  
  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  
  // Form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    type: 'percentage',
    value: 20,
    applicableTo: 'all',
    providers: [],
    states: [],
    performanceTier: '',
    serviceCategories: [],
    minBookingAmount: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    state: '',
    performanceTier: ''
  });

  // Available options
  const states = [
    'Punjab', 'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 
    'Hyderabad', 'Ahmedabad', 'Pune', 'Surat', 'Jaipur', 'Lucknow'
  ];
  
  const performanceTiers = ['basic', 'standard', 'premium'];
  const serviceCategories = ['Electrical', 'AC', 'Appliance Repair', 'Other'];

  // Fetch commission rules
  const fetchCommissionRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/commission/get-rules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCommissionRules(data.data);
        // Calculate active rules count
        const activeCount = data.data.filter(rule => rule.isActive).length;
        setStats(prev => ({ ...prev, activeRules: activeCount }));
        
        // Calculate average commission rate
        if (data.data.length > 0) {
          const avgRate = data.data.reduce((sum, rule) => sum + (rule.type === 'percentage' ? rule.value : 0), 0) / data.data.length;
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
      const response = await fetch(`${API}/admin/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProviders(data.providers);
        setStats(prev => ({ ...prev, totalProviders: data.providers.length }));
      }
    } catch (error) {
      showToast('Failed to fetch providers', 'error');
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
    setLoading(true);
    try {
      const method = editingRule ? 'GET' : 'POST';
      const url = editingRule 
        ? `${API}/commission/rules/${editingRule._id}`
        : `${API}/commission/rules`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(ruleForm)
      });
      
      const data = await response.json();
      if (data.success) {
        showToast(`Rule ${editingRule ? 'updated' : 'created'} successfully`);
        setShowRuleModal(false);
        setEditingRule(null);
        resetRuleForm();
        fetchCommissionRules();
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
        showToast(`Rule status updated`);
        fetchCommissionRules();
      }
    } catch (error) {
      showToast('Failed to toggle rule status', 'error');
    }
  };

  // Reset form
  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      type: 'percentage',
      value: 20,
      applicableTo: 'all',
      providers: [],
      states: [],
      performanceTier: '',
      serviceCategories: [],
      minBookingAmount: 0
    });
  };

  // Open edit modal
  const openEditModal = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      type: rule.type,
      value: rule.value,
      applicableTo: rule.applicableTo,
      providers: rule.providers || [],
      states: rule.states || [],
      performanceTier: rule.performanceTier || '',
      serviceCategories: rule.serviceCategories || [],
      minBookingAmount: rule.minBookingAmount || 0
    });
    setShowRuleModal(true);
  };

  // Filter rules
  const filteredRules = commissionRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(filters.search.toLowerCase());
    const matchesActive = filters.isActive === '' || rule.isActive.toString() === filters.isActive;
    const matchesState = filters.state === '' || (rule.states && rule.states.includes(filters.state));
    const matchesTier = filters.performanceTier === '' || rule.performanceTier === filters.performanceTier;
    
    return matchesSearch && matchesActive && matchesState && matchesTier;
  });

  // Calculate total commission from transactions
  const calculateTotalCommission = async () => {
    try {
      const response = await fetch(`${API}/transaction?type=commission`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        const total = data.data.reduce((sum, tx) => sum + tx.commissionAmount, 0);
        setStats(prev => ({ ...prev, totalCommission: total }));
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchCommissionRules();
    fetchProviders();
    calculateTotalCommission();
  }, []);

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
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Commission Rule
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Commission</p>
              <p className="text-2xl font-bold text-gray-900">₹{stats.totalCommission.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Rules</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeRules}</p>
            </div>
            <Settings className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Providers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProviders}</p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Commission</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgCommissionRate}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600" />
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
        </nav>
      </div>

      {/* Commission Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search rules..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.isActive}
                  onChange={(e) => setFilters({...filters, isActive: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <select
                  value={filters.state}
                  onChange={(e) => setFilters({...filters, state: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All States</option>
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier</label>
                <select
                  value={filters.performanceTier}
                  onChange={(e) => setFilters({...filters, performanceTier: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Tiers</option>
                  {performanceTiers.map(tier => (
                    <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
                      Applicable To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      States
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
                  {filteredRules.map((rule) => (
                    <tr key={rule._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          rule.applicableTo === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {rule.applicableTo === 'all' ? 'All Providers' : 'Specific Providers'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rule.states?.length > 0 ? rule.states.join(', ') : 'All States'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(rule)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleRuleStatus(rule._id)}
                            className={rule.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                            title={rule.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {rule.isActive ? <Trash2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Provider Commission Tab */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* Provider Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Select Provider</h3>
            <div className="flex gap-4">
              <select
                value={selectedProvider || ''}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  if (e.target.value) {
                    fetchProviderCommission(e.target.value);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a provider...</option>
                {providers.map(provider => (
                  <option key={provider._id} value={provider._id}>
                    {provider.name} - {provider.address?.state || 'N/A'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Provider Commission Details */}
          {providerCommission && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Commission Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Provider Information</h4>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Name:</span> {providerCommission.provider.name}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">State:</span> {providerCommission.provider.state}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Performance Tier:</span> 
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {providerCommission.provider.performanceTier}
                      </span>
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Effective Commission</h4>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Rate:</span> 
                      {providerCommission.effectiveCommission.value}
                      {providerCommission.effectiveCommission.type === 'percentage' ? '%' : ' ₹'}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Description:</span> {providerCommission.effectiveCommission.description}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Applicable Rules */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Applicable Rules</h4>
                {providerCommission.commissionRules.length > 0 ? (
                  <div className="space-y-2">
                    {providerCommission.commissionRules.map((rule, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{rule.name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'} commission
                              {rule.states?.length > 0 && ` | States: ${rule.states.join(', ')}`}
                              {rule.performanceTier && ` | Tier: ${rule.performanceTier}`}
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
                  <p className="text-sm text-gray-500">No specific rules found. Default commission applies.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commission Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Punjab Providers Commission"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commission Type*</label>
                  <select
                    value={ruleForm.type}
                    onChange={(e) => setRuleForm({...ruleForm, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step={ruleForm.type === 'percentage' ? '0.1' : '1'}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applicable To*</label>
                <select
                  value={ruleForm.applicableTo}
                  onChange={(e) => setRuleForm({...ruleForm, applicableTo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="all">All Providers</option>
                  <option value="specific">Specific Providers</option>
                </select>
              </div>
              
              {ruleForm.applicableTo === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Providers*</label>
                  <select
                    multiple
                    value={ruleForm.providers}
                    onChange={(e) => setRuleForm({
                      ...ruleForm, 
                      providers: Array.from(e.target.selectedOptions, option => option.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    size="4"
                    required
                  >
                    {providers.map(provider => (
                      <option key={provider._id} value={provider._id}>
                        {provider.name} - {provider.address?.state || 'N/A'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple providers</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">States (Optional)</label>
                <select
                  multiple
                  value={ruleForm.states}
                  onChange={(e) => setRuleForm({
                    ...ruleForm, 
                    states: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size="4"
                >
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Leave empty for all states</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier (Optional)</label>
                <select
                  value={ruleForm.performanceTier}
                  onChange={(e) => setRuleForm({...ruleForm, performanceTier: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Tiers</option>
                  {performanceTiers.map(tier => (
                    <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Categories (Optional)</label>
                <select
                  multiple
                  value={ruleForm.serviceCategories}
                  onChange={(e) => setRuleForm({
                    ...ruleForm, 
                    serviceCategories: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size="3"
                >
                  {serviceCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Leave empty for all categories</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Booking Amount (₹)</label>
                <input
                  type="number"
                  value={ruleForm.minBookingAmount}
                  onChange={(e) => setRuleForm({...ruleForm, minBookingAmount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="100"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRuleModal(false);
                  setEditingRule(null);
                  resetRuleForm();
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={loading || !ruleForm.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCommissionPage;