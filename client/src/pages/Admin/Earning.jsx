import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../store/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { FaDownload, FaMoneyBillWave, FaUsers, FaCalendarAlt, FaChartPie } from 'react-icons/fa';
import { FiArrowRight, FiArrowLeft, FiRefreshCw, FiLogOut } from 'react-icons/fi';

const COLORS = ['#1e3a8a', '#2563eb', '#312e81', '#facc15', '#eab308'];

const AdminPayments = () => {
    const { API, isAdmin, logoutUser, showToast } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalGross: 0,
        totalCommission: 0,
        totalNet: 0,
        pendingCount: 0
    });
    const [earnings, setEarnings] = useState([]);
    const [requests, setRequests] = useState([]);
    const [topProviders, setTopProviders] = useState([]);
    const [allProviders, setAllProviders] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [selectedTab, setSelectedTab] = useState('dashboard');
    const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState(new Date());
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('completed');
    const [transactionId, setTransactionId] = useState('');

    // Fetch all data on component mount and when date range changes
    useEffect(() => {
        if (!isAdmin) {
            showToast('Unauthorized access', 'error');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                await Promise.all([
                    fetchDashboardStats(),
                    fetchEarnings(),
                    fetchWithdrawalRequests(),
                    fetchTopProviders(),
                    fetchAllProviders(),
                    fetchAllBookings()
                ]);
            } catch (error) {
                showToast(error.message || 'Failed to load data', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, endDate]);

    const fetchDashboardStats = async () => {
        try {
            const response = await fetch(`${API}/payment/admin/generate-report?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setStats({
                    totalGross: data.totalGross || 0,
                    totalCommission: data.totalCommission || 0,
                    totalNet: data.totalNet || 0,
                    pendingCount: data.pendingCount || 0
                });
            } else {
                throw new Error(data.message || 'Failed to fetch stats');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const fetchEarnings = async () => {
        try {
            const response = await fetch(`${API}/payment/admin/earnings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setEarnings(data.earnings || []);
            } else {
                throw new Error(data.message || 'Failed to fetch earnings');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const fetchWithdrawalRequests = async () => {
        try {
            const response = await fetch(`${API}/payment/admin/requests?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setRequests(data.requests || []);
            } else {
                throw new Error(data.message || 'Failed to fetch withdrawal requests');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const fetchTopProviders = async () => {
        try {
            const response = await fetch(`${API}/payment/admin/top-providers?limit=5`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setTopProviders(data.providers || []);
            } else {
                throw new Error(data.message || 'Failed to fetch top providers');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const fetchAllProviders = async () => {
        try {
            const response = await fetch(`${API}/admin/providers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setAllProviders(data.providers || []);
            } else {
                throw new Error(data.message || 'Failed to fetch providers');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const fetchAllBookings = async () => {
        try {
            const response = await fetch(`${API}/booking/admin/bookings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setAllBookings(data.bookings || []);
            } else {
                throw new Error(data.message || 'Failed to fetch bookings');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const processBookingPayment = async (bookingId) => {
        try {
            const response = await fetch(`${API}/payment/admin/bookings/${bookingId}/process-payment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Payment processed successfully');
                fetchEarnings();
                fetchAllBookings();
            } else {
                throw new Error(data.message || 'Failed to process payment');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const handleProcessWithdrawal = async () => {
        if (!selectedRequest) return;

        try {
            const response = await fetch(`${API}/payment/admin/process/${selectedRequest._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    status: processingStatus,
                    transactionId: transactionId
                })
            });
            const data = await response.json();
            if (response.ok) {
                showToast(`Withdrawal ${processingStatus} successfully`);
                setSelectedRequest(null);
                setTransactionId('');
                fetchWithdrawalRequests();
                fetchDashboardStats();
            } else {
                throw new Error(data.message || 'Failed to process withdrawal');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const downloadReport = async (type) => {
        try {
            const endpoint = type === 'pdf'
                ? 'generate-report'
                : 'generate-report-excel';

            const queryParams = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            const response = await fetch(`${API}/payment/admin/${endpoint}?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to download report');
            }

            // Create blob from response
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report.${type}`);
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const earningsChartData = useMemo(() => {
        const statusMap = {
            pending: { name: 'Pending', value: 0 },
            available: { name: 'Available', value: 0 },
            processing: { name: 'Processing', value: 0 },
            paid: { name: 'Paid', value: 0 }
        };

        earnings.forEach(earning => {
            statusMap[earning.status].value += earning.netAmount;
        });

        return Object.values(statusMap);
    }, [earnings]);

    const requestsChartData = useMemo(() => {
        const statusMap = {
            pending: { name: 'Pending', value: 0 },
            processing: { name: 'Processing', value: 0 },
            completed: { name: 'Completed', value: 0 },
            rejected: { name: 'Rejected', value: 0 }
        };

        requests.forEach(request => {
            statusMap[request.status].value += request.amount;
        });

        return Object.values(statusMap);
    }, [requests]);

    const monthlyEarningsData = useMemo(() => {
        const monthlyData = {};
        earnings.forEach(earning => {
            const month = format(new Date(earning.createdAt), 'MMM yyyy');
            if (!monthlyData[month]) {
                monthlyData[month] = { name: month, gross: 0, net: 0, commission: 0 };
            }
            monthlyData[month].gross += earning.grossAmount;
            monthlyData[month].net += earning.netAmount;
            monthlyData[month].commission += earning.commissionAmount;
        });

        return Object.values(monthlyData).slice(-6); // Last 6 months
    }, [earnings]);

    const providersChartData = useMemo(() => {
        return topProviders.map(provider => ({
            name: provider.name || 'Unknown',
            bookings: provider.bookingsCount || 0,
            earnings: provider.totalEarnings || 0
        }));
    }, [topProviders]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-blue-50">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-900"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50">
            {/* Header */}
            <header className="bg-blue-900 shadow">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-white">Admin Payment Dashboard</h1>
                    <button
                        onClick={logoutUser}
                        className="px-4 py-2 bg-yellow-500 text-blue-900 rounded-md hover:bg-yellow-400 transition flex items-center gap-2"
                    >
                        <FiLogOut /> Logout
                    </button>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex space-x-8 overflow-x-auto">
                        <button
                            onClick={() => setSelectedTab('dashboard')}
                            className={`px-3 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${selectedTab === 'dashboard' ? 'border-b-2 border-blue-600 text-blue-900' : 'text-gray-500 hover:text-blue-900'}`}
                        >
                            <FaChartPie /> Dashboard
                        </button>
                        <button
                            onClick={() => setSelectedTab('earnings')}
                            className={`px-3 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${selectedTab === 'earnings' ? 'border-b-2 border-blue-600 text-blue-900' : 'text-gray-500 hover:text-blue-900'}`}
                        >
                            <FaMoneyBillWave /> Earnings
                        </button>
                        <button
                            onClick={() => setSelectedTab('withdrawals')}
                            className={`px-3 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${selectedTab === 'withdrawals' ? 'border-b-2 border-blue-600 text-blue-900' : 'text-gray-500 hover:text-blue-900'}`}
                        >
                            <FiRefreshCw /> Withdrawals
                        </button>
                        <button
                            onClick={() => setSelectedTab('topProviders')}
                            className={`px-3 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${selectedTab === 'topProviders' ? 'border-b-2 border-blue-600 text-blue-900' : 'text-gray-500 hover:text-blue-900'}`}
                        >
                            <FaUsers /> Top Providers
                        </button>
                        <button
                            onClick={() => setSelectedTab('allProviders')}
                            className={`px-3 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${selectedTab === 'allProviders' ? 'border-b-2 border-blue-600 text-blue-900' : 'text-gray-500 hover:text-blue-900'}`}
                        >
                            <FaUsers /> All Providers
                        </button>
                        <button
                            onClick={() => setSelectedTab('allBookings')}
                            className={`px-3 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${selectedTab === 'allBookings' ? 'border-b-2 border-blue-600 text-blue-900' : 'text-gray-500 hover:text-blue-900'}`}
                        >
                            <FaCalendarAlt /> All Bookings
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                {/* Date Range Selector */}
                <div className="mb-8 bg-white p-4 rounded-lg shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-lg font-medium text-blue-900">Date Range</h2>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">From:</label>
                                <DatePicker
                                    selected={startDate}
                                    onChange={(date) => setStartDate(date)}
                                    selectsStart
                                    startDate={startDate}
                                    endDate={endDate}
                                    className="border rounded-md px-3 py-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">To:</label>
                                <DatePicker
                                    selected={endDate}
                                    onChange={(date) => setEndDate(date)}
                                    selectsEnd
                                    startDate={startDate}
                                    endDate={endDate}
                                    minDate={startDate}
                                    className="border rounded-md px-3 py-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    fetchDashboardStats();
                                    fetchEarnings();
                                    fetchWithdrawalRequests();
                                    fetchAllBookings();
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                            >
                                <FiRefreshCw /> Apply
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => downloadReport('pdf')}
                                    className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm flex items-center gap-1"
                                >
                                    <FaDownload /> PDF
                                </button>
                                <button
                                    onClick={() => downloadReport('excel')}
                                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm flex items-center gap-1"
                                >
                                    <FaDownload /> Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Tab */}
                {selectedTab === 'dashboard' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900">Total Earnings</h3>
                                <p className="mt-2 text-3xl font-bold text-blue-600">
                                    ${stats.totalGross.toFixed(2)}
                                </p>
                                <p className="text-sm text-gray-500">Gross amount</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900">Total Commission</h3>
                                <p className="mt-2 text-3xl font-bold text-green-600">
                                    ${stats.totalCommission.toFixed(2)}
                                </p>
                                <p className="text-sm text-gray-500">Platform earnings</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900">Net Paid</h3>
                                <p className="mt-2 text-3xl font-bold text-indigo-900">
                                    ${stats.totalNet.toFixed(2)}
                                </p>
                                <p className="text-sm text-gray-500">To providers</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900">Pending Requests</h3>
                                <p className="mt-2 text-3xl font-bold text-yellow-500">
                                    {stats.pendingCount}
                                </p>
                                <p className="text-sm text-gray-500">Withdrawals</p>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Earnings</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyEarningsData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']} />
                                            <Legend />
                                            <Bar dataKey="gross" fill="#1e3a8a" name="Gross Earnings" />
                                            <Bar dataKey="net" fill="#2563eb" name="Net Earnings" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Earnings Distribution</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={earningsChartData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                nameKey="name"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {earningsChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Withdrawal Requests</h3>
                            {requests.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-blue-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Provider</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Amount</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Method</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {requests.slice(0, 5).map((request) => (
                                                <tr key={request._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">{request.provider?.name || 'N/A'}</div>
                                                                <div className="text-sm text-gray-500">{request.provider?.email || ''}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        ${request.amount?.toFixed(2) || '0.00'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {request.paymentMethod || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${request.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                                request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                    request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                                        'bg-blue-100 text-blue-800'}`}>
                                                            {request.status || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button
                                                            onClick={() => setSelectedRequest(request)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                        >
                                                            Process
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500">No withdrawal requests found</p>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Earnings Tab */}
                {selectedTab === 'earnings' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-6 rounded-lg shadow"
                    >
                        <h2 className="text-lg font-medium text-blue-900 mb-4">Provider Earnings</h2>
                        {earnings.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-blue-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Provider</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Service</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Gross</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Commission</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Net</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {earnings.map((earning) => (
                                            <tr key={earning._id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{earning.provider?.name || 'N/A'}</div>
                                                            <div className="text-sm text-gray-500">{earning.provider?.email || ''}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {earning.booking?.service?.name || earning.booking?.service || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    ${earning.grossAmount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    ${earning.commissionAmount?.toFixed(2) || '0.00'} ({earning.commissionRule?.value || 0}%)
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    ${earning.netAmount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${earning.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                            earning.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                earning.status === 'available' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-purple-100 text-purple-800'}`}>
                                                        {earning.status || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {earning.createdAt ? format(new Date(earning.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    {earning.status === 'pending' && earning.booking?._id && (
                                                        <button
                                                            onClick={() => processBookingPayment(earning.booking._id)}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                        >
                                                            Process
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500">No earnings data found</p>
                        )}
                    </motion.div>
                )}

                {/* Withdrawals Tab */}
                {selectedTab === 'withdrawals' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-6 rounded-lg shadow"
                    >
                        <h2 className="text-lg font-medium text-blue-900 mb-4">Withdrawal Requests</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900">Requests Status</h3>
                                {requests.length > 0 ? (
                                    <div className="h-64 mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={requestsChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    nameKey="name"
                                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {requestsChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => [`$${value?.toFixed(2) || '0.00'}`, 'Amount']} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 mt-4">No data available for chart</p>
                                )}
                            </div>
                            <div className="col-span-2 bg-white p-6 rounded-lg shadow">
                                <h3 className="text-lg font-medium text-gray-900">Recent Requests</h3>
                                {requests.length > 0 ? (
                                    <div className="overflow-x-auto mt-4">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-blue-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Method</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Date</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {requests.map((request) => (
                                                    <tr key={request._id}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900">{request.provider?.name || 'N/A'}</div>
                                                                    <div className="text-sm text-gray-500">{request.provider?.email || ''}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            ${request.amount?.toFixed(2) || '0.00'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {request.paymentMethod || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${request.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                                    request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                                            'bg-blue-100 text-blue-800'}`}>
                                                                {request.status || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            <button
                                                                onClick={() => setSelectedRequest(request)}
                                                                className="text-blue-600 hover:text-blue-900"
                                                            >
                                                                Process
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 mt-4">No withdrawal requests found</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Top Providers Tab */}
                {selectedTab === 'topProviders' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-6 rounded-lg shadow"
                    >
                        <h2 className="text-lg font-medium text-blue-900 mb-4">Top Performing Providers</h2>
                        {topProviders.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Top Providers by Earnings</h3>
                                    <div className="h-96">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={providersChartData}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" />
                                                <YAxis dataKey="name" type="category" width={100} />
                                                <Tooltip formatter={(value) => [`$${value?.toFixed(2) || '0.00'}`, 'Earnings']} />
                                                <Legend />
                                                <Bar dataKey="earnings" fill="#1e3a8a" name="Total Earnings" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Provider Details</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-blue-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Earnings</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Bookings</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Avg. Earnings</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {topProviders.map((provider) => (
                                                    <tr key={provider._id}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900">{provider.name || 'Unknown'}</div>
                                                                    <div className="text-sm text-gray-500">{provider.email || ''}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            ${provider.totalEarnings?.toFixed(2) || '0.00'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {provider.bookingsCount || 0}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            ${(provider.totalEarnings / (provider.bookingsCount || 1)).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500">No top providers data available</p>
                        )}
                    </motion.div>
                )}

                {/* All Providers Tab */}
                {selectedTab === 'allProviders' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-6 rounded-lg shadow"
                    >
                        <h2 className="text-lg font-medium text-blue-900 mb-4">All Providers</h2>
                        {allProviders.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Providers Performance</h3>
                                    <div className="h-96">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={allProviders.slice(0, 5).map(provider => ({
                                                    name: provider.name || 'Unknown',
                                                    bookings: provider.bookingsCount || 0,
                                                    earnings: provider.totalEarnings || 0
                                                }))}
                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="bookings" fill="#facc15" name="Bookings" />
                                                <Bar dataKey="earnings" fill="#1e3a8a" name="Earnings ($)" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Provider List</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-blue-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Earnings</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Bookings</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Services</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {allProviders.map((provider) => (
                                                    <tr key={provider._id}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900">{provider.name || 'Unknown'}</div>
                                                                    <div className="text-sm text-gray-500">{provider.email || ''}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${provider.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                {provider.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            ${provider.totalEarnings?.toFixed(2) || '0.00'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {provider.bookingsCount || 0}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">
                                                            {provider.services?.map(s => s.name).join(', ') || 'No services'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500">No providers data available</p>
                        )}
                    </motion.div>
                )}

                {/* All Bookings Tab */}
                {selectedTab === 'allBookings' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-6 rounded-lg shadow"
                    >
                        <h2 className="text-lg font-medium text-blue-900 mb-4">All Bookings</h2>
                        {allBookings.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-blue-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Customer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Provider</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Service</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Amount</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Payment</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {allBookings.map((booking) => (
                                            <tr key={booking._id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{booking.customer?.name || 'N/A'}</div>
                                                            <div className="text-sm text-gray-500">{booking.customer?.email || ''}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{booking.provider?.name || 'N/A'}</div>
                                                            <div className="text-sm text-gray-500">{booking.provider?.email || ''}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {booking.service?.name || booking.service || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    ${booking.totalAmount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                    'bg-blue-100 text-blue-800'}`}>
                                                        {booking.status || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {booking.createdAt ? format(new Date(booking.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    {booking.paymentStatus === 'pending' && booking.status === 'completed' ? (
                                                        <button
                                                            onClick={() => processBookingPayment(booking._id)}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                        >
                                                            Process Payment
                                                        </button>
                                                    ) : (
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                                                'bg-yellow-100 text-yellow-800'}`}>
                                                            {booking.paymentStatus || 'N/A'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500">No bookings data available</p>
                        )}
                    </motion.div>
                )}
            </main>

            {/* Process Withdrawal Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                    >
                        <h3 className="text-lg font-medium text-blue-900 mb-4">Process Withdrawal Request</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Provider</label>
                                <p className="mt-1 text-sm text-gray-900">{selectedRequest.provider?.name || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Amount</label>
                                <p className="mt-1 text-sm text-gray-900">${selectedRequest.amount?.toFixed(2) || '0.00'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                                <p className="mt-1 text-sm text-gray-900">{selectedRequest.paymentMethod || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select
                                    value={processingStatus}
                                    onChange={(e) => setProcessingStatus(e.target.value)}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                >
                                    <option value="completed">Completed</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>

                            {processingStatus === 'completed' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Transaction ID</label>
                                    <input
                                        type="text"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Enter transaction reference"
                                    />
                                </div>
                            )}

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    onClick={() => {
                                        setSelectedRequest(null);
                                        setTransactionId('');
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleProcessWithdrawal}
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AdminPayments;