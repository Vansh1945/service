import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/auth';
import DatePicker from 'react-datepicker';
import TimePicker from 'react-time-picker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-time-picker/dist/TimePicker.css';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, User, Phone, DollarSign, CheckCircle,
  XCircle, AlertCircle, Eye, Search, CreditCard, Star, Package,
  ShoppingCart, Timer, Wrench, Activity, Edit3, ChevronLeft,
  ChevronRight, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { cancelBooking, userUpdateBookingDateTime, getCustomerBookings } from '../../services/BookingService';
import Pagination from '../../components/Pagination';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/format';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

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
  if (b.paymentStatus === 'paid' || b.status === 'cancelled') return false;
  // If it's already an online pending payment, it needs payment
  if (b.paymentMethod !== 'cash' && b.paymentType !== 'cash') return b.paymentStatus === 'pending';
  // If it's a cash booking, allow online payment ONLY if still pending (not accepted)
  return b.status === 'pending';
};
const canCancel = (b) => ['pending', 'accepted'].includes(b.status);
const canReschedule = (b) => b.status === 'pending';

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
  const getTs = (key) => booking.statusHistory?.find(h => h.status === key)?.timestamp;

  const steps = booking.status === 'cancelled'
    ? [
      { key: 'booked', label: 'Booking Placed', icon: ShoppingCart, done: true, time: booking.createdAt, desc: 'Your booking was placed.' },
      { key: 'cancelled', label: 'Booking Cancelled', icon: XCircle, done: false, active: true, time: getTs('cancelled'), desc: booking.cancellationReason ? `Reason: ${booking.cancellationReason}` : 'Booking was cancelled.' },
    ]
    : [
      { key: 'booked', label: 'Booking Placed', icon: ShoppingCart, done: true, time: booking.createdAt, desc: 'Your booking has been placed.' },
      { key: 'payment', label: 'Payment', icon: booking.paymentMethod === 'cash' ? DollarSign : CreditCard, done: booking.paymentStatus === 'paid', active: booking.paymentStatus === 'pending' && !booking.confirmedBooking, time: booking.paymentDate || getTs('payment_pending'), desc: booking.paymentStatus === 'paid' ? `${formatCurrency(booking.totalAmount)} paid via ${booking.paymentMethod}` : booking.paymentMethod === 'cash' ? 'Pay after service' : 'Payment pending' },
      { key: 'assigned', label: 'Provider Assigned', icon: User, done: ['accepted', 'in-progress', 'completed'].includes(booking.status), active: !!(booking.providerDetails || booking.provider) && booking.status === 'pending', time: getTs('accepted') || getTs('assigned'), desc: (booking.providerDetails || booking.provider) ? `${(booking.providerDetails || booking.provider).name} (ID: ${(booking.providerDetails || booking.provider).providerId || 'N/A'}) has been assigned.` : 'Waiting for provider.' },
      { key: 'in_progress', label: 'Work Started', icon: Wrench, done: ['in-progress', 'completed'].includes(booking.status), active: booking.status === 'in-progress', time: booking.serviceStartedAt || getTs('in-progress'), desc: booking.status === 'in-progress' ? 'Provider has started work.' : 'Work will begin soon.' },
      { key: 'completed', label: 'Completed', icon: CheckCircle, done: booking.status === 'completed', time: booking.serviceCompletedAt || getTs('completed'), desc: booking.status === 'completed' ? 'Service completed successfully.' : 'Awaiting completion.' },
    ];

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Booking Progress</p>
      <div className="relative pl-4">
        <div className="absolute left-[34px] top-5 bottom-5 w-px bg-gray-200" />
        <div className="space-y-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="relative flex items-start gap-3">
                <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${step.done ? 'bg-primary text-white shadow-sm' : step.active ? 'bg-accent text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="pt-1.5 min-w-0">
                  <p className={`text-sm font-semibold leading-none ${step.done ? 'text-primary' : step.active ? 'text-accent' : 'text-gray-400'}`}>{step.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                  {step.time && <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(step.time)}</p>}
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
    <div className="mt-3 flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-blue-200 flex-shrink-0">
        <User className="w-4 h-4 text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 font-medium">Assigned Provider</p>
        <p className="text-sm font-bold text-gray-900 truncate">{provider.name}</p>
        <p className="text-[10px] font-bold text-primary uppercase">ID: {provider.providerId || 'N/A'}</p>
      </div>
      {rating > 0 && (
        <div className="ml-auto flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-yellow-100 flex-shrink-0">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          <span className="text-xs font-bold">{rating.toFixed(1)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assigned Provider</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-gray-900">{provider.name}</p>
          <p className="text-xs font-bold text-primary uppercase">ID: {provider.providerId || 'N/A'}</p>
          {rating > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
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

const PaymentDetails = ({ booking }) => (
  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      <CreditCard className="w-3.5 h-3.5" /> Payment Details
    </p>
    <div className="space-y-2 text-sm">
      {[
        ['Method', <span className="capitalize">{booking.paymentMethod || 'N/A'}</span>],
        ['Status', <span className={booking.paymentStatus === 'paid' ? 'text-emerald-600 font-semibold' : 'text-accent font-semibold'}>{booking.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</span>],
        ['Subtotal', formatCurrency(booking.subtotal || 0)],
        ...(booking.totalDiscount > 0 ? [['Discount', <span className="text-emerald-600">-{formatCurrency(booking.totalDiscount)}</span>]] : []),
        ...(booking.couponApplied?.isValid ? [['Coupon', <span className="text-blue-600">{booking.couponApplied.code}</span>]] : []),
      ].map(([label, val]) => (
        <div key={label} className="flex justify-between items-center">
          <span className="text-gray-500">{label}</span>
          <span className="font-medium">{val}</span>
        </div>
      ))}
      <div className="border-t border-gray-200 pt-2 mt-1 flex justify-between font-bold text-secondary">
        <span>Total</span>
        <span>{formatCurrency(booking.totalAmount || 0)}</span>
      </div>
    </div>
    {booking.transactionId && (
      <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction</p>
        {[
          ['Txn ID', booking.transactionId],
          ...(booking.razorpayPaymentId ? [['Payment ID', booking.razorpayPaymentId]] : []),
          ...(booking.paymentDate ? [['Paid On', new Date(booking.paymentDate).toLocaleString()]] : []),
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
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" /> Service Address
      </p>
      <p className="text-sm text-gray-700">{parts}</p>
      {phone && <p className="text-sm text-gray-600 mt-1">📞 {phone}</p>}
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

const BookingModal = ({ booking, onClose, onPayNow, user }) => {
  const provider = booking.provider || booking.providerDetails;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-lg font-bold text-secondary">{booking.services?.[0]?.service?.title || 'Booking Details'}</h2>
              <p className="text-xs text-gray-500">ID: {booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <BookingTimeline booking={booking} />
          <ServiceDetails services={booking.services} />
          <PaymentDetails booking={booking} />
          <div className="grid sm:grid-cols-2 gap-4">
            <AddressBlock address={booking.address} phone={user?.phone} />
            {provider && ['accepted', 'in_progress', 'in-progress', 'completed'].includes(booking.status) && (
              <ProviderCard provider={provider} status={booking.status} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            Close
          </button>
          {needsPayment(booking) && (
            <button onClick={() => { onClose(); onPayNow(booking); }} className="px-4 py-2 text-sm font-bold text-white bg-accent rounded-xl hover:bg-accent/90 transition-all flex items-center gap-2 shadow-sm">
              <CreditCard className="w-4 h-4" /> Pay Now
            </button>
          )}
        </div>
      </div>
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

const CancelModal = ({ booking, onClose, onConfirm }) => (
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
            <p className="text-xs text-red-600 mt-1">Any payment made will be processed per our refund policy.</p>
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

// ─── Booking Card ─────────────────────────────────────────────────────────────

const BookingCard = ({ booking, onView, onPayNow, onReschedule, onCancel, onCall }) => {
  const cfg = getStatusCfg(booking.status);
  const provider = booking.provider || booking.providerDetails;
  const svcImage = booking.services?.[0]?.service?.images?.[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      {/* Status color bar */}
      <div className={`h-1 w-full ${cfg.bar}`} />

      <div className="p-4 md:p-5">
        {/* Top Row */}
        <div className="flex items-start gap-3 mb-4">
          {/* Image or icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-100 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
            {svcImage
              ? <img src={svcImage} alt="service" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
              : null}
            <Wrench className="w-6 h-6 text-primary" style={svcImage ? { display: 'none' } : {}} />
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-secondary truncate">{booking.services?.[0]?.service?.title || 'Service Booking'}</h3>
                <p className="text-xs text-gray-400">{booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-secondary">{formatCurrency(booking.totalAmount || 0)}</p>
                <p className={`text-xs font-bold px-2 py-0.5 rounded-full ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-600' : (booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-50 text-accent')}`}>
                  {booking.paymentStatus === 'paid' ? `✓ Paid` : (booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service' ? 'Pay After Service' : 'Unpaid')}
                </p>
              </div>
            </div>

            {/* Date / time / status */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" /> {formatDate(booking.date)}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" /> {booking.time || 'Not set'}
              </div>
              <StatusBadge status={booking.status} />
              {needsPayment(booking) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 animate-pulse">
                  <AlertCircle className="w-3 h-3" /> Payment Due
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Provider strip (if assigned and not completed) */}
        {provider && booking.status !== 'completed' && (
          <ProviderCard provider={provider} status={booking.status} compact />
        )}

        {/* Payment pending hint */}
        {booking.paymentStatus === 'pending' && booking.status !== 'cancelled' && (
          <p className={`text-xs mt-3 p-2.5 rounded-xl border ${booking.paymentMethod === 'cash' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
            ⚡ {booking.paymentMethod === 'cash'
              ? "Payment for this request will be collected by the professional after service completion."
              : "Confirm payment so a provider can be assigned and your request resolved."}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => onView(booking._id)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors">
            <Eye className="w-3.5 h-3.5" /> View Details
          </button>

          {needsPayment(booking) && (
            <button onClick={() => onPayNow(booking)} className="flex items-center gap-1.5 text-xs font-bold text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95">
              <CreditCard className="w-3.5 h-3.5" /> Pay Now
            </button>
          )}

          {canReschedule(booking) && (
            <button onClick={() => onReschedule(booking)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Reschedule
            </button>
          )}

          {provider?.phone && !['completed', 'pending', 'cancelled'].includes(booking.status) && (
            <button onClick={() => onCall(provider.phone)} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 px-3 py-1.5 rounded-lg hover:bg-primary/5 border border-primary/20 transition-colors">
              <Phone className="w-3.5 h-3.5" /> Call
            </button>
          )}

          {canCancel(booking) && (
            <button onClick={() => onCancel(booking)} className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-red-200 transition-colors ml-auto">
              <XCircle className="w-3.5 h-3.5" /> Cancel
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
  const { token, API, showToast, user } = useAuth();
  const navigate = useNavigate();

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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => { fetchBookings(); }, [statusFilter, timeFilter, debouncedSearch, currentPage]);

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
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalBookings || bookings.length}
          limit={20}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>

      {/* Modals */}
      {showModal && selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={() => setShowModal(false)} onPayNow={handlePayNow} user={user} />
      )}
      {showRescheduleModal && bookingToReschedule && (
        <RescheduleModal booking={bookingToReschedule} onClose={() => setShowRescheduleModal(false)} onConfirm={handleRescheduleSubmit} />
      )}
      {showCancelModal && bookingToCancel && (
        <CancelModal booking={bookingToCancel} onClose={() => setShowCancelModal(false)} onConfirm={handleCancelConfirm} />
      )}
    </div>
  );
};

export default CustomerBookingsPage;