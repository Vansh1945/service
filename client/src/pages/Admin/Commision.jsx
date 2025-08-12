// import React, { useState, useEffect } from 'react';
// import { useAuth } from '../../store/auth';
// import { 
//   DollarSign, 
//   TrendingUp, 
//   Users, 
//   Settings, 
//   Award,
//   Plus,
//   Search,
//   Filter,
//   Edit,
//   Trash2,
//   RefreshCw,
//   Eye,
//   Download,
//   CheckCircle,
//   XCircle
// } from 'lucide-react';

// const AdminCommissionPage = () => {
//   const { API, token, showToast } = useAuth();
//   const [activeTab, setActiveTab] = useState('rules');
//   const [loading, setLoading] = useState(false);
  
//   // Data states
//   const [commissionRules, setCommissionRules] = useState([]);
//   const [providers, setProviders] = useState([]);
//   const [selectedProvider, setSelectedProvider] = useState(null);
//   const [providerCommission, setProviderCommission] = useState(null);
//   const [bookings, setBookings] = useState([]);
  
//   // Stats
//   const [stats, setStats] = useState({
//     totalCommission: 0,
//     totalProviders: 0,
//     activeRules: 0,
//     totalProcessedCommissions: 0,
//     avgCommissionRate: 10
//   });
  
//   // Pagination
//   const [pagination, setPagination] = useState({
//     page: 1,
//     limit: 10,
//     total: 0,
//     pages: 0
//   });
  
//   // Modal states
//   const [showRuleModal, setShowRuleModal] = useState(false);
//   const [editingRule, setEditingRule] = useState(null);
  
//   // Form state matching backend model
//   const [ruleForm, setRuleForm] = useState({
//     name: '',
//     description: '',
//     type: 'percentage',
//     value: 10,
//     applyTo: 'all',
//     performanceTier: ''
//   });

//   // Filters
//   const [filters, setFilters] = useState({
//     search: '',
//     isActive: '',
//     performanceTier: '',
//     bookingSearch: ''
//   });

//   // Available options matching backend enum
//   const performanceTiers = ['basic', 'standard', 'premium'];

//   // Fetch commission rules
//   const fetchCommissionRules = async (page = 1, limit = 10) => {
//     setLoading(true);
//     try {
//       const queryParams = new URLSearchParams({
//         page: page.toString(),
//         limit: limit.toString(),
//         ...(filters.isActive && { isActive: filters.isActive })
//       });

//       const response = await fetch(`${API}/commission/rules/list?${queryParams}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
      
//       const data = await response.json();
//       if (data.success) {
//         setCommissionRules(data.data);
//         setPagination(data.pagination);
        
//         // Calculate stats
//         const activeCount = data.data.filter(rule => rule.isActive).length;
//         setStats(prev => ({ 
//           ...prev, 
//           activeRules: activeCount,
//           totalRules: data.pagination.total
//         }));
        
//         // Calculate average commission rate
//         if (data.data.length > 0) {
//           const avgRate = data.data
//             .filter(rule => rule.type === 'percentage')
//             .reduce((sum, rule) => sum + rule.value, 0) / 
//             data.data.filter(rule => rule.type === 'percentage').length;
//           setStats(prev => ({ ...prev, avgCommissionRate: avgRate?.toFixed(1) || 10 }));
//         }
//       }
//     } catch (error) {
//       showToast('Failed to fetch commission rules', 'error');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Fetch providers
//   const fetchProviders = async () => {
//     try {
//       const response = await fetch(`${API}/admin/providers`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await response.json();
//       if (data.success) {
//         setProviders(data.providers || data.data || []);
//         setStats(prev => ({ 
//           ...prev, 
//           totalProviders: (data.providers || data.data || []).length 
//         }));
//       }
//     } catch (error) {
//       console.error('Failed to fetch providers:', error);
//       setProviders([]);
//     }
//   };

