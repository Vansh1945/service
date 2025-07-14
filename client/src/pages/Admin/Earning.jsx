import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AdminEarnings = () => {
    const { API, isAdmin, logoutUser, showToast } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [topProviders, setTopProviders] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const [earningsReport, setEarningsReport] = useState([]);
    const [timePeriod, setTimePeriod] = useState('month');
    const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)));
    const [endDate, setEndDate] = useState(new Date());

    useEffect(() => {
        if (!isAdmin) {
            showToast('Unauthorized access', 'error');
            logoutUser();
            return;
        }
        fetchDashboardData();
    }, [timePeriod]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch top providers
            const providersRes = await fetch(`${API}/earning/top-providers?period=${timePeriod}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!providersRes.ok) {
                throw new Error('Failed to fetch top providers');
            }

            const providersData = await providersRes.json();
            console.log('Providers Data:', providersData); // Debug log

            // Handle both array and object responses
            const providersArray = Array.isArray(providersData)
                ? providersData
                : providersData.topProviders || [];

            setTopProviders(providersArray);

            // Fetch top customers
            const customersRes = await fetch(`${API}/earning/top-customers?period=${timePeriod}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!customersRes.ok) {
                throw new Error('Failed to fetch top customers');
            }

            const customersData = await customersRes.json();
            const customersArray = Array.isArray(customersData)
                ? customersData
                : customersData.topCustomers || [];

            setTopCustomers(customersArray);

            // Fetch earnings report
            const earningsRes = await fetch(`${API}/earning/report`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!earningsRes.ok) {
                throw new Error('Failed to fetch earnings report');
            }

            const earningsData = await earningsRes.json();
            const earningsArray = Array.isArray(earningsData)
                ? earningsData
                : earningsData.earnings || [];

            setEarningsReport(earningsArray);

            setLoading(false);
        } catch (error) {
            console.error('Dashboard fetch error:', error);
            showToast(error.message || 'Failed to fetch dashboard data', 'error');
            setTopProviders([]);
            setTopCustomers([]);
            setEarningsReport([]);
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        try {
            const res = await fetch(`${API}/earning/generate-report?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `earnings_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                showToast('Report downloaded successfully');
            } else {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to generate report');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    // Prepare chart data with fallbacks
    const earningsChartData = topProviders.map(provider => ({
        name: provider.providerName || 'Unknown',
        earnings: provider.totalEarnings || 0
    }));

    const spendingChartData = topCustomers.map(customer => ({
        name: customer.customerName || 'Unknown',
        spending: customer.totalSpent || 0
    }));

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-indigo-700 text-white shadow-md">
                <div className="container mx-auto px-4 py-6">
                    <h1 className="text-3xl font-bold">Admin Earnings Dashboard</h1>
                    <p className="text-indigo-200">Manage provider earnings and customer transactions</p>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        className={`py-2 px-4 font-medium ${activeTab === 'overview' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`py-2 px-4 font-medium ${activeTab === 'providers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('providers')}
                    >
                        Top Providers
                    </button>
                    <button
                        className={`py-2 px-4 font-medium ${activeTab === 'customers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('customers')}
                    >
                        Top Customers
                    </button>
                    <button
                        className={`py-2 px-4 font-medium ${activeTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('reports')}
                    >
                        Reports
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <>
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Top Providers Earnings Chart */}
                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <h2 className="text-xl font-semibold mb-4">Top Providers Earnings</h2>
                                    {earningsChartData.length > 0 ? (
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={earningsChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip
                                                        formatter={(value) => formatCurrency(value)}
                                                        labelFormatter={(value) => `Provider: ${value}`}
                                                    />
                                                    <Legend />
                                                    <Bar
                                                        dataKey="earnings"
                                                        fill="#8884d8"
                                                        name="Earnings"
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-64 flex items-center justify-center">
                                            <p className="text-gray-500">No provider earnings data available</p>
                                        </div>
                                    )}
                                </div>

                                {/* Top Customers Spending Chart */}
                                <div className="bg-white p-6 rounded-lg shadow-md">
                                    <h2 className="text-xl font-semibold mb-4">Top Customers Spending</h2>
                                    {spendingChartData.length > 0 ? (
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={spendingChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip
                                                        formatter={(value) => formatCurrency(value)}
                                                        labelFormatter={(value) => `Customer: ${value}`}
                                                    />
                                                    <Legend />
                                                    <Bar
                                                        dataKey="spending"
                                                        fill="#82ca9d"
                                                        name="Spending"
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-64 flex items-center justify-center">
                                            <p className="text-gray-500">No customer spending data available</p>
                                        </div>
                                    )}
                                </div>

                                {/* Recent Earnings Table */}
                                <div className="bg-white p-6 rounded-lg shadow-md md:col-span-2">
                                    <h2 className="text-xl font-semibold mb-4">Recent Earnings</h2>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {earningsReport.length > 0 ? (
                                                    earningsReport.slice(0, 5).map((earning, index) => (
                                                        <tr key={index}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="ml-4">
                                                                        <div className="text-sm font-medium text-gray-900">
                                                                            {earning.provider?.name || 'N/A'}
                                                                        </div>
                                                                        <div className="text-sm text-gray-500">
                                                                            {earning.provider?.email || ''}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-900">
                                                                    {earning.booking?.service || 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {formatCurrency(earning.amount || 0)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                                    ${earning.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                                        earning.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                            'bg-blue-100 text-blue-800'}`}>
                                                                    {earning.status || 'unknown'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {earning.createdAt ? new Date(earning.createdAt).toLocaleDateString() : 'N/A'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                                                            No earnings data available
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Top Providers Tab */}
                        {activeTab === 'providers' && (
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-semibold">Top Providers</h2>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setTimePeriod('month')}
                                            className={`px-3 py-1 rounded ${timePeriod === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                                        >
                                            This Month
                                        </button>
                                        <button
                                            onClick={() => setTimePeriod('year')}
                                            className={`px-3 py-1 rounded ${timePeriod === 'year' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                                        >
                                            This Year
                                        </button>
                                        <button
                                            onClick={() => setTimePeriod('all')}
                                            className={`px-3 py-1 rounded ${timePeriod === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                                        >
                                            All Time
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Earnings</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {topProviders.length > 0 ? (
                                                topProviders.map((provider, index) => (
                                                    <tr key={provider.providerId || index}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900">
                                                                        {provider.providerName || 'N/A'}
                                                                    </div>
                                                                    <div className="text-sm text-gray-500">
                                                                        {provider.providerEmail || ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {formatCurrency(provider.totalEarnings || 0)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {provider.bookingCount || 0}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {formatCurrency(
                                                                (provider.totalEarnings && provider.bookingCount)
                                                                    ? provider.totalEarnings / provider.bookingCount
                                                                    : 0
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                                                        No provider data available
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Top Customers Tab */}
                        {activeTab === 'customers' && (
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-semibold">Top Customers</h2>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setTimePeriod('month')}
                                            className={`px-3 py-1 rounded ${timePeriod === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                                        >
                                            This Month
                                        </button>
                                        <button
                                            onClick={() => setTimePeriod('year')}
                                            className={`px-3 py-1 rounded ${timePeriod === 'year' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                                        >
                                            This Year
                                        </button>
                                        <button
                                            onClick={() => setTimePeriod('all')}
                                            className={`px-3 py-1 rounded ${timePeriod === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                                        >
                                            All Time
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spending</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Spending</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {topCustomers.map((customer, index) => (
                                                <tr key={customer.customerId}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">{customer.customerName}</div>
                                                                <div className="text-sm text-gray-500">{customer.customerEmail}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {formatCurrency(customer.totalSpent)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {customer.bookingCount}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {formatCurrency(customer.totalSpent / customer.bookingCount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Reports Tab */}
                        {activeTab === 'reports' && (
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h2 className="text-xl font-semibold mb-6">Generate Earnings Report</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                        <DatePicker
                                            selected={startDate}
                                            onChange={(date) => setStartDate(date)}
                                            selectsStart
                                            startDate={startDate}
                                            endDate={endDate}
                                            className="w-full p-2 border border-gray-300 rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                        <DatePicker
                                            selected={endDate}
                                            onChange={(date) => setEndDate(date)}
                                            selectsEnd
                                            startDate={startDate}
                                            endDate={endDate}
                                            minDate={startDate}
                                            className="w-full p-2 border border-gray-300 rounded-md"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerateReport}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                                >
                                    Generate Excel Report
                                </button>

                                <div className="mt-8">
                                    <h3 className="text-lg font-medium mb-4">Recent Earnings</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {earningsReport.map((earning, index) => (
                                                    <tr key={index}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900">{earning.provider?.name || 'N/A'}</div>
                                                                    <div className="text-sm text-gray-500">{earning.provider?.email || ''}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm text-gray-900">{earning.booking?.service || 'N/A'}</div>
                                                            <div className="text-sm text-gray-500">{earning.booking?.date ? new Date(earning.booking.date).toLocaleDateString() : ''}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {formatCurrency(earning.amount)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${earning.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                                    earning.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-blue-100 text-blue-800'}`}>
                                                                {earning.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {new Date(earning.createdAt).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Withdrawals Tab */}
                        {activeTab === 'withdrawals' && (
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h2 className="text-xl font-semibold mb-6">Provider Withdrawals</h2>

                                <div className="mt-8">
                                    <h3 className="text-lg font-medium mb-4">Recent Withdrawals</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {earningsReport
                                                    .filter(earning => earning.status === 'paid')
                                                    .slice(0, 5)
                                                    .map((earning, index) => (
                                                        <tr key={index}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="ml-4">
                                                                        <div className="text-sm font-medium text-gray-900">{earning.provider?.name || 'N/A'}</div>
                                                                        <div className="text-sm text-gray-500">{earning.provider?.email || ''}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {formatCurrency(earning.amount)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {earning.withdrawalMethod || 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                                    Completed
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {new Date(earning.createdAt).toLocaleDateString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default AdminEarnings;