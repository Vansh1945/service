import React, { useState, useEffect } from 'react';
import { useAdminFilter } from '../context/AdminFilterContext';
import * as BookingService from '../services/BookingService';
import * as TransactionService from '../services/TransactionService';
import PriceDisplay from './PriceDisplay';
import { formatDateTime } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import {
  X, ArrowLeft, ExternalLink, Calendar, CreditCard, DollarSign,
  Activity, User, Users, ShieldAlert, CheckCircle, Clock, AlertTriangle,
  RefreshCw, FileText, ArrowRight, CornerDownRight, Tag, Layers, ChevronRight,
  Download, RotateCcw, Award, Check
} from 'lucide-react';

const FinanceInvestigationDrawer = () => {
  const { drawerConfig, drawerHistory, closeInvestigationDrawer, popDrawerHistory, openInvestigationDrawer } = useAdminFilter();
  const { isOpen, entityType, entityId, entityData: initialData } = drawerConfig;

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('360_timeline'); // '360_timeline' | 'details' | 'links' | 'actions' | 'raw'
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Fetch full details if needed
  useEffect(() => {
    if (!isOpen || !entityId) {
      setData(null);
      return;
    }

    let isMounted = true;
    const loadDetails = async () => {
      setLoading(true);
      try {
        if (entityType === 'booking') {
          const res = await BookingService.getBookingDetails(entityId);
          if (isMounted && res.data?.success) {
            setData(res.data.data);
          } else if (isMounted && initialData) {
            setData(initialData);
          }
        } else if (entityType === 'transaction' || entityType === 'payment') {
          const res = await TransactionService.getTransactionById(entityId);
          if (isMounted && res.data?.success) {
            setData(res.data.data);
          } else if (isMounted && initialData) {
            setData(initialData);
          }
        } else {
          // Fallback to initial data if provided
          if (isMounted) setData(initialData || {});
        }
      } catch (err) {
        console.error('Drawer details fetch error:', err);
        if (isMounted) setData(initialData || {});
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();
    return () => { isMounted = false; };
  }, [isOpen, entityType, entityId, initialData]);

  if (!isOpen) return null;

  // Extract common financial entity fields safely
  const booking = data?.booking || (entityType === 'booking' ? data : null);
  const user = data?.user || data?.customer || booking?.customer;
  const provider = data?.provider || booking?.provider;

  const bookingIdDisplay = booking?.bookingId || booking?._id || (entityType === 'booking' ? entityId : 'N/A');
  const txnIdDisplay = data?.transactionId || data?._id || (entityType === 'transaction' ? entityId : 'N/A');
  const razorpayPaymentId = data?.razorpayPaymentId || booking?.razorpayPaymentId || 'N/A';
  const razorpayOrderId = data?.razorpayOrderId || booking?.razorpayOrderId || 'N/A';
  const refundId = data?.refundId || data?._id || 'N/A';
  const paymentMethod = data?.paymentMethod || booking?.paymentMethod || 'online';
  const paymentStatus = data?.paymentStatus || booking?.paymentStatus || 'pending';
  const totalAmount = data?.amount || booking?.totalAmount || 0;
  const commissionAmount = data?.commission || booking?.commissionAmount || 0;
  const providerEarnings = data?.providerEarning || booking?.providerEarnings || 0;

  const handleAction = async (actionType) => {
    setActionLoading(true);
    setActionSuccess('');
    try {
      if (actionType === 'retry_verify' && txnIdDisplay !== 'N/A') {
        const res = await TransactionService.adminRetryVerify(data?._id || txnIdDisplay);
        if (res.data?.success) {
          setActionSuccess('Payment verification retried successfully.');
        }
      } else if (actionType === 'mark_paid' && txnIdDisplay !== 'N/A') {
        const res = await TransactionService.adminMarkPaid(data?._id || txnIdDisplay, 'Manually verified in investigation drawer');
        if (res.data?.success) {
          setActionSuccess('Transaction marked as paid.');
        }
      } else if (actionType === 'view_booking_page') {
        closeInvestigationDrawer();
        navigate(`/admin/bookings?search=${bookingIdDisplay}`);
      } else if (actionType === 'view_payments_page') {
        closeInvestigationDrawer();
        navigate(`/admin/payments?search=${bookingIdDisplay}`);
      }
    } catch (err) {
      console.error('Action execution failed:', err);
    } finally {
      setActionLoading(false);
    }

  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={closeInvestigationDrawer} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-5 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center space-x-3">
              {drawerHistory.length > 0 && (
                <button
                  onClick={popDrawerHistory}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                  title="Go Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                    {entityType || 'Investigation'} Console
                  </span>
                  <span className="text-xs text-gray-400 font-mono">ID: {entityId}</span>
                </div>
                <h2 className="text-lg font-black text-white tracking-tight mt-0.5">
                  Connected Entity Financial Audit
                </h2>
              </div>
            </div>
            <button
              onClick={closeInvestigationDrawer}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50 px-5 space-x-2 pt-2">
            {[
              { id: '360_timeline', label: '360° Timeline', icon: Activity },
              { id: 'details', label: 'Entity Details', icon: FileText },
              { id: 'links', label: 'Entity Links', icon: Layers },
              { id: 'actions', label: 'Smart Actions', icon: CheckCircle },
              { id: 'raw', label: 'Raw Gateway Data', icon: CodeIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    isActive
                      ? 'border-primary text-primary bg-white rounded-t-lg shadow-xs'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-semibold text-gray-500">Tracing connected financial entities...</p>
              </div>
            ) : (
              <>
                {actionSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center">
                    <Check className="w-4 h-4 mr-2 text-emerald-600" />
                    {actionSuccess}
                  </div>
                )}

                {/* 360° TIMELINE TAB */}
                {activeTab === '360_timeline' && (
                  <div className="space-y-6">
                    {/* Financial Summary Card */}
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white rounded-2xl p-5 shadow-lg border border-gray-800">
                      <p className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Financial Overview</p>
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div>
                          <p className="text-[11px] text-gray-400 font-semibold">Total Amount</p>
                          <p className="text-xl font-black text-emerald-400">
                            <PriceDisplay amount={totalAmount} />
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400 font-semibold">Platform Commission</p>
                          <p className="text-xl font-black text-blue-400">
                            <PriceDisplay amount={commissionAmount} />
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400 font-semibold">Provider Net Earning</p>
                          <p className="text-xl font-black text-purple-400">
                            <PriceDisplay amount={providerEarnings} />
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">Method:</span>
                          <span className="font-bold text-white uppercase px-2 py-0.5 rounded bg-gray-700/80">{paymentMethod}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">Status:</span>
                          <span className={`font-bold uppercase px-2 py-0.5 rounded ${
                            paymentStatus === 'paid' || paymentStatus === 'success' || paymentStatus === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chronological Unified Flow Timeline */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                      <h3 className="text-xs uppercase font-extrabold text-gray-500 tracking-wider mb-4 flex items-center">
                        <Activity className="w-4 h-4 mr-2 text-primary" /> Connected LifeCycle Flow
                      </h3>

                      <div className="relative border-l-2 border-primary/20 pl-6 space-y-6 ml-2">
                        {/* Step 1: Booking Created */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-primary ring-4 ring-primary/10 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">Booking Created</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Booking ID: <span className="font-mono font-bold text-gray-700">{bookingIdDisplay}</span></p>
                            <button
                              onClick={() => openInvestigationDrawer('booking', bookingIdDisplay, booking)}
                              className="text-[11px] text-primary hover:underline font-semibold mt-1 flex items-center"
                            >
                              Inspect Booking Record <ChevronRight className="w-3 h-3 ml-0.5" />
                            </button>
                          </div>
                        </div>

                        {/* Step 2: Payment Created & Captured */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10 flex items-center justify-center">
                            <CreditCard className="w-2.5 h-2.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">Payment Captured ({paymentMethod})</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Payment ID: <span className="font-mono font-bold text-gray-700">{razorpayPaymentId}</span> • Order ID: <span className="font-mono text-gray-600">{razorpayOrderId}</span>
                            </p>
                            <button
                              onClick={() => openInvestigationDrawer('payment', razorpayPaymentId, data)}
                              className="text-[11px] text-emerald-600 hover:underline font-semibold mt-1 flex items-center"
                            >
                              Inspect Gateway Payment <ChevronRight className="w-3 h-3 ml-0.5" />
                            </button>
                          </div>
                        </div>

                        {/* Step 3: Gateway Settlement & Platform Bank Deposit */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-600/10 flex items-center justify-center">
                            <Download className="w-2.5 h-2.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">Razorpay Bank Settlement & Reconciliation</p>
                            <div className="mt-1 p-2 bg-blue-50/50 rounded-lg border border-blue-100 text-[11px] text-blue-900 space-y-0.5 font-sans">
                              <p>Gross Captured: <strong><PriceDisplay amount={totalAmount} /></strong></p>
                              <p>Est. Gateway Fee (2% + GST): <strong><PriceDisplay amount={totalAmount > 0 ? Math.round(totalAmount * 0.0236) : 0} /></strong></p>
                              <p>Net Settled into Bank: <strong><PriceDisplay amount={totalAmount > 0 ? totalAmount - Math.round(totalAmount * 0.0236) : 0} /></strong></p>
                              <p className="text-[10px] text-blue-700">Bank Transfer Status: <span className="font-bold uppercase text-emerald-700">RECEIVED IN BANK</span></p>
                            </div>
                          </div>
                        </div>

                        {/* Step 4: Transaction Ledger Entry */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-purple-500/10 flex items-center justify-center">
                            <DollarSign className="w-2.5 h-2.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">Transaction Ledger Record</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Txn ID: <span className="font-mono font-bold text-gray-700">{txnIdDisplay}</span></p>
                            <button
                              onClick={() => openInvestigationDrawer('transaction', txnIdDisplay, data)}
                              className="text-[11px] text-purple-600 hover:underline font-semibold mt-1 flex items-center"
                            >
                              Inspect Ledger Transaction <ChevronRight className="w-3 h-3 ml-0.5" />
                            </button>
                          </div>
                        </div>

                        {/* Step 5: Provider Settlement & Earnings */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-500/10 flex items-center justify-center">
                            <Users className="w-2.5 h-2.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">Provider Net Earnings & Payout</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Provider: {provider?.name || 'N/A'} • Share: <strong><PriceDisplay amount={providerEarnings} /></strong>
                            </p>
                            {provider?._id && (
                              <button
                                onClick={() => openInvestigationDrawer('provider', provider._id, provider)}
                                className="text-[11px] text-indigo-600 hover:underline font-semibold mt-1 flex items-center"
                              >
                                View Provider Wallet & Earnings <ChevronRight className="w-3 h-3 ml-0.5" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                {/* DETAILS TAB */}
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                      <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Primary Record Info</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">Entity Type</p>
                          <p className="font-bold text-gray-900 uppercase">{entityType}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Created At</p>
                          <p className="font-bold text-gray-900">{formatDateTime(data?.createdAt || booking?.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Customer</p>
                          <p className="font-bold text-gray-900">{user?.name || 'N/A'} ({user?.phone || user?.email || 'N/A'})</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Provider</p>
                          <p className="font-bold text-gray-900">{provider?.name || 'N/A'} ({provider?.phone || provider?.email || 'N/A'})</p>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Card */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
                      <h4 className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">Financial Breakdown</h4>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-600">Subtotal Amount</span>
                        <span className="font-bold text-gray-900"><PriceDisplay amount={booking?.subtotal || totalAmount} /></span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-600">Platform Commission Share</span>
                        <span className="font-bold text-blue-600"><PriceDisplay amount={commissionAmount} /></span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-600">Provider Net Payout</span>
                        <span className="font-bold text-emerald-600"><PriceDisplay amount={providerEarnings} /></span>
                      </div>
                      <div className="flex justify-between py-1 font-bold text-sm text-gray-900 pt-2">
                        <span>Total Payable</span>
                        <span><PriceDisplay amount={totalAmount} /></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ENTITY LINKS TAB */}
                {activeTab === 'links' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 font-medium">
                      Click any entity pill to switch investigation focus and trace backwards/forwards seamlessly.
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                      <EntityLinkCard
                        title="Booking Entity"
                        id={bookingIdDisplay}
                        subtitle={booking?.services?.[0]?.service?.title || 'Service Booking'}
                        onClick={() => openInvestigationDrawer('booking', bookingIdDisplay, booking)}
                      />
                      <EntityLinkCard
                        title="Razorpay Gateway Payment"
                        id={razorpayPaymentId}
                        subtitle={`Order ID: ${razorpayOrderId}`}
                        onClick={() => openInvestigationDrawer('payment', razorpayPaymentId, data)}
                      />
                      <EntityLinkCard
                        title="Transaction Ledger ID"
                        id={txnIdDisplay}
                        subtitle={`Payment Method: ${paymentMethod}`}
                        onClick={() => openInvestigationDrawer('transaction', txnIdDisplay, data)}
                      />
                      {user?._id && (
                        <EntityLinkCard
                          title="Customer Profile & Wallet"
                          id={user._id}
                          subtitle={`${user.name || 'Customer'} • ${user.email || user.phone || ''}`}
                          onClick={() => openInvestigationDrawer('customer', user._id, user)}
                        />
                      )}
                      {provider?._id && (
                        <EntityLinkCard
                          title="Provider Profile & Wallet"
                          id={provider._id}
                          subtitle={`${provider.name || 'Provider'} • ${provider.email || provider.phone || ''}`}
                          onClick={() => openInvestigationDrawer('provider', provider._id, provider)}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* SMART ACTIONS TAB */}
                {activeTab === 'actions' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 font-medium">
                      Contextual administrative operations available for this entity record:
                    </p>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleAction('view_booking_page')}
                        className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all font-bold text-xs text-gray-900"
                      >
                        <span className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-primary" /> View Full Booking Console</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </button>

                      <button
                        onClick={() => handleAction('view_payments_page')}
                        className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all font-bold text-xs text-gray-900"
                      >
                        <span className="flex items-center"><CreditCard className="w-4 h-4 mr-2 text-emerald-600" /> View Payment Ledger</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </button>

                      <button
                        onClick={() => handleAction('retry_verify')}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-between p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all font-bold text-xs text-amber-900"
                      >
                        <span className="flex items-center"><RefreshCw className={`w-4 h-4 mr-2 text-amber-600 ${actionLoading ? 'animate-spin' : ''}`} /> Retry Razorpay Verification</span>
                        <ArrowRight className="w-4 h-4 text-amber-500" />
                      </button>

                      <button
                        onClick={() => handleAction('mark_paid')}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-between p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all font-bold text-xs text-emerald-900"
                      >
                        <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-emerald-600" /> Mark Payment as Paid (Admin Override)</span>
                        <ArrowRight className="w-4 h-4 text-emerald-500" />
                      </button>
                    </div>
                  </div>
                )}

                {/* RAW GATEWAY DATA TAB */}
                {activeTab === 'raw' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 font-mono">Raw Database Schema & Gateway Payload:</p>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96">
                      {JSON.stringify(data || initialData || {}, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EntityLinkCard = ({ title, id, subtitle, onClick }) => (
  <div
    onClick={onClick}
    className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-2xs"
  >
    <div>
      <p className="text-[10px] uppercase font-bold text-gray-400">{title}</p>
      <p className="text-xs font-black text-gray-900 font-mono mt-0.5">{id}</p>
      {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
    </div>
    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
  </div>
);

const CodeIcon = (props) => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>
);

export default FinanceInvestigationDrawer;