//   // Fetch provider commission details
//   const fetchProviderCommission = async (providerId) => {
//     setLoading(true);
//     try {
//       const response = await fetch(`${API}/commission/provider/${providerId}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await response.json();
//       if (data.success) {
//         setProviderCommission(data.data);
//       }
//     } catch (error) {
//       showToast('Failed to fetch provider commission details', 'error');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Create/update commission rule
//   const handleSaveRule = async () => {
//     if (!ruleForm.name || !ruleForm.value || ruleForm.value < 0) {
//       showToast('Please fill all required fields with valid values', 'error');
//       return;
//     }

//     if (ruleForm.applyTo === 'performanceTier' && !ruleForm.performanceTier) {
//       showToast('Performance tier is required when applyTo is performanceTier', 'error');
//       return;
//     }

//     setLoading(true);
//     try {
//       const method = editingRule ? 'PUT' : 'POST';
//       const url = editingRule 
//         ? `${API}/commission/rules/${editingRule._id}`
//         : `${API}/commission/rules`;
      
//       const payload = {
//         name: ruleForm.name,
//         description: ruleForm.description,
//         type: ruleForm.type,
//         value: ruleForm.value,
//         applyTo: ruleForm.applyTo,
//         ...(ruleForm.applyTo === 'performanceTier' && { performanceTier: ruleForm.performanceTier })
//       };

//       const response = await fetch(url, {
//         method,
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`
//         },
//         body: JSON.stringify(payload)
//       });
      
//       const data = await response.json();
//       if (data.success) {
//         showToast(`Rule ${editingRule ? 'updated' : 'created'} successfully`);
//         setShowRuleModal(false);
//         setEditingRule(null);
//         resetRuleForm();
//         fetchCommissionStats(); // Refresh stats
//         fetchCommissionRules(pagination.page, pagination.limit);
//       } else {
//         showToast(data.message || 'Failed to save rule', 'error');
//       }
//     } catch (error) {
//       showToast('Failed to save rule', 'error');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Toggle rule status
//   const toggleRuleStatus = async (ruleId) => {
//     try {
//       const response = await fetch(`${API}/commission/rules/${ruleId}/toggle`, {
//         method: 'PATCH',
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await response.json();
//       if (data.success) {
//         showToast(data.message || 'Rule status updated');
//         fetchCommissionStats(); // Refresh stats
//         fetchCommissionRules(pagination.page, pagination.limit);
//       } else {
//         showToast(data.message || 'Failed to toggle rule status', 'error');
//       }
//     } catch (error) {
//       showToast('Failed to toggle rule status', 'error');
//     }
//   };

//   // Process commission for booking
//   const processBookingCommission = async (bookingId) => {
//     setLoading(true);
//     try {
//       const response = await fetch(`${API}/commission/process/${bookingId}`, {
//         method: 'POST',
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await response.json();
//       if (data.success) {
//         showToast('Commission processed successfully');
//         // Refresh data
//         fetchCommissionStats(); // Refresh stats
//         fetchBookings();
//       } else {
//         showToast(data.message || 'Failed to process commission', 'error');
//       }
//     } catch (error) {
//       showToast('Failed to process commission', 'error');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Fetch bookings with commission status
//   const fetchBookings = async () => {
//     try {
//       const queryParams = new URLSearchParams({
//         status: 'completed',
//         ...(filters.bookingSearch && { search: filters.bookingSearch })
//       });

//       const response = await fetch(`${API}/admin/bookings?${queryParams}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await response.json();
//       if (data.success) {
//         setBookings(data.bookings || data.data || []);
//       }
//     } catch (error) {
//       console.error('Failed to fetch bookings:', error);
//       setBookings([]);
//     }
//   };

//   // Fetch commission statistics
//   const fetchCommissionStats = async () => {
//     try {
//       const response = await fetch(`${API}/commission/stats`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await response.json();
//       if (data.success) {
//         setStats(prev => ({
//           ...prev,
//           totalCommission: data.totalCommission || 0,
//           totalProcessedCommissions: data.totalProcessed || 0,
//           avgCommissionRate: data.avgRate?.toFixed(1) || 10
//         }));
//       }
//     } catch (error) {
//       console.error('Failed to fetch commission stats:', error);
//     }
//   };

//   // Reset form
//   const resetRuleForm = () => {
//     setRuleForm({
//       name: '',
//       description: '',
//       type: 'percentage',
//       value: 10,
//       applyTo: 'all',
//       performanceTier: ''
//     });
//   };

//   // Open edit modal
//   const openEditModal = (rule) => {
//     setEditingRule(rule);
//     setRuleForm({
//       name: rule.name || '',
//       description: rule.description || '',
//       type: rule.type || 'percentage',
//       value: rule.value || 10,
//       applyTo: rule.applyTo || 'all',
//       performanceTier: rule.performanceTier || ''
//     });
//     setShowRuleModal(true);
//   };

//   // Filter rules
//   const filteredRules = commissionRules.filter(rule => {
//     const matchesSearch = rule.name.toLowerCase().includes(filters.search.toLowerCase());
//     const matchesActive = filters.isActive === '' || rule.isActive.toString() === filters.isActive;
//     const matchesTier = filters.performanceTier === '' || rule.performanceTier === filters.performanceTier;
    
//     return matchesSearch && matchesActive && matchesTier;
//   });

//   // Filter bookings
//   const filteredBookings = bookings.filter(booking => {
//     const matchesSearch = filters.bookingSearch === '' || 
//       booking._id.toLowerCase().includes(filters.bookingSearch.toLowerCase());
//     return matchesSearch;
//   });

//   // Initial data fetch
//   useEffect(() => {
//     fetchCommissionRules();
//     fetchProviders();
//     fetchBookings();
//     fetchCommissionStats();
//   }, []);

//   // Refetch when filters change
//   useEffect(() => {
//     fetchCommissionRules(1, pagination.limit);
//   }, [filters.isActive]);

//   useEffect(() => {
//     fetchBookings();
//   }, [filters.bookingSearch]);

//   return (
//     <div className="p-6 max-w-7xl mx-auto">
//       {/* Header */}
//       <div className="flex justify-between items-center mb-6">
//         <div>
//           <h1 className="text-3xl font-bold text-gray-900">Commission Management</h1>
//           <p className="text-gray-600">Manage commission rules and provider earnings</p>
//         </div>
//         <button
//           onClick={() => {
//             resetRuleForm();
//             setShowRuleModal(true);
//           }}
//           className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
//         >
//           <Plus className="w-4 h-4" />
//           Add Commission Rule
//         </button>
//       </div>

//       {/* Enhanced Stats Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
//         <div className="bg-white rounded-lg shadow p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm font-medium text-gray-600">Total Commission</p>
//               <p className="text-2xl font-bold text-gray-900">₹{stats.totalCommission.toLocaleString()}</p>
//             </div>
//             <DollarSign className="w-8 h-8 text-green-600" />
//           </div>
//         </div>
        
//         <div className="bg-white rounded-lg shadow p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm font-medium text-gray-600">Active Rules</p>
//               <p className="text-2xl font-bold text-gray-900">{stats.activeRules}</p>
//             </div>
//             <CheckCircle className="w-8 h-8 text-blue-600" />
//           </div>
//         </div>
        
//         <div className="bg-white rounded-lg shadow p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm font-medium text-gray-600">Total Providers</p>
//               <p className="text-2xl font-bold text-gray-900">{stats.totalProviders}</p>
//             </div>
//             <Users className="w-8 h-8 text-purple-600" />
//           </div>
//         </div>
        
//         <div className="bg-white rounded-lg shadow p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm font-medium text-gray-600">Avg Commission Rate</p>
//               <p className="text-2xl font-bold text-gray-900">{stats.avgCommissionRate}%</p>
//             </div>
//             <TrendingUp className="w-8 h-8 text-orange-600" />
//           </div>
//         </div>
//       </div>

