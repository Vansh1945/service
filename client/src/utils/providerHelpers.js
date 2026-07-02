import {
  CheckCircle, Clock, XCircle, AlertCircle, ShieldAlert, Lock,
  Timer, CheckCheck, Activity, Check, X
} from 'lucide-react';
import { readCachedSystemSettings } from './systemSettingsCache';

/**
 * Checks if chat is visible for a booking.
 * Chat is visible for non-completed/non-cancelled bookings, or completed bookings within 24 hours,
 * or if there is an active complaint/dispute.
 */
export const isChatVisible = (b) => {
  if (!b) return false;
  if (b.disputeStatus === 'resolved' || b.status === 'resolved') return false;
  if (b.hasComplaint || b.disputeRaised || b.status === 'complaint') return true;
  if (['pending', 'cancelled', 'no-show', 'completed'].includes(b.status)) return false;

  return true;
};

/**
 * Standard address formatter for display.
 */
export const formatAddress = (address) => {
  if (!address) return 'Address not specified';
  if (typeof address === 'string') return address;
  return [address.street, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ') || 'Address not specified';
};

/**
 * Calculates subtotal for booking services (price * qty - discount).
 */
export const calculateSubtotal = (booking) => {
  if (!booking?.services) return 0;
  return booking.services.reduce((sum, item) => sum + (item.price * item.quantity) - (item.discountAmount || 0), 0).toFixed(2);
};

/**
 * Calculates net provider earnings/payout amount for a booking.
 */
export const calculateNetAmount = (booking) => {
  if (!booking) return 0;
  if (booking.status === 'completed' && typeof booking.providerEarnings === 'number' && booking.providerEarnings > 0) {
    return booking.providerEarnings.toFixed(2);
  }
  const systemSettings = readCachedSystemSettings();
  
  const getSplit = (bookingSplits, systemSplits, key, defaultVal) => {
    let bSplits = bookingSplits;
    if (typeof bSplits === 'string') {
      try { bSplits = JSON.parse(bSplits); } catch (_) { bSplits = null; }
    }
    if (bSplits && typeof bSplits === 'object' && bSplits[key] !== undefined && bSplits[key] !== null) {
      const val = parseFloat(bSplits[key]);
      if (!isNaN(val)) return val;
    }
    
    let sSplits = systemSplits;
    if (typeof sSplits === 'string') {
      try { sSplits = JSON.parse(sSplits); } catch (_) { sSplits = null; }
    }
    if (sSplits && typeof sSplits === 'object' && sSplits[key] !== undefined && sSplits[key] !== null) {
      const val = parseFloat(sSplits[key]);
      if (!isNaN(val)) return val;
    }
    
    return defaultVal;
  };

  const splitVisiting = getSplit(booking.surgeSplitSettings, systemSettings?.surgeSplitSettings, 'visiting', 60);
  const splitRain = getSplit(booking.surgeSplitSettings, systemSettings?.surgeSplitSettings, 'rain', 70);
  const splitTraffic = getSplit(booking.surgeSplitSettings, systemSettings?.surgeSplitSettings, 'traffic', 70);
  const splitNight = getSplit(booking.surgeSplitSettings, systemSettings?.surgeSplitSettings, 'night', 70);
  const splitDemand = getSplit(booking.surgeSplitSettings, systemSettings?.surgeSplitSettings, 'demand', 50);

  const subtotal = parseFloat(calculateSubtotal(booking)) || 0;
  const visiting = booking.visitingCharge ? parseFloat((booking.visitingCharge * (splitVisiting / 100)).toFixed(2)) : 0;
  const rain = booking.rainCharge ? parseFloat((booking.rainCharge * (splitRain / 100)).toFixed(2)) : 0;
  const traffic = booking.trafficCharge ? parseFloat((booking.trafficCharge * (splitTraffic / 100)).toFixed(2)) : 0;
  const night = booking.nightCharge ? parseFloat((booking.nightCharge * (splitNight / 100)).toFixed(2)) : 0;
  const demand = booking.demandSurge ? parseFloat((booking.demandSurge * (splitDemand / 100)).toFixed(2)) : 0;
  const commission = booking.commission?.amount || booking.commissionAmount || 0;
  return (subtotal + visiting + rain + traffic + night + demand - commission).toFixed(2);
};

/**
 * Config mapping for various status values used across provider panel.
 */
export const getStatusConfig = (status) => {
  const configs = {
    // Earning & Withdrawal statuses
    completed: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Success' },
    paid: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Paid' },
    processing: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Clock, label: 'Processing' },
    under_review: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Clock, label: 'Review' },
    approved: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Approved' },
    requested: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Clock, label: 'Requested' },
    failed: { color: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle, label: 'Failed' },
    rejected: { color: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle, label: 'Rejected' },
    withdrawn: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: CheckCircle, label: 'Withdrawn' },
    'dispute hold': { color: 'bg-red-50 text-red-700 border border-red-200', icon: ShieldAlert, label: 'Dispute Hold' },
    'admin hold': { color: 'bg-accent/10 text-accent border border-accent/20', icon: Lock, label: 'Admin Hold' },
    'held': { color: 'bg-accent/10 text-accent border border-accent/20', icon: Lock, label: 'Held' },
    'available': { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Ready for withdrawal' },
    
    // Booking statuses
    pending: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Timer, label: 'Pending' },
    assigned: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Timer, label: 'Assigned' },
    confirmed: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Confirmed' },
    accepted: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCheck, label: 'Accepted' },
    'in-progress': { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Activity, label: 'In Progress' },
    cancelled: { color: 'bg-red-50 text-red-600 border border-red-200', icon: X, label: 'Cancelled' }
  };
  return configs[status?.toLowerCase()] || { color: 'bg-gray-100 text-secondary/70 border border-gray-200', icon: AlertCircle, label: status || 'Unknown' };
};
