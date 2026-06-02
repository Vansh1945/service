import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/auth';
import DatePicker from 'react-datepicker';
import TimePicker from 'react-time-picker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-time-picker/dist/TimePicker.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, User, Phone, DollarSign, CheckCircle,
  XCircle, AlertCircle, Eye, Search, CreditCard, Star, Package,
  ShoppingCart, Timer, Wrench, Activity, Edit3, ChevronLeft,
  ChevronRight, X, ChevronDown, ChevronUp, Wallet, ShieldAlert, ShieldCheck, Home, CheckSquare, MessageSquare, Heart
} from 'lucide-react';
import { cancelBooking, userUpdateBookingDateTime, getCustomerBookings, getBooking } from '../../services/BookingService';
import { toggleFavoriteProvider } from '../../services/CustomerService';
import Pagination from '../../components/Pagination';
import { formatDate, formatTime, formatDateTime, formatCurrency } from '../../utils/format';
import ChatModal from '../../components/chat/ChatModal';

// ─── Pure helpers ─────────────────

const isChatVisible = (b) => {
  if (!b) return false;
  if (!b.provider && !b.providerDetails) return false;

  if (b.disputeStatus === 'resolved' || b.status === 'resolved') return false;
  if (b.hasComplaint || b.disputeRaised || b.status === 'complaint') return true;
  if (['pending', 'cancelled', 'no-show'].includes(b.status)) return false;

  if (b.status === 'completed') {
    const completedTime = b.serviceCompletedAt || b.completedAt || b.updatedAt;
    if (completedTime) {
      const diffMs = Date.now() - new Date(completedTime).getTime();
      return diffMs <= 24 * 60 * 60 * 1000;
    }
    return true;
  }
  return true;
};

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: Timer, label: 'Finding Provider' },
  accepted: { color: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500', icon: CheckCircle, label: 'Confirmed' },
  in_progress: { color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', icon: Activity, label: 'In Progress' },
  'in-progress': { color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', icon: Activity, label: 'In Progress' },
  completed: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-red-50 text-red-600 border-red-200', bar: 'bg-red-400', icon: XCircle, label: 'Cancelled' },
  payment_pending: { color: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-400', icon: CreditCard, label: 'Payment Due' },
};

const getStatusCfg = (status) => STATUS_CONFIG[status] || { color: 'bg-gray-100 text-gray-600 border-gray-200', bar: 'bg-gray-400', icon: AlertCircle, label: status || 'Unknown' };


const needsPayment = (b) => {
  const isPaid = ['paid', 'escrow_hold'].includes(b.paymentStatus);
  if (isPaid || b.status === 'cancelled' || b.status === 'in-progress' || b.status === 'in_progress' || b.status === 'completed') return false;
  return !isPaid;
};
const canCancel = (b) => ['pending', 'accepted'].includes(b.status);
const canReschedule = (b) => b.status === 'pending';

const getStartPin = (booking) => {
  if (!booking.statusHistory) return null;
  for (const h of booking.statusHistory) {
    if (h.note) {
      const match = h.note.match(/START_PIN:(\d{4})/);
      if (match) return match[1];
    }
  }
  return null;
};

const getCompletionPin = (booking) => {
  if (!booking.statusHistory) return null;
  for (const h of booking.statusHistory) {
    if (h.note) {
      const match = h.note.match(/COMPLETION_PIN:(\d{4})/);
      if (match) return match[1];
    }
  }
  return null;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = getStatusCfg(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

const BookingTimeline = ({ booking }) => {
  const timeline = Array.isArray(booking.timeline) ? booking.timeline : [];

  if (timeline.length === 0) return null;

  const getStepIcon = (title) => {
    const t = title.toLowerCase();
    if (t.includes('requested')) return ShoppingCart;
    if (t.includes('payment')) return CreditCard;
    if (t.includes('assigned')) return User;
    if (t.includes('accepted')) return CheckCircle;
    if (t.includes('way')) return Home;
    if (t.includes('pin generated')) return ShieldCheck;
    if (t.includes('verified')) return ShieldCheck;
    if (t.includes('geo')) return MapPin;
    if (t.includes('started')) return Wrench;
    if (t.includes('completed')) return CheckCircle;
    if (t.includes('protection') || t.includes('review')) return ShieldAlert;
    if (t.includes('cancelled')) return XCircle;
    if (t.includes('dispute') || t.includes('complaint')) return AlertCircle;
    return Activity;
  };

  return (
    <div className="pt-2 pb-4">
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-100" />

        <div className="space-y-8">
          {timeline.map((step, idx) => {
            const Icon = getStepIcon(step.title);
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';
            const isError = step.status === 'error';

            return (
              <div key={idx} className="relative flex items-start group">
                {/* Icon Container */}
                <div className={`relative z-20 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${isCompleted
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                  : isCurrent
                    ? 'bg-orange-500 text-white animate-pulse shadow-md shadow-orange-100'
                    : isError
                      ? 'bg-red-500 text-white shadow-md shadow-red-100'
                      : 'bg-white border-2 border-gray-100 text-gray-300'
                  }`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="ml-4 pt-1 min-w-0">
                  <h4 className={`text-sm font-bold leading-none mb-1.5 transition-colors ${isCompleted ? 'text-secondary font-black' : isCurrent ? 'text-orange-600 font-black' : isError ? 'text-red-600 font-black' : 'text-gray-400'
                    }`}>
                    {step.title}
                  </h4>
                  {step.time && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(step.time)}
                    </div>
                  )}
                  {isCurrent && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full border border-orange-100 animate-pulse">
                      In Progress
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


// ─── Provider Card ────────────────────────────────────────────────────────────

const ProviderCard = ({ provider, status, compact = false }) => {
  if (!provider) return null;
  const rating = provider.performanceScore?.rating;

  if (compact) return (
    <div className={`mt-3 flex items-center gap-3 p-3 rounded-xl border ${status === 'completed'
      ? 'bg-emerald-50 border-emerald-100'
      : 'bg-blue-50 border-blue-100'
      }`}>
      <div className={`w-9 h-9 bg-white rounded-full overflow-hidden flex items-center justify-center border flex-shrink-0 ${status === 'completed' ? 'border-emerald-200' : 'border-blue-200'
        }`}>
        {provider.profilePicUrl ? (
          <img src={provider.profilePicUrl} alt={provider.name} className="w-full h-full object-cover" />
        ) : (
          <User className={`w-4 h-4 ${status === 'completed' ? 'text-emerald-600' : 'text-blue-600'}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-500 font-medium leading-none mb-0.5">
          {status === 'completed' ? 'Served By' : 'Assigned Provider'}
        </p>
        <p className="text-sm font-bold text-gray-900 truncate leading-tight">{provider.name}</p>
        <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${status === 'completed' ? 'text-emerald-600' : 'text-primary'
            }`}>ID: {provider.providerId || 'N/A'}</span>
          <span className="text-gray-300 text-[10px]">•</span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black border border-emerald-100 flex items-center gap-0.5 shrink-0">
            <CheckCircle className="w-2.5 h-2.5" /> {provider.completedBookings || 0} Jobs
          </span>
        </div>
      </div>
      {rating > 0 && (
        <div className="ml-auto flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-yellow-100 flex-shrink-0">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          <span className="text-xs font-bold">{rating.toFixed(1)}</span>
        </div>
      )}
      {status === 'completed' && (
        <div className="ml-auto flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {status === 'completed' ? 'Service Completed By' : 'Assigned Provider'}
      </p>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary/10 rounded-full overflow-hidden flex items-center justify-center border-2 border-primary/20">
          {provider.profilePicUrl ? (
            <img src={provider.profilePicUrl} alt={provider.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-primary" />
          )}
        </div>
        <div>
          <p className="font-bold text-gray-900">{provider.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-primary uppercase mt-0.5">
            <span>ID: {provider.providerId || 'N/A'}</span>
            <span className="text-gray-300">•</span>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 font-black">
              <CheckCircle className="w-3 h-3" /> {provider.completedBookings || 0} Completed {provider.completedBookings === 1 ? 'Booking' : 'Bookings'}
            </span>
          </div>
          {rating > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold">{rating.toFixed(1)}/5</span>
            </div>
          )}
        </div>
      </div>
      {status !== 'completed' && (
        <>
          {provider.phone && (
            <a href={`tel:${provider.phone}`} className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-sm">
              <Phone className="w-4 h-4" />
              Call Provider
            </a>
          )}
          {provider.performanceScore && (
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="flex justify-between bg-white p-2 rounded-lg border border-gray-100">
                <span className="text-gray-500">On-Time</span>
                <span className="font-bold">{(provider.performanceScore.onTimePercentage || 0).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-gray-100">
                <span className="text-gray-500">Completion</span>
                <span className="font-bold">{(provider.performanceScore.completionPercentage || 0).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Payment Details ──────────────────────────────────────────────────────────

const PaymentDetails = ({ booking }) => {
  const mergedServicePrice = (booking.subtotal || 0) + (booking.demandSurge || 0);
  const visitingCharge = booking.visitingCharge || 0;
  const customCharges = booking.customCharges || 0;
  const additional = (booking.rainCharge || 0) + (booking.trafficCharge || 0) + (booking.nightCharge || 0) + (booking.platformFee || 0);
  
  const additionalBreakdown = [];
  if (booking.rainCharge > 0) additionalBreakdown.push({ name: 'Rain Charge', amount: booking.rainCharge });
  if (booking.trafficCharge > 0) additionalBreakdown.push({ name: 'Traffic Charge', amount: booking.trafficCharge });
  if (booking.nightCharge > 0) additionalBreakdown.push({ name: 'Night Charge', amount: booking.nightCharge });
  if (booking.platformFee > 0) additionalBreakdown.push({ name: 'Platform Fee', amount: booking.platformFee });

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <CreditCard className="w-3.5 h-3.5" /> Payment Details
      </p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center animate-fadeIn">
          <span className="text-gray-500">Method</span>
          <span className="font-medium capitalize">{booking.paymentMethod || 'N/A'}</span>
        </div>
        <div className="flex justify-between items-center animate-fadeIn">
          <span className="text-gray-500">Status</span>
          <span className={['paid', 'escrow_hold'].includes(booking.paymentStatus) ? 'text-emerald-600 font-semibold' : 'text-accent font-semibold'}>
            {['paid', 'escrow_hold'].includes(booking.paymentStatus) ? 'Paid' : 'Pending'}
          </span>
        </div>
        <div className="flex justify-between items-center animate-fadeIn">
          <span className="text-gray-500">Service Price</span>
          <span className="font-semibold text-secondary">{formatCurrency(mergedServicePrice)}</span>
        </div>
        {booking.totalDiscount > 0 && (
          <div className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">Discount</span>
            <span className="text-emerald-600 font-medium">-{formatCurrency(booking.totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center animate-fadeIn">
          <span className="text-gray-500">Visiting Charges</span>
          <span className="text-green-600 font-semibold italic">{visitingCharge > 0 ? formatCurrency(visitingCharge) : "Free"}</span>
        </div>
        {customCharges > 0 && (
          <div className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">Custom Charges</span>
            <span className="text-red-500 font-medium">+{formatCurrency(customCharges)}</span>
          </div>
        )}
        {additional > 0 && (
          <div className="flex justify-between items-center relative group animate-fadeIn">
            <span className="text-gray-500 border-b border-dashed border-gray-400 cursor-help">
              Additional Charges
            </span>
            <span className="text-red-500 font-semibold">+{formatCurrency(additional)}</span>
            <div className="absolute right-0 bottom-full mb-2 w-56 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-30 leading-normal pointer-events-none">
              <p className="font-bold border-b border-slate-700 pb-1 mb-1 text-[11px]">Fee Breakdown</p>
              {additionalBreakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between gap-2 py-0.5">
                  <span>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {booking.couponApplied?.isValid && (
          <div className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">Coupon</span>
            <span className="text-blue-600 font-medium">{booking.couponApplied.code}</span>
          </div>
        )}
        {booking.paymentStatus === 'refunded' && (
          <div className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">Refund Status</span>
            <span className="text-purple-600 font-black flex items-center gap-1"><Wallet className="w-3 h-3" /> Refunded</span>
          </div>
        )}
        {booking.fullData?.walletAmountUsed > 0 && (
          <div className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">Wallet Used</span>
            <span className="text-purple-600 font-bold">-{formatCurrency(booking.fullData.walletAmountUsed)}</span>
          </div>
        )}
        {booking.fullData?.onlineAmountPaid > 0 && (
          <div className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">Paid Online</span>
            <span className="text-blue-600 font-bold">{formatCurrency(booking.fullData.onlineAmountPaid)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 mt-1 flex justify-between font-bold text-secondary text-base">
          <span>Total Payable</span>
          <span>{formatCurrency(booking.totalAmount || 0)}</span>
        </div>
      </div>

      {/* Payout Hold Info for Transparency */}
      {booking.timeline?.payoutHoldUntil && booking.status === 'completed' && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex justify-between items-center text-[10px] mb-1.5">
            <span className="text-blue-700 font-bold uppercase tracking-wider">Review Protection</span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${new Date(booking.timeline.payoutHoldUntil) > new Date() ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
              {new Date(booking.timeline.payoutHoldUntil) > new Date() ? 'ACTIVE' : 'COMPLETED'}
            </span>
          </div>
          <p className="text-xs text-blue-700 font-medium">
            {new Date(booking.timeline.payoutHoldUntil) > new Date()
              ? "Service under 48-hour review protection"
              : "Review period completed"}
          </p>
          <p className="text-[10px] text-blue-500 mt-1 italic">
            {new Date(booking.timeline.payoutHoldUntil) > new Date()
              ? `Protection valid until: ${formatDateTime(booking.timeline.payoutHoldUntil)}`
              : `Protection ended at: ${formatDateTime(booking.timeline.payoutHoldUntil)}`}
          </p>
        </div>
      )}

      {booking.transactionId && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Info</p>
          {[
            ['Txn ID', booking.transactionId],
            ...(booking.razorpayPaymentId ? [['Payment ID', booking.razorpayPaymentId]] : []),
            ...(booking.paymentDate ? [['Date', new Date(booking.paymentDate).toLocaleString()]] : []),
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-gray-500">{label}</span>
              <span className="font-mono text-gray-700 truncate max-w-[60%] text-right">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Service Details ──────────────────────────────────────────────────────────

const ServiceDetails = ({ services, useServiceDetails = false }) => (
  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      <Package className="w-3.5 h-3.5" /> Service Details
    </p>
    <div className="space-y-2">
      {services?.map((item, i) => {
        const svc = useServiceDetails ? item.serviceDetails : item.service;
        return (
          <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <p className="font-semibold text-secondary text-sm">{svc?.title || 'Service'}</p>
              <span className="text-sm font-bold text-primary">{formatCurrency(item.price || 0)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
              <div><span className="font-medium">Category:</span> <span className="uppercase">{typeof svc?.category === 'object' ? svc.category.name : (svc?.category || 'N/A')}</span></div>
              <div><span className="font-medium">Qty:</span> {item.quantity || 1}</div>
              <div><span className="font-medium">Duration:</span> {svc?.duration ? `${svc.duration} hrs` : 'N/A'}</div>
              <div><span className="font-medium">Discount:</span> {formatCurrency(item.discountAmount || 0)}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Address ──────────────────────────────────────────────────────────────────

const AddressBlock = ({ address, phone }) => {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.postalCode].filter(Boolean).join(', ');
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Home className="w-3.5 h-3.5 text-primary" /> Service Address
      </p>
      <p className="text-sm text-gray-700 font-medium">{parts}</p>
      {phone && (
        <div className="flex items-center gap-2 mt-2 text-gray-600">
          <Phone className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-sm font-medium">{phone}</p>
        </div>
      )}
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

const BookingModal = ({ booking, onClose, onPayNow, user, onChat }) => {
  const [previewImage, setPreviewImage] = useState(null);
  const provider = booking.provider || booking.providerDetails;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl z-30">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Booking Detail</p>
              <h2 className="text-lg font-bold text-secondary leading-tight">{booking.services?.[0]?.service?.title || 'Booking Details'}</h2>
              <p className="text-[10px] font-medium text-gray-400 mt-1">ID: {booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-xl hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <BookingTimeline booking={booking} />

          {/* Dispute & Refund Info */}
          {(booking.disputeRaised || booking.paymentStatus === 'refunded' || booking.adminRefundDecision) && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Dispute & Refund Details
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-red-700">Dispute Status</span>
                  <span className="font-medium text-red-800 capitalize">{booking.disputeStatus?.replace('_', ' ') || 'Under Review'}</span>
                </div>
                {booking.adminRefundDecision && (
                  <div className="flex justify-between items-center">
                    <span className="text-red-700">Admin Decision</span>
                    <span className="font-medium text-red-800 capitalize">{booking.adminRefundDecision}</span>
                  </div>
                )}
                {booking.paymentStatus === 'refunded' && (
                  <div className="flex justify-between items-center">
                    <span className="text-red-700">Refund Status</span>
                    <span className="font-medium text-purple-600 font-bold flex items-center gap-1"><Wallet className="w-4 h-4" /> Refunded to Wallet</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Secure Verification PIN Card */}
          {['scheduled', 'accepted', 'in-progress', 'in_progress'].includes(booking.status) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-blue-200 text-blue-600 shadow-sm shrink-0">
                  <ShieldCheck className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary text-sm">Secure Service Verification</h3>
                  <p className="text-xs text-gray-500">Provide this PIN to your service professional when they arrive</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-widest block mb-0.5">
                    {['in-progress', 'in_progress'].includes(booking.status) ? 'Completion Verification PIN' : 'Start Verification PIN'}
                  </span>
                  <span className="text-2xl font-black tracking-wider text-secondary font-mono">
                    {['in-progress', 'in_progress'].includes(booking.status) ? (getCompletionPin(booking) || '••••') : (getStartPin(booking) || '••••')}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-medium leading-relaxed max-w-[280px]">
                  {['in-progress', 'in_progress'].includes(booking.status)
                    ? 'Only share this completion PIN after the provider successfully finishes the work.'
                    : 'Share this start PIN when the provider arrives at your location to begin the service.'
                  }
                </div>
              </div>
            </div>
          )}

          <ServiceDetails services={booking.services} />
          <PaymentDetails booking={booking} />

          <div className="grid sm:grid-cols-2 gap-4">
            <AddressBlock address={booking.address} phone={user?.phone} />
            {provider && ['accepted', 'in_progress', 'in-progress', 'completed'].includes(booking.status) && (
              <ProviderCard provider={provider} status={booking.status} />
            )}
          </div>

          {/* Photo Proofs Section */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Work Proofs & Photos
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Work Column */}
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">Before Service</p>
                  {booking.providerWorkProof?.startLocation && (
                    <div className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full">
                      <MapPin className="w-3 h-3" /> Location Verified
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {booking.providerWorkProof?.beforeImages?.length > 0 ? (
                    booking.providerWorkProof.beforeImages.map((img, idx) => (
                      <div key={idx} onClick={() => setPreviewImage(img.url)} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 hover:border-primary transition-all cursor-pointer group">
                        <img src={img.url} alt="Before" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 py-6 text-center border border-dashed border-gray-100 rounded-lg">
                      <p className="text-[10px] text-gray-400 italic">No before-work photos</p>
                    </div>
                  )}
                </div>
                {booking.serviceStartedAt && (
                  <p className="text-[9px] text-gray-400 mt-2 flex items-center gap-1 font-medium">
                    <Clock className="w-2.5 h-2.5" /> {new Date(booking.serviceStartedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* After Work Column */}
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">After Service</p>
                  {booking.providerWorkProof?.completionLocation && (
                    <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <MapPin className="w-3 h-3" /> Location Verified
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {booking.providerWorkProof?.afterImages?.length > 0 ? (
                    booking.providerWorkProof.afterImages.map((img, idx) => (
                      <div key={idx} onClick={() => setPreviewImage(img.url)} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 hover:border-emerald-500 transition-all cursor-pointer group">
                        <img src={img.url} alt="After" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <CheckSquare className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 py-6 text-center border border-dashed border-gray-100 rounded-lg">
                      <p className="text-[10px] text-gray-400 italic">No completion photos</p>
                    </div>
                  )}
                </div>
                {booking.serviceCompletedAt && (
                  <p className="text-[9px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                    <CheckSquare className="w-2.5 h-2.5" /> {new Date(booking.serviceCompletedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Complaint Proofs */}
            {booking.complaintProofs?.length > 0 && (
              <div className="mt-4 bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Complaint & Support Photos</p>
                <div className="space-y-3">
                  {booking.complaintProofs.map((proof, pIdx) => (
                    <div key={pIdx} className="border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold uppercase ${proof.uploadedBy === 'customer' ? 'text-blue-600' : 'text-primary'}`}>
                          {proof.uploadedBy}
                        </span>
                        <span className="text-[10px] text-gray-400">{new Date(proof.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{proof.message}</p>
                      <div className="flex flex-wrap gap-2">
                        {proof.images?.map((img, iIdx) => (
                          <div key={iIdx} onClick={() => setPreviewImage(img.url)} className="w-10 h-10 rounded-md overflow-hidden border border-gray-100 hover:border-primary transition-colors cursor-pointer">
                            <img src={img.url} alt="Proof" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            Close
          </button>
          {['assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'in-progress'].includes(booking.status) && (
            <button
              onClick={() => { onClose(); onChat(booking._id, 'provider_customer'); }}
              className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-500/95 hover:to-emerald-600/95 rounded-xl transition-all flex items-center gap-2 shadow-sm animate-none"
            >
              <MessageSquare className="w-4 h-4" /> Chat Provider
            </button>
          )}
          {needsPayment(booking) && (
            <button onClick={() => { onClose(); onPayNow(booking); }} className="px-4 py-2 text-sm font-bold text-white bg-accent rounded-xl hover:bg-accent/90 transition-all flex items-center gap-2 shadow-sm">
              <CreditCard className="w-4 h-4" /> Pay Now
            </button>
          )}
        </div>
      </div>

      {/* Image Preview Gallery Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999]" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
          <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
            <X className="w-6 h-6" />
          </button>
          <img src={previewImage} className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="Preview" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

// ─── Reschedule Modal ─────────────────────────────────────────────────────────

const RescheduleModal = ({ booking, onClose, onConfirm }) => {
  const [date, setDate] = useState(booking ? new Date(booking.date) : new Date());
  const [time, setTime] = useState(booking?.time || '10:00');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    if (new Date(`${dateStr}T${time}`) < new Date(Date.now() + 6 * 3600000)) {
      setError('Cannot reschedule within 6 hours. Please contact support.');
      return;
    }
    onConfirm({ date: dateStr, time });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-up">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-secondary">Reschedule Booking</h2>
          <p className="text-xs text-gray-500">#{booking._id.slice(-8).toUpperCase()}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">New Date</label>
            <DatePicker selected={date} onChange={setDate} minDate={new Date()} dateFormat="dd/MM/yyyy"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">New Time</label>
            <TimePicker onChange={setTime} value={time} format="HH:mm" disableClock={true}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all">Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ─── Cancel Modal ─────────────────────────────────────────────────────────────

const CancelModal = ({ booking, onClose, onConfirm }) => {
  const isStarted = !!booking?.serviceStartedAt;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-up">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-secondary">Cancel Booking?</h2>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">This action cannot be undone</p>
              {isStarted ? (
                <p className="text-xs text-red-600 mt-1">Service has already started. Cancellation requires admin review and may be treated as a dispute.</p>
              ) : (
                <p className="text-xs text-red-600 mt-1">Any valid refund will be added directly to your wallet.</p>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Keep Booking</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all">Yes, Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Booking Card ─────────────────────────────────────────────────────────────

const BookingCard = ({ booking, onView, onPayNow, onReschedule, onCancel, onCall, onChat, onToggleFavorite, user }) => {
  const navigate = useNavigate();
  const cfg = getStatusCfg(booking.status);
  const provider = booking.provider || booking.providerDetails;
  const svcImage = booking.services?.[0]?.service?.images?.[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      <div className={`h-1 w-full ${cfg.bar}`} />
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-100 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
            {svcImage ? <img src={svcImage} alt="service" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
            <Wrench className="w-6 h-6 text-primary" style={svcImage ? { display: 'none' } : {}} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-secondary truncate">{booking.services?.[0]?.service?.title || 'Service Booking'}</h3>
                <p className="text-xs text-gray-400">{booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-secondary">{formatCurrency(booking.totalAmount || 0)}</p>
                <p className={`text-xs font-bold px-2 py-0.5 rounded-full ${['paid', 'escrow_hold'].includes(booking.paymentStatus) ? 'bg-green-100 text-green-600' : (booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-50 text-accent')}`}>
                  {['paid', 'escrow_hold'].includes(booking.paymentStatus) ? `✓ Paid` : (booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service' ? 'Pay After Service' : 'Unpaid')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" /> {formatDate(booking.date)}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" /> {booking.time ? formatTime(booking.time) : 'Not set'}
              </div>
              <StatusBadge status={booking.status} />
              {booking.paymentStatus === 'refunded' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <Wallet className="w-3 h-3" /> Refunded
                </span>
              )}
              {booking.disputeRaised && !booking.adminRefundDecision && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                  <ShieldAlert className="w-3 h-3" /> Under Review
                </span>
              )}
              {needsPayment(booking) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 animate-pulse">
                  <AlertCircle className="w-3 h-3" /> Payment Due
                </span>
              )}
            </div>
          </div>
        </div>
        {provider && !['completed', 'cancelled'].includes(booking.status) && booking.paymentStatus !== 'refunded' && <ProviderCard provider={provider} status={booking.status} compact />}
        {booking.paymentStatus === 'pending' && booking.status !== 'cancelled' && (
          <p className={`text-xs mt-3 p-2.5 rounded-xl border ${booking.paymentMethod === 'cash' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
            ⚡ {booking.paymentMethod === 'cash' ? "Payment for this request will be collected by the professional after service completion." : "Confirm payment so a provider can be assigned and your request resolved."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => onView(booking._id)} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-xl hover:bg-blue-50 border border-blue-200 transition-colors w-full sm:w-auto">
            <Eye className="w-3.5 h-3.5" /> View Details
          </button>
          {provider && ['accepted', 'in_progress', 'in-progress', 'arriving'].includes(booking.status) && (
            <button onClick={() => navigate(`/customer/track/${booking._id}`)} className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 px-3 py-2 rounded-xl transition-all shadow-md active:scale-95 animate-pulse w-full sm:w-auto">
              <MapPin className="w-3.5 h-3.5" /> Track En Route
            </button>
          )}
          {['assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'in-progress'].includes(booking.status) ? (
            <button onClick={() => onChat(booking._id, 'provider_customer')} className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-500/95 hover:to-emerald-600/95 px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 animate-none w-full sm:w-auto">
              <MessageSquare className="w-3.5 h-3.5" /> Chat Provider
            </button>
          ) : booking.status === 'completed' && isChatVisible(booking) ? (
            <button onClick={() => onChat(booking._id, 'provider_customer')} className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-500/95 hover:to-emerald-600/95 px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 animate-none w-full sm:w-auto">
              <MessageSquare className="w-3.5 h-3.5" /> Chat Provider
            </button>
          ) : null}
          {needsPayment(booking) && (
            <button onClick={() => onPayNow(booking)} className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-accent hover:bg-accent/90 px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 w-full sm:w-auto">
              <CreditCard className="w-3.5 h-3.5" /> Pay Now
            </button>
          )}
          {canReschedule(booking) && (
            <button onClick={() => onReschedule(booking)} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-xl hover:bg-blue-50 border border-blue-200 transition-colors w-full sm:w-auto">
              <Edit3 className="w-3.5 h-3.5" /> Reschedule
            </button>
          )}
          {provider?.phone && !['completed', 'pending', 'cancelled'].includes(booking.status) && (
            <button onClick={() => onCall(provider.phone)} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 px-3 py-2 rounded-xl hover:bg-primary/5 border border-primary/20 transition-colors w-full sm:w-auto">
              <Phone className="w-3.5 h-3.5" /> Call
            </button>
          )}
          {canCancel(booking) && (
            <button onClick={() => onCancel(booking)} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 px-3 py-2 rounded-xl hover:bg-red-50 border border-red-200 transition-colors w-full sm:w-auto sm:ml-auto">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
          {booking.status === 'completed' && booking.services?.[0]?.service?._id && (
            <button onClick={() => navigate(`/customer/book-service/${booking.services[0].service._id}`, { state: { prefillBooking: booking } })} className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 w-full sm:w-auto">
              <ShoppingCart className="w-3.5 h-3.5" /> Book Again
            </button>
          )}
          {booking.status === 'completed' && (
            <button onClick={() => navigate(`/customer/complaints`, { state: { prefilledBookingId: booking._id } })} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 px-3 py-2 rounded-xl hover:bg-amber-50 border border-amber-200 transition-colors w-full sm:w-auto">
              <AlertCircle className="w-3.5 h-3.5" /> Raise Complaint
            </button>
          )}
          {booking.status === 'completed' && provider && (
            <button onClick={() => onToggleFavorite(provider)} className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border w-full sm:w-auto ${user?.favoriteProviders?.some(fp => fp.providerId?.toString() === (provider._id || provider.id)?.toString()) ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
              <Heart className={`w-3.5 h-3.5 ${user?.favoriteProviders?.some(fp => fp.providerId?.toString() === (provider._id || provider.id)?.toString()) ? 'fill-rose-600' : ''}`} />
              {user?.favoriteProviders?.some(fp => fp.providerId?.toString() === (provider._id || provider.id)?.toString()) ? 'Saved' : 'Add to Favorites'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
    <div className="h-1 bg-gray-200 w-full" />
    <div className="p-5 space-y-3">
      <div className="flex gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="space-y-2 flex-shrink-0">
          <div className="h-5 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-200 rounded w-12" />
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <div className="h-7 bg-gray-200 rounded-lg w-24" />
        <div className="h-7 bg-gray-200 rounded-lg w-20" />
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const CustomerBookingsPage = () => {
  const { token, API, showToast, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId') || searchParams.get('bookingId');

  const handleToggleFavorite = async (provider) => {
    if (!provider) return;
    try {
      const res = await toggleFavoriteProvider({
        providerId: provider._id || provider.id,
        providerName: provider.name,
        category: provider.category || 'N/A'
      });
      if (res.data?.success) {
        showToast(res.data.message || 'Updated favorites', 'success');
        refreshUser(); // Updates user context favorites
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update favorites', 'error');
    }
  };

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [chatBookingId, setChatBookingId] = useState(null);
  const [chatRoomType, setChatRoomType] = useState('provider_customer');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => { fetchBookings(); }, [statusFilter, timeFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    if (entityId) {
      const existing = bookings.find(b => b._id === entityId);
      if (existing) {
        setSelectedBooking(existing);
        setShowModal(true);
      } else {
        getBooking(entityId).then(res => {
          if (res.data?.success && res.data?.data) {
            setSelectedBooking(res.data.data);
            setShowModal(true);
          }
        }).catch(err => {
          console.error("Error fetching single booking on deep link:", err);
        });
      }
    }
  }, [entityId, bookings]);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: statusFilter, timeFilter, searchTerm: debouncedSearch, page: currentPage, limit: 20 });
      const res = await getCustomerBookings(params);
      const responseData = res.data;
      setBookings(responseData.data || []);
      setPagination(responseData.pagination || {});
    } catch (err) {
      showToast(`Error fetching bookings: ${err.message} `, 'error');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [API, token, showToast, statusFilter, timeFilter, debouncedSearch, currentPage]);

  const fetchBookingDetails = (id) => {
    const b = bookings.find(b => b._id === id);
    b ? (setSelectedBooking(b), setShowModal(true)) : showToast('Booking not found', 'error');
  };

  const handlePayNow = (booking) => {
    if (needsPayment(booking)) {
      navigate(`/customer/booking-confirm/${booking._id}`, {
        state: { booking, service: booking.services?.[0]?.serviceDetails || booking.services?.[0]?.service, coupon: booking.couponApplied, isReachingFromBookings: true }
      });
    } else {
      showToast('Payment is not pending for this booking.', 'info');
    }
  };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;
    try {
      await cancelBooking(bookingToCancel._id, {
        reason: cancelReason.trim(),
      });
      showToast('Booking cancelled successfully', 'success');
      setShowCancelModal(false);
      setBookingToCancel(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleRescheduleSubmit = async ({ date, time }) => {
    if (!bookingToReschedule) return;
    try {
      await userUpdateBookingDateTime(bookingToReschedule._id, { date, time });
      showToast('Booking rescheduled successfully', 'success');
      setShowRescheduleModal(false);
      setBookingToReschedule(null);
      fetchBookings();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const clearFilters = () => { setStatusFilter('all'); setTimeFilter('all'); setSearchTerm(''); };
  const hasFilters = statusFilter !== 'all' || timeFilter !== 'all' || searchTerm;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-secondary">My Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${bookings.length} of ${pagination.totalBookings || 0} bookings`}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white">
                <option value="all">All</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending_payment">Pending Payment</option>
              </select>
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Time Period</label>
              <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white">
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="1month">1 Month</option>
                <option value="6months">6 Months</option>
                <option value="1year">1 Year</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Service name…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
            </div>

            {/* Clear */}
            <div className="flex items-end">
              <button onClick={clearFilters} disabled={!hasFilters}
                className={`w-full px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${hasFilters ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-secondary mb-1">No bookings found</h3>
            <p className="text-sm text-gray-500 mb-6">
              {hasFilters ? 'Try adjusting your filters.' : "You haven't made any bookings yet."}
            </p>
            {!hasFilters && (
              <button onClick={() => navigate('/services')} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all">
                Browse Services
              </button>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {bookings.map(booking => (
                <BookingCard
                  key={booking._id}
                  booking={booking}
                  onView={fetchBookingDetails}
                  onPayNow={handlePayNow}
                  onReschedule={b => { setBookingToReschedule(b); setShowRescheduleModal(true); }}
                  onCancel={b => { setBookingToCancel(b); setShowCancelModal(true); }}
                  onCall={phone => { if (phone) window.location.href = `tel:${phone}`; else showToast('Phone not available', 'warning'); }}
                  onChat={(id, type) => { setChatBookingId(id); setChatRoomType(type || 'provider_customer'); }}
                  onToggleFavorite={handleToggleFavorite}
                  user={user}
                />
              ))}
            </div>

            {/* Pagination Implementation */}
            {pagination.totalPages > 1 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalBookings || bookings.length}
                  limit={20}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={() => setShowModal(false)} onPayNow={handlePayNow} user={user} onChat={(id, type) => { setChatBookingId(id); setChatRoomType(type || 'provider_customer'); }} />
      )}
      {showRescheduleModal && bookingToReschedule && (
        <RescheduleModal booking={bookingToReschedule} onClose={() => setShowRescheduleModal(false)} onConfirm={handleRescheduleSubmit} />
      )}
      {showCancelModal && bookingToCancel && (
        <CancelModal booking={bookingToCancel} onClose={() => setShowCancelModal(false)} onConfirm={handleCancelConfirm} />
      )}

      <ChatModal
        bookingId={chatRoomType === 'provider_customer' ? chatBookingId : null}
        roomType={chatRoomType}
        customerId={chatRoomType === 'customer_admin' ? user?._id : null}
        role="customer"
        isOpen={!!chatBookingId}
        onClose={() => { setChatBookingId(null); setChatRoomType('provider_customer'); }}
      />
    </div>
  );
};

export default CustomerBookingsPage;
