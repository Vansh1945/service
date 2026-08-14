import { useState, useEffect } from 'react';
import {
    CreditCard, QrCode, CheckCircle2, AlertTriangle, Edit3, Trash2,
    ShieldCheck, Loader2, PlusCircle, Check, DollarSign, Clock,
    Send, Eye, Bell, XCircle, ArrowUpRight, Lock, Activity
} from 'lucide-react';
import * as ProviderService from '../../../../services/ProviderService';
import * as SystemService from '../../../../services/SystemService';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { getWithdrawalStatusBadge } from '../../../../utils/status';
import { IfscBankDetails } from '../../../../components/IfscBankDetails';

import { getProviderPayoutState } from '../../../../utils/payoutState';

const PayoutProfileTab = ({ showToast }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);

    const [payoutMode, setPayoutMode] = useState('manual');
    const [payoutSettings, setPayoutSettings] = useState({});

    const [walletData, setWalletData] = useState({
        availableBalance: 0,
        totalWithdrawn: 0,
        pendingWithdrawals: 0,
        lastSettlementAmount: 0,
        lastSettlementDate: null
    });

    const [recentWithdrawals, setRecentWithdrawals] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [bankDetails, setBankDetails] = useState({
        accountNo: '',
        ifsc: '',
        bankName: '',
        accountName: '',
        upiId: '',
        verified: false,
        bankVerificationStatus: 'pending',
        bankRejectReason: '',
        payoutEnabled: true,
        defaultMethod: 'bank_account',
        passbookImage: '',
        passbookImagePublicId: '',
        uploadedAt: null
    });

    const [passbookFile, setPassbookFile] = useState(null);
    const [passbookPreview, setPassbookPreview] = useState('');

    const [modal, setModal] = useState({
        isOpen: false,
        type: 'bank_account',
    });

    const [selectedWithdrawalDetail, setSelectedWithdrawalDetail] = useState(null);

    const [formData, setFormData] = useState({
        accountNo: '',
        ifsc: '',
        bankName: '',
        accountName: '',
        upiId: '',
        district: '',
        city: '',
        address: ''
    });

    // Withdrawal Form State
    const [withdrawForm, setWithdrawForm] = useState({
        amount: '',
        method: 'bank_account'
    });

    const fetchPayoutDetails = async () => {
        try {
            setLoading(true);
            const [profileRes, dashboardRes, systemRes] = await Promise.all([
                ProviderService.getProfile().catch(() => ({ data: {} })),
                ProviderService.getDashboardData().catch(() => ({ data: {} })),
                SystemService.getSystemSetting().catch(() => ({ data: {} }))
            ]);

            const details = profileRes.data?.data?.bankDetails || profileRes.data?.bankDetails || profileRes.data?.provider?.bankDetails || {};
            const providerName = profileRes.data?.data?.name || profileRes.data?.name || profileRes.data?.provider?.name || '';
            const payoutState = getProviderPayoutState(details);

            setBankDetails({
                accountNo: payoutState.accountNo,
                ifsc: payoutState.ifsc,
                bankName: payoutState.bankName,
                accountName: details.accountName || providerName || '',
                upiId: payoutState.upiId,
                verified: payoutState.verified,
                bankVerificationStatus: payoutState.bankVerificationStatus,
                bankRejectReason: payoutState.bankRejectReason,
                payoutEnabled: payoutState.payoutEnabled,
                defaultMethod: payoutState.preferredMethod,
                passbookImage: details.passbookImage || '',
                passbookImagePublicId: details.passbookImagePublicId || '',
                uploadedAt: details.uploadedAt || null
            });

            // Normalize to lowercase to match <select> option values ('upi' / 'bank_account')
            const normalizedMethod = (payoutState.preferredMethod || 'bank_account').toLowerCase();
            setWithdrawForm(prev => ({ ...prev, method: normalizedMethod }));

            if (dashboardRes.data?.data) {
                const dash = dashboardRes.data.data;
                const wallet = dash.wallet || dash.profile?.wallet || {};
                const list = dash.recentWithdrawals || dash.withdrawals || [];
                const completedList = list.filter(w => w.status === 'completed' || w.status === 'paid');
                const lastCompleted = completedList[0] || null;

                setWalletData({
                    availableBalance: wallet.availableBalance || wallet.currentBalance || 0,
                    totalWithdrawn: wallet.totalWithdrawn || wallet.releasedPayouts || 0,
                    pendingWithdrawals: wallet.pendingWithdrawals || 0,
                    lastSettlementAmount: lastCompleted?.amount || 0,
                    lastSettlementDate: lastCompleted?.completedAt || lastCompleted?.updatedAt || null
                });

                setRecentWithdrawals(list);

                // Extract payout notifications if available
                const allNotifs = dash.notifications || [];
                const payoutNotifs = allNotifs.filter(n =>
                    (n.title && n.title.toLowerCase().includes('bank')) ||
                    (n.title && n.title.toLowerCase().includes('payout')) ||
                    (n.title && n.title.toLowerCase().includes('withdrawal')) ||
                    (n.message && n.message.toLowerCase().includes('bank')) ||
                    (n.message && n.message.toLowerCase().includes('payout'))
                );
                setNotifications(payoutNotifs.slice(0, 5));
            }

            if (systemRes.data?.data?.payoutSettings) {
                const pSet = systemRes.data.data.payoutSettings;
                setPayoutSettings(pSet);
                setPayoutMode(pSet.mode || 'manual');
            }
        } catch (error) {
            console.error('Fetch payout profile error:', error);
            if (showToast) showToast('Failed to load payout profile details', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayoutDetails();
    }, []);

    useEffect(() => {
        const shouldLock = modal.isOpen || !!selectedWithdrawalDetail;
        if (shouldLock) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [modal.isOpen, selectedWithdrawalDetail]);

    const handleOpenModal = (type) => {
        setModal({ isOpen: true, type });
        if (type === 'bank_account') {
            setFormData({
                accountNo: bankDetails.accountNo || '',
                ifsc: bankDetails.ifsc || '',
                bankName: bankDetails.bankName || '',
                accountName: bankDetails.accountName || '',
                upiId: bankDetails.upiId || ''
            });
        } else {
            setFormData({
                accountNo: bankDetails.accountNo || '',
                ifsc: bankDetails.ifsc || '',
                bankName: bankDetails.bankName || '',
                accountName: bankDetails.accountName || '',
                upiId: bankDetails.upiId || ''
            });
        }
    };

    const handleCloseModal = () => {
        setModal({ isOpen: false, type: 'bank_account' });
        setPassbookFile(null);
        setPassbookPreview('');
    };

    const handlePassbookFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedExts = ['jpg', 'jpeg', 'png', 'pdf'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext)) {
            if (showToast) showToast('Invalid format. Accepted formats: JPG, PNG, PDF', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            if (showToast) showToast('File size must not exceed 5MB', 'error');
            return;
        }

        setPassbookFile(file);

        if (file.type === 'application/pdf') {
            setPassbookPreview(URL.createObjectURL(file));
        } else {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPassbookPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);

            if (modal.type === 'bank_account') {
                if (!formData.accountNo || !/^[0-9]{9,18}$/.test(formData.accountNo.trim())) {
                    if (showToast) showToast('Please enter a valid 9-18 digit account number', 'error');
                    setSaving(false);
                    return;
                }
                if (!formData.ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc.trim().toUpperCase())) {
                    if (showToast) showToast('Please enter a valid 11-character IFSC code', 'error');
                    setSaving(false);
                    return;
                }

                const hasExistingBank = !!bankDetails.accountNo;
                const detailsChanged =
                    formData.accountNo.trim() !== (bankDetails.accountNo || '') ||
                    formData.ifsc.trim().toUpperCase() !== (bankDetails.ifsc || '') ||
                    formData.accountName.trim() !== (bankDetails.accountName || '');

                if (!hasExistingBank || detailsChanged) {
                    if (!passbookFile) {
                        if (showToast) showToast('Bank Passbook or Cancelled Cheque is required.', 'error');
                        setSaving(false);
                        return;
                    }
                }

                const fd = new FormData();
                fd.append('updateType', 'bank');
                fd.append('accountName', formData.accountName.trim());
                fd.append('accountNo', formData.accountNo.trim());
                fd.append('ifsc', formData.ifsc.trim().toUpperCase());
                fd.append('bankName', formData.bankName.trim());
                if (passbookFile) {
                    fd.append('passbookImage', passbookFile);
                }

                const res = await ProviderService.updateProfile(fd);

                if (res.data?.isSameData) {
                    if (showToast) showToast(res.data.message || 'No changes detected.', 'info');
                    return;
                }

                if (res.data?.success) {
                    if (showToast) showToast(res.data.message || 'Bank details submitted successfully and are awaiting Admin verification.', 'success');
                    handleCloseModal();
                    fetchPayoutDetails();
                }
            } else {
                if (!formData.upiId || !/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/.test(formData.upiId.trim())) {
                    if (showToast) showToast('Please enter a valid UPI ID (e.g. name@bank)', 'error');
                    setSaving(false);
                    return;
                }

                const fd = new FormData();
                fd.append('accountName', formData.accountName.trim());
                fd.append('upiId', formData.upiId.trim());
                fd.append('updateType', 'upi');

                const res = await ProviderService.updateProfile(fd);

                if (res.data?.isSameData) {
                    if (showToast) showToast(res.data.message || 'No changes detected.', 'info');
                    return;
                }

                if (res.data?.success) {
                    if (showToast) showToast(res.data.message || 'Payout profile updated.', 'success');
                    handleCloseModal();
                    fetchPayoutDetails();
                }
            }
        } catch (error) {
            console.error('Save payout error:', error);
            const msg = error.response?.data?.message || 'Failed to save payout details';
            if (showToast) showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (type) => {
        if (!window.confirm(`Are you sure you want to remove your ${type === 'bank_account' ? 'Bank Account' : 'UPI ID'}?`)) return;
        try {
            setSaving(true);
            const payload = type === 'bank_account' ? { accountNo: '', ifsc: '', bankName: '' } : { upiId: '' };
            const res = await ProviderService.updateProfile(payload);
            if (res.data?.success) {
                if (showToast) showToast('Payment destination removed', 'success');
                fetchPayoutDetails();
            }
        } catch (error) {
            console.error('Delete error:', error);
            if (showToast) showToast('Failed to remove payout destination', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (method) => {
        try {
            setSaving(true);
            const mappedMethod = method === 'vpa' ? 'upi' : method;
            const res = await ProviderService.updateProfile({ preferredMethod: mappedMethod });
            if (res.data?.success) {
                if (showToast) showToast('Preferred payout method updated', 'success');
                fetchPayoutDetails();
            }
        } catch (error) {
            console.error('Set default error:', error);
            const msg = error.response?.data?.message || 'Failed to change preferred payout method';
            if (showToast) showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleWithdrawSubmit = async (e) => {
        e.preventDefault();
        const amt = Number(withdrawForm.amount);
        const minLimit = payoutSettings.minWithdrawalAmount || 500;
        const maxLimit = payoutSettings.maxWithdrawalAmount || 100000;

        if (!amt || amt <= 0) {
            if (showToast) showToast('Please enter a valid withdrawal amount', 'error');
            return;
        }
        if (amt < minLimit) {
            if (showToast) showToast(`Minimum withdrawal amount is ${formatCurrency(minLimit)}`, 'error');
            return;
        }
        if (amt > maxLimit) {
            if (showToast) showToast(`Maximum single withdrawal limit is ${formatCurrency(maxLimit)}`, 'error');
            return;
        }
        if (amt > walletData.availableBalance) {
            if (showToast) showToast('Insufficient wallet balance', 'error');
            return;
        }
        if (!isBankVerified) {
            if (showToast) showToast('Bank account verification is required before withdrawing', 'error');
            return;
        }

        try {
            setWithdrawing(true);
            const res = await ProviderService.requestWithdrawal({
                amount: amt,
                withdrawalMethod: withdrawForm.method
            });
            if (res.data?.success) {
                if (showToast) showToast(res.data.message || 'Withdrawal request submitted successfully', 'success');
                setWithdrawForm(prev => ({ ...prev, amount: '' }));
                fetchPayoutDetails();
            }
        } catch (err) {
            console.error('Withdraw request error:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to submit withdrawal request';
            if (showToast) showToast(msg, 'error');
        } finally {
            setWithdrawing(false);
        }
    };

    const maskAccount = (num) => {
        if (!num || num.length < 4) return '••••';
        return `•••• •••• ${num.slice(-4)}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const hasBank = !!bankDetails.accountNo;
    const hasUpi = !!bankDetails.upiId;
    const minLimit = payoutSettings.minWithdrawalAmount || 500;
    const maxLimit = payoutSettings.maxWithdrawalAmount || 100000;
    const isBankVerified = Boolean(
        bankDetails.bankVerificationStatus === 'verified' &&
        bankDetails.verified === true &&
        bankDetails.payoutEnabled === true
    );
    const defaultMethodClean = String(bankDetails.defaultMethod || '').toLowerCase();
    
    // Verification Status Text & Color
    let verificationText = 'Pending Verification';
    let verificationColor = 'text-amber-600';
    let VerificationIcon = AlertTriangle;

    if (bankDetails.bankVerificationStatus === 'verified') {
        verificationText = 'Verified ✓';
        verificationColor = 'text-emerald-600';
        VerificationIcon = ShieldCheck;
    } else if (bankDetails.bankVerificationStatus === 'rejected') {
        verificationText = 'Rejected';
        verificationColor = 'text-rose-600';
        VerificationIcon = XCircle;
    }

    // Withdrawal Status Text & Color
    let withdrawalStatusText = 'Locked — Verification Required';
    let withdrawalStatusColor = 'text-amber-600';
    let WithdrawalIcon = Lock;

    if (bankDetails.bankVerificationStatus === 'rejected') {
        withdrawalStatusText = 'Locked — Verification Rejected';
        withdrawalStatusColor = 'text-rose-600';
        WithdrawalIcon = Lock;
    } else if (!isBankVerified) {
        if (bankDetails.payoutEnabled === false && bankDetails.verified && bankDetails.bankVerificationStatus === 'verified') {
            withdrawalStatusText = 'Locked — Payout Disabled';
        } else {
            withdrawalStatusText = 'Locked — Verification Required';
        }
        withdrawalStatusColor = 'text-amber-600';
        WithdrawalIcon = Lock;
    } else if (walletData.availableBalance < minLimit) {
        withdrawalStatusText = 'Locked — Minimum Balance Required';
        withdrawalStatusColor = 'text-amber-600';
        WithdrawalIcon = Lock;
    } else {
        withdrawalStatusText = 'Active / Ready';
        withdrawalStatusColor = 'text-emerald-600';
        WithdrawalIcon = CheckCircle2;
    }

    // Withdrawal Warnings
    let withdrawalWarning = null;
    let isWithdrawalDisabled = false;

    if (!hasBank && !hasUpi) {
        withdrawalWarning = "Add and verify a bank account or UPI ID.";
        isWithdrawalDisabled = true;
    } else if (bankDetails.bankVerificationStatus === 'rejected') {
        withdrawalWarning = "Bank verification details were rejected. Please update them.";
        isWithdrawalDisabled = true;
    } else if (bankDetails.bankVerificationStatus === 'pending' || !bankDetails.verified) {
        withdrawalWarning = "Bank verification is required before withdrawal.";
        isWithdrawalDisabled = true;
    } else if (bankDetails.payoutEnabled === false) {
        withdrawalWarning = "Withdrawals are currently disabled.";
        isWithdrawalDisabled = true;
    } else if (walletData.availableBalance < minLimit) {
        withdrawalWarning = `Minimum balance of ${formatCurrency(minLimit)} is required.`;
        isWithdrawalDisabled = true;
    }

    return (
        <div className="space-y-6 font-inter">

            {/* 1. SECTION 1: PAYOUT STATUS */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-poppins">
                            <CreditCard className="w-6 h-6 text-primary" />
                            Payout Profile & Withdrawal Center
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-[10px] sm:text-xs font-inter">
                    {/* Payout Mode */}
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] sm:text-[10px]">Payout Mode</span>
                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm mt-1 block uppercase">
                            {payoutMode === 'razorpayx' ? 'RazorpayX' : 'Manual Approval'}
                        </span>
                    </div>

                    {/* Verification Status */}
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] sm:text-[10px]">Verification Status</span>
                        <span className={`font-extrabold text-xs sm:text-sm mt-1 inline-flex items-center gap-1.5 ${verificationColor}`}>
                            <VerificationIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> {verificationText}
                        </span>
                    </div>

                    {/* Withdrawal Status */}
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] sm:text-[10px]">Withdrawal Status</span>
                        <span className={`font-extrabold text-xs sm:text-sm mt-1 inline-flex items-center gap-1 ${withdrawalStatusColor}`}>
                            <WithdrawalIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> {withdrawalStatusText}
                        </span>
                    </div>

                    {/* Preferred Method */}
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] sm:text-[10px]">Preferred Method</span>
                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm mt-1 block uppercase">
                            {defaultMethodClean === 'vpa' || defaultMethodClean === 'upi' ? 'UPI' : 'Bank Account'}
                        </span>
                    </div>
                </div>

                {bankDetails.bankVerificationStatus === 'rejected' && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                            <strong>Verification Rejection Reason:</strong> {bankDetails.bankRejectReason || 'Submitted details do not match bank record. Please update and re-submit.'}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. SECTION 3: PAYMENT DESTINATION (BANK & UPI CARDS) */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" /> Payment Destinations
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bank Account Card */}
                    <div className={`relative bg-white rounded-2xl p-6 border transition-all ${defaultMethodClean === 'bank_account' && hasBank
                        ? 'border-primary shadow-md ring-2 ring-primary/10'
                        : 'border-slate-200/80 hover:border-slate-300 shadow-sm'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">Bank Account</h4>
                                    <span className="text-[11px] text-slate-500">Direct Transfer (IMPS / NEFT)</span>
                                </div>
                            </div>

                            {defaultMethodClean === 'bank_account' && hasBank && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Preferred
                                </span>
                            )}
                        </div>

                        {hasBank ? (
                            <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Account Holder</span>
                                    <span className="font-bold text-slate-900">{bankDetails.accountName || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Account Number</span>
                                    <span className="font-mono font-bold text-slate-900 tracking-wider">
                                        {maskAccount(bankDetails.accountNo)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">IFSC Code</span>
                                    <span className="font-mono font-bold text-slate-900">{bankDetails.ifsc || 'N/A'}</span>
                                </div>
                                {bankDetails.bankName && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Bank Name</span>
                                        <span className="font-bold text-slate-900 truncate max-w-[180px]">{bankDetails.bankName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                                    <span className="text-slate-500">Verification Status</span>
                                    <span className={`font-bold ${bankDetails.bankVerificationStatus === 'verified' ? 'text-emerald-600' : bankDetails.bankVerificationStatus === 'rejected' ? 'text-rose-600' : 'text-amber-600'}`}>
                                        {bankDetails.bankVerificationStatus === 'verified' ? 'Verified ✓' : bankDetails.bankVerificationStatus === 'rejected' ? 'Rejected' : 'Pending Verification'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                <p className="text-xs text-slate-500 mb-3">No Bank Account linked yet.</p>
                                <button
                                    onClick={() => handleOpenModal('bank_account')}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                                >
                                    <PlusCircle className="w-4 h-4" /> Add Bank Account
                                </button>
                            </div>
                        )}

                        {hasBank && (
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenModal('bank_account')}
                                        className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete('bank_account')}
                                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                                {defaultMethodClean !== 'bank_account' && (
                                    <button
                                        onClick={() => handleSetDefault('bank_account')}
                                        disabled={saving}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:border-primary text-slate-700 hover:text-primary transition-colors cursor-pointer"
                                    >
                                        Make Preferred
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* UPI VPA Card */}
                    <div className={`relative bg-white rounded-2xl p-6 border transition-all ${(defaultMethodClean === 'vpa' || defaultMethodClean === 'upi') && hasUpi
                        ? 'border-primary shadow-md ring-2 ring-primary/10'
                        : 'border-slate-200/80 hover:border-slate-300 shadow-sm'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                    <QrCode className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">UPI Payout (VPA)</h4>
                                    <span className="text-[11px] text-slate-500">Instant UPI Transfer</span>
                                </div>
                            </div>

                            {(defaultMethodClean === 'vpa' || defaultMethodClean === 'upi') && hasUpi && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Preferred
                                </span>
                            )}
                        </div>

                        {hasUpi ? (
                            <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Account Holder</span>
                                    <span className="font-bold text-slate-900">{bankDetails.accountName || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">UPI ID / VPA</span>
                                    <span className="font-mono font-bold text-slate-900 tracking-wide">
                                        {bankDetails.upiId}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                                    <span className="text-slate-500">Verification Status</span>
                                    <span className={`font-bold ${bankDetails.bankVerificationStatus === 'verified' ? 'text-emerald-600' : bankDetails.bankVerificationStatus === 'rejected' ? 'text-rose-600' : 'text-amber-600'}`}>
                                        {bankDetails.bankVerificationStatus === 'verified' ? 'Verified ✓' : bankDetails.bankVerificationStatus === 'rejected' ? 'Rejected' : 'Pending Verification'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                <p className="text-xs text-slate-500 mb-3">No UPI ID added</p>
                                <button
                                    onClick={() => handleOpenModal('vpa')}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                                >
                                    <PlusCircle className="w-4 h-4" /> Add UPI ID
                                </button>
                            </div>
                        )}

                        {hasUpi && (
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenModal('vpa')}
                                        className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete('vpa')}
                                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                                {defaultMethodClean !== 'vpa' && defaultMethodClean !== 'upi' && (
                                    <button
                                        onClick={() => handleSetDefault('vpa')}
                                        disabled={saving}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:border-emerald-600 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
                                    >
                                        Make Preferred
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. SECTION 4: WITHDRAWAL REQUEST FORM */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 font-poppins">
                        <Send className="w-4.5 h-4.5 text-primary" /> Withdraw Money
                    </h3>
                </div>

                <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">Available Balance</span>
                            <span className="text-xs sm:text-lg font-black text-slate-900 font-mono mt-1 block">{formatCurrency(walletData.availableBalance)}</span>
                        </div>
                        <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">Min Limit</span>
                            <span className="text-xs sm:text-lg font-black text-slate-800 font-mono mt-1 block">{formatCurrency(minLimit)}</span>
                        </div>
                        <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">Max Limit</span>
                            <span className="text-xs sm:text-lg font-black text-slate-800 font-mono mt-1 block">{formatCurrency(maxLimit)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Withdrawal Amount (₹) *</label>
                            <input
                                type="number"
                                required
                                min={minLimit}
                                max={maxLimit}
                                value={withdrawForm.amount}
                                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                                placeholder={`Enter amount between ${minLimit} and ${maxLimit}`}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Destination Method *</label>
                            <select
                                value={withdrawForm.method}
                                onChange={(e) => setWithdrawForm({ ...withdrawForm, method: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            >
                                <option value="bank_account">Bank Account ({hasBank ? maskAccount(bankDetails.accountNo) : 'Not set'})</option>
                                <option value="upi">UPI ID ({hasUpi ? bankDetails.upiId : 'Not set'})</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                            {withdrawalWarning ? (
                                <span className="text-amber-600 font-bold">⚠️ {withdrawalWarning}</span>
                            ) : (
                                <span>Requests are processed based on system settings.</span>
                            )}
                        </p>

                        <button
                            type="submit"
                            disabled={withdrawing || isWithdrawalDisabled}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
                        >
                            {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Submit Withdrawal Request
                        </button>
                    </div>
                </form>
            </div>

            {/* 5. SECTION 5: WITHDRAWAL HISTORY */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 font-poppins">
                        <DollarSign className="w-4 h-4 text-primary" /> Withdrawal History
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">{recentWithdrawals.length} transactions</span>
                </div>

                {recentWithdrawals.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs font-inter">
                        No withdrawals yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600 font-inter">
                            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold">
                                <tr>
                                    <th className="p-3">Withdrawal ID</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Amount</th>
                                    <th className="p-3">Destination</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {recentWithdrawals.map((w, idx) => {
                                    const badge = getWithdrawalStatusBadge(w.status);
                                    const isUpi = w.withdrawalMethod === 'upi' || w.paymentMethod === 'upi';
                                    const destinationLabel = isUpi ? 'UPI VPA' : 'Bank Account';
                                    return (
                                        <tr key={w._id || idx} className="hover:bg-slate-50/60">
                                            <td className="p-3 font-mono text-teal-700 font-bold">{w.transactionReference || `#${(w._id || '').slice(-6)}`}</td>
                                            <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(w.createdAt)}</td>
                                            <td className="p-3 font-bold text-slate-900 font-mono">{formatCurrency(w.amount || 0)}</td>
                                            <td className="p-3 uppercase text-[11px] font-bold text-slate-700">{destinationLabel}</td>
                                            <td className="p-3">
                                                <span className={badge.className}>{badge.label}</span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => setSelectedWithdrawalDetail(w)}
                                                    className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 7. SECTION 7: RECENT NOTIFICATIONS */}
            {notifications.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3 font-inter">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2 font-poppins">
                        <Bell className="w-4 h-4 text-primary" /> Recent Payout Notifications
                    </h3>
                    <div className="space-y-2 text-xs font-inter">
                        {notifications.map((n, idx) => (
                            <div key={n._id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                                <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <span className="font-bold text-slate-900 block">{n.title || 'Payout Notification'}</span>
                                    <span className="text-slate-600 text-xs mt-0.5 block">{n.message}</span>
                                    <span className="text-[10px] text-slate-400 block mt-1">{formatDate(n.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* WITHDRAWAL DETAIL MODAL */}
            {selectedWithdrawalDetail && (
                <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-100 space-y-4 font-inter">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-poppins">
                                <DollarSign className="w-5 h-5 text-primary" /> Withdrawal Details
                            </h3>
                            <button onClick={() => setSelectedWithdrawalDetail(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer">✕</button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Transaction Reference</span>
                                <span className="font-mono font-bold text-slate-900">{selectedWithdrawalDetail.transactionReference || `#${(selectedWithdrawalDetail._id || '').slice(-6)}`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Amount</span>
                                <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(selectedWithdrawalDetail.amount || 0)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Method</span>
                                <span className="font-bold text-slate-800 uppercase">{selectedWithdrawalDetail.withdrawalMethod || 'Bank'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Status</span>
                                <span className={getWithdrawalStatusBadge(selectedWithdrawalDetail.status).className}>
                                    {getWithdrawalStatusBadge(selectedWithdrawalDetail.status).label}
                                </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">UTR / Reference No</span>
                                <span className="font-mono text-slate-900">{selectedWithdrawalDetail.utrNo || selectedWithdrawalDetail.notes || '—'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Requested On</span>
                                <span className="text-slate-800">{formatDate(selectedWithdrawalDetail.createdAt)}</span>
                            </div>
                            {selectedWithdrawalDetail.completedAt && (
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span className="text-slate-500">Completed On</span>
                                    <span className="text-slate-800">{formatDate(selectedWithdrawalDetail.completedAt)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedWithdrawalDetail(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FOR ADD / EDIT ACCOUNT */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-[100] bg-black/25 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] flex flex-col shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-150 font-inter">
                        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-6 pb-3 flex-shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-poppins">
                                {modal.type === 'bank_account' ? <CreditCard className="w-5 h-5 text-primary" /> : <QrCode className="w-5 h-5 text-emerald-600" />}
                                {modal.type === 'bank_account' ? 'Bank Account Details' : 'UPI ID Details'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 py-4 space-y-4">
                                {modal.type === 'bank_account' ? (
                                    <>
                                        <IfscBankDetails
                                            value={{
                                                ifsc: formData.ifsc,
                                                accountNo: formData.accountNo,
                                                bankName: formData.bankName
                                            }}
                                            onChange={(updated) => setFormData(prev => ({ ...prev, ...updated }))}
                                            showAccountName={true}
                                            accountNameValue={formData.accountName}
                                            onAccountNameChange={(val) => setFormData(prev => ({ ...prev, accountName: val }))}
                                        />

                                        <div className="mt-4 space-y-2">
                                            <label className="block text-xs font-semibold text-slate-700">
                                                Bank Passbook / Cancelled Cheque *
                                            </label>

                                            {(passbookPreview || bankDetails.passbookImage) ? (
                                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-white border flex items-center justify-center relative flex-shrink-0">
                                                            {(passbookPreview ? passbookFile?.type === 'application/pdf' : bankDetails.passbookImage?.toLowerCase().endsWith('.pdf')) ? (
                                                                <div className="flex flex-col items-center justify-center text-center">
                                                                    <span className="text-[10px] font-black text-rose-500">PDF</span>
                                                                </div>
                                                            ) : (
                                                                <img
                                                                    src={passbookPreview || bankDetails.passbookImage}
                                                                    alt="Passbook Thumbnail"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-bold text-slate-700 block truncate max-w-[150px]">
                                                                {passbookFile ? passbookFile.name : 'Passbook Uploaded'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-bold block uppercase mt-0.5">
                                                                {bankDetails.uploadedAt ? `Uploaded: ${new Date(bankDetails.uploadedAt).toLocaleDateString()}` : 'Document Uploaded'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-start sm:justify-end border-t sm:border-t-0 border-slate-200/60 pt-2 sm:pt-0 mt-1 sm:mt-0">
                                                        <label htmlFor="passbook-modal-upload" className="px-2.5 py-1 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border border-slate-200 hover:border-primary text-center flex-1 sm:flex-none">
                                                            Replace
                                                        </label>

                                                        {(passbookPreview || bankDetails.passbookImage) && (
                                                            <a
                                                                href={passbookPreview || bankDetails.passbookImage}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1 text-primary hover:bg-primary/10 rounded-lg text-[10px] font-bold text-center block transition-colors border border-primary/20 flex-1 sm:flex-none"
                                                            >
                                                                Preview
                                                            </a>
                                                        )}

                                                        {bankDetails.passbookImage && (
                                                            <a
                                                                href={bankDetails.passbookImage}
                                                                download={`passbook_${bankDetails.accountName || 'provider'}.jpg`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[10px] font-bold text-center block transition-colors border border-emerald-200/50 flex-1 sm:flex-none"
                                                            >
                                                                Download
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50 text-center hover:bg-slate-50 transition-colors relative">
                                                    <label htmlFor="passbook-modal-upload" className="cursor-pointer block">
                                                        <div className="space-y-1">
                                                            <span className="text-xs text-primary font-bold block">Click to upload Passbook / Cheque</span>
                                                            <span className="text-[10px] text-slate-400 block font-medium">Accepted Formats: JPG, PNG, PDF (Max 5 MB)</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            )}

                                            <input
                                                id="passbook-modal-upload"
                                                type="file"
                                                onChange={handlePassbookFileChange}
                                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                                className="hidden"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.accountName}
                                                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                                                placeholder="Enter full name as per bank"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">UPI ID / VPA</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.upiId}
                                                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                                                placeholder="e.g. name@okaxis or 9876543210@paytm"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 p-4 sm:p-6 pt-3 border-t border-slate-100 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                                >
                                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Save Payout Details
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayoutProfileTab;