//       {/* Tabs */}
//       <div className="border-b border-gray-200 mb-6">
//         <nav className="flex space-x-8">
//           <button
//             onClick={() => setActiveTab('rules')}
//             className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
//               activeTab === 'rules'
//                 ? 'border-blue-500 text-blue-600'
//                 : 'border-transparent text-gray-500 hover:text-gray-700'
//             }`}
//           >
//             <Settings className="w-4 h-4" />
//             Commission Rules
//           </button>
//           <button
//             onClick={() => setActiveTab('providers')}
//             className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
//               activeTab === 'providers'
//                 ? 'border-blue-500 text-blue-600'
//                 : 'border-transparent text-gray-500 hover:text-gray-700'
//             }`}
//           >
//             <Users className="w-4 h-4" />
//             Provider Commissions
//           </button>
//           <button
//             onClick={() => setActiveTab('processing')}
//             className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
//               activeTab === 'processing'
//                 ? 'border-blue-500 text-blue-600'
//                 : 'border-transparent text-gray-500 hover:text-gray-700'
//             }`}
//           >
//             <DollarSign className="w-4 h-4" />
//             Commission Processing
//           </button>
//         </nav>
//       </div>

//       {/* Commission Rules Tab */}
//       {activeTab === 'rules' && (
//         <div className="space-y-6">
//           {/* Filters */}
//           <div className="bg-white rounded-lg shadow p-6">
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
//                 <div className="relative">
//                   <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <input
//                     type="text"
//                     placeholder="Search rules..."
//                     value={filters.search}
//                     onChange={(e) => setFilters({...filters, search: e.target.value})}
//                     className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   />
//                 </div>
//               </div>
              
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
//                 <select
//                   value={filters.isActive}
//                   onChange={(e) => setFilters({...filters, isActive: e.target.value})}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 >
//                   <option value="">All</option>
//                   <option value="true">Active</option>
//                   <option value="false">Inactive</option>
//                 </select>
//               </div>
              
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier</label>
//                 <select
//                   value={filters.performanceTier}
//                   onChange={(e) => setFilters({...filters, performanceTier: e.target.value})}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 >
//                   <option value="">All Tiers</option>
//                   {performanceTiers.map(tier => (
//                     <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
//                   ))}
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* Rules Table */}
//           <div className="bg-white rounded-lg shadow overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Rule Name
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Commission
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Apply To
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Performance Tier
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Status
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {filteredRules.map((rule) => (
//                     <tr key={rule._id} className="hover:bg-gray-50">
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="text-sm font-medium text-gray-900">{rule.name}</div>
//                         {rule.description && (
//                           <div className="text-sm text-gray-500">{rule.description}</div>
//                         )}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="text-sm text-gray-900">
//                           {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'}
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                           rule.applyTo === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
//                         }`}>
//                           {rule.applyTo === 'all' ? 'All Providers' : 'Performance Tier'}
//                         </span>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="text-sm text-gray-900">
//                           {rule.performanceTier ? 
//                             rule.performanceTier.charAt(0).toUpperCase() + rule.performanceTier.slice(1) : 
//                             'All Tiers'
//                           }
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                           rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
//                         }`}>
//                           {rule.isActive ? 'Active' : 'Inactive'}
//                         </span>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                         <div className="flex items-center gap-2">
//                           <button
//                             onClick={() => openEditModal(rule)}
//                             className="text-blue-600 hover:text-blue-900"
//                             title="Edit"
//                           >
//                             <Edit className="w-4 h-4" />
//                           </button>
//                           <button
//                             onClick={() => toggleRuleStatus(rule._id)}
//                             className={rule.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
//                             title={rule.isActive ? 'Deactivate' : 'Activate'}
//                           >
//                             {rule.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>

//             {/* Pagination */}
//             {pagination.pages > 1 && (
//               <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
//                 <div className="flex-1 flex justify-between sm:hidden">
//                   <button
//                     onClick={() => fetchCommissionRules(pagination.page - 1, pagination.limit)}
//                     disabled={pagination.page <= 1}
//                     className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
//                   >
//                     Previous
//                   </button>
//                   <button
//                     onClick={() => fetchCommissionRules(pagination.page + 1, pagination.limit)}
//                     disabled={pagination.page >= pagination.pages}
//                     className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
//                   >
//                     Next
//                   </button>
//                 </div>
//                 <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
//                   <div>
//                     <p className="text-sm text-gray-700">
//                       Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
//                       <span className="font-medium">
//                         {Math.min(pagination.page * pagination.limit, pagination.total)}
//                       </span>{' '}
//                       of <span className="font-medium">{pagination.total}</span> results
//                     </p>
//                   </div>
//                   <div>
//                     <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
//                       <button
//                         onClick={() => fetchCommissionRules(pagination.page - 1, pagination.limit)}
//                         disabled={pagination.page <= 1}
//                         className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
//                       >
//                         Previous
//                       </button>
//                       <button
//                         onClick={() => fetchCommissionRules(pagination.page + 1, pagination.limit)}
//                         disabled={pagination.page >= pagination.pages}
//                         className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
//                       >
//                         Next
//                       </button>
//                     </nav>
//                   </div>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Provider Commission Tab */}
//       {activeTab === 'providers' && (
//         <div className="space-y-6">
//           {/* Provider Selection */}
//           <div className="bg-white rounded-lg shadow p-6">
//             <h3 className="text-lg font-semibold mb-4">Select Provider</h3>
//             <div className="flex gap-4">
//               <select
//                 value={selectedProvider || ''}
//                 onChange={(e) => {
//                   setSelectedProvider(e.target.value);
//                   if (e.target.value) {
//                     fetchProviderCommission(e.target.value);
//                   } else {
//                     setProviderCommission(null);
//                   }
//                 }}
//                 className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               >
//                 <option value="">Select a provider...</option>
//                 {providers.map(provider => (
//                   <option key={provider._id} value={provider._id}>
//                     {provider.name} - {provider.performanceTier || 'Standard'}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           {/* Provider Commission Details */}
//           {providerCommission && (
//             <div className="bg-white rounded-lg shadow p-6">
//               <h3 className="text-lg font-semibold mb-4">Commission Details</h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div>
//                   <h4 className="font-medium text-gray-900 mb-3">Provider Information</h4>
//                   <div className="space-y-2">
//                     <p className="text-sm">
//                       <span className="font-medium">Name:</span> {providerCommission.provider.name}
//                     </p>
//                     <p className="text-sm">
//                       <span className="font-medium">Performance Tier:</span> 
//                       <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
//                         {providerCommission.provider.performanceTier}
//                       </span>
//                     </p>
//                     <p className="text-sm">
//                       <span className="font-medium">Total Earnings:</span> ₹{providerCommission.totalEarnings?.toFixed(2) || '0.00'}
//                     </p>
//                   </div>
//                 </div>
                
//                 <div>
//                   <h4 className="font-medium text-gray-900 mb-3">Current Commission</h4>
//                   <div className="space-y-2">
//                     <p className="text-sm">
//                       <span className="font-medium">Rate:</span> 
//                       {providerCommission.currentCommission.value}
//                       {providerCommission.currentCommission.type === 'percentage' ? '%' : ' ₹'}
//                     </p>
//                     <p className="text-sm">
//                       <span className="font-medium">Rule:</span> {providerCommission.currentCommission.name || 'Default Commission'}
//                     </p>
//                     <p className="text-sm">
//                       <span className="font-medium">Total Commission Paid:</span> ₹{providerCommission.totalCommissionPaid?.toFixed(2) || '0.00'}
//                     </p>
//                   </div>
//                 </div>
//               </div>
              
//               {/* All Active Rules */}
//               <div className="mt-6">
//                 <h4 className="font-medium text-gray-900 mb-3">All Active Rules</h4>
//                 {providerCommission.allActiveRules && providerCommission.allActiveRules.length > 0 ? (
//                   <div className="space-y-2">
//                     {providerCommission.allActiveRules.map((rule) => (
//                       <div key={rule._id} className="p-3 bg-gray-50 rounded-lg">
//                         <div className="flex justify-between items-start">
//                           <div>
//                             <p className="font-medium text-sm">{rule.name}</p>
//                             <p className="text-xs text-gray-600 mt-1">
//                               {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'} commission
//                               {rule.applyTo === 'performanceTier' && rule.performanceTier && ` | Tier: ${rule.performanceTier}`}
//                             </p>
//                           </div>
//                           <span className={`px-2 py-1 text-xs rounded-full ${
//                             rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
//                           }`}>
//                             {rule.isActive ? 'Active' : 'Inactive'}
//                           </span>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <p className="text-sm text-gray-500">No active rules found.</p>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Commission Processing Tab */}
//       {activeTab === 'processing' && (
//         <div className="space-y-6">
//           <div className="bg-white rounded-lg shadow p-6">
//             <h3 className="text-lg font-semibold mb-4">Process Commission for Completed Bookings</h3>
            
//             {/* Booking Search */}
//             <div className="mb-4">
//               <label className="block text-sm font-medium text-gray-700 mb-2">Search Bookings</label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                 <input
//                   type="text"
//                   placeholder="Search by booking ID..."
//                   value={filters.bookingSearch}
//                   onChange={(e) => setFilters({...filters, bookingSearch: e.target.value})}
//                   className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 />
//               </div>
//             </div>
            
//             <div className="flex justify-between items-center mb-4">
//               <p className="text-gray-600">
//                 {filteredBookings.filter(b => !b.invoice).length} bookings need commission processing
//               </p>
//               <div className="flex items-center gap-2">
//                 <span className="text-sm text-gray-600">
//                   Total Processed: {stats.totalProcessedCommissions}
//                 </span>
//                 <button 
//                   onClick={fetchCommissionStats}
//                   className="text-gray-500 hover:text-gray-700"
//                   title="Refresh stats"
//                 >
//                   <RefreshCw className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
            
//             {filteredBookings.length > 0 ? (
//               <div className="overflow-x-auto">
//                 <table className="min-w-full divide-y divide-gray-200">
//                   <thead className="bg-gray-50">
//                     <tr>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Booking ID
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Provider
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Service
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Total Amount
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Status
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Actions
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white divide-y divide-gray-200">
//                     {filteredBookings
//                       .filter(booking => booking.status === 'completed' && !booking.invoice)
//                       .map((booking) => (
//                       <tr key={booking._id} className="hover:bg-gray-50">
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="text-sm font-medium text-gray-900">
//                             #{booking._id?.slice(-8)}
//                             <button 
//                               onClick={() => {
//                                 navigator.clipboard.writeText(booking._id);
//                                 showToast('Booking ID copied to clipboard');
//                               }}
//                               className="ml-2 text-gray-400 hover:text-gray-600"
//                               title="Copy ID"
//                             >
//                               <Eye className="w-4 h-4" />
//                             </button>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="text-sm text-gray-900">{booking.provider?.name || 'N/A'}</div>
//                           <div className="text-xs text-gray-500">
//                             {booking.provider?.performanceTier || 'Standard'}
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="text-sm text-gray-900">{booking.service?.name || 'N/A'}</div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="text-sm text-gray-900">₹{booking.totalAmount?.toFixed(2) || '0.00'}</div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
//                             Completed
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                           <button
//                             onClick={() => processBookingCommission(booking._id)}
//                             className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
//                           >
//                             Process Commission
//                           </button>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             ) : (
//               <div className="text-center py-8">
//                 <p className="text-gray-500">No completed bookings found that need commission processing.</p>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Commission Rule Modal */}
//       {showRuleModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
//             <div className="flex justify-between items-center mb-4">
//               <h3 className="text-lg font-semibold">
//                 {editingRule ? 'Edit Commission Rule' : 'Add Commission Rule'}
//               </h3>
//               <button
//                 onClick={() => {
//                   setShowRuleModal(false);
//                   setEditingRule(null);
//                   resetRuleForm();
//                 }}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 ×
//               </button>
//             </div>
            
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name*</label>
//                 <input
//                   type="text"
//                   value={ruleForm.name}
//                   onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   placeholder="e.g., Premium Providers Commission"
//                   required
//                 />
//               </div>
              
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
//                 <textarea
//                   value={ruleForm.description}
//                   onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   placeholder="Optional description of this rule"
//                   rows="3"
//                 />
//               </div>
              
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">Commission Type*</label>
//                   <select
//                     value={ruleForm.type}
//                     onChange={(e) => setRuleForm({...ruleForm, type: e.target.value})}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     required
//                   >
//                     <option value="percentage">Percentage</option>
//                     <option value="fixed">Fixed Amount</option>
//                   </select>
//                 </div>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Commission Value* {ruleForm.type === 'percentage' ? '(%)' : '(₹)'}
//                   </label>
//                   <input
//                     type="number"
//                     value={ruleForm.value}
//                     onChange={(e) => setRuleForm({...ruleForm, value: parseFloat(e.target.value) || 0})}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     min="0"
//                     step={ruleForm.type === 'percentage' ? '0.1' : '1'}
//                     required
//                   />
//                 </div>
//               </div>
              
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Apply To*</label>
//                 <select
//                   value={ruleForm.applyTo}
//                   onChange={(e) => setRuleForm({...ruleForm, applyTo: e.target.value, performanceTier: ''})}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   required
//                 >
//                   <option value="all">All Providers</option>
//                   <option value="performanceTier">Performance Tier</option>
//                 </select>
//               </div>
              
//               {ruleForm.applyTo === 'performanceTier' && (
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier*</label>
//                   <select
//                     value={ruleForm.performanceTier}
//                     onChange={(e) => setRuleForm({...ruleForm, performanceTier: e.target.value})}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     required
//                   >
//                     <option value="">Select Performance Tier</option>
//                     {performanceTiers.map(tier => (
//                       <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
//                     ))}
//                   </select>
//                 </div>
//               )}
//             </div>
            
//             <div className="flex justify-end gap-3 mt-6">
//               <button
//                 onClick={() => {
//                   setShowRuleModal(false);
//                   setEditingRule(null);
//                   resetRuleForm();
//                 }}
//                 className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleSaveRule}
//                 disabled={loading || !ruleForm.name || !ruleForm.value || ruleForm.value < 0}
//                 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
//               >
//                 {loading ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Loading Overlay */}
//       {loading && (
//         <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
//           <div className="bg-white rounded-lg p-6 flex items-center gap-3">
//             <RefreshCw className="w-5 h-5 animate-spin" />
//             <span>Loading...</span>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default AdminCommissionPage;



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
  Download,
  CheckCircle,
  XCircle
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
  const [bookings, setBookings] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalCommission: 0,
    totalProviders: 0,
    activeRules: 0,
    avgCommissionRate: 10,
    totalProcessedCommission: 0,
    pendingCommission: 0
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
    performanceTier: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    performanceTier: '',
    bookingSearch: ''
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
        ...(filters.isActive && { isActive: filters.isActive })
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
          const avgRate = data.data
            .filter(rule => rule.type === 'percentage')
            .reduce((sum, rule) => sum + rule.value, 0) / 
            data.data.filter(rule => rule.type === 'percentage').length;
          setStats(prev => ({ ...prev, avgCommissionRate: avgRate?.toFixed(1) || 10 }));
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
        setProviders(data.providers || data.data || []);
        setStats(prev => ({ 
          ...prev, 
          totalProviders: (data.providers || data.data || []).length 
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
        ...(ruleForm.applyTo === 'performanceTier' && { performanceTier: ruleForm.performanceTier })
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
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to toggle rule status', 'error');
      }
    } catch (error) {
      showToast('Failed to toggle rule status', 'error');
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
        fetchBookings();
        fetchCommissionStats(); // Refresh stats after processing
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
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        status: 'completed',
        ...(filters.bookingSearch && { search: filters.bookingSearch })
      });

      const response = await fetch(`${API}/admin/bookings?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBookings(data.bookings || data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch commission statistics
  const fetchCommissionStats = async () => {
    try {
      const response = await fetch(`${API}/commission/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(prev => ({
          ...prev,
          totalCommission: data.totalCommission || 0,
          totalProcessedCommission: data.totalProcessedCommission || 0,
          pendingCommission: data.pendingCommission || 0
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
      performanceTier: ''
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
      performanceTier: rule.performanceTier || ''
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
      (booking.provider?.name && booking.provider.name.toLowerCase().includes(filters.bookingSearch.toLowerCase()));
    
    return matchesSearch;
  });

  // Initial data fetch
  useEffect(() => {
    fetchCommissionRules();
    fetchProviders();
    fetchBookings();
    fetchCommissionStats();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    if (activeTab === 'rules') {
      fetchCommissionRules(1, pagination.limit);
    } else if (activeTab === 'processing') {
      fetchBookings();
    }
  }, [filters.isActive, filters.bookingSearch]);

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
            <CheckCircle className="w-8 h-8 text-blue-600" />
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
        </nav>
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
                      Apply To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance Tier
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
                        {rule.description && (
                          <div className="text-sm text-gray-500">{rule.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          rule.applyTo === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {rule.applyTo === 'all' ? 'All Providers' : 'Performance Tier'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rule.performanceTier ? 
                            rule.performanceTier.charAt(0).toUpperCase() + rule.performanceTier.slice(1) : 
                            'All Tiers'
                          }
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
                            {rule.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                        Previous
                      </button>
                      <button
                        onClick={() => fetchCommissionRules(pagination.page + 1, pagination.limit)}
                        disabled={pagination.page >= pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
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
          <div className="bg-white rounded-lg shadow p-6">
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <span className="font-medium">Performance Tier:</span> 
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {providerCommission.provider.performanceTier}
                      </span>
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Current Commission</h4>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Rate:</span> 
                      {providerCommission.currentCommission.value}
                      {providerCommission.currentCommission.type === 'percentage' ? '%' : ' ₹'}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Rule:</span> {providerCommission.currentCommission.name || 'Default Commission'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* All Active Rules */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">All Active Rules</h4>
                {providerCommission.allActiveRules && providerCommission.allActiveRules.length > 0 ? (
                  <div className="space-y-2">
                    {providerCommission.allActiveRules.map((rule) => (
                      <div key={rule._id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{rule.name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {rule.value}{rule.type === 'percentage' ? '%' : ' ₹'} commission
                              {rule.applyTo === 'performanceTier' && rule.performanceTier && ` | Tier: ${rule.performanceTier}`}
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
                  <p className="text-sm text-gray-500">No active rules found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commission Processing Tab */}
      {activeTab === 'processing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Process Commission for Completed Bookings</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by booking ID or provider..."
                  value={filters.bookingSearch}
                  onChange={(e) => setFilters({...filters, bookingSearch: e.target.value})}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              Process commission for completed bookings that haven't been processed yet.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Total Processed</p>
                <p className="text-xl font-bold text-gray-900">₹{stats.totalProcessedCommission.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Pending Commission</p>
                <p className="text-xl font-bold text-gray-900">₹{stats.pendingCommission.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Bookings to Process</p>
                <p className="text-xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'completed' && !b.invoice).length}
                </p>
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
                        Total Amount
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
                            <div className="text-sm font-medium text-gray-900">#{booking._id?.slice(-8)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{booking.provider?.name || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">₹{booking.totalAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Completed
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => processBookingCommission(booking._id)}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
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
              <div className="text-center py-8">
                <p className="text-gray-500">No completed bookings found that need commission processing.</p>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Premium Providers Commission"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Apply To*</label>
                <select
                  value={ruleForm.applyTo}
                  onChange={(e) => setRuleForm({...ruleForm, applyTo: e.target.value, performanceTier: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="all">All Providers</option>
                  <option value="performanceTier">Performance Tier</option>
                </select>
              </div>
              
              {ruleForm.applyTo === 'performanceTier' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Performance Tier*</label>
                  <select
                    value={ruleForm.performanceTier}
                    onChange={(e) => setRuleForm({...ruleForm, performanceTier: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Performance Tier</option>
                    {performanceTiers.map(tier => (
                      <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
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
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={loading || !ruleForm.name || !ruleForm.value || ruleForm.value < 0}
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