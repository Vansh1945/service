// import React, { useState, useEffect } from 'react';
// import { useAuth } from '../../store/auth';
// import {
//     Wallet,
//     TrendingUp,
//     DollarSign,
//     Clock,
//     Download,
//     CreditCard,
//     FileText,
//     AlertCircle,
//     CheckCircle,
//     XCircle,
//     Calendar,
//     Filter,
//     RefreshCw
// } from 'lucide-react';

// const ProviderEarningsDashboard = () => {
//     const { token, API, showToast } = useAuth();
//     const [earnings, setEarnings] = useState(null);
//     const [summary, setSummary] = useState(null);
//     const [statements, setStatements] = useState([]);
//     const [showWithdrawal, setShowWithdrawal] = useState(false);
//     const [withdrawalForm, setWithdrawalForm] = useState({
//         amount: '',
//         method: 'upi',
//         details: {
//             upiId: '',
//             accountNumber: '',
//             ifscCode: '',
//             accountHolderName: '',
//             bankName: ''
//         }
//     });
//     const [dateFilter, setDateFilter] = useState({
//         startDate: '',
//         endDate: ''
//     });
//     const [activeTab, setActiveTab] = useState('overview');

//     // Fetch earnings data
//     const fetchEarnings = async () => {
//         try {
//             const response = await fetch(`${API}/transaction/earnings`, {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             });

//             if (!response.ok) throw new Error('Failed to fetch earnings');

//             const data = await response.json();
//             setEarnings(data.earnings);
//         } catch (error) {
//             showToast('Error fetching earnings: ' + error.message, 'error');
//         }
//     };

//     // Fetch earnings summary
//     const fetchSummary = async () => {
//         try {
//             const response = await fetch(`${API}/earning/summary`, {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             });

//             if (!response.ok) {
//                 const errorData = await response.json();
//                 throw new Error(errorData.message || 'Failed to fetch summary');
//             }

//             const data = await response.json();
//             setSummary(data.summary);
//         } catch (error) {
//             showToast('Error fetching summary: ' + error.message, 'error');
//         }
//     };

//     // Fetch earnings statement
//     const fetchStatement = async () => {
//         try {
//             const params = new URLSearchParams();
//             if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
//             if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);

//             const response = await fetch(`${API}/earning/statement?${params}`, {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             });

//             if (!response.ok) throw new Error('Failed to fetch statement');

//             const data = await response.json();
//             setStatements(data.earnings);
//         } catch (error) {
//             showToast('Error fetching statement: ' + error.message, 'error');
//         }
//     };

//     // Handle withdrawal
//     const handleWithdrawal = async () => {
//         if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) < 500) {
//             showToast('Minimum withdrawal amount is ₹500', 'error');
//             return;
//         }

