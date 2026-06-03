import React, { useState, useEffect } from 'react';
import {
  FiDownload,
  FiCalendar,
  FiTrendingUp,
  FiUsers,
  FiDollarSign,
  FiCreditCard,
  FiFileText,
  FiClock,
  FiFilter,
  FiAlertCircle,
  FiRefreshCw
} from 'react-icons/fi';
import * as PaymentService from '../../services/PaymentService';
import * as BookingService from '../../services/BookingService';
import { useAuth } from '../../context/auth';
import { useAdminFilter } from '../../context/AdminFilterContext';
import AdminFilterBar from '../../components/AdminFilterBar';

const AdminEarningReports = () => {
  const { API, token, showToast } = useAuth();
  const { getComputedDateRange, getMergedQuery, resetGlobalFilters } = useAdminFilter();
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [providerId, setProviderId] = useState('');
  const [groupBy, setGroupBy] = useState('month');
  const [dateError, setDateError] = useState('');

  const reports = [
    {
      id: 'withdrawal',
      title: 'Withdrawal Report',
      description: 'Track all withdrawal requests',
      icon: <FiCreditCard className="w-5 h-5" />,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 'provider-earnings',
      title: 'Provider Earnings',
      description: 'Earnings summary by provider',
      icon: <FiTrendingUp className="w-5 h-5" />,
      color: 'bg-emerald-100 text-emerald-600'
    },
    {
      id: 'commission',
      title: 'Commission Report',
      description: 'Booking-wise commission data',
      icon: <FiDollarSign className="w-5 h-5" />,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      id: 'earnings-summary',
      title: 'Earnings Summary',
      description: 'Grouped by month or week',
      icon: <FiCalendar className="w-5 h-5" />,
      color: 'bg-indigo-100 text-indigo-600'
    },
    {
      id: 'outstanding-balance',
      title: 'Outstanding Balance',
      description: 'Pending withdrawal amounts',
      icon: <FiClock className="w-5 h-5" />,
      color: 'bg-rose-100 text-rose-600'
    },
    {
      id: 'booking-report',
      title: 'Booking Report',
      description: 'Download overall bookings list',
      icon: <FiFileText className="w-5 h-5" />,
      color: 'bg-teal-100 text-teal-600'
    },
    {
      id: 'complaint-report',
      title: 'Complaint Report',
      description: 'Download user complaints status',
      icon: <FiAlertCircle className="w-5 h-5" />,
      color: 'bg-amber-100 text-amber-600'
    },
    {
      id: 'refund-report',
      title: 'Refund Report',
      description: 'Download wallet and online refunds',
      icon: <FiRefreshCw className="w-5 h-5" />,
      color: 'bg-rose-100 text-rose-600'
    }
  ];

  const validateDateRange = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setDateError('');
      return true;
    }

    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    // Check if end date is before start date
    if (end < start) {
      setDateError('End date cannot be before start date');
      return false;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
      setDateError('Date range must be at least 1 day');
      return false;
    }

    if (diffDays > 366) {
      setDateError('Date range cannot exceed 1 year (366 days)');
      return false;
    }

    setDateError('');
    return true;
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const handleDownload = async (reportId, specificProviderId = null) => {
    // Validate date range before proceeding
    if (!validateDateRange()) {
      showToast?.('Please fix the date range errors', 'error');
      return;
    }

    try {
      setLoading(true);
      setActiveReport(reportId);

      // Merge global filters with local ones
      const params = getMergedQuery({
        fromDate: dateRange.startDate,
        toDate: dateRange.endDate,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      if (providerId && reportId !== 'provider-ledger') {
        params.providerId = providerId;
      }

      const config = { responseType: 'blob' };
      let response;

      switch (reportId) {
        case 'withdrawal':
          response = await PaymentService.generateWithdrawalReport(params, config);
          break;
        case 'provider-earnings':
          response = await PaymentService.generateProviderEarningsReport(params, config);
          break;
        case 'commission':
          response = await PaymentService.getCommissionReport(params, config);
          break;
        case 'provider-ledger':
          if (!specificProviderId) {
            showToast?.('Please enter a Provider ID for ledger report', 'warning');
            setLoading(false);
            setActiveReport(null);
            return;
          }
          response = await PaymentService.providerLedgerReport(specificProviderId, params, config);
          break;
        case 'earnings-summary':
          params.groupBy = groupBy;
          response = await PaymentService.earningsSummaryReport(params, config);
          break;
        case 'outstanding-balance':
          response = await PaymentService.outstandingBalanceReport(params, config);
          break;
        case 'booking-report':
          response = await BookingService.downloadBookingReport(params, config);
          break;
        case 'complaint-report':
          response = await PaymentService.generateComplaintReport(params, config);
          break;
        case 'refund-report':
          response = await PaymentService.generateRefundReport(params, config);
          break;
        default:
          showToast?.('Invalid report type', 'error');
          setLoading(false);
          setActiveReport(null);
          return;
      }

      const reportName = reports.find(r => r.id === reportId)?.title || reportId;
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${reportName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();

      window.URL.revokeObjectURL(link.href);

      showToast?.(`${reportName} downloaded successfully!`, 'success');

    } catch (err) {
      let errorMessage = 'Failed to download report';

      if (err.response?.status === 404) {
        errorMessage = 'Report endpoint not found';
      } else if (err.response?.status === 401) {
        errorMessage = 'Unauthorized access';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error';
      } else if (err.response?.data) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const errorData = JSON.parse(text);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = 'Error processing the report';
          }
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      showToast?.(errorMessage, 'error');
    } finally {
      setLoading(false);
      setActiveReport(null);
    }
  };

  // Reactively default dateRange to global computed dates on change
  const globalDates = getComputedDateRange();
  useEffect(() => {
    if (globalDates.startDate && globalDates.endDate) {
      setDateRange({
        startDate: globalDates.startDate,
        endDate: globalDates.endDate
      });
    }
  }, [globalDates.startDate, globalDates.endDate]);

  // Validate date range when it changes
  useEffect(() => {
    validateDateRange();
  }, [dateRange.startDate, dateRange.endDate]);

  const clearFilters = () => {
    resetGlobalFilters();
    setProviderId('');
    setGroupBy('month');
    setDateError('');
    showToast?.('Filters cleared', 'info');
  };

  const isDateRangeValid = !dateError;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminFilterBar />
      <div className="p-4 md:p-6 flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Earning Reports</h1>
              <p className="text-gray-600 mt-1">Generate and download comprehensive financial reports</p>
            </div>
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg border border-gray-300"
            >
              <FiRefreshCw className="w-4 h-4" />
              Reset Filters
            </button>
          </div>

          {/* Filter Section */}
          <div className="bg-white rounded-xl border p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FiFilter className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-gray-700">Report Filters</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group By
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="month">Monthly</option>
                  <option value="week">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider ID
                </label>
                <input
                  type="text"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="e.g., PROV001"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Reports Section */}
        <div className="space-y-8">
          {/* Main Reports Grid */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Reports</h3>
            <p className="text-gray-600 mb-6">Download reports in Excel format for easy analysis</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((report) => (
                <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`p-3 rounded-lg ${report.color}`}>
                      {report.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1">{report.title}</h4>
                      <p className="text-sm text-gray-600">{report.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(report.id)}
                    disabled={loading || (!isDateRangeValid && dateRange.startDate && dateRange.endDate)}
                    className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && activeReport === report.id ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Preparing...</span>
                      </>
                    ) : (
                      <>
                        <FiDownload className="w-5 h-5" />
                        <span>Download Report</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Provider Ledger Section */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
                <FiFileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Provider Ledger Report</h3>
                <p className="text-sm text-gray-600">Generate detailed ledger for a specific provider</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider ID
                </label>
                <input
                  type="text"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="Enter Provider ID (e.g., PROV001)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => handleDownload('provider-ledger', providerId)}
                  disabled={loading || !providerId || (!isDateRangeValid && dateRange.startDate && dateRange.endDate)}
                  className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-accent to-orange-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && activeReport === 'provider-ledger' ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FiDownload className="w-5 h-5" />
                      <span>Download Ledger</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FiAlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Report Guidelines</h4>
                <ul className="text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>All reports download as Excel (.xlsx) files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>Date range must be between 1 day and 1 year (366 days)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>Leave dates empty or use global reset for complete historical data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>Provider ID is required for ledger reports only</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEarningReports;
