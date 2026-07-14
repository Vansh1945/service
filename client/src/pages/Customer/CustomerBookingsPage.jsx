import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-time-picker/dist/TimePicker.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, User, Phone, CheckCircle,
  XCircle, AlertCircle, Eye, Search, CreditCard, Star, Package,
  ShoppingCart, Wrench, Activity, Edit3,
  X, Wallet, ShieldAlert, ShieldCheck, Home, CheckSquare, MessageSquare, Heart
} from 'lucide-react';
import { cancelBooking, userUpdateBookingDateTime, getCustomerBookings, getBooking } from '../../services/BookingService';
import { toggleFavoriteProvider } from '../../services/CustomerService';
import Pagination from '../../components/Pagination';
import BookingCardSkeleton from '../../components/ui-skeletons/BookingCardSkeleton';
import { formatDate, formatTime, formatDateTime } from '../../utils/format';
import PriceDisplay from '../../components/PriceDisplay';
import ChatModal from '../../components/chat/ChatModal';
import useDebounce from '../../hooks/useDebounce';
import RescheduleModal from '../../components/modals/RescheduleModal';
import { useConfirm } from '../../context/ConfirmContext';

// ─── Pure helpers ─────────────────

const isChatVisible = (b) => {
  if (!b) return false;
  if (!b.provider && !b.providerDetails) return false;

  if (b.disputeStatus === 'resolved' || b.status === 'resolved') return false;
  if (b.hasComplaint || b.disputeRaised || b.status === 'complaint') return true;
  if (['pending', 'cancelled', 'no-show', 'completed'].includes(b.status)) return false;

  return true;
};

const getBookingTypeBadge = (bookingType) => {
  const type = bookingType || 'scheduled';
  let colorClass = '';
  let label = '';
  switch (type.toLowerCase()) {
    case 'scheduled':
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
      label = 'Scheduled';
      break;
    case 'instant':
      colorClass = 'bg-green-50 text-green-700 border-green-200';
      label = 'Instant';
      break;
    case 'emergency':
      colorClass = 'bg-red-50 text-red-700 border-red-200';
      label = 'Emergency';
      break;
    default:
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
      label = 'Scheduled';
  }
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
};

import { getBookingStatusCfg } from '../../components/ui/StatusConfig';
const getStatusCfg = getBookingStatusCfg;


const needsPayment = (b) => {
  const isPaid = ['paid', 'escrow_hold'].includes(b.paymentStatus);
  if (isPaid || b.status === 'cancelled' || b.status === 'in-progress' || b.status === 'in_progress' || b.status === 'completed') return false;
  return !isPaid;
};
const canCancel = (b) => ['pending', 'accepted'].includes(b.status);
const canReschedule = (b) => b.status === 'pending';

const getStartPin = (booking) => {
  if (booking.startPin) return booking.startPin;
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



const renderStars = (rating = 0) => {
  const count = Math.min(5, Math.max(0, Math.floor(rating)));
  return '★'.repeat(count) + '☆'.repeat(5 - count);
};

// ─── Provider Card ────────────────────────────────────────────────────────────

const ProviderCard = ({ provider, status, compact = false, onCall, onChat, bookingId }) => {
  if (!provider) return null;

  const rating = provider.rating || provider.averageRating || 4.5;
  const experience = provider.experience || provider.yearsOfExperience;
  const completedCount = (provider.completedBookings !== undefined ? provider.completedBookings : provider.completedJobs) || 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl border bg-slate-50 border-slate-100 mt-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-white rounded-full overflow-hidden flex items-center justify-center border border-slate-200 shrink-0 shadow-sm">
          {provider.profilePicUrl ? (
            <img src={provider.profilePicUrl} alt={provider.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">
            Served By
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-extrabold text-slate-800 truncate">{provider.name}</p>
            {provider.isVerified && (
              <span className="text-[9px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">Verified</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-xs font-extrabold text-slate-700">
            <span className="text-amber-500 tracking-wider text-[11px]">{renderStars(rating)}</span>
            <span>{Number(rating).toFixed(1)}</span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{completedCount} Jobs Completed</p>
        </div>

        {/* Contact Actions for non-compact or inline placement */}
        {!compact && !['completed', 'cancelled'].includes(status) && (
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            {provider.phone && onCall && (
              <button
                onClick={(e) => { e.stopPropagation(); onCall(provider.phone); }}
                className="p-2 text-slate-650 hover:text-primary bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
                title="Call"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            )}
            {onChat && bookingId && (
              <button
                onClick={(e) => { e.stopPropagation(); onChat(bookingId, 'provider_customer'); }}
                className="p-2 text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm"
                title="Chat"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Payment Details ──────────────────────────────────────────────────────────

const PaymentDetails = ({ booking }) => {
  const pb = booking.pricingBreakdown || {};
  const hasPb = !!booking.pricingBreakdown;

  const servicePrice = hasPb ? pb.servicePrice : (booking.subtotal || 0);
  const visitingCharge = hasPb ? pb.visitingCharges : (booking.visitingCharge || 0);
  const emergencyCharge = hasPb ? pb.emergencyCharges : (booking.emergencySurge || 0);
  const surgeCharge = hasPb ? pb.surgeCharges : ((booking.rainCharge || 0) + (booking.trafficCharge || 0) + (booking.nightCharge || 0) + (booking.demandSurge || 0) + (booking.platformFee || 0));
  const discount = hasPb ? pb.discount : (booking.totalDiscount || 0);
  const grandTotal = hasPb ? pb.customerTotal : (booking.totalAmount || 0);
  const walletUsed = hasPb ? pb.walletUsed : (booking.walletAmountUsed || booking.fullData?.walletAmountUsed || 0);
  const refundAmount = booking.refundAmount || booking.cancellationProgress?.refundAmount || 0;
  const cashRemaining = hasPb ? pb.cashRemaining : (booking.paymentMethod === 'cash' ? grandTotal : 0);
  const onlinePaid = hasPb ? pb.onlinePaid : (booking.paymentMethod === 'online' || booking.paymentMethod === 'mixed' ? (grandTotal - walletUsed) : 0);

  const rows = [
    { label: 'Service Price', val: servicePrice, type: 'default' },
    discount > 0 && { label: 'Coupon Discount', val: discount, type: 'discount', prefix: '-' },
    visitingCharge > 0 && { label: 'Visiting Charges', val: visitingCharge, type: 'default', prefix: '+' },
    emergencyCharge > 0 && { label: 'Emergency Charge', val: emergencyCharge, type: 'charge', prefix: '+' },
    surgeCharge > 0 && { label: 'Surge Charges', val: surgeCharge, type: 'charge', prefix: '+' },
    walletUsed > 0 && { label: 'Wallet Used', val: walletUsed, type: 'purple-bold', prefix: '-' },
    onlinePaid > 0 && { label: 'Online Paid', val: onlinePaid, type: 'default' },
    cashRemaining > 0 && { label: 'Cash To Pay', val: cashRemaining, type: 'default' },
    refundAmount > 0 && { label: 'Refund Amount', val: refundAmount, type: 'purple-bold' },
  ].filter(Boolean);

  const isPaid = ['paid', 'escrow_hold'].includes(booking.paymentStatus);

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
          <span className={isPaid ? 'text-emerald-600 font-semibold' : booking.paymentStatus === 'refunded' ? 'text-purple-600 font-semibold' : 'text-accent font-semibold'}>
            {isPaid ? 'Paid' : booking.paymentStatus === 'refunded' ? 'Refunded' : 'Pending'}
          </span>
        </div>
        {rows.map(({ label, val, type, prefix }) => (
          <div key={label} className="flex justify-between items-center animate-fadeIn">
            <span className="text-gray-500">{label}</span>
            <PriceDisplay amount={val} type={type} prefix={prefix} />
          </div>
        ))}
        <div className="border-t border-gray-200 pt-2 mt-1 flex justify-between font-bold text-secondary text-base">
          <span>Grand Total</span>
          <PriceDisplay amount={grandTotal || 0} type="default" />
        </div>
      </div>

      {booking.timeline?.payoutHoldUntil && booking.status === 'completed' && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex justify-between items-center text-[10px] mb-1.5">
            <span className="text-blue-700 font-bold uppercase tracking-wider">Review Protection</span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${new Date(booking.timeline.payoutHoldUntil) > new Date() ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
              {new Date(booking.timeline.payoutHoldUntil) > new Date() ? 'ACTIVE' : 'COMPLETED'}
            </span>
          </div>
          <p className="text-xs text-blue-700 font-medium">
            {new Date(booking.timeline.payoutHoldUntil) > new Date() ? "Service under 48-hour review protection" : "Review period completed"}
          </p>
          <p className="text-[10px] text-blue-500 mt-1 italic">
            {new Date(booking.timeline.payoutHoldUntil) > new Date() ? `Protection valid until: ${formatDateTime(booking.timeline.payoutHoldUntil)}` : `Protection ended at: ${formatDateTime(booking.timeline.payoutHoldUntil)}`}
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

const ServiceDetails = ({ services, demandSurge = 0, useServiceDetails = false }) => (
  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      <Package className="w-3.5 h-3.5" /> Service Details
    </p>
    <div className="space-y-2">
      {services?.map((item, i) => {
        const svc = useServiceDetails ? item.serviceDetails : item.service;
        const surgePerItem = demandSurge / (item.quantity || 1);
        const priceWithSurge = (item.price || 0) + surgePerItem;
        return (
          <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <p className="font-semibold text-secondary text-sm">{svc?.title || 'Service'}</p>
              <PriceDisplay amount={priceWithSurge} type="primary" className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
              <div><span className="font-medium">Category:</span> <span className="uppercase">{typeof svc?.category === 'object' ? svc.category.name : (svc?.category || 'N/A')}</span></div>
              <div><span className="font-medium">Qty:</span> {item.quantity || 1}</div>
              <div><span className="font-medium">Duration:</span> {svc?.duration ? `${svc.duration} hrs` : 'N/A'}</div>
              <div><span className="font-medium">Discount:</span> <PriceDisplay amount={item.discountAmount || 0} type="text-only" /></div>
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
  const [activeTab, setActiveTab] = useState('booking');
  const provider = booking.provider || booking.providerDetails;

  const currentStatus = (booking.status || 'pending').toLowerCase().replace(/[^a-z]/g, '');

  const isContactable = !['completed', 'cancelled', 'rejected', 'expired', 'refunded'].includes(currentStatus);
  const showProviderTab = provider && isContactable;

  const tabs = [
    { id: 'booking', label: 'Booking' },
    ...(showProviderTab ? [{ id: 'provider', label: 'Provider' }] : []),
    { id: 'payment', label: 'Payment' },
    { id: 'timeline', label: 'Timeline & PIN' },
    { id: 'proofs', label: 'Proofs' }
  ];

  const getMaskedPhone = (phoneNum) => {
    if (!phoneNum) return 'N/A';
    if (!isContactable) {
      return phoneNum.replace(/(\d{2})\d+(\d{3})/, '$1******$2');
    }
    return phoneNum;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl z-30">
          <div className="flex justify-between items-start gap-4 mb-2">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Booking Detail</p>
              <h2 className="text-lg font-bold text-secondary leading-tight">{booking.services?.[0]?.service?.title || 'Booking Details'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-medium text-gray-400 font-mono">ID: {booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</span>
                {getBookingTypeBadge(booking.bookingType)}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize border border-slate-200">{booking.status}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-xl hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex border-b border-gray-200 -mx-6 px-6 mt-3 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all whitespace-nowrap uppercase tracking-wider ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-650'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {activeTab === 'booking' && (
            <div className="space-y-4 animate-fadeIn">
              <ServiceDetails services={booking.services} demandSurge={booking.demandSurge} />
              <AddressBlock address={booking.address} phone={user?.phone} />
              {booking.notes && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-secondary mb-1">Special Instructions</p>
                    <p className="text-xs text-gray-600">{booking.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'provider' && provider && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-full overflow-hidden flex items-center justify-center border-2 border-slate-200 shrink-0 shadow-md">
                    {provider.profilePicUrl ? (
                      <img src={provider.profilePicUrl} alt={provider.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-extrabold text-secondary text-base truncate">{provider.name}</h4>
                      {provider.isVerified && (
                        <span className="text-[9px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">Verified</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide">Professional Partner</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                      <span className="text-amber-500 font-extrabold tracking-wider">{renderStars(provider.rating || provider.averageRating || 4.5)}</span>
                      <span className="font-extrabold text-slate-700">{Number(provider.rating || provider.averageRating || 4.5).toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200/60 pt-4 space-y-2.5 text-xs font-semibold text-gray-650">
                  {isContactable && provider.phone && (
                    <div className="flex justify-between items-center py-1">
                      <span>Phone Actions</span>
                      <button
                        onClick={() => onCall(provider.phone)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/95 active:scale-95 transition-all shadow-sm"
                      >
                        <Phone className="w-3 h-3" /> Call Partner
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Experience</span>
                    <span className="text-secondary font-bold">{(provider.experience !== undefined ? provider.experience : provider.yearsOfExperience) || 0} Years Experience</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Jobs</span>
                    <span className="text-secondary font-bold">{(provider.completedBookings !== undefined ? provider.completedBookings : provider.completedJobs) || 0} Jobs Completed</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completion Rate</span>
                    <span className="text-secondary font-bold">{provider.completionRate || 100}% Completion Rate</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs text-gray-500 flex gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-700">🔒 Privacy Protection Active</p>
                  <p className="mt-0.5 leading-relaxed">For your privacy and security, phone calls and chat options are active only during an active booking. Once the booking is completed or cancelled, direct communication channels are deactivated.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-4 animate-fadeIn">
              <PaymentDetails booking={booking} />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4 animate-fadeIn">
              {['scheduled', 'accepted', 'inprogress', 'assigned', 'ontheway', 'arrived', 'started'].includes(currentStatus) && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-blue-200 text-blue-600 shadow-sm shrink-0">
                      <ShieldCheck className="w-4.5 h-4.5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-blue-600/60 uppercase tracking-wider block leading-none mb-0.5">
                        {['inprogress', 'started'].includes(currentStatus) ? 'Completion PIN' : 'Start PIN'}
                      </span>
                      <span className="text-lg font-black tracking-wider text-secondary font-mono leading-none">
                        {['inprogress', 'started'].includes(currentStatus) ? (getCompletionPin(booking) || '••••') : (getStartPin(booking) || '••••')}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight max-w-[160px] text-right shrink-0">
                    {['inprogress', 'started'].includes(currentStatus)
                      ? 'Share to verify service completion.'
                      : 'Provide to partner to start service.'
                    }
                  </p>
                </div>
              )}

              {((booking.disputeRaised === true || booking.hasComplaint === true) &&
                ((booking.disputeStatus && !['none', 'None'].includes(booking.disputeStatus)) ||
                 (booking.adminRefundDecision && !['none', 'None'].includes(booking.adminRefundDecision)))) && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Dispute & Refund Details
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-red-700">Dispute Status</span>
                      <span className="font-medium text-red-800 capitalize">{booking.disputeStatus?.replace('_', ' ') || 'Under Review'}</span>
                    </div>
                    {booking.adminRefundDecision && !['none', 'None'].includes(booking.adminRefundDecision) && (
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

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Tracking Timeline
                </p>
                <div className="relative pl-1">
                  <div className="space-y-0">
                    {(() => {
                      const stepsList = [
                        { label: 'Booking Created', statuses: ['pending', 'searchingprovider', 'offered', 'assigned', 'accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                        { label: 'Provider Assigned', statuses: ['assigned', 'accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                        { label: 'Accepted', statuses: ['accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                        { label: 'On The Way', statuses: ['ontheway', 'arrived', 'started', 'inprogress', 'completed'] },
                        { label: 'Arrived', statuses: ['arrived', 'started', 'inprogress', 'completed'] },
                        { label: 'Started', statuses: ['started', 'inprogress', 'completed'] },
                        { label: 'Completed', statuses: ['completed'] }
                      ];

                      return stepsList.map((step, idx) => {
                        const history = booking.statusHistory || [];
                        const match = history.find(h => {
                          const s = (h.status || '').toLowerCase().replace(/[^a-z]/g, '');
                          return step.statuses.includes(s);
                        });
                        const isCompleted = !!match || step.statuses.includes((booking.status || '').toLowerCase().replace(/[^a-z]/g, ''));
                        const timestamp = match ? match.timestamp : null;

                        return (
                          <div key={idx} className="relative pl-8 pb-5 last:pb-0">
                            {idx !== stepsList.length - 1 && (
                              <div className={`absolute left-[9px] top-5 bottom-0 w-0.5 ${isCompleted ? 'bg-emerald-500' : 'bg-gray-250'}`} />
                            )}
                            <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold z-10 transition-all ${
                              isCompleted 
                                ? 'bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50' 
                                : 'bg-white border-2 border-gray-300 text-gray-400'
                            }`}>
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-xs font-bold leading-none ${isCompleted ? 'text-secondary font-black' : 'text-gray-400 font-semibold'}`}>
                                {step.label}
                              </h4>
                              {timestamp && (
                                <span className="text-[9px] text-gray-400 font-mono block mt-1">
                                  {new Date(timestamp).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'proofs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Work Proofs & Photos
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          <p className="text-xs text-gray-650 mb-2">{proof.message}</p>
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
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex justify-end gap-3 z-30">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            Close
          </button>
          {['assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'in-progress', 'started'].includes(booking.status) && (
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



// ─── Booking Card ─────────────────────────────────────────────────────────────

const ActionBtn = ({ label, icon: Icon, onClick, variant = 'blue', disabled = false, mlAuto = false, fullWidth = false }) => {
  const styles = {
    blue: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-200 bg-white',
    red: 'text-red-605 hover:text-red-800 hover:bg-red-50 border-red-200 bg-white',
    amber: 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 border-amber-200 bg-white',
    teal: 'text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-500/95 hover:to-emerald-600/95 shadow-sm border-transparent',
    primary: 'text-white bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 shadow-md border-transparent',
    green: 'text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-sm border-transparent',
    phone: 'text-primary hover:text-primary/80 hover:bg-primary/5 border-primary/20 bg-white'
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${fullWidth ? 'col-span-2 w-full sm:w-auto' : 'w-full sm:w-auto'} ${mlAuto ? 'sm:ml-auto' : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};

const BookingCard = ({ booking, onView, onPayNow, onReschedule, onCancel, onCall, onChat, onToggleFavorite, user, actionLoading = {} }) => {
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
                <p className="text-lg font-bold text-secondary"><PriceDisplay amount={booking.totalAmount || 0} type="large-bold-secondary" /></p>
                <p className={`text-xs font-bold px-2 py-0.5 rounded-full ${['paid', 'escrow_hold'].includes(booking.paymentStatus)
                  ? 'bg-green-100 text-green-600'
                  : booking.paymentStatus === 'refunded'
                    ? 'bg-purple-100 text-purple-600'
                    : (booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service'
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-red-50 text-accent')
                  }`}>
                  {['paid', 'escrow_hold'].includes(booking.paymentStatus)
                    ? `✓ Paid`
                    : booking.paymentStatus === 'refunded'
                      ? '✓ Refunded'
                      : (booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service'
                        ? 'Pay After Service'
                        : 'Unpaid')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {getBookingTypeBadge(booking.bookingType)}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" /> {formatDate(booking.date)}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" /> {booking.time ? formatTime(booking.time) : 'Not set'}
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 capitalize">{booking.status}</span>
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
        {provider && !['completed', 'cancelled'].includes(booking.status?.toLowerCase()) && booking.paymentStatus !== 'refunded' && <ProviderCard provider={provider} status={booking.status} compact />}
        {booking.paymentStatus === 'pending' && booking.status !== 'cancelled' && (
          <p className={`text-xs mt-3 p-2.5 rounded-xl border ${booking.paymentMethod === 'cash' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
            ⚡ {booking.paymentMethod === 'cash' ? "Payment for this request will be collected by the professional after service completion." : "Confirm payment so a provider can be assigned and your request resolved."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 mt-4 pt-4 border-t border-gray-100">
          <ActionBtn label="View Details" icon={Eye} onClick={() => onView(booking._id)} />
          {(() => {
            const status = (booking.status || 'pending').toLowerCase().replace(/[^a-z]/g, '');
            const buttons = [];

            if (['pending', 'searchingprovider'].includes(status)) {
              buttons.push(
                { label: 'Reschedule', icon: Edit3, onClick: () => onReschedule(booking), disabled: actionLoading[booking._id + '-reschedule'] },
                { label: 'Cancel Booking', icon: XCircle, onClick: () => onCancel(booking), disabled: actionLoading[booking._id + '-cancel'], variant: 'red', mlAuto: true }
              );
            } else if (['assigned', 'accepted'].includes(status)) {
              buttons.push(
                { label: 'Track Provider', icon: MapPin, onClick: () => navigate(`/customer/track/${booking._id}`), variant: 'primary' },
                { label: provider?.name ? `Chat with ${provider.name}` : 'Chat with Provider', icon: MessageSquare, onClick: () => onChat(booking._id, 'provider_customer'), variant: 'teal' }
              );
            } else if (status === 'ontheway') {
              buttons.push(
                { label: 'Track Provider', icon: MapPin, onClick: () => navigate(`/customer/track/${booking._id}`), variant: 'primary' },
                provider?.phone && { label: 'Call', icon: Phone, onClick: () => onCall(provider.phone), variant: 'phone' },
                { label: provider?.name ? `Chat with ${provider.name}` : 'Chat with Provider', icon: MessageSquare, onClick: () => onChat(booking._id, 'provider_customer'), variant: 'teal' }
              );
            } else if (status === 'arrived') {
              buttons.push(
                provider?.phone && { label: 'Call', icon: Phone, onClick: () => onCall(provider.phone), variant: 'phone' },
                { label: provider?.name ? `Chat with ${provider.name}` : 'Chat with Provider', icon: MessageSquare, onClick: () => onChat(booking._id, 'provider_customer'), variant: 'teal' }
              );
            } else if (['started', 'inprogress'].includes(status)) {
              buttons.push(
                { label: 'Track Progress', icon: Activity, onClick: () => navigate(`/customer/track/${booking._id}`), variant: 'primary' },
                { label: 'Upload Issue', icon: AlertCircle, onClick: () => navigate(`/customer/complaints`, { state: { prefilledBookingId: booking._id } }), variant: 'amber' }
              );
            } else if (status === 'completed') {
              buttons.push(
                { label: 'Rate Service', icon: Star, onClick: () => navigate(`/customer/feedback`, { state: { prefilledBooking: booking } }), variant: 'amber' },
                booking.services?.[0]?.service?._id && { label: 'Book Again', icon: ShoppingCart, onClick: () => navigate(`/customer/book-service/${booking.services[0].service._id}`, { state: { prefillBooking: booking } }), variant: 'green' },
                { label: 'Raise Dispute', icon: AlertCircle, onClick: () => navigate(`/customer/complaints`, { state: { prefilledBookingId: booking._id } }), variant: 'red' }
              );
            } else if (booking.services?.[0]?.service?._id) {
              buttons.push(
                { label: 'Book Again', icon: ShoppingCart, onClick: () => navigate(`/customer/book-service/${booking.services[0].service._id}`, { state: { prefillBooking: booking } }), variant: 'green' }
              );
            }

            const validButtons = buttons.filter(Boolean);
            const totalBtnsCount = validButtons.length + 1;
            return validButtons.map((btn, idx) => {
              const isLast = idx === validButtons.length - 1;
              const shouldBeFullWidth = isLast && (totalBtnsCount % 2 !== 0);
              return (
                <ActionBtn
                  key={idx}
                  {...btn}
                  fullWidth={btn.fullWidth || shouldBeFullWidth}
                />
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};



// ─── Main Page ────────────────────────────────────────────────────────────────

const CustomerBookingsPage = () => {
  const { token, API, showToast, user, refreshUser } = useAuth();
  const { socket } = useSocket();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId') || searchParams.get('bookingId');
  const [actionLoading, setActionLoading] = useState({});

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
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchTerm(prev => prev !== q ? q : prev);
  }, [searchParams]);
  const [showModal, setShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [chatBookingId, setChatBookingId] = useState(null);
  const [chatRoomType, setChatRoomType] = useState('provider_customer');

  const deepLinkLoadedRef = useRef(false);

  const fetchBookings = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const params = new URLSearchParams({ status: statusFilter, timeFilter, searchTerm: debouncedSearch, page: currentPage, limit: 20 });
      const res = await getCustomerBookings(params);
      const responseData = res.data;
      setBookings(responseData.data || []);
      setPagination(responseData.pagination || {});
    } catch (err) {
      showToast(`Error fetching bookings: ${err.message} `, 'error');
      setBookings([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [API, token, showToast, statusFilter, timeFilter, debouncedSearch, currentPage]);

  // Reset page on debounced search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => { fetchBookings(); }, [statusFilter, timeFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdated = (data) => {
      if (!data || !data.booking) return;

      setBookings(prev => {
        const index = prev.findIndex(b => b._id === data.bookingId);
        if (index === -1) {
          return [data.booking, ...prev];
        }

        const currentBooking = prev[index];
        const currentUpdatedAt = new Date(currentBooking.updatedAt || 0).getTime();
        const incomingUpdatedAt = new Date(data.booking.updatedAt || 0).getTime();

        if (incomingUpdatedAt < currentUpdatedAt) {
          console.log("Ignored stale socket booking-updated event.");
          return prev;
        }

        const next = [...prev];
        next[index] = {
          ...next[index],
          ...data.booking,
          provider: data.booking.provider || next[index].provider,
          services: data.booking.services || next[index].services
        };
        return next;
      });

      setSelectedBooking(prev => {
        if (prev && prev._id === data.bookingId) {
          const currentUpdatedAt = new Date(prev.updatedAt || 0).getTime();
          const incomingUpdatedAt = new Date(data.booking.updatedAt || 0).getTime();
          if (incomingUpdatedAt < currentUpdatedAt) {
            return prev;
          }
          return {
            ...prev,
            ...data.booking,
            provider: data.booking.provider || prev.provider,
            services: data.booking.services || prev.services
          };
        }
        return prev;
      });
    };

    const handleBookingDeleted = (data) => {
      if (!data || !data.bookingId) return;
      setBookings(prev => prev.filter(b => b._id !== data.bookingId));
      setSelectedBooking(prev => {
        if (prev && prev._id === data.bookingId) {
          setShowModal(false);
          return null;
        }
        return prev;
      });
    };

    socket.on('booking-updated', handleBookingUpdated);
    socket.on('booking-deleted', handleBookingDeleted);

    const handleReconnect = () => {
      fetchBookings(true);
    };
    socket.on('connect', handleReconnect);
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('booking-updated', handleBookingUpdated);
      socket.off('booking-deleted', handleBookingDeleted);
      socket.off('connect', handleReconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, fetchBookings]);

  useEffect(() => {
    if (entityId && !deepLinkLoadedRef.current) {
      const existing = bookings.find(b => b._id === entityId);
      if (existing) {
        setSelectedBooking(existing);
        setShowModal(true);
        deepLinkLoadedRef.current = true;
      } else {
        getBooking(entityId).then(res => {
          if (res.data?.success && res.data?.data) {
            setSelectedBooking(res.data.data);
            setShowModal(true);
            deepLinkLoadedRef.current = true;
          }
        }).catch(err => {
          console.error("Error fetching single booking on deep link:", err);
        });
      }
    }
  }, [entityId, bookings]);

  // fetchBookings declaration moved above to avoid temporal dead zone reference errors

  // Silent Refresh on window focus and online status
  useEffect(() => {
    const handleFocus = () => {
      fetchBookings(true);
    };
    const handleOnline = () => {
      fetchBookings(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchBookings]);

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



  const handleRescheduleSubmit = async ({ date, time }) => {
    if (!bookingToReschedule) return;
    const actionKey = `${bookingToReschedule._id}-reschedule`;
    if (actionLoading[actionKey]) return;

    // Save previous state for rollback
    const prevBookings = [...bookings];
    const prevSelected = selectedBooking ? { ...selectedBooking } : null;

    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      // Optimistic update
      setBookings(prev => prev.map(item => item._id === bookingToReschedule._id ? { ...item, date, time } : item));
      if (selectedBooking && selectedBooking._id === bookingToReschedule._id) {
        setSelectedBooking(prev => ({ ...prev, date, time }));
      }

      await userUpdateBookingDateTime(bookingToReschedule._id, { date, time });
      showToast('Booking rescheduled successfully', 'success');
      setShowRescheduleModal(false);
      setBookingToReschedule(null);
      fetchBookings(true);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      // Rollback on failure
      setBookings(prevBookings);
      if (prevSelected) setSelectedBooking(prevSelected);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTimeFilter('all');
    setSearchTerm('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    setSearchParams(newParams, { replace: true });
  };
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
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
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

            {/* Clear */}
            <div>
              <button onClick={clearFilters} disabled={!hasFilters}
                className={`w-full px-2 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors border ${hasFilters ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed'}`}>
                <span className="hidden sm:inline">Clear Filters</span>
                <span className="sm:hidden">Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingCardSkeleton key={i} />
            ))}
          </div>
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
                  actionLoading={actionLoading}
                  onCancel={async (b) => {
                    const actionKey = `${b._id}-cancel`;
                    if (actionLoading[actionKey]) return;

                    const isStarted = !!b?.serviceStartedAt;
                    const hasPlatformFee = (b.platformFee || 0) > 0;
                    const message = isStarted
                      ? 'Service has already started. Cancellation requires admin review and may be treated as a dispute. Are you sure you want to cancel?'
                      : hasPlatformFee
                        ? `Any valid refund (excluding the non-refundable Platform Fee of ₹${b.platformFee}) will be added directly to your wallet. Are you sure you want to cancel?`
                        : 'Any valid refund will be added directly to your wallet. Are you sure you want to cancel?';
                    const isConfirmed = await confirm({
                      title: 'Cancel Booking?',
                      message,
                      type: 'danger',
                      confirmText: 'Yes, Cancel',
                      cancelText: 'Keep Booking'
                    });
                    if (isConfirmed) {
                      const prevBookings = [...bookings];
                      const prevSelected = selectedBooking ? { ...selectedBooking } : null;
                      try {
                        setActionLoading(prev => ({ ...prev, [actionKey]: true }));

                        // Optimistic update
                        setBookings(prev => prev.map(item => item._id === b._id ? { ...item, status: 'cancelled', cancellationProgress: { ...item.cancellationProgress, status: 'cancelled', cancelledAt: new Date() } } : item));
                        if (selectedBooking && selectedBooking._id === b._id) {
                          setSelectedBooking(prev => ({ ...prev, status: 'cancelled', cancellationProgress: { ...prev.cancellationProgress, status: 'cancelled', cancelledAt: new Date() } }));
                        }

                        await cancelBooking(b._id, { reason: 'Cancelled by Customer' });
                        showToast('Booking cancelled successfully', 'success');
                        fetchBookings(true);
                      } catch (err) {
                        showToast(`Error: ${err.message}`, 'error');
                        setBookings(prevBookings);
                        if (prevSelected) setSelectedBooking(prevSelected);
                      } finally {
                        setActionLoading(prev => ({ ...prev, [actionKey]: false }));
                      }
                    }
                  }}
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
        <RescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          onConfirm={(date, time) => handleRescheduleSubmit({ date, time })}
          initialDate={bookingToReschedule.date}
          initialTime={bookingToReschedule.time}
        />
      )}

      <ChatModal
        bookingId={chatRoomType === 'provider_customer' ? chatBookingId : null}
        roomType={chatRoomType}
        customerId={chatRoomType === 'customer_admin' ? user?._id : null}
        userRole="customer"
        isOpen={!!chatBookingId}
        onClose={() => { setChatBookingId(null); setChatRoomType('provider_customer'); }}
      />
    </div>
  );
};

export default CustomerBookingsPage;