//         try {
//             const response = await fetch(`${API}/transaction/withdraw`, {
//                 method: 'POST',
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify({
//                     amount: parseFloat(withdrawalForm.amount),
//                     method: withdrawalForm.method,
//                     details: withdrawalForm.details
//                 })
//             });

//             if (!response.ok) throw new Error('Withdrawal failed');

//             showToast('Withdrawal request submitted successfully!', 'success');
//             setShowWithdrawal(false);
//             setWithdrawalForm({
//                 amount: '',
//                 method: 'upi',
//                 details: {
//                     upiId: '',
//                     accountNumber: '',
//                     ifscCode: '',
//                     accountHolderName: '',
//                     bankName: ''
//                 }
//             });

//             // Refresh data
//             fetchEarnings();
//             fetchSummary();
//         } catch (error) {
//             showToast('Error processing withdrawal: ' + error.message, 'error');
//         }
//     };

//     // Download statement
//     const downloadStatement = async () => {
//         try {
//             const params = new URLSearchParams();
//             if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
//             if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);

//             const response = await fetch(`${API}/earning/download-statement?${params}`, {
//                 headers: {
//                     'Authorization': `Bearer ${token}`
//                 }
//             });

//             if (!response.ok) throw new Error('Failed to download statement');

//             const blob = await response.blob();
//             const url = window.URL.createObjectURL(blob);
//             const a = document.createElement('a');
//             a.href = url;
//             a.download = `earnings_statement_${new Date().toISOString().split('T')[0]}.pdf`;
//             a.click();
//             window.URL.revokeObjectURL(url);

//             showToast('Statement downloaded successfully!', 'success');
//         } catch (error) {
//             showToast('Error downloading statement: ' + error.message, 'error');
//         }
//     };

//     // Refresh all data
//     const refreshData = async () => {
//         await Promise.all([fetchEarnings(), fetchSummary(), fetchStatement()]);
//     };

//     useEffect(() => {
//         refreshData();
//     }, []);

//     useEffect(() => {
//         if (activeTab === 'statement') {
//             fetchStatement();
//         }
//     }, [dateFilter, activeTab]);

//     const getStatusColor = (status) => {
//         switch (status) {
//             case 'completed': return 'text-green-600';
//             case 'pending': return 'text-yellow-600';
//             case 'processing': return 'text-blue-600';
//             case 'failed': return 'text-red-600';
//             default: return 'text-gray-600';
//         }
//     };

//     const getStatusIcon = (status) => {
//         switch (status) {
//             case 'completed': return <CheckCircle className="w-4 h-4" />;
//             case 'pending': return <Clock className="w-4 h-4" />;
//             case 'processing': return <RefreshCw className="w-4 h-4" />;
//             case 'failed': return <XCircle className="w-4 h-4" />;
//             default: return <AlertCircle className="w-4 h-4" />;
//         }
//     };

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
//             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//                 {/* Header */}
//                 <div className="mb-8">
//                     <div className="flex items-center justify-between">
//                         <div>
//                             <h1 className="text-3xl font-bold text-gray-900">Earnings Dashboard</h1>
//                             <p className="text-gray-600 mt-2">Manage your earnings and withdrawals</p>
//                         </div>
//                         <button
//                             onClick={refreshData}
//                             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
//                         >
//                             <RefreshCw className="w-4 h-4" />
//                             Refresh
//                         </button>
//                     </div>
//                 </div>

//                 {/* Summary Cards */}
//                 {summary && (
//                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//                         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
//                             <div className="flex items-center justify-between">
//                                 <div>
//                                     <p className="text-sm font-medium text-gray-600">Available Balance</p>
//                                     <p className="text-2xl font-bold text-green-600">
//                                         ₹{summary.availableBalance?.toFixed(2) || '0.00'}
//                                     </p>
//                                 </div>
//                                 <div className="bg-green-100 p-3 rounded-full">
//                                     <Wallet className="w-6 h-6 text-green-600" />
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
//                             <div className="flex items-center justify-between">
//                                 <div>
//                                     <p className="text-sm font-medium text-gray-600">Total Earnings</p>
//                                     <p className="text-2xl font-bold text-blue-600">
//                                         ₹{summary.totalEarnings?.toFixed(2) || '0.00'}
//                                     </p>
//                                 </div>
//                                 <div className="bg-blue-100 p-3 rounded-full">
//                                     <TrendingUp className="w-6 h-6 text-blue-600" />
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
//                             <div className="flex items-center justify-between">
//                                 <div>
//                                     <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
//                                     <p className="text-2xl font-bold text-yellow-600">
//                                         ₹{summary.pendingEarnings?.toFixed(2) || '0.00'}
//                                     </p>
//                                 </div>
//                                 <div className="bg-yellow-100 p-3 rounded-full">
//                                     <Clock className="w-6 h-6 text-yellow-600" />
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {/* Withdrawal Button */}
//                 <div className="mb-8">
//                     <button
//                         onClick={() => setShowWithdrawal(true)}
//                         disabled={!summary?.availableBalance || summary.availableBalance < 500}
//                         className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all"
//                     >
//                         <DollarSign className="w-5 h-5" />
//                         Withdraw Earnings
//                     </button>
//                     {summary?.availableBalance < 500 && (
//                         <p className="text-sm text-red-500 mt-2">
//                             Minimum withdrawal amount is ₹500
//                         </p>
//                     )}
//                 </div>

//                 {/* Tabs */}
//                 <div className="bg-white rounded-xl shadow-sm border border-gray-200">
//                     <div className="border-b border-gray-200">
//                         <nav className="flex space-x-8 px-6">
//                             <button
//                                 onClick={() => setActiveTab('overview')}
//                                 className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
//                                         ? 'border-blue-500 text-blue-600'
//                                         : 'border-transparent text-gray-500 hover:text-gray-700'
//                                     }`}
//                             >
//                                 Overview
//                             </button>
//                             <button
//                                 onClick={() => setActiveTab('statement')}
//                                 className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'statement'
//                                         ? 'border-blue-500 text-blue-600'
//                                         : 'border-transparent text-gray-500 hover:text-gray-700'
//                                     }`}
//                             >
//                                 Statement
//                             </button>
//                         </nav>
//                     </div>

//                     <div className="p-6">
//                         {activeTab === 'overview' && (
//                             <div>
//                                 <h3 className="text-lg font-semibold mb-4">Recent Earnings</h3>
//                                 {earnings && earnings.length > 0 ? (
//                                     <div className="space-y-4">
//                                         {earnings.slice(0, 10).map((earning, index) => (
//                                             <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
//                                                 <div className="flex items-center gap-3">
//                                                     <div className="bg-blue-100 p-2 rounded-full">
//                                                         <CreditCard className="w-4 h-4 text-blue-600" />
//                                                     </div>
//                                                     <div>
//                                                         <p className="font-medium">
//                                                             {earning.type === 'provider-withdrawal' ? 'Withdrawal' : 'Booking Payment'}
//                                                         </p>
//                                                         <p className="text-sm text-gray-600">
//                                                             {new Date(earning.createdAt).toLocaleDateString()}
//                                                         </p>
//                                                     </div>
//                                                 </div>
//                                                 <div className="text-right">
//                                                     <p className={`font-semibold ${earning.type === 'provider-withdrawal' ? 'text-red-600' : 'text-green-600'
//                                                         }`}>
//                                                         {earning.type === 'provider-withdrawal' ? '-' : '+'}₹{earning.amount?.toFixed(2)}
//                                                     </p>
//                                                     <div className={`flex items-center gap-1 ${getStatusColor(earning.status)}`}>
//                                                         {getStatusIcon(earning.status)}
//                                                         <span className="text-sm capitalize">{earning.status}</span>
//                                                     </div>
//                                                 </div>
//                                             </div>
//                                         ))}
//                                     </div>
//                                 ) : (
//                                     <p className="text-gray-500 text-center py-8">No earnings found</p>
//                                 )}
//                             </div>
//                         )}

//                         {activeTab === 'statement' && (
//                             <div>
//                                 <div className="flex flex-col sm:flex-row gap-4 mb-6">
//                                     <div className="flex items-center gap-2">
//                                         <Calendar className="w-4 h-4 text-gray-500" />
//                                         <input
//                                             type="date"
//                                             value={dateFilter.startDate}
//                                             onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
//                                             className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
//                                         />
//                                         <span className="text-gray-500">to</span>
//                                         <input
//                                             type="date"
//                                             value={dateFilter.endDate}
//                                             onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
//                                             className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
//                                         />
//                                     </div>
//                                     <button
//                                         onClick={downloadStatement}
//                                         className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
//                                     >
//                                         <Download className="w-4 h-4" />
//                                         Download PDF
//                                     </button>
//                                 </div>

//                                 <div className="overflow-x-auto">
//                                     <table className="w-full">
//                                         <thead>
//                                             <tr className="border-b border-gray-200">
//                                                 <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
//                                                 <th className="text-left py-3 px-4 font-medium text-gray-600">Service</th>
//                                                 <th className="text-left py-3 px-4 font-medium text-gray-600">Amount</th>
//                                                 <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
//                                             </tr>
//                                         </thead>
//                                         <tbody>
//                                             {statements.map((statement, index) => (
//                                                 <tr key={index} className="border-b border-gray-100">
//                                                     <td className="py-3 px-4">
//                                                         {new Date(statement.createdAt).toLocaleDateString()}
//                                                     </td>
//                                                     <td className="py-3 px-4">
//                                                         {statement.booking?.service || 'N/A'}
//                                                     </td>
//                                                     <td className="py-3 px-4 font-medium">
//                                                         ₹{statement.amount?.toFixed(2)}
//                                                     </td>
//                                                     <td className="py-3 px-4">
//                                                         <div className={`flex items-center gap-1 ${getStatusColor(statement.status)}`}>
//                                                             {getStatusIcon(statement.status)}
//                                                             <span className="capitalize">{statement.status}</span>
//                                                         </div>
//                                                     </td>
//                                                 </tr>
//                                             ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             </div>

//             {/* Withdrawal Modal */}
//             {showWithdrawal && (
//                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//                     <div className="bg-white rounded-xl max-w-md w-full p-6">
//                         <h3 className="text-lg font-semibold mb-4">Withdraw Earnings</h3>

//                         <div className="space-y-4">
//                             <div>
//                                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                                     Amount (₹)
//                                 </label>
//                                 <input
//                                     type="number"
//                                     min="500"
//                                     step="0.01"
//                                     value={withdrawalForm.amount}
//                                     onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
//                                     className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                                     placeholder="Enter amount"
//                                     required
//                                 />
//                                 <p className="text-xs text-gray-500 mt-1">Minimum withdrawal: ₹500</p>
//                             </div>

//                             <div>
//                                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                                     Withdrawal Method
//                                 </label>
//                                 <select
//                                     value={withdrawalForm.method}
//                                     onChange={(e) => setWithdrawalForm({ ...withdrawalForm, method: e.target.value })}
//                                     className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                                 >
//                                     <option value="upi">UPI</option>
//                                     <option value="bank_transfer">Bank Transfer</option>
//                                 </select>
//                             </div>

//                             {withdrawalForm.method === 'upi' ? (
//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                                         UPI ID
//                                     </label>
//                                     <input
//                                         type="text"
//                                         value={withdrawalForm.details.upiId}
//                                         onChange={(e) => setWithdrawalForm({
//                                             ...withdrawalForm,
//                                             details: { ...withdrawalForm.details, upiId: e.target.value }
//                                         })}
//                                         className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                                         placeholder="your@upi"
//                                         required
//                                     />
//                                 </div>
//                             ) : (
//                                 <div className="space-y-3">
//                                     <div>
//                                         <label className="block text-sm font-medium text-gray-700 mb-2">
//                                             Account Holder Name
//                                         </label>
//                                         <input
//                                             type="text"
//                                             value={withdrawalForm.details.accountHolderName}
//                                             onChange={(e) => setWithdrawalForm({
//                                                 ...withdrawalForm,
//                                                 details: { ...withdrawalForm.details, accountHolderName: e.target.value }
//                                             })}
//                                             className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                                             required
//                                         />
//                                     </div>
//                                     <div>
//                                         <label className="block text-sm font-medium text-gray-700 mb-2">
//                                             Account Number
//                                         </label>
//                                         <input
//                                             type="text"
//                                             value={withdrawalForm.details.accountNumber}
//                                             onChange={(e) => setWithdrawalForm({
//                                                 ...withdrawalForm,
//                                                 details: { ...withdrawalForm.details, accountNumber: e.target.value }
//                                             })}
//                                             className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                                             required
//                                         />
//                                     </div>
//                                     <div>
//                                         <label className="block text-sm font-medium text-gray-700 mb-2">
//                                             IFSC Code
//                                         </label>
//                                         <input
//                                             type="text"
//                                             value={withdrawalForm.details.ifscCode}
//                                             onChange={(e) => setWithdrawalForm({
//                                                 ...withdrawalForm,
//                                                 details: { ...withdrawalForm.details, ifscCode: e.target.value }
//                                             })}
//                                             className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                                             required
//                                         />
//                                     </div>
//                                 </div>
//                             )}

//                             <div className="flex gap-3 pt-4">
//                                 <button
//                                     type="button"
//                                     onClick={() => setShowWithdrawal(false)}
//                                     className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors"
//                                 >
//                                     Cancel
//                                 </button>
//                                 <button
//                                     type="button"
//                                     onClick={handleWithdrawal}
//                                     className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
//                                 >
//                                     Submit Request
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default ProviderEarningsDashboard;



import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Download, Calendar, ArrowUpRight, ArrowDownLeft, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const ProviderEarningsSystem = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [walletBalance, setWalletBalance] = useState(1250.75);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [autoTransfer, setAutoTransfer] = useState(true);
  
  // Sample transaction data
  const [transactions, setTransactions] = useState([
    { id: 1, type: 'earning', amount: 450, description: 'Service #1234', date: '2025-07-29', status: 'completed' },
    { id: 2, type: 'earning', amount: 300, description: 'Service #1235', date: '2025-07-28', status: 'completed' },
    { id: 3, type: 'withdrawal', amount: -500, description: 'Manual Withdrawal', date: '2025-07-27', status: 'completed', fee: 25 },
    { id: 4, type: 'earning', amount: 600, description: 'Service #1236', date: '2025-07-26', status: 'completed' },
    { id: 5, type: 'commission', amount: -50, description: 'Low Balance Commission', date: '2025-07-25', status: 'completed' }
  ]);

  // Calculate commission based on wallet balance
  const getCommissionRate = () => {
    return walletBalance < 500 ? 15 : 10; // Extra 5% commission if balance < ₹500
  };

  // Calculate weekly earnings
  useEffect(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyTotal = transactions
      .filter(t => new Date(t.date) >= oneWeekAgo && t.type === 'earning')
      .reduce((sum, t) => sum + t.amount, 0);
    
    setWeeklyEarnings(weeklyTotal);
  }, [transactions]);

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (amount > 0 && amount <= walletBalance) {
      const fee = amount * 0.05; // 5% withdrawal fee
      const netAmount = amount - fee;
      
      setWalletBalance(prev => prev - amount);
      setTransactions(prev => [
        {
          id: Date.now(),
          type: 'withdrawal',
          amount: -netAmount,
          description: 'Manual Withdrawal',
          date: new Date().toISOString().split('T')[0],
          status: 'processing',
          fee: fee
        },
        ...prev
      ]);
      setWithdrawAmount('');
    }
  };

  const generateReport = () => {
    if (!dateRange.from || !dateRange.to) {
      alert('Please select date range');
      return;
    }
    
    const filteredTransactions = transactions.filter(t => 
      t.date >= dateRange.from && t.date <= dateRange.to
    );
    
    const reportData = {
      period: `${dateRange.from} to ${dateRange.to}`,
      totalEarnings: filteredTransactions.filter(t => t.type === 'earning').reduce((sum, t) => sum + t.amount, 0),
      totalWithdrawals: Math.abs(filteredTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0)),
      totalCommissions: Math.abs(filteredTransactions.filter(t => t.type === 'commission').reduce((sum, t) => sum + t.amount, 0)),
      transactions: filteredTransactions
    };
    
    // Simulate download
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `earnings-report-${dateRange.from}-to-${dateRange.to}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const simulateEarning = () => {
    const amount = Math.floor(Math.random() * 500) + 100;
    const commission = amount * (getCommissionRate() / 100);
    const netAmount = amount - commission;
    
    setWalletBalance(prev => prev + netAmount);
    setTransactions(prev => [
      {
        id: Date.now(),
        type: 'earning',
        amount: netAmount,
        description: `Service #${Math.floor(Math.random() * 9999)}`,
        date: new Date().toISOString().split('T')[0],
        status: 'completed'
      },
      {
        id: Date.now() + 1,
        type: 'commission',
        amount: -commission,
        description: `Commission (${getCommissionRate()}%)`,
        date: new Date().toISOString().split('T')[0],
        status: 'completed'
      },
      ...prev
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Provider Dashboard</h1>
              <p className="text-gray-600">Manage your earnings and wallet</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-2xl font-bold text-green-600">₹{walletBalance.toFixed(2)}</p>
              </div>
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg mb-6">
          <div className="flex border-b">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
              { id: 'wallet', label: 'Wallet & Earnings', icon: Wallet },
              { id: 'reports', label: 'Transaction Reports', icon: Download }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Wallet Balance</p>
                  <p className="text-3xl font-bold">₹{walletBalance.toFixed(2)}</p>
                </div>
                <Wallet className="h-10 w-10 text-green-200" />
              </div>
              {walletBalance < 500 && (
                <div className="mt-3 flex items-center space-x-2 text-yellow-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Low balance - Extra {getCommissionRate()}% commission</span>
                </div>
              )}
            </div>

            {/* Weekly Earnings */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Weekly Earnings</p>
                  <p className="text-3xl font-bold">₹{weeklyEarnings.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-blue-200" />
              </div>
            </div>

            {/* Commission Rate */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100">Commission Rate</p>
                  <p className="text-3xl font-bold">{getCommissionRate()}%</p>
                </div>
                <ArrowUpRight className="h-10 w-10 text-purple-200" />
              </div>
            </div>

            {/* Auto Transfer Status */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Auto Transfer</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {autoTransfer ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoTransfer}
                    onChange={(e) => setAutoTransfer(e.target.checked)}
                    className="h-5 w-5 text-blue-600"
                  />
                  {autoTransfer ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <Clock className="h-6 w-6 text-gray-400" />
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {autoTransfer ? 'Weekly auto-transfer to bank' : 'Manual withdrawals only'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-lg md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
              <div className="flex space-x-4">
                <button
                  onClick={simulateEarning}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  Simulate New Earning
                </button>
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Withdraw Funds
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Download Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Withdrawal Section */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Manual Withdrawal</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Withdrawal Amount
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      Withdrawal fee: 5% (₹{withdrawAmount ? (parseFloat(withdrawAmount) * 0.05).toFixed(2) : '0.00'})
                    </span>
                  </div>
                  <p className="text-sm text-yellow-800 mt-1">
                    You'll receive: ₹{withdrawAmount ? (parseFloat(withdrawAmount) * 0.95).toFixed(2) : '0.00'}
                  </p>
                </div>
                <button
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) > walletBalance}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Withdraw Funds
                </button>
              </div>
            </div>

            {/* Balance Tracking */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Balance Tracking</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                  <span className="text-green-800">Available Balance</span>
                  <span className="text-green-600 font-bold">₹{walletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                  <span className="text-blue-800">Weekly Earnings</span>
                  <span className="text-blue-600 font-bold">₹{weeklyEarnings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                  <span className="text-purple-800">Commission Rate</span>
                  <span className="text-purple-600 font-bold">{getCommissionRate()}%</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-800">Auto Transfer</span>
                  <span className={`font-bold ${autoTransfer ? 'text-green-600' : 'text-red-600'}`}>
                    {autoTransfer ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Transaction Reports</h3>
            
            {/* Date Range Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={generateReport}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="h-5 w-5" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>

            {/* Transaction History */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-800">{transaction.date}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'earning' ? 'bg-green-100 text-green-800' :
                          transaction.type === 'withdrawal' ? 'bg-red-100 text-red-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {transaction.type === 'earning' ? (
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3 mr-1" />
                          )}
                          {transaction.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{transaction.description}</td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ₹{Math.abs(transaction.amount).toFixed(2)}
                        {transaction.fee && (
                          <div className="text-xs text-gray-500">Fee: ₹{transaction.fee.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                          transaction.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderEarningsSystem;


