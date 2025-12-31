import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Download,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  Wallet,
  Receipt,
  TrendingDown,
  Menu,
  X
} from 'lucide-react';

const ProviderEarningsDashboard = () => {
  const { token, API, showToast, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalEarnings: 0,
    cashReceived: 0,
    commissionPending: 0,
    availableBalance: 0,
    totalPendingWithdrawals: 0
  });
  const [earningsReport, setEarningsReport] = useState([]);
  const [withdrawalReport, setWithdrawalReport] = useState([]);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [expandedCards, setExpandedCards] = useState({
    weekly: false,
    monthly: false
  });
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: ''
  });
  const [downloading, setDownloading] = useState({ earnings: false, withdrawals: false });
  const [providerBankDetails, setProviderBankDetails] = useState(null);
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalEarnings: 0
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  // Fetch earnings summary
  const fetchSummary = async () => {
    try {
      setLoading(true);

      // Calculate current month start and end dates
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];

      const response = await fetch(`${API}/payment/summary?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || errorData?.message || 'Failed to fetch earnings summary');
      }

      const data = await response.json();
      if (data.success) {
        setSummary({
          totalEarnings: data.totalEarnings || 0,
          cashReceived: data.cashReceived || 0,
          commissionPending: data.commissionPending || 0,
          availableBalance: data.availableBalance || 0,
          totalPendingWithdrawals: data.pendingWithdrawals || 0
        });
      } else {
        throw new Error(data.error || data.message || 'Failed to fetch earnings summary');
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch weekly/monthly earnings data
  const fetchWeeklyMonthlyData = async () => {
    try {
      // Generate weekly data for current month
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const weeklyResponse = await fetch(
        `${API}/payment/earnings-report?startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        if (weeklyData.success && weeklyData.earnings) {
          processWeeklyData(weeklyData.earnings);
        }
      }

      // Generate monthly data for current year
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

      const monthlyResponse = await fetch(
        `${API}/payment/earnings-report?startDate=${startOfYear.toISOString().split('T')[0]}&endDate=${endOfYear.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (monthlyResponse.ok) {
        const monthlyData = await monthlyResponse.json();
        if (monthlyData.success && monthlyData.earnings) {
          processMonthlyData(monthlyData.earnings);
        }
      }

    } catch (error) {
      console.error('Error fetching weekly/monthly data:', error);
    }
  };

  // Process weekly data
  const processWeeklyData = (earnings) => {
    const weeks = [];
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Generate 4 weeks for current month
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(startOfMonth.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekEarnings = earnings.filter(earning => {
        const earningDate = new Date(earning.createdAt);
        return earningDate >= weekStart && earningDate <= weekEnd;
      });

      weeks.push({
        week: `Week ${i + 1}`,
        startDate: weekStart,
        endDate: weekEnd,
        earnings: weekEarnings.reduce((sum, e) => sum + (e.netAmount || 0), 0),
        count: weekEarnings.length
      });
    }

    setWeeklyData(weeks);
  };

  // Process monthly data
  const processMonthlyData = (earnings) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthlyEarnings = months.map((month, index) => {
      const monthEarnings = earnings.filter(earning => {
        const earningDate = new Date(earning.createdAt);
        return earningDate.getMonth() === index;
      });

      return {
        month,
        earnings: monthEarnings.reduce((sum, e) => sum + (e.netAmount || 0), 0),
        count: monthEarnings.length,
        commission: monthEarnings.reduce((sum, e) => sum + (e.commissionAmount || 0), 0)
      };
    });

    setMonthlyData(monthlyEarnings);
  };

  // Fetch earnings report
  const fetchEarningsReport = async (page = pagination.currentPage, limit = pagination.pageSize) => {
    try {
      let url = `${API}/payment/earnings-report`;
      const params = new URLSearchParams();

      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);

      url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || errorData?.message || 'Failed to fetch earnings report');
      }

      const data = await response.json();
      if (data.success) {
        setEarningsReport(data.earnings || []);
        setPagination(prev => ({
          ...prev,
          currentPage: page,
          pageSize: limit,
          totalEarnings: data.totalCount || 0
        }));
      } else {
        throw new Error(data.error || data.message || 'Failed to fetch earnings report');
      }
    } catch (error) {
      console.error('Error fetching earnings report:', error);
      showToast(error.message, 'error');
    }
  };

  // Fetch withdrawal report
  const fetchWithdrawalReport = async () => {
    try {
      let url = `${API}/payment/withdrawal-report`;
      const params = new URLSearchParams();

      if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || errorData?.message || 'Failed to fetch withdrawal report');
      }

      const data = await response.json();
      if (data.success) {
        setWithdrawalReport(data.records || []);
      } else {
        throw new Error(data.error || data.message || 'Failed to fetch withdrawal report');
      }
    } catch (error) {
      console.error('Error fetching withdrawal report:', error);
      showToast(error.message, 'error');
    }
  };

  // Fetch provider profile for bank details
  const fetchProviderProfile = async () => {
    try {
      const response = await fetch(`${API}/provider/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || errorData?.message || 'Failed to fetch provider profile');
      }

      const data = await response.json();
      if (data.provider && data.provider.bankDetails) {
        setProviderBankDetails(data.provider.bankDetails);
        return data.provider.bankDetails;
      } else {
        throw new Error('No bank details found in profile');
      }
    } catch (error) {
      console.error('Error fetching provider profile:', error);
      showToast(error.message, 'error');
      return null;
    }
  };

  // Handle withdrawal request
  const handleWithdrawal = async () => {
    try {
      if (!withdrawalForm.amount || withdrawalForm.amount < 500) {
        showToast('Minimum withdrawal amount is ₹500', 'error');
        return;
      }

      // Refresh balance to ensure we have the latest data
      await fetchSummary();

      if (withdrawalForm.amount > summary.availableBalance) {
        showToast(`Insufficient balance. Available: ₹${summary.availableBalance}`, 'error');
        return;
      }

      showConfirmation(
        `Are you sure you want to withdraw ₹${withdrawalForm.amount}? This action cannot be undone.`,
        async () => {
          try {
            setProcessingWithdrawal(true);

            const response = await fetch(`${API}/payment/withdraw`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                amount: parseFloat(withdrawalForm.amount)
              })
            });

            const data = await response.json();

            if (!response.ok) {
              // If backend provides actual balance, use it
              const actualBalance = data.availableBalance !== undefined ? data.availableBalance : summary.availableBalance;

              if (data.error?.includes('exceeds available balance')) {
                showToast(`Insufficient balance. Available: ₹${actualBalance}`, 'error');
              } else {
                throw new Error(data?.error || data?.message || 'Failed to process withdrawal');
              }
              return;
            }

            if (data.success) {
              showToast('Withdrawal request submitted successfully!', 'success');
              setShowWithdrawal(false);
              setWithdrawalForm({ amount: '' });
              await refreshData(); // Refresh all data
            } else {
              throw new Error(data.error || data.message || 'Failed to process withdrawal');
            }
          } catch (error) {
            console.error('Error processing withdrawal:', error);
            showToast(error.message, 'error');
          } finally {
            setProcessingWithdrawal(false);
          }
        }
      );
    } catch (error) {
      console.error('Error preparing withdrawal:', error);
      showToast(error.message, 'error');
    }
  };

  // Download Report function
  const downloadReport = async (type) => {
    try {
      setDownloading(prev => ({ ...prev, [type]: true }));

      if (!dateFilter.startDate || !dateFilter.endDate) {
        showToast('Please select a start and end date to download the report', 'error');
        return;
      }

      // First, check if there is data to download
      const checkParams = new URLSearchParams();
      checkParams.append('startDate', dateFilter.startDate);
      checkParams.append('endDate', dateFilter.endDate);

      const endpoint = type === 'earnings' ? 'earnings-report' : 'withdrawal-report';
      const checkResponse = await fetch(`${API}/payment/${endpoint}?${checkParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!checkResponse.ok) {
        const errorData = await checkResponse.json();
        throw new Error(errorData?.error || errorData?.message || `Failed to check for ${type} report data`);
      }

      const checkData = await checkResponse.json();
      const records = type === 'earnings' ? checkData.earnings : checkData.records;

      if (!records || records.length === 0) {
        showToast(`No ${type} data found for the selected period.`, 'info');
        return;
      }

      // If data exists, proceed with download
      const downloadParams = new URLSearchParams();
      downloadParams.append('startDate', dateFilter.startDate);
      downloadParams.append('endDate', dateFilter.endDate);
      downloadParams.append('download', 'true');

      const downloadResponse = await fetch(`${API}/payment/${endpoint}?${downloadParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData?.error || errorData?.message || `Failed to download ${type} report`);
      }

      // Handle file download
      const blob = await downloadResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${dateFilter.startDate}_to_${dateFilter.endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded successfully!`, 'success');
    } catch (error) {
      console.error(`Error downloading ${type} report:`, error);
      showToast(error.message, 'error');
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Show confirmation modal
  const showConfirmation = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (confirmAction) {
      await confirmAction();
    }
    setShowConfirmModal(false);
    setConfirmMessage('');
    setConfirmAction(null);
  };

  // Refresh all data
  const refreshData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSummary(),
        fetchWeeklyMonthlyData()
      ]);
      if (activeTab === 'earnings') {
        await fetchEarningsReport();
      } else if (activeTab === 'withdrawals') {
        await fetchWithdrawalReport();
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Set up auto-refresh every 30 seconds to check for balance updates
    const autoRefreshInterval = setInterval(() => {
      fetchSummary();
    }, 5000); // 5 seconds

    return () => clearInterval(autoRefreshInterval);
  }, []);

  useEffect(() => {
    if (activeTab === 'earnings') {
      fetchEarningsReport();
    } else if (activeTab === 'withdrawals') {
      fetchWithdrawalReport();
    }
  }, [dateFilter, activeTab]);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'text-primary bg-green-100';
      case 'available': return 'text-primary bg-primary/10';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'requested': return 'text-yellow-600 bg-yellow-100';
      case 'paid': return 'text-primary bg-green-100';
      case 'failed':
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-secondary bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'available': return <Wallet className="w-4 h-4" />;
      case 'processing':
      case 'requested': return <Clock className="w-4 h-4" />;
      case 'failed':
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleCardExpansion = (cardType) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardType]: !prev[cardType]
    }));
  };

  const getTrend = (current, previous) => {
    if (previous === 0) return { trend: 'neutral', percentage: 0 };
    const change = ((current - previous) / previous) * 100;
    return {
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      percentage: Math.abs(change).toFixed(1)
    };
  };

  // Mobile tab navigation
  const MobileTabSelector = () => (
    <div className="md:hidden mb-4">
      <select
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
      >
        <option value="dashboard">Dashboard</option>
        <option value="earnings">Earnings Report</option>
        <option value="withdrawals">Withdrawal History</option>
        <option value="reports">Download Reports</option>
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent font-inter">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                className="md:hidden mr-2 p-2 rounded-md text-secondary"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Earnings Dashboard</h1>
                <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Track your earnings and manage withdrawals</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Earnings Card */}
          <div className="bg-background rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-lg sm:text-xl font-bold text-primary">
                  {formatCurrency(summary.totalEarnings)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
              </div>
              <div className="bg-primary/10 p-2 sm:p-3 rounded-full">
                <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
              </div>
            </div>
          </div>

          {/* Available Balance Card */}
          <div className="bg-background rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Balance</p>
                <p className="text-lg sm:text-xl font-bold text-primary">
                  {formatCurrency(summary.availableBalance)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
              </div>
              <div className="bg-primary/10 p-2 sm:p-3 rounded-full">
                <Wallet className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
              </div>
            </div>
          </div>

          {/* Cash Received Card */}
          <div className="bg-background rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cash Received</p>
                <p className="text-lg sm:text-xl font-bold text-accent">
                  {formatCurrency(summary.cashReceived)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Direct cash payments</p>
              </div>
              <div className="bg-accent/10 p-2 sm:p-3 rounded-full">
                <DollarSign className="w-5 sm:w-6 h-5 sm:h-6 text-accent" />
              </div>
            </div>
          </div>

          {/* Commission Pending Card */}
          <div className="bg-background rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Commission (Cash Booking)</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-600">
                  {formatCurrency(summary.commissionPending)}
                </p>
                <p className="text-xs text-gray-500 mt-1">To be paid to admin</p>
              </div>
              <div className="bg-yellow-100 p-2 sm:p-3 rounded-full">
                <Clock className="w-5 sm:w-6 h-5 sm:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Total Pending Withdrawals Card */}
          <div className="bg-background rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Withdrawals</p>
                <p className="text-lg sm:text-xl font-bold text-orange-600">
                  {formatCurrency(summary.totalPendingWithdrawals)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Awaiting processing</p>
              </div>
              <div className="bg-orange-100 p-2 sm:p-3 rounded-full">
                <Clock className="w-5 sm:w-6 h-5 sm:h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Weekly & Monthly Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Weekly Stats */}
          <div className="bg-background rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-secondary">Weekly Overview</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Current month breakdown</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleCardExpansion('weekly')}
                  className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  {expandedCards.weekly ?
                    <ChevronUp className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" /> :
                    <ChevronDown className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
                  }
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {weeklyData.slice(0, 4).map((week, index) => (
                  <div key={week.week} className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">{week.week}</p>
                    <p className="text-sm font-bold text-secondary">
                      {formatCurrency(week.earnings)}
                    </p>
                    <p className="text-xs text-gray-500">{week.count} bookings</p>
                  </div>
                ))}
              </div>

              {expandedCards.weekly && (
                <div className="mt-4 pt-4 border-t">
                  <div className="space-y-2">
                    {weeklyData.map((week) => (
                      <div key={week.week} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{week.week}</span>
                        <span className="text-sm font-medium text-secondary">
                          {formatCurrency(week.earnings)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Stats */}
          <div className="bg-background rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-accent/10 p-2 rounded-full">
                    <Activity className="w-4 sm:w-5 h-4 sm:h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-secondary">Monthly Overview</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Current year performance</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleCardExpansion('monthly')}
                  className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  {expandedCards.monthly ?
                    <ChevronUp className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" /> :
                    <ChevronDown className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
                  }
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {monthlyData.slice(0, 6).map((month, index) => {
                  const prevMonth = index > 0 ? monthlyData[index - 1] : null;
                  const trend = prevMonth ? getTrend(month.earnings, prevMonth.earnings) : { trend: 'neutral', percentage: 0 };

                  return (
                    <div key={month.month} className="bg-gray-50 p-2 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">{month.month}</span>
                        {trend.trend !== 'neutral' && (
                          <div className={`flex items-center gap-1 ${trend.trend === 'up' ? 'text-primary' : 'text-red-600'}`}>
                            {trend.trend === 'up' ?
                              <TrendingUp className="w-3 h-3" /> :
                              <TrendingDown className="w-3 h-3" />
                            }
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-secondary">
                        {formatCurrency(month.earnings)}
                      </p>
                      <p className="text-xs text-gray-500">{month.count} bookings</p>
                    </div>
                  );
                })}
              </div>

              {expandedCards.monthly && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-3">
                    {monthlyData.map((month) => (
                      <div key={month.month} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{month.month}</span>
                        <span className="text-sm font-medium text-secondary">
                          {formatCurrency(month.earnings)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Withdrawal Button */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => {
              if (!providerBankDetails) {
                fetchProviderProfile();
              }
              setShowWithdrawal(true);
            }}
            disabled={summary.availableBalance < 500}
            className="w-full sm:w-auto bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white px-4 sm:px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
          >
            <DollarSign className="w-4 sm:w-5 h-4 sm:h-5" />
            Request Withdrawal
          </button>
          {summary.availableBalance < 500 && (
            <p className="text-sm text-red-600 mt-2">
              Minimum ₹500 required for withdrawal. Current available: {formatCurrency(summary.availableBalance)}
            </p>
          )}
        </div>

        {/* Withdrawal Modal */}
        {showWithdrawal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-secondary">Request Withdrawal</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm({
                    ...withdrawalForm,
                    amount: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="500 minimum"
                  min="500"
                  max={summary.availableBalance}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {formatCurrency(summary.availableBalance)} | Minimum: ₹500
                </p>
              </div>

              {providerBankDetails && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-secondary mb-2">Bank Details:</p>
                  <p className="text-xs text-gray-600">Account: {providerBankDetails.accountNo}</p>
                  <p className="text-xs text-gray-600">IFSC: {providerBankDetails.ifsc}</p>
                  <p className="text-xs text-gray-600">Bank: {providerBankDetails.bankName}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowWithdrawal(false)}
                  className="px-4 py-2 text-secondary border border-gray-300 rounded-md hover:bg-gray-50 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdrawal}
                  disabled={processingWithdrawal || loading}
                  className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-1 order-1 sm:order-2 mb-3 sm:mb-0"
                >
                  {processingWithdrawal ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-secondary">Confirm Action</h3>

              <p className="text-secondary mb-6">{confirmMessage}</p>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-secondary border border-gray-300 rounded-md hover:bg-gray-50 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={processingWithdrawal}
                  className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-1 order-1 sm:order-2 mb-3 sm:mb-0"
                >
                  {processingWithdrawal ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Tab Selector */}
        <MobileTabSelector />

        {/* Tabs */}
        <div className="bg-background rounded-xl shadow-sm border border-gray-200">
          <div className="hidden md:block border-b border-gray-200">
            <nav className="flex flex-wrap space-x-8 px-6">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                { id: 'earnings', label: 'Earnings Report', icon: CreditCard },
                { id: 'withdrawals', label: 'Withdrawal History', icon: FileText },
                { id: 'reports', label: 'Download Reports', icon: Download }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-secondary'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-secondary">Recent Activity</h3>
                {withdrawalReport.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {withdrawalReport.slice(0, 5).map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="bg-accent/10 p-2 rounded-full">
                            <ArrowDownLeft className="w-4 h-4 text-accent" />
                          </div>
                          <div className="max-w-[60%]">
                            <p className="font-medium text-secondary text-sm sm:text-base">Withdrawal</p>
                            <p className="text-xs sm:text-sm text-gray-500">{formatDate(record.createdAt)}</p>
                            <p className="text-xs text-gray-400 truncate">Ref: {record.transactionReference}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-accent text-sm sm:text-base">
                            -{formatCurrency(record.amount)}
                          </p>
                          <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${getStatusColor(record.status)}`}>
                            {getStatusIcon(record.status)}
                            <span className="hidden sm:inline">{record.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <AlertCircle className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No recent activity found</p>
                  </div>
                )}
              </div>
            )}

            {/* Earnings Report Tab */}
            {activeTab === 'earnings' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-secondary">Earnings Report</h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <input
                        type="date"
                        value={dateFilter.startDate}
                        onChange={(e) => setDateFilter({
                          ...dateFilter,
                          startDate: e.target.value
                        })}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full sm:w-auto"
                      />
                      <span className="text-sm text-gray-500 hidden sm:inline">to</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-sm text-gray-500 sm:hidden">to</span>
                      <input
                        type="date"
                        value={dateFilter.endDate}
                        onChange={(e) => setDateFilter({
                          ...dateFilter,
                          endDate: e.target.value
                        })}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full sm:w-auto"
                      />
                    </div>
                    <button
                      onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                      className="text-sm text-primary hover:text-primary/80 w-full sm:w-auto text-left sm:text-center mt-1 sm:mt-0"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>

                {earningsReport.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking ID</th>
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Commission</th>
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-gray-200">
                        {earningsReport.map((earning) => (
                          <tr key={earning.booking}>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary">#{earning.booking}</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(earning.createdAt)}</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(earning.grossAmount)}</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">-{formatCurrency(earning.commissionAmount)} ({earning.commissionRate}%)</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">+{formatCurrency(earning.netAmount)}</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {earning.paymentMethod
                                ? earning.paymentMethod.charAt(0).toUpperCase() + earning.paymentMethod.slice(1)
                                : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <AlertCircle className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No earnings found for the selected period</p>
                  </div>
                )}

                {pagination.totalEarnings > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-500">
                      Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalEarnings)} of {pagination.totalEarnings} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchEarningsReport(pagination.currentPage - 1)}
                        disabled={pagination.currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {pagination.currentPage} of {Math.ceil(pagination.totalEarnings / pagination.pageSize)}
                      </span>
                      <button
                        onClick={() => fetchEarningsReport(pagination.currentPage + 1)}
                        disabled={pagination.currentPage >= Math.ceil(pagination.totalEarnings / pagination.pageSize)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Withdrawal History Tab */}
            {activeTab === 'withdrawals' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-secondary">Withdrawal History</h3>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full sm:w-auto"
                      defaultValue="all"
                    >
                      <option value="all">All Status</option>
                      <option value="requested">Requested</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value='rejected'>Rejected</option>
                    </select>
                  </div>
                </div>

                {withdrawalReport.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {withdrawalReport.map((record, index) => (
                      <div key={index} className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 max-w-[60%]">
                            <div className="bg-accent/10 p-2 rounded-full flex-shrink-0">
                              <ArrowDownLeft className="w-4 h-4 text-accent" />
                            </div>
                            <div>
                              <p className="font-medium text-secondary text-sm sm:text-base">Withdrawal Request</p>
                              <p className="text-xs sm:text-sm text-gray-500 truncate">Ref: {record.transactionReference}</p>
                              <p className="text-xs text-gray-400">{record.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : record.paymentMethod}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-accent text-sm sm:text-base">
                              {formatCurrency(record.amount)}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500">{formatDate(record.createdAt)}</p>
                            <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)}
                              <span className="hidden sm:inline">{record.status}</span>
                            </div>
                          </div>
                        </div>
                        {record.status === 'rejected' && (record.rejectionReason || record.adminRemark) && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            {record.rejectionReason && (
                              <p className="text-sm text-red-700 mb-1">
                                <strong>Rejection Reason:</strong> {record.rejectionReason}
                              </p>
                            )}
                            {record.adminRemark && (
                              <p className="text-sm text-red-700">
                                <strong>Admin Remark:</strong> {record.adminRemark}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <AlertCircle className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No withdrawal history found</p>
                  </div>
                )}
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-secondary">Download Reports</h3>

                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <label className="text-sm font-medium text-secondary">Date Range:</label>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <input
                        type="date"
                        value={dateFilter.startDate}
                        onChange={(e) => setDateFilter({
                          ...dateFilter,
                          startDate: e.target.value
                        })}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full sm:w-auto"
                      />
                      <span className="text-sm text-gray-500 hidden sm:inline">to</span>
                      <input
                        type="date"
                        value={dateFilter.endDate}
                        onChange={(e) => setDateFilter({
                          ...dateFilter,
                          endDate: e.target.value
                        })}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full sm:w-auto"
                      />
                    </div>
                    <button
                      onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                      className="text-sm text-primary hover:text-primary/80 w-full sm:w-auto text-left sm:text-center mt-1 sm:mt-0"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
                  <div className="bg-background border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-primary/10 p-3 rounded-full">
                        <FileText className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-secondary">Earnings Report</h4>
                        <p className="text-sm text-gray-500">Detailed earnings breakdown</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadReport('earnings')}
                      disabled={!dateFilter.startDate || !dateFilter.endDate || downloading.earnings}
                      className="w-full bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.earnings ? 'Downloading...' : 'Download Excel'}
                    </button>
                  </div>

                  <div className="bg-background border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-accent/10 p-3 rounded-full">
                        <Receipt className="w-5 sm:w-6 h-5 sm:h-6 text-accent" />
                      </div>
                      <div>
                        <h4 className="font-medium text-secondary">Withdrawal Report</h4>
                        <p className="text-sm text-gray-500">Withdrawal history and status</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadReport('withdrawals')}
                      disabled={!dateFilter.startDate || !dateFilter.endDate || downloading.withdrawals}
                      className="w-full bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.withdrawals ? 'Downloading...' : 'Download Excel'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderEarningsDashboard;