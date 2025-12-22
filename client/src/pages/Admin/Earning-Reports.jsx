import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../store/auth';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const AdminEarningReports = () => {
  const { API, showToast, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earningsData, setEarningsData] = useState({
    withdrawalRequests: [],
    withdrawalReport: [],
    providerEarnings: [],
    commissionReport: [],
    failedRejected: []
  });
  const [filters, setFilters] = useState({
    dateRange: '7d',
    startDate: '',
    endDate: '',
    status: '',
    reportType: 'withdrawal'
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [downloading, setDownloading] = useState(false);

  // Color palette
  const COLORS = {
    primary: '#0D9488',
    secondary: '#374151',
    accent: '#F97316',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  };

  // Chart colors
  const CHART_COLORS = [COLORS.primary, COLORS.accent, COLORS.success, COLORS.warning, '#8B5CF6', '#06B6D4'];

  // Fetch data on component mount and filter changes
  useEffect(() => {
    fetchDashboardData();
  }, [filters.dateRange, filters.status]);

  const getDateRange = () => {
    let fromDate, toDate = new Date();
    
    switch (filters.dateRange) {
      case '1d':
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 1);
        break;
      case '7d':
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 7);
        break;
      case '30d':
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 30);
        break;
      case '90d':
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 90);
        break;
      case 'custom':
        if (filters.startDate && filters.endDate) {
          fromDate = new Date(filters.startDate);
          toDate = new Date(filters.endDate);
        } else {
          fromDate = new Date();
          fromDate.setDate(toDate.getDate() - 7);
        }
        break;
      default:
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 7);
    }

    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0]
    };
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      
      // Fetch withdrawal requests
      const withdrawalRequestsRes = await fetch(
        `${API}/payment/admin/withdrawal-requests?status=${filters.status || ''}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (withdrawalRequestsRes.ok) {
        const data = await withdrawalRequestsRes.json();
        setEarningsData(prev => ({
          ...prev,
          withdrawalRequests: data.data || []
        }));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async (reportType) => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      let endpoint = '';

      switch (reportType) {
        case 'withdrawal':
          endpoint = 'withdrawal-report';
          break;
        case 'provider-earnings':
          endpoint = 'provider-earnings-report';
          break;
        case 'commission':
          endpoint = 'commission-report';
          break;
        case 'failed-rejected':
          endpoint = 'failed-rejected-report';
          break;
        default:
          endpoint = 'withdrawal-report';
      }

      const response = await fetch(
        `${API}/payment/admin/${endpoint}?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEarningsData(prev => ({
          ...prev,
          [`${reportType}Report`]: data.data || []
        }));
      } else {
        throw new Error('Failed to fetch report data');
      }

    } catch (error) {
      console.error(`Error fetching ${reportType} report:`, error);
      showToast(`Failed to load ${reportType} data`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (reportType) => {
    setDownloading(true);
    try {
      const dateRange = getDateRange();
      let endpoint = '';

      switch (reportType) {
        case 'withdrawal':
          endpoint = 'withdrawal-report';
          break;
        case 'provider-earnings':
          endpoint = 'provider-earnings-report';
          break;
        case 'commission':
          endpoint = 'commission-report';
          break;
        case 'failed-rejected':
          endpoint = 'failed-rejected-report';
          break;
        default:
          endpoint = 'withdrawal-report';
      }

      const response = await fetch(
        `${API}/payment/admin/${endpoint}?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}&download=true`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report_${dateRange.fromDate}_to_${dateRange.toDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast(`${reportType.replace('-', ' ')} report downloaded successfully!`, 'success');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      showToast('Failed to download report', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    try {
      const transactionReference = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
      
      const response = await fetch(`${API}/payment/admin/withdrawal-request/${withdrawalId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionReference,
          notes: 'Approved via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('Withdrawal approved successfully!', 'success');
        fetchDashboardData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Approval failed');
      }
    } catch (error) {
      console.error('Approve error:', error);
      showToast(error.message || 'Failed to approve withdrawal', 'error');
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    const rejectionReason = prompt('Please enter the reason for rejection:');
    if (!rejectionReason) return;

    try {
      const response = await fetch(`${API}/payment/admin/withdrawal-request/${withdrawalId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rejectionReason,
          adminRemark: 'Rejected via admin dashboard'
        })
      });

      if (response.ok) {
        showToast('Withdrawal rejected successfully!', 'success');
        fetchDashboardData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Rejection failed');
      }
    } catch (error) {
      console.error('Reject error:', error);
      showToast(error.message || 'Failed to reject withdrawal', 'error');
    }
  };

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const withdrawals = earningsData.withdrawalRequests;
    
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const completedWithdrawals = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    
    const statusCounts = withdrawals.reduce((acc, w) => {
      acc[w.status] = (acc[w.status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalWithdrawals,
      completedWithdrawals,
      pendingWithdrawals: totalWithdrawals - completedWithdrawals,
      totalRequests: withdrawals.length,
      statusCounts,
      recentWithdrawals: withdrawals.slice(0, 5)
    };
  }, [earningsData.withdrawalRequests]);

  // Withdrawal status chart data
  const withdrawalChartData = useMemo(() => {
    return Object.entries(dashboardMetrics.statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      amount: earningsData.withdrawalRequests
        .filter(w => w.status === status)
        .reduce((sum, w) => sum + (w.amount || 0), 0)
    }));
  }, [dashboardMetrics.statusCounts]);

  if (loading && activeTab === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Earnings & Payments Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage withdrawals, view reports, and track earnings</p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'withdrawals', label: 'Withdrawal Requests', icon: '💳' },
              { id: 'reports', label: 'Reports & Downloads', icon: '📋' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select 
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
            <select 
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Status</option>
              <option value="requested">Requested</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchDashboardData}
              className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-teal-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Withdrawal Requests"
              value={dashboardMetrics.totalRequests}
              subtitle="All time"
              color={COLORS.primary}
              icon="📥"
            />
            <MetricCard
              title="Total Amount Requested"
              value={`₹${dashboardMetrics.totalWithdrawals?.toLocaleString()}`}
              subtitle="Sum of all requests"
              color={COLORS.info}
              icon="💰"
            />
            <MetricCard
              title="Completed Withdrawals"
              value={`₹${dashboardMetrics.completedWithdrawals?.toLocaleString()}`}
              subtitle="Successfully processed"
              color={COLORS.success}
              icon="✅"
            />
            <MetricCard
              title="Pending Amount"
              value={`₹${dashboardMetrics.pendingWithdrawals?.toLocaleString()}`}
              subtitle="Awaiting action"
              color={COLORS.warning}
              icon="⏳"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Withdrawal Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdrawal Status Distribution</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={withdrawalChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {withdrawalChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Withdrawal Requests</h3>
              <div className="space-y-3">
                {dashboardMetrics.recentWithdrawals.map((withdrawal) => (
                  <div key={withdrawal._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {withdrawal.provider?.name || 'Unknown Provider'}
                      </p>
                      <p className="text-sm text-gray-500">
                        ₹{withdrawal.amount?.toLocaleString()} • {new Date(withdrawal.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={withdrawal.status} />
                  </div>
                ))}
                {dashboardMetrics.recentWithdrawals.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No recent withdrawals</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Requests Tab */}
      {activeTab === 'withdrawals' && (
        <WithdrawalRequestsTable
          withdrawals={earningsData.withdrawalRequests}
          onApprove={handleApproveWithdrawal}
          onReject={handleRejectWithdrawal}
          loading={loading}
        />
      )}

      {/* Reports & Downloads Tab */}
      {activeTab === 'reports' && (
        <ReportsSection
          onDownload={handleDownloadReport}
          onFetchReport={fetchReportData}
          downloading={downloading}
          filters={filters}
          onFilterChange={setFilters}
        />
      )}
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, subtitle, color, icon }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4" style={{ borderLeftColor: color }}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>
      <span className="text-3xl opacity-80">{icon}</span>
    </div>
  </div>
);

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    requested: { color: 'bg-yellow-100 text-yellow-800', label: 'Requested' },
    processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
    completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
    rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
    failed: { color: 'bg-red-100 text-red-800', label: 'Failed' }
  };

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Withdrawal Requests Table Component
const WithdrawalRequestsTable = ({ withdrawals, onApprove, onReject, loading }) => (
  <div className="bg-white rounded-lg shadow-sm">
    <div className="p-6 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Withdrawal Requests Management</h3>
      <p className="text-gray-600 mt-1">Approve or reject withdrawal requests from providers</p>
    </div>
    
    {loading ? (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{withdrawal.provider?.name || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{withdrawal.provider?.email || ''}</div>
                  <div className="text-sm text-gray-500">{withdrawal.provider?.phone || ''}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">₹{withdrawal.amount?.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">Net: ₹{withdrawal.netAmount?.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                  {withdrawal.paymentMethod?.replace('_', ' ') || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {withdrawal.paymentDetails ? (
                    <div>
                      <div>{withdrawal.paymentDetails.bankName}</div>
                      <div>****{withdrawal.paymentDetails.accountNumber?.slice(-4)}</div>
                      <div>{withdrawal.paymentDetails.ifscCode}</div>
                    </div>
                  ) : (
                    'N/A'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={withdrawal.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(withdrawal.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {withdrawal.status === 'requested' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprove(withdrawal._id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(withdrawal._id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {withdrawal.status !== 'requested' && (
                    <span className="text-gray-400 text-xs">No actions available</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {withdrawals.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">💸</div>
            <p className="text-gray-500">No withdrawal requests found</p>
            <p className="text-gray-400 text-sm mt-1">All withdrawal requests are processed</p>
          </div>
        )}
      </div>
    )}
  </div>
);

// Reports Section Component
const ReportsSection = ({ onDownload, onFetchReport, downloading, filters, onFilterChange }) => {
  const reportTypes = [
    {
      id: 'withdrawal',
      title: 'Withdrawal Report',
      description: 'Complete history of all withdrawal transactions',
      icon: '💳',
      features: ['Amount details', 'Payment methods', 'Status tracking', 'Bank information']
    },
    {
      id: 'provider-earnings',
      title: 'Provider Earnings Report',
      description: 'Detailed earnings breakdown for each provider',
      icon: '👥',
      features: ['Provider-wise earnings', 'Commission calculations', 'Net amounts', 'Withdrawal history']
    },
    {
      id: 'commission',
      title: 'Commission Report',
      description: 'Platform commission revenue analysis',
      icon: '💰',
      features: ['Commission rates', 'Service-wise breakdown', 'Revenue tracking', 'Date-wise analysis']
    },
    {
      id: 'failed-rejected',
      title: 'Failed & Rejected Report',
      description: 'Analysis of unsuccessful withdrawal attempts',
      icon: '❌',
      features: ['Failure reasons', 'Rejection analysis', 'Amount details', 'Provider information']
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Download Reports</h3>
        <p className="text-gray-600 mb-4">Generate and download detailed reports in Excel format</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportTypes.map((report) => (
            <div key={report.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{report.icon}</span>
                    <h4 className="text-lg font-semibold text-gray-900">{report.title}</h4>
                  </div>
                  <p className="text-gray-600 text-sm">{report.description}</p>
                </div>
              </div>
              
              <ul className="space-y-2 mb-4">
                {report.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600">
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => onDownload(report.id)}
                disabled={downloading}
                className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    📥 Download Excel Report
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Report Preview Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Preview & Customization</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select 
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={filters.reportType}
              onChange={(e) => onFilterChange(prev => ({ ...prev, reportType: e.target.value }))}
            >
              {reportTypes.map(report => (
                <option key={report.id} value={report.id}>{report.title}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select 
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={filters.dateRange}
              onChange={(e) => onFilterChange(prev => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => onFetchReport(filters.reportType)}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
            >
              Preview Data
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-600 text-sm text-center">
            Select a report type and date range to preview data before downloading. 
            All reports will be generated based on your current filter settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminEarningReports;