// import React, { useState, useEffect } from 'react';
// import { 
//   DollarSign, 
//   TrendingUp, 
//   Clock, 
//   Download, 
//   CreditCard, 
//   Smartphone,
//   AlertCircle,
//   Calendar,
//   Filter,
//   Eye,
//   EyeOff
// } from 'lucide-react';

// const ProviderEarningsDashboard = () => {
//   // State management
//   const [activeTab, setActiveTab] = useState('overview');
//   const [earnings, setEarnings] = useState(null);
//   const [summary, setSummary] = useState(null);
//   const [statement, setStatement] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [withdrawalModal, setWithdrawalModal] = useState(false);
//   const [withdrawalForm, setWithdrawalForm] = useState({
//     amount: '',
//     method: 'upi',
//     details: {
//       upiId: '',
//       accountNumber: '',
//       ifscCode: '',
//       accountHolderName: '',
//       bankName: ''
//     }
//   });
//   const [dateFilter, setDateFilter] = useState({
//     startDate: '',
//     endDate: ''
//   });
//   const [showBalance, setShowBalance] = useState(true);

//   // API calls
//   const fetchEarnings = async () => {
//     try {
//       const response = await fetch('http://localhost:5000/api/transaction/earnings', {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('providerToken')}`
//         }
//       });
//       if (!response.ok) throw new Error('Failed to fetch earnings');
//       const data = await response.json();
//       setEarnings(data.earnings);
//     } catch (err) {
//       setError('Failed to load earnings data');
//     }
//   };

//   const fetchSummary = async () => {
//     try {
//       const response = await fetch('http://localhost:5000/api/provider-earnings/summary', {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('providerToken')}`
//         }
//       });
//       if (!response.ok) throw new Error('Failed to fetch summary');
//       const data = await response.json();
//       setSummary(data.summary);
//     } catch (err) {
//       setError('Failed to load summary data');
//     }
//   };

//   const fetchStatement = async () => {
//     try {
//       const queryParams = new URLSearchParams();
//       if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
//       if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);

//       const response = await fetch(`http://localhost:5000/api/provider-earnings/statement?${queryParams}`, {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('providerToken')}`
//         }
//       });
//       if (!response.ok) throw new Error('Failed to fetch statement');
//       const data = await response.json();
//       setStatement(data.earnings);
//     } catch (err) {
//       setError('Failed to load statement data');
//     }
//   };

//   const handleWithdrawal = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const response = await fetch('http://localhost:5000/api/transaction/withdraw', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${localStorage.getItem('providerToken')}`
//         },
//         body: JSON.stringify(withdrawalForm)
//       });

//       if (!response.ok) throw new Error('Withdrawal failed');

//       const data = await response.json();
//       alert('Withdrawal request submitted successfully!');
//       setWithdrawalModal(false);
//       fetchEarnings();
//       fetchSummary();
//     } catch (err) {
//       alert(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const downloadStatement = async () => {
//     try {
//       const queryParams = new URLSearchParams();
//       if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
//       if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);

//       const response = await fetch(`http://localhost:5000/api/provider-earnings/download-statement?${queryParams}`, {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('providerToken')}`
//         }
//       });

//       if (!response.ok) throw new Error('Failed to download statement');

//       const blob = await response.blob();
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = `earnings_statement_${new Date().toISOString().split('T')[0]}.pdf`;
//       a.click();
//       window.URL.revokeObjectURL(url);
//     } catch (err) {
//       alert('Failed to download statement');
//     }
//   };

//   useEffect(() => {
//     const loadData = async () => {
//       setLoading(true);
//       await Promise.all([fetchEarnings(), fetchSummary(), fetchStatement()]);
//       setLoading(false);
//     };
//     loadData();
//   }, []);

//   useEffect(() => {
//     if (activeTab === 'statement') {
//       fetchStatement();
//     }
//   }, [dateFilter, activeTab]);

//   if (loading && !earnings) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading earnings data...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white shadow-sm border-b">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex justify-between items-center py-6">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">Earnings Dashboard</h1>
//               <p className="text-gray-600">Manage your earnings and withdrawals</p>
//             </div>
//             <div className="flex items-center space-x-4">
//               <button
//                 onClick={() => setShowBalance(!showBalance)}
//                 className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800"
//               >
//                 {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
//                 <span>{showBalance ? 'Hide' : 'Show'} Balance</span>
//               </button>
//               <button
//                 onClick={() => setWithdrawalModal(true)}
//                 className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
//               >
//                 <CreditCard size={18} />
//                 <span>Withdraw</span>
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* Earnings Summary Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//           <div className="bg-white rounded-xl shadow-sm p-6 border">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center space-x-3">
//                 <div className="bg-green-100 p-3 rounded-full">
//                   <DollarSign className="text-green-600" size={24} />
//                 </div>
//                 <div>
//                   <p className="text-sm font-medium text-gray-600">Available Balance</p>
//                   <p className="text-2xl font-bold text-gray-900">
//                     {showBalance ? `₹${summary?.availableBalance?.toFixed(2) || '0.00'}` : '₹••••'}
//                   </p>
//                 </div>
//               </div>
//             </div>
//             <div className="flex items-center text-sm text-gray-600">
//               <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
//                 (summary?.availableBalance || 0) >= 500 ? 'bg-green-400' : 'bg-red-400'
//               }`}></span>
//               {(summary?.availableBalance || 0) >= 500 ? 'Ready to withdraw' : 'Minimum ₹500 required'}
//             </div>
//           </div>

//           <div className="bg-white rounded-xl shadow-sm p-6 border">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center space-x-3">
//                 <div className="bg-blue-100 p-3 rounded-full">
//                   <TrendingUp className="text-blue-600" size={24} />
//                 </div>
//                 <div>
//                   <p className="text-sm font-medium text-gray-600">Total Earnings</p>
//                   <p className="text-2xl font-bold text-gray-900">
//                     {showBalance ? `₹${summary?.totalEarnings?.toFixed(2) || '0.00'}` : '₹••••'}
//                   </p>
//                 </div>
//               </div>
//             </div>
//             <div className="text-sm text-gray-600">
//               Lifetime earnings from all bookings
//             </div>
//           </div>

//           <div className="bg-white rounded-xl shadow-sm p-6 border">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center space-x-3">
//                 <div className="bg-yellow-100 p-3 rounded-full">
//                   <Clock className="text-yellow-600" size={24} />
//                 </div>
//                 <div>
//                   <p className="text-sm font-medium text-gray-600">Pending</p>
//                   <p className="text-2xl font-bold text-gray-900">
//                     {showBalance ? `₹${summary?.pendingEarnings?.toFixed(2) || '0.00'}` : '₹••••'}
//                   </p>
//                 </div>
//               </div>
//             </div>
//             <div className="text-sm text-gray-600">
//               Pending clearance (7-day hold)
//             </div>
//           </div>
//         </div>

//         {/* Tabs */}
//         <div className="bg-white rounded-xl shadow-sm border">
//           <div className="border-b">
//             <nav className="flex space-x-8 px-6">
//               {[
//                 { id: 'overview', label: 'Overview', icon: DollarSign },
//                 { id: 'statement', label: 'Statement', icon: Calendar },
//               ].map((tab) => {
//                 const Icon = tab.icon;
//                 return (
//                   <button
//                     key={tab.id}
//                     onClick={() => setActiveTab(tab.id)}
//                     className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
//                       activeTab === tab.id
//                         ? 'border-blue-500 text-blue-600'
//                         : 'border-transparent text-gray-500 hover:text-gray-700'
//                     }`}
//                   >
//                     <Icon size={18} />
//                     <span>{tab.label}</span>
//                   </button>
//                 );
//               })}
//             </nav>
//           </div>

//           <div className="p-6">
//             {activeTab === 'overview' && (
//               <div className="space-y-6">
//                 {/* Earnings Chart Placeholder */}
//                 <div className="bg-gray-50 rounded-lg p-8 text-center">
//                   <TrendingUp className="mx-auto text-gray-400 mb-4" size={48} />
//                   <h3 className="text-lg font-medium text-gray-900 mb-2">Earnings Overview</h3>
//                   <p className="text-gray-600">
//                     Total Earnings: ₹{earnings?.totalEarnings?.toFixed(2) || '0.00'}
//                   </p>
//                   <p className="text-gray-600">
//                     Available Balance: ₹{earnings?.availableBalance?.toFixed(2) || '0.00'}
//                   </p>
//                   <p className="text-gray-600">
//                     Can Withdraw: {earnings?.canWithdraw ? 'Yes' : 'No (Minimum ₹500 required)'}
//                   </p>
//                 </div>

//                 {/* Quick Actions */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <button
//                     onClick={() => setWithdrawalModal(true)}
//                     disabled={!earnings?.canWithdraw}
//                     className="flex items-center justify-center space-x-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     <CreditCard size={20} />
//                     <span>Request Withdrawal</span>
//                   </button>
//                   <button
//                     onClick={downloadStatement}
//                     className="flex items-center justify-center space-x-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
//                   >
//                     <Download size={20} />
//                     <span>Download Statement</span>
//                   </button>
//                 </div>
//               </div>
//             )}

//             {activeTab === 'statement' && (
//               <div className="space-y-6">
//                 {/* Date Filter */}
//                 <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
//                   <Filter size={20} className="text-gray-400" />
//                   <input
//                     type="date"
//                     value={dateFilter.startDate}
//                     onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
//                     className="border border-gray-300 rounded-md px-3 py-2"
//                     placeholder="Start Date"
//                   />
//                   <span className="text-gray-500">to</span>
//                   <input
//                     type="date"
//                     value={dateFilter.endDate}
//                     onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
//                     className="border border-gray-300 rounded-md px-3 py-2"
//                     placeholder="End Date"
//                   />
//                   <button
//                     onClick={downloadStatement}
//                     className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
//                   >
//                     <Download size={16} />
//                     <span>Download PDF</span>
//                   </button>
//                 </div>

//                 {/* Statement Table */}
//                 <div className="overflow-x-auto">
//                   <table className="w-full">
//                     <thead>
//                       <tr className="border-b">
//                         <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
//                         <th className="text-left py-3 px-4 font-medium text-gray-700">Booking</th>
//                         <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
//                         <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
//                         <th className="text-left py-3 px-4 font-medium text-gray-700">Available Date</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {statement.map((item) => (
//                         <tr key={item._id} className="border-b hover:bg-gray-50">
//                           <td className="py-3 px-4 text-sm text-gray-900">
//                             {new Date(item.createdAt).toLocaleDateString()}
//                           </td>
//                           <td className="py-3 px-4 text-sm text-gray-900">
//                             {item.booking?.service || 'N/A'}
//                           </td>
//                           <td className="py-3 px-4 text-sm font-medium text-gray-900">
//                             ₹{item.amount?.toFixed(2)}
//                           </td>
//                           <td className="py-3 px-4">
//                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
//                               item.status === 'available' ? 'bg-green-100 text-green-800' :
//                               item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
//                               'bg-gray-100 text-gray-800'
//                             }`}>
//                               {item.status}
//                             </span>
//                           </td>
//                           <td className="py-3 px-4 text-sm text-gray-900">
//                             {new Date(item.availableAfter).toLocaleDateString()}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                   {statement.length === 0 && (
//                     <div className="text-center py-8 text-gray-500">
//                       No earnings found for the selected period
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Withdrawal Modal */}
//       {withdrawalModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-xl max-w-md w-full p-6">
//             <h3 className="text-lg font-medium mb-4">Request Withdrawal</h3>

//             <form onSubmit={handleWithdrawal} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Amount (₹)
//                 </label>
//                 <input
//                   type="number"
//                   min="500"
//                   max={earnings?.availableBalance || 0}
//                   value={withdrawalForm.amount}
//                   onChange={(e) => setWithdrawalForm({...withdrawalForm, amount: e.target.value})}
//                   className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                   placeholder="Minimum ₹500"
//                   required
//                 />
//                 <p className="text-sm text-gray-500 mt-1">
//                   Available: ₹{earnings?.availableBalance?.toFixed(2) || '0.00'}
//                 </p>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Withdrawal Method
//                 </label>
//                 <select
//                   value={withdrawalForm.method}
//                   onChange={(e) => setWithdrawalForm({...withdrawalForm, method: e.target.value})}
//                   className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                 >
//                   <option value="upi">UPI</option>
//                   <option value="bank_transfer">Bank Transfer</option>
//                 </select>
//               </div>

//               {withdrawalForm.method === 'upi' ? (
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     UPI ID
//                   </label>
//                   <input
//                     type="text"
//                     value={withdrawalForm.details.upiId}
//                     onChange={(e) => setWithdrawalForm({
//                       ...withdrawalForm,
//                       details: {...withdrawalForm.details, upiId: e.target.value}
//                     })}
//                     className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                     placeholder="your-upi@paytm"
//                     required
//                   />
//                 </div>
//               ) : (
//                 <div className="space-y-3">
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       Account Holder Name
//                     </label>
//                     <input
//                       type="text"
//                       value={withdrawalForm.details.accountHolderName}
//                       onChange={(e) => setWithdrawalForm({
//                         ...withdrawalForm,
//                         details: {...withdrawalForm.details, accountHolderName: e.target.value}
//                       })}
//                       className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       Account Number
//                     </label>
//                     <input
//                       type="text"
//                       value={withdrawalForm.details.accountNumber}
//                       onChange={(e) => setWithdrawalForm({
//                         ...withdrawalForm,
//                         details: {...withdrawalForm.details, accountNumber: e.target.value}
//                       })}
//                       className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       IFSC Code
//                     </label>
//                     <input
//                       type="text"
//                       value={withdrawalForm.details.ifscCode}
//                       onChange={(e) => setWithdrawalForm({
//                         ...withdrawalForm,
//                         details: {...withdrawalForm.details, ifscCode: e.target.value}
//                       })}
//                       className="w-full border border-gray-300 rounded-lg px-3 py-2"
//                       required
//                     />
//                   </div>
//                 </div>
//               )}

//               <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg">
//                 <AlertCircle size={16} className="text-yellow-600" />
//                 <p className="text-sm text-yellow-800">
//                   Withdrawal requests are processed within 24-48 hours
//                 </p>
//               </div>

//               <div className="flex space-x-3 pt-4">
//                 <button
//                   type="button"
//                   onClick={() => setWithdrawalModal(false)}
//                   className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={loading}
//                   className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
//                 >
//                   {loading ? 'Processing...' : 'Request Withdrawal'}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProviderEarningsDashboard;





























import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
    Wallet,
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
    RefreshCw
} from 'lucide-react';

const ProviderEarningsDashboard = () => {
    const { token, API, showToast } = useAuth();
    const [earnings, setEarnings] = useState(null);
    const [summary, setSummary] = useState(null);
    const [statements, setStatements] = useState([]);
    const [showWithdrawal, setShowWithdrawal] = useState(false);
    const [withdrawalForm, setWithdrawalForm] = useState({
        amount: '',
        method: 'upi',
        details: {
            upiId: '',
            accountNumber: '',
            ifscCode: '',
            accountHolderName: '',
            bankName: ''
        }
    });
    const [dateFilter, setDateFilter] = useState({
        startDate: '',
        endDate: ''
    });
    const [activeTab, setActiveTab] = useState('overview');

    // Fetch earnings data
    const fetchEarnings = async () => {
        try {
            const response = await fetch(`${API}/transaction/earnings`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch earnings');

            const data = await response.json();
            setEarnings(data.earnings);
        } catch (error) {
            showToast('Error fetching earnings: ' + error.message, 'error');
        }
    };

    // Fetch earnings summary
    const fetchSummary = async () => {
        try {
            const response = await fetch(`${API}/earning/summary`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch summary');
            }

            const data = await response.json();
            setSummary(data.summary);
        } catch (error) {
            showToast('Error fetching summary: ' + error.message, 'error');
        }
    };

    // Fetch earnings statement
    const fetchStatement = async () => {
        try {
            const params = new URLSearchParams();
            if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
            if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);

            const response = await fetch(`${API}/earning/statement?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch statement');

            const data = await response.json();
            setStatements(data.earnings);
        } catch (error) {
            showToast('Error fetching statement: ' + error.message, 'error');
        }
    };

    // Handle withdrawal
    const handleWithdrawal = async () => {
        if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) < 500) {
            showToast('Minimum withdrawal amount is ₹500', 'error');
            return;
        }

        try {
            const response = await fetch(`${API}/transaction/withdraw`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: parseFloat(withdrawalForm.amount),
                    method: withdrawalForm.method,
                    details: withdrawalForm.details
                })
            });

            if (!response.ok) throw new Error('Withdrawal failed');

            showToast('Withdrawal request submitted successfully!', 'success');
            setShowWithdrawal(false);
            setWithdrawalForm({
                amount: '',
                method: 'upi',
                details: {
                    upiId: '',
                    accountNumber: '',
                    ifscCode: '',
                    accountHolderName: '',
                    bankName: ''
                }
            });

            // Refresh data
            fetchEarnings();
            fetchSummary();
        } catch (error) {
            showToast('Error processing withdrawal: ' + error.message, 'error');
        }
    };

    // Download statement
    const downloadStatement = async () => {
        try {
            const params = new URLSearchParams();
            if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
            if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);

            const response = await fetch(`${API}/earning/download-statement?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to download statement');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `earnings_statement_${new Date().toISOString().split('T')[0]}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);

            showToast('Statement downloaded successfully!', 'success');
        } catch (error) {
            showToast('Error downloading statement: ' + error.message, 'error');
        }
    };

    // Refresh all data
    const refreshData = async () => {
        await Promise.all([fetchEarnings(), fetchSummary(), fetchStatement()]);
    };

    useEffect(() => {
        refreshData();
    }, []);

    useEffect(() => {
        if (activeTab === 'statement') {
            fetchStatement();
        }
    }, [dateFilter, activeTab]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-600';
            case 'pending': return 'text-yellow-600';
            case 'processing': return 'text-blue-600';
            case 'failed': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4" />;
            case 'pending': return <Clock className="w-4 h-4" />;
            case 'processing': return <RefreshCw className="w-4 h-4" />;
            case 'failed': return <XCircle className="w-4 h-4" />;
            default: return <AlertCircle className="w-4 h-4" />;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Earnings Dashboard</h1>
                            <p className="text-gray-600 mt-2">Manage your earnings and withdrawals</p>
                        </div>
                        <button
                            onClick={refreshData}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Available Balance</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        ₹{summary.availableBalance?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="bg-green-100 p-3 rounded-full">
                                    <Wallet className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        ₹{summary.totalEarnings?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-full">
                                    <TrendingUp className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        ₹{summary.pendingEarnings?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="bg-yellow-100 p-3 rounded-full">
                                    <Clock className="w-6 h-6 text-yellow-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Withdrawal Button */}
                <div className="mb-8">
                    <button
                        onClick={() => setShowWithdrawal(true)}
                        disabled={!summary?.availableBalance || summary.availableBalance < 500}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all"
                    >
                        <DollarSign className="w-5 h-5" />
                        Withdraw Earnings
                    </button>
                    {summary?.availableBalance < 500 && (
                        <p className="text-sm text-red-500 mt-2">
                            Minimum withdrawal amount is ₹500
                        </p>
                    )}
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('statement')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'statement'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Statement
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === 'overview' && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Recent Earnings</h3>
                                {earnings && earnings.length > 0 ? (
                                    <div className="space-y-4">
                                        {earnings.slice(0, 10).map((earning, index) => (
                                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-blue-100 p-2 rounded-full">
                                                        <CreditCard className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {earning.type === 'provider-withdrawal' ? 'Withdrawal' : 'Booking Payment'}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            {new Date(earning.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-semibold ${earning.type === 'provider-withdrawal' ? 'text-red-600' : 'text-green-600'
                                                        }`}>
                                                        {earning.type === 'provider-withdrawal' ? '-' : '+'}₹{earning.amount?.toFixed(2)}
                                                    </p>
                                                    <div className={`flex items-center gap-1 ${getStatusColor(earning.status)}`}>
                                                        {getStatusIcon(earning.status)}
                                                        <span className="text-sm capitalize">{earning.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No earnings found</p>
                                )}
                            </div>
                        )}

                        {activeTab === 'statement' && (
                            <div>
                                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-500" />
                                        <input
                                            type="date"
                                            value={dateFilter.startDate}
                                            onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        />
                                        <span className="text-gray-500">to</span>
                                        <input
                                            type="date"
                                            value={dateFilter.endDate}
                                            onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={downloadStatement}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download PDF
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Service</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Amount</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statements.map((statement, index) => (
                                                <tr key={index} className="border-b border-gray-100">
                                                    <td className="py-3 px-4">
                                                        {new Date(statement.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {statement.booking?.service || 'N/A'}
                                                    </td>
                                                    <td className="py-3 px-4 font-medium">
                                                        ₹{statement.amount?.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className={`flex items-center gap-1 ${getStatusColor(statement.status)}`}>
                                                            {getStatusIcon(statement.status)}
                                                            <span className="capitalize">{statement.status}</span>
                                                        </div>
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
            </div>

            {/* Withdrawal Modal */}
            {showWithdrawal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold mb-4">Withdraw Earnings</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    min="500"
                                    step="0.01"
                                    value={withdrawalForm.amount}
                                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="Enter amount"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Minimum withdrawal: ₹500</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Withdrawal Method
                                </label>
                                <select
                                    value={withdrawalForm.method}
                                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, method: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    <option value="upi">UPI</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                </select>
                            </div>

                            {withdrawalForm.method === 'upi' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        UPI ID
                                    </label>
                                    <input
                                        type="text"
                                        value={withdrawalForm.details.upiId}
                                        onChange={(e) => setWithdrawalForm({
                                            ...withdrawalForm,
                                            details: { ...withdrawalForm.details, upiId: e.target.value }
                                        })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        placeholder="your@upi"
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Account Holder Name
                                        </label>
                                        <input
                                            type="text"
                                            value={withdrawalForm.details.accountHolderName}
                                            onChange={(e) => setWithdrawalForm({
                                                ...withdrawalForm,
                                                details: { ...withdrawalForm.details, accountHolderName: e.target.value }
                                            })}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Account Number
                                        </label>
                                        <input
                                            type="text"
                                            value={withdrawalForm.details.accountNumber}
                                            onChange={(e) => setWithdrawalForm({
                                                ...withdrawalForm,
                                                details: { ...withdrawalForm.details, accountNumber: e.target.value }
                                            })}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            IFSC Code
                                        </label>
                                        <input
                                            type="text"
                                            value={withdrawalForm.details.ifscCode}
                                            onChange={(e) => setWithdrawalForm({
                                                ...withdrawalForm,
                                                details: { ...withdrawalForm.details, ifscCode: e.target.value }
                                            })}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowWithdrawal(false)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleWithdrawal}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderEarningsDashboard;