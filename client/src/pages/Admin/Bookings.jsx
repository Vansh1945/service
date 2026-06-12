import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import TableSkeleton from '../../components/ui-skeletons/TableSkeleton';
import useDebounce from '../../hooks/useDebounce';
// Local status helper functions
const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case 'pending':
            return 'bg-yellow-50 text-yellow-800 border-yellow-200';
        case 'accepted':
        case 'new':
            return 'bg-blue-50 text-blue-800 border-blue-200';
        case 'in-progress':
        case 'started':
            return 'bg-indigo-50 text-indigo-800 border-indigo-200';
        case 'completed':
        case 'active':
        case 'approved':
        case 'replied':
            return 'bg-green-50 text-green-800 border-green-200';
        case 'cancelled':
        case 'inactive':
        case 'restricted':
        case 'rejected':
            return 'bg-red-50 text-red-800 border-red-200';
        default:
            return 'bg-gray-50 text-gray-800 border-gray-200';
    }
};

const getStatusIcon = (status) => {
    const baseClass = "w-4 h-4";
    switch (status?.toLowerCase()) {
        case 'pending':
            return <AlertCircle className={baseClass} />;
        case 'accepted':
        case 'new':
            return <UserCheck className={baseClass} />;
        case 'in-progress':
        case 'started':
            return <Activity className={baseClass} />;
        case 'completed':
        case 'active':
        case 'approved':
        case 'replied':
            return <CheckCircle className={baseClass} />;
        case 'cancelled':
        case 'inactive':
        case 'restricted':
        case 'rejected':
            return <XCircle className={baseClass} />;
        default:
            return <AlertCircle className={baseClass} />;
    }
};
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const customerIcon = L.divIcon({ html: `<div style="background-color: #EF4444; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [1, -34] });
const providerIcon = L.divIcon({ html: `<div style="background-color: #10B981; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [1, -34] });

// Override default Leaflet marker assets with divIcon to prevent 404 image errors in Vite
const defaultIcon = L.divIcon({ html: `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [1, -34] });
L.Marker.prototype.options.icon = defaultIcon;

const MapBoundsHelper = ({ providerLoc, targetLat, targetLng }) => {
    const map = useMap();
    React.useEffect(() => {
        if (targetLat && targetLng) {
            if (providerLoc) {
                const bounds = L.latLngBounds([
                    [targetLat, targetLng],
                    [providerLoc.lat, providerLoc.lng]
                ]);
                map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                map.setView([targetLat, targetLng], 15);
            }
        }
    }, [providerLoc, targetLat, targetLng, map]);
    return null;
};
import * as BookingService from '../../services/BookingService';
import * as AdminService from '../../services/AdminService';
import Pagination from '../../components/Pagination';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';
import RescheduleModal from '../../components/modals/RescheduleModal';
import { useAdminFilter } from '../../context/AdminFilterContext';
import AdminFilterBar from '../../components/AdminFilterBar';
import { formatDate, formatTime, formatCurrency, LIGHT_MAP_TILES, LIGHT_MAP_ATTRIBUTION } from '../../utils/format';
import PriceDisplay from '../../components/PriceDisplay';
import {
    Search,
    Calendar,
    User,
    Clock,
    MapPin,
    Eye,
    Trash2,
    CheckCircle,
    XCircle,
    AlertCircle,
    UserCheck,
    CreditCard,
    BarChart2,
    DollarSign,
    Briefcase,
    Activity,
    Phone,
    Mail,
    Star,
    Award,
    X,
    ExternalLink,
    Lock,
    Unlock,
    CheckSquare
} from 'lucide-react';

// Static option arrays outside component — never change between renders
const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
];

const paymentStatusOptions = [
    { value: '', label: 'All Payment Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' }
];

const timeRangeOptions = [
    { value: '', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half-year', label: 'Half Year' },
    { value: 'year', label: 'Yearly' }
];

// Helper functions outside component to prevent recreation on every render


// Memoized Booking Row to prevent unnecessary re-renders
const BookingRow = React.memo(({ booking, onDetails, onReschedule, onAssign, onDelete, onCancel }) => (
    <tr className="hover:bg-gray-50">
        <td className="px-4 py-4 whitespace-nowrap">
            <div className="text-sm font-medium text-secondary">
                {booking.bookingId || `#${booking._id?.substring(booking._id.length - 8) || 'N/A'}`}
            </div>
            <div className="flex flex-col gap-1 mt-1">
                {booking.isRebook ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-750 border border-teal-200 px-1.5 py-0.5 rounded w-max" title={`Original Booking: ${booking.originalBooking?.bookingId || booking.originalBooking || 'N/A'}`}>
                        🔄 Rebook
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded w-max">
                        🆕 New
                    </span>
                )}
                {booking.isFavoriteProviderBooking && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded w-max">
                        ❤️ Preferred
                    </span>
                )}
            </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <div>
                <div className="text-sm font-medium text-secondary">
                    {booking.customer?.name || 'N/A'}
                </div>
                <div className="text-sm text-gray-500">
                    {booking.customer?.email || 'N/A'}
                </div>
            </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
            <div>
                <div className="text-sm font-medium text-secondary">
                    {booking.provider?.name || 'Unassigned'}
                    {booking.provider?.providerId && (
                        <span className="ml-1 text-[10px] text-gray-400 font-mono">[{booking.provider.providerId}]</span>
                    )}
                </div>
                <div className="text-sm text-gray-500">
                    {booking.provider?.email || 'N/A'}
                </div>
                {booking.provider && booking.assignmentSource && (
                    <div className="text-[10px] font-semibold text-teal-650 mt-1 flex items-center gap-0.5">
                        📍 {booking.assignmentSource}
                    </div>
                )}
            </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <div>
                <div className="text-sm font-medium text-secondary">
                    {booking.services?.[0]?.service?.title || 'N/A'}
                </div>
                <div className="text-sm">
                    <PriceDisplay amount={booking.totalAmount} type="bold-primary" />
                </div>
            </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap hidden lg:table-cell">
            <div>
                <div className="text-sm text-secondary">
                    {formatDate(booking.date)}
                </div>
                <div className="text-sm text-gray-500">
                    {booking.time ? formatTime(booking.time) : 'Not specified'}
                </div>
            </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
                {getStatusIcon(booking.status)}
                <span className="ml-1 capitalize">{booking.status}</span>
            </span>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => onDetails(booking._id)}
                    className="p-1 text-primary hover:text-teal-700"
                    title="View Details"
                >
                    <Eye className="w-4 h-4" />
                </button>

                {!["completed", "cancelled"].includes(booking.status) && (
                    <button
                        onClick={() => onReschedule(booking)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Update Date/Time"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                )}

                {booking.status === 'pending' && !booking.provider && (
                    <button
                        onClick={() => onAssign(booking)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Assign Provider"
                    >
                        <UserCheck className="w-4 h-4" />
                    </button>
                )}

                {['pending', 'accepted', 'assigned', 'confirmed'].includes(booking.status) && (
                    <button
                        onClick={() => onCancel(booking)}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Cancel Booking"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>
                )}

                <button
                    onClick={() => onDelete(booking)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete Booking"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </td>
    </tr>
));

const PayoutStatusBadge = ({ status }) => {
    const cfg = {
        'Payout On Hold': 'bg-orange-100 text-orange-700 border-orange-200',
        'Payout Ready': 'bg-green-100 text-green-700 border-green-200',
        'Payout Released': 'bg-blue-100 text-blue-700 border-blue-200',
        'Refund Adjusted': 'bg-gray-100 text-gray-500 border-gray-200',
        'Dispute Hold': 'bg-red-100 text-red-700 border-red-200',
        'Not Processed': 'bg-gray-50 text-gray-400 border-gray-100',
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {status === 'Payout On Hold' || status === 'Dispute Hold' ? <Lock size={10} /> : <Unlock size={10} />}
            {status || 'Unknown'}
        </span>
    );
};

// Dynamic Google script loader
const loadGoogleMapsScript = (callback) => {
    if (window.google && window.google.maps) {
        if (callback) callback();
        return;
    }
    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (callback) callback();
        };
        document.head.appendChild(script);
    } else {
        existingScript.addEventListener('load', () => {
            if (callback) callback();
        });
    }
};

const AdminLiveTrackingMap = ({ bookingId, address, status, provider, booking }) => {
    const { socket } = useSocket();
    const [trackingState, setTrackingState] = useState({
        trackingEnabled: booking?.trackingEnabled || false,
        providerLiveLocation: booking?.providerLiveLocation || null,
        providerReached: booking?.providerReached || false,
        liveDistance: booking?.liveDistance || '',
        liveDuration: booking?.liveDuration || '',
        routeCoordinates: booking?.routeCoordinates || []
    });

    // Socket Setup
    useEffect(() => {
        if (!socket || !bookingId) return;

        socket.emit('join-booking-tracking', { bookingId });

        socket.on('tracking-started', (data) => {
            console.log('📡 Admin Tracking sync:', data);
            setTrackingState(data);
        });

        socket.on('provider-live-location', (data) => {
            console.log('📡 Admin location update:', data);
            setTrackingState(prev => ({
                ...prev,
                providerLiveLocation: { lat: data.latitude, lng: data.longitude },
                liveDistance: data.liveDistance,
                liveDuration: data.liveDuration,
                routeCoordinates: data.routeCoordinates,
                providerReached: data.providerReached
            }));
        });

        socket.on('provider-arrived', () => {
            setTrackingState(prev => ({ ...prev, providerReached: true }));
        });

        return () => {
            socket.emit('leave-booking-tracking', { bookingId });
            socket.off('tracking-started');
            socket.off('provider-live-location');
            socket.off('provider-arrived');
        };
    }, [socket, bookingId]);

    let targetLat = 28.5;
    let targetLng = 77.1;

    if (address && address.lat != null && address.lng != null) {
        const parsedLat = parseFloat(address.lat);
        const parsedLng = parseFloat(address.lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
            targetLat = parsedLat;
            targetLng = parsedLng;
        }
    }

    // Resolve provider coordinate fallback
    const providerCoords = trackingState.providerLiveLocation || (
        provider?.currentLocation?.coordinates?.length === 2 && provider.currentLocation.coordinates[0] !== 0
            ? { lat: provider.currentLocation.coordinates[1], lng: provider.currentLocation.coordinates[0] }
            : null
    );

    return (
        <div className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Live Provider Geolocation</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 font-semibold">
                    {trackingState.liveDuration && <span>ETA: {trackingState.liveDuration}</span>}
                    {trackingState.liveDistance && <span>• Distance: {trackingState.liveDistance}</span>}
                </div>
            </div>

            <div className="relative w-full h-[250px] bg-slate-100 flex items-center justify-center">
                <MapContainer center={[targetLat, targetLng]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 10 }}>
                    <TileLayer attribution={LIGHT_MAP_ATTRIBUTION} url={LIGHT_MAP_TILES} />
                    <Marker position={[targetLat, targetLng]} icon={customerIcon}>
                        <Popup>
                            <div className="font-semibold text-sm">Customer Location</div>
                            <div className="text-xs text-gray-500">Service Destination</div>
                        </Popup>
                        <Tooltip permanent direction="top" offset={[0, -35]} className="font-bold text-red-600 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-red-100">
                            Customer
                        </Tooltip>
                    </Marker>
                    {providerCoords && (
                        <Marker position={[providerCoords.lat, providerCoords.lng]} icon={providerIcon}>
                            <Popup>
                                <div className="font-semibold text-sm">Provider Location</div>
                                <div className="text-xs text-gray-500">Current Position</div>
                            </Popup>
                            <Tooltip permanent direction="top" offset={[0, -35]} className="font-bold text-green-700 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-green-100">
                                Provider
                            </Tooltip>
                        </Marker>
                    )}
                    {trackingState.routeCoordinates?.length > 0 && (
                        <Polyline positions={trackingState.routeCoordinates.map(c => [c.lat, c.lng])} color="#0D9488" weight={4} opacity={0.8} />
                    )}
                    <MapBoundsHelper providerLoc={providerCoords} targetLat={targetLat} targetLng={targetLng} />
                </MapContainer>
            </div>

            {trackingState.providerReached && (
                <div className="bg-green-50 p-2 text-center text-xs font-bold text-green-700 border-t border-green-100 flex items-center justify-center gap-1.5 animate-pulse">
                    <span>✓ Technician has arrived at the client destination!</span>
                </div>
            )}
        </div>
    );
};

const getStartPin = (b) => {
    if (!b) return 'N/A';
    return b.startPin || b.startOtp || b.pin || (b.statusHistory && b.statusHistory.find(h => h.note?.includes('START_PIN'))?.note.match(/START_PIN:(\d+)/)?.[1]) || 'N/A';
};

const getCompletionPin = (b) => {
    if (!b) return 'N/A';
    return b.completionPin || b.completionOtp || (b.statusHistory && b.statusHistory.find(h => h.note?.includes('COMPLETION_PIN'))?.note.match(/COMPLETION_PIN:(\d+)/)?.[1]) || 'N/A';
};

const CancelBookingModal = ({ isOpen, onClose, booking, complaints, onConfirm, actionLoading }) => {
    const [reasonType, setReasonType] = useState('Customer Requested');
    const [reasonText, setReasonText] = useState('');
    const [complaintId, setComplaintId] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    if (!isOpen || !booking) return null;

    const totalPaid = booking.totalAmount || 0;
    const platformFee = booking.platformFee || 0;
    const refundableAmount = ['cash'].includes(booking.paymentMethod) ? 0 : Math.max(0, totalPaid - platformFee);

    const handleConfirm = () => {
        onConfirm({
            reasonType,
            reasonText,
            complaintId,
            adminNotes
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-150">
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-base font-bold text-secondary">Cancel Booking</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cancellation Reason Type</label>
                        <select
                            value={reasonType}
                            onChange={(e) => setReasonType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            <option value="Customer Requested">Customer Requested</option>
                            <option value="Complaint Resolution">Complaint Resolution</option>
                            <option value="Provider Unavailable">Provider Unavailable</option>
                            <option value="Duplicate Booking">Duplicate Booking</option>
                            <option value="Fraud Prevention">Fraud Prevention</option>
                            <option value="Admin Decision">Admin Decision</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason Details (Mandatory)</label>
                        <textarea
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            placeholder="Provide a detailed reason..."
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link Complaint (Optional)</label>
                        <select
                            value={complaintId}
                            onChange={(e) => setComplaintId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            <option value="">Select Complaint</option>
                            {complaints.map(c => (
                                <option key={c._id} value={c._id}>
                                    {c.complaintId || c._id.slice(-8)} - {c.title}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Admin Resolution Notes (Optional)</label>
                        <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Resolution notes for the complaint..."
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                        <p className="font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">Refund Summary</p>
                        <div className="flex justify-between"><span>Total Paid:</span><PriceDisplay amount={totalPaid} type="default" /></div>
                        <div className="flex justify-between"><span>Platform Fee Retained:</span><PriceDisplay amount={platformFee} type="red-semibold" /></div>
                        <div className="flex justify-between border-t border-gray-200 pt-1 font-bold"><span>Refundable Amount:</span><PriceDisplay amount={refundableAmount} type="teal" /></div>
                        <div className="flex justify-between pt-1"><span>Refund Destination:</span><span className="font-bold text-teal-700">Customer Wallet</span></div>
                        <div className="flex justify-between"><span>Expected Refund Method:</span><span className="font-semibold text-teal-700">Wallet Transfer</span></div>
                    </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-100 text-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={actionLoading || !reasonText.trim()}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminBookingsView = () => {
    const { token, API, showToast } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const entityId = searchParams.get('entityId') || searchParams.get('bookingId');
    const [bookings, setBookings] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0
    });
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [pagination, setPagination] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            page: parseInt(params.get('page')) || 1,
            limit: 10,
            total: 0,
            pages: 0
        };
    });
    const [filters, setFilters] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            status: '',
            search: params.get('search') || '',
            paymentStatus: ''
        };
    });
    // useAdminFilter hook provides merged query utility
    const {
        filterType,
        year,
        financialYear,
        month,
        quarter,
        zoneIds,
        getMergedQuery
    } = useAdminFilter();

    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showAssignProviderModal, setShowAssignProviderModal] = useState(false);
    const [providerSearch, setProviderSearch] = useState('');

    // Cancellation enhancements states
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [bookingComplaints, setBookingComplaints] = useState([]);

    const fetchBookingComplaints = useCallback(async (bookingId) => {
        try {
            const response = await API.get(`/api/complaint?booking=${bookingId}`);
            if (response.data.success) {
                setBookingComplaints(response.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching complaints for booking:', err);
        }
    }, [API]);

    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);

            const params = {
                page: pagination.page,
                limit: pagination.limit,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
                ...getMergedQuery()
            };

            const response = await BookingService.getAllBookings(params);
            const data = response.data;

            if (data.success || response.status === 200) {
                const fetchedBookings = data.data || [];

                setBookings(fetchedBookings);
                setPagination(prev => ({
                    ...prev,
                    total: data.total || 0,
                    pages: data.pages || 1
                }));

                // Set global stats from backend instead of local calculation
                if (data.stats) {
                    setStats(data.stats);
                }
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast, filters, pagination.page, pagination.limit, getMergedQuery]);
    const handleCancelBookingByAdmin = useCallback(async (payload) => {
        setActionLoading(true);
        try {
            const bookingId = selectedBooking.booking._id;
            const res = await API.patch(`/api/admin/bookings/${bookingId}/cancel`, payload);
            if (res.data.success) {
                showToast('Booking cancelled successfully and refund processed to wallet.', 'success');
                setShowCancelModal(false);
                setShowModal(false);
                fetchBookings();
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to cancel booking', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [selectedBooking, API, showToast, fetchBookings]);



    // Search input state (independent of filters.search to enable debouncing)
    const [searchQuery, setSearchQuery] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('search') || '';
    });
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Sync debounced search to filters.search
    useEffect(() => {
        setFilters(prev => {
            if (prev.search === debouncedSearchQuery) return prev;
            return { ...prev, search: debouncedSearchQuery };
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [debouncedSearchQuery]);

    // Update filters when URL search param changes (for in-page navigation)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const searchParam = params.get('search');

        // Only update if the search filter actually changed to avoid infinite loops
        if (searchParam !== undefined && searchParam !== searchQuery) {
            setSearchQuery(searchParam || '');
        }
    }, [location.search, searchQuery]);

    // Fetch all providers for assignment — useCallback keeps reference stable
    const fetchProviders = useCallback(async () => {
        try {
            const response = await AdminService.getAllProviders();
            const data = response.data;
            setProviders(data.providers || data.data || []);
        } catch (error) {
            console.error('Error fetching providers:', error);
            showToast(error.message, 'error');
        }
    }, [showToast]);

    // --- fetchBookings definition moved above to avoid temporal dead zone ---
    // fetchBookings definition moved above

    // fetchBookings definition moved above; original removed


    // Fetch booking details
    const fetchBookingDetails = useCallback(async (bookingId) => {
        try {
            setActionLoading(true);
            const response = await BookingService.getBookingDetails(bookingId);
            const data = response.data;
            setSelectedBooking(data.data);
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching booking details:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast]);

    // Initiate cancellation from table row
    const handleInitiateCancel = useCallback(async (booking) => {
        try {
            setActionLoading(true);
            const response = await BookingService.getBookingDetails(booking._id);
            const data = response.data;
            setSelectedBooking(data.data);
            await fetchBookingComplaints(booking._id);
            setShowCancelModal(true);
        } catch (error) {
            console.error('Error initiating cancellation:', error);
            showToast(error.message || 'Failed to load booking details for cancellation', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookingComplaints]);

    useEffect(() => {
        if (entityId) {
            fetchBookingDetails(entityId);
        }
    }, [entityId, fetchBookingDetails]);

    // Delete booking
    const handleDeleteBooking = useCallback(async (bookingId) => {
        try {
            setActionLoading(true);
            await BookingService.deleteBooking(bookingId);
            showToast('Booking deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchBookings();
            setShowModal(false);
        } catch (error) {
            console.error('Error deleting booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings]);

    // Delete user booking
    const handleDeleteUserBooking = useCallback(async (userId, bookingId) => {
        try {
            setActionLoading(true);
            await BookingService.deleteUserBooking(userId, bookingId);
            showToast('User booking deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchBookings();
            setShowModal(false);
        } catch (error) {
            console.error('Error deleting user booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings]);

    // Assign provider to booking
    const handleAssignProvider = useCallback(async (bookingId, providerId) => {
        try {
            setActionLoading(true);
            await BookingService.assignProvider(bookingId, { providerId });
            showToast('Provider assigned successfully', 'success');
            fetchBookings();
            setShowAssignProviderModal(false);
            if (selectedBooking) {
                fetchBookingDetails(selectedBooking._id);
            }
        } catch (error) {
            if (error.name === 'CanceledError' || error.message === 'canceled') {
                return;
            }
            console.error('Error assigning provider:', error);
            showToast(error.response?.data?.message || error.message || 'Failed to assign provider', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings, fetchBookingDetails, selectedBooking]);

    // Reschedule booking
    const handleRescheduleBooking = useCallback(async (bookingId, newDate, newTime) => {
        try {
            setActionLoading(true);
            const body = {};
            if (newDate) body.date = newDate;
            if (newTime) body.time = newTime;

            await BookingService.updateBookingDateTimeAdmin(bookingId, body);
            showToast('Booking rescheduled successfully', 'success');
            fetchBookings();
            setShowRescheduleModal(false);
            setShowModal(false);
        } catch (error) {
            console.error('Error rescheduling booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings]);

    // Handle filter changes — useCallback avoids recreation on every render
    const handleFilterChange = useCallback((key, value) => {
        if (key === 'search') {
            setSearchQuery(value);
        } else {
            setFilters(prev => ({ ...prev, [key]: value }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, []);

    const navigateToTransaction = useCallback((bookingId) => {
        if (!bookingId) {
            showToast('No booking ID available', 'error');
            return;
        }
        navigate(`/admin/transactions?bookingId=${bookingId}`);
    }, [navigate, showToast]);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setFilters({
            status: '',
            search: '',
            paymentStatus: ''
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    // Pagination handlers
    const goToPage = useCallback((page) => {
        setPagination(prev => ({ ...prev, page }));
    }, []);

    const nextPage = useCallback(() => {
        setPagination(prev =>
            prev.page < prev.pages ? { ...prev, page: prev.page + 1 } : prev
        );
    }, []);

    const prevPage = useCallback(() => {
        setPagination(prev =>
            prev.page > 1 ? { ...prev, page: prev.page - 1 } : prev
        );
    }, []);

    // Filter providers by service location match (stable callback)
    const getFilteredProviders = useCallback((booking) => {
        if (!booking || !booking.address) return providers.filter(p => p.approved);

        return providers.filter(provider => {
            if (!provider.approved) return false;
            const providerCity = provider.serviceLocation?.city || provider.city || '';
            const bookingCity = booking.address?.city || '';

            return providerCity.toLowerCase().includes(bookingCity.toLowerCase()) ||
                bookingCity.toLowerCase().includes(providerCity.toLowerCase());
        });
    }, [providers]);

    // Memoized filtered bookings count
    const filteredBookingsCount = useMemo(() => {
        return bookings.length;
    }, [bookings]);

    // Stable handlers for BookingRow to prevent breaking memoization
    const handleOnReschedule = useCallback((b) => {
        setSelectedBooking(b);
        setShowRescheduleModal(true);
    }, []);

    const handleOnAssign = useCallback((b) => {
        setSelectedBooking(b);
        setShowAssignProviderModal(true);
    }, []);

    const handleOnDelete = useCallback((b) => {
        setDeleteConfirm({
            id: b._id,
            userId: b.customer?._id,
            type: 'booking'
        });
    }, []);

    const renderTableContent = () => {
        if (loading) {
            return <TableSkeleton rows={8} cols={7} />;
        }

        if (bookings.length === 0) {
            return (
                <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No bookings found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                    </td>
                </tr>
            );
        }

        return bookings.map((booking) => (
            <BookingRow
                key={booking._id}
                booking={booking}
                onDetails={fetchBookingDetails}
                onReschedule={handleOnReschedule}
                onAssign={handleOnAssign}
                onCancel={handleInitiateCancel}
                onDelete={handleOnDelete}
            />
        ));
    };

    // Fetch data on component mount and when filters/pagination change
    useEffect(() => {
        fetchBookings();
        fetchProviders();
    }, [filters, pagination.page, pagination.limit, filterType, year, financialYear, month, quarter, zoneIds]);

    // Generate pagination items
    const getPaginationItems = () => {
        const items = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            items.push(
                <button
                    key={i}
                    onClick={() => goToPage(i)}
                    className={`px-3 py-1 rounded-lg ${pagination.page === i
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    {i}
                </button>
            );
        }

        return items;
    };

    return (
        <div className="min-h-screen p-4 md:p-6">
            {/* Header Section */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-secondary mb-2">Bookings Management</h1>
                <p className="text-gray-600">Manage and monitor all bookings in the system</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Bookings</p>
                            <p className="text-2xl font-bold text-secondary">{stats.total}</p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded-full">
                            <BarChart2 className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded-full">
                            <AlertCircle className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Completed</p>
                            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-full">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Revenue</p>
                            <p className="text-2xl font-bold text-primary"><PriceDisplay amount={stats.revenue} type="text-only" /></p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded-full">
                            <DollarSign className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reusable Premium Filter Bar */}
            <AdminFilterBar onApply={fetchBookings} />

            {/* Local Page Filters Section */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-secondary">Local Page Filters</h3>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            Clear Local
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search bookings..."
                                value={searchQuery}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            {statusOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Payment Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                        <select
                            value={filters.paymentStatus}
                            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            {paymentStatusOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Active Filters Badges */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                    {filters.status && (
                        <span className="inline-flex items-center px-2 py-1 bg-teal-50 text-primary text-sm rounded-full border border-teal-100">
                            Status: {statusOptions.find(s => s.value === filters.status)?.label}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('status', '')} />
                        </span>
                    )}
                    {filters.paymentStatus && (
                        <span className="inline-flex items-center px-2 py-1 bg-teal-50 text-primary text-sm rounded-full border border-teal-100">
                            Payment: {paymentStatusOptions.find(p => p.value === filters.paymentStatus)?.label}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('paymentStatus', '')} />
                        </span>
                    )}
                    {filters.search && (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 text-sm font-semibold rounded-full border border-blue-100">
                                Filtered by Booking ID: {filters.search}
                                <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('search', '')} />
                            </span>
                            <button
                                onClick={() => handleFilterChange('search', '')}
                                className="text-xs text-red-500 hover:underline font-medium"
                            >
                                Clear Filter
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-semibold text-secondary">All Bookings</h3>
                        <p className="text-sm text-gray-600">
                            Showing {filteredBookingsCount} of {pagination.total} bookings
                        </p>
                    </div>
                    {/* Download Report removed as per user rule to keep it only on Earning Reports page */}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Booking ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                                    Provider
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Service & Amount
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                                    Date & Time
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {renderTableContent()}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.pages}
                    totalItems={pagination.total}
                    limit={pagination.limit}
                    onPageChange={(page) => goToPage(page)}
                />
            </div>

            {/* Booking Details Modal */}
            {showModal && selectedBooking && (() => {
                const bk = selectedBooking.booking;
                if (bk && bk.cancellationProgress) {
                    bk.refundAmount = bk.cancellationProgress.refundAmount || bk.refundAmount;
                }
                const addr = bk.address || {};
                const pay = selectedBooking.payment || {};
                const prov = selectedBooking.provider;
                const refundAmountVal = bk.cancellationProgress?.refundAmount || bk.refundAmount || 0;
                const InfoRow = ({ label, children, className = '' }) => (
                    <div className={`flex items-start justify-between gap-2 py-1 ${className}`}>
                        <span className="text-xs text-gray-500 shrink-0 w-28">{label}</span>
                        <span className="text-xs font-semibold text-secondary text-right">{children}</span>
                    </div>
                );
                const Card = ({ title, icon, children, className = '' }) => (
                    <div className={`bg-gray-50 border border-gray-100 rounded-lg p-3 ${className}`}>
                        {title && (
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                {icon}{title}
                            </p>
                        )}
                        {children}
                    </div>
                );
                const PinBadge = ({ verified }) => (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${verified ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                        {verified ? 'Verified' : 'Pending'}
                    </span>
                );
                return (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col animate-scale-up">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-base font-bold text-secondary">Booking Details</h2>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(bk.status)}`}>
                                        {getStatusIcon(bk.status)}
                                        <span className="ml-1 capitalize">{bk.status}</span>
                                    </span>
                                    {bk.isRebook ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-750 border border-teal-200 px-2 py-0.5 rounded-full animate-none" title={`Original Booking: ${bk.originalBooking?.bookingId || bk.originalBooking || 'N/A'}`}>
                                            🔄 Rebook
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                            🆕 New
                                        </span>
                                    )}
                                    {bk.isFavoriteProviderBooking && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                                            ❤️ Preferred Provider Selected
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400 font-mono">{bk.bookingId || bk._id}</span>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-1 rounded-md text-gray-400 hover:text-secondary hover:bg-gray-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body — scrollable */}
                            <div className="overflow-y-auto flex-1 p-4">
                                {/* Top row: 3 equal columns on desktop */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">

                                    {/* ── Col 1: Booking Info ── */}
                                    <Card title="Booking Info" icon={<Calendar className="w-3 h-3 text-primary" />}>
                                        <InfoRow label="Date">{formatDate(bk.date)}</InfoRow>
                                        <InfoRow label="Time">{bk.time ? formatTime(bk.time) : '—'}</InfoRow>
                                        <InfoRow label="Created">{bk.createdAt ? new Date(bk.createdAt).toLocaleDateString() : '—'}</InfoRow>
                                        <InfoRow label="Payment Method">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-750 border border-blue-200">
                                                {bk.paymentMethod || '—'}
                                            </span>
                                        </InfoRow>
                                        <InfoRow label="Service Zone">
                                            {bk.zoneId?.name ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250 font-sans">
                                                    {bk.zoneId.name} ({bk.zoneId.zoneLevel || 'city'})
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">Global/None</span>
                                            )}
                                        </InfoRow>
                                    </Card>

                                    {/* ── Col 2: Customer Info ── */}
                                    <Card title="Customer" icon={<User className="w-3 h-3 text-primary" />}>
                                        <InfoRow label="Name">{selectedBooking.customer?.name || '—'}</InfoRow>
                                        <InfoRow label="Email">{selectedBooking.customer?.email || '—'}</InfoRow>
                                        <InfoRow label="Phone">{selectedBooking.customer?.phone || '—'}</InfoRow>
                                    </Card>

                                    {/* ── Col 3: Service Address ── */}
                                    <Card title="Service Address" icon={<MapPin className="w-3 h-3 text-primary" />}>
                                        <p className="text-xs font-semibold text-secondary leading-snug">{addr.street || '—'}</p>
                                        <p className="text-xs text-gray-500">{[addr.city, addr.postalCode].filter(Boolean).join(', ')}</p>
                                        <p className="text-xs text-gray-500">{[addr.state, addr.country].filter(Boolean).join(', ')}</p>
                                        {(addr.s2CellId || addr.s2CellIdPrecise) && (
                                            <div className="mt-1.5 pt-1.5 border-t border-gray-200 space-y-1">
                                                {addr.s2CellId && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] text-gray-400">S2 L13</span>
                                                        <span className="font-mono text-[9px] text-teal-700 bg-teal-50 px-1.5 rounded">{addr.s2CellId}</span>
                                                    </div>
                                                )}
                                                {addr.s2CellIdPrecise && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] text-gray-400">S2 L15</span>
                                                        <span className="font-mono text-[9px] text-emerald-700 bg-emerald-50 px-1.5 rounded">{addr.s2CellIdPrecise}</span>
                                                    </div>
                                                )}
                                                {addr.lat && addr.lng && (
                                                    <p className="text-[9px] text-gray-400 font-mono text-right">{parseFloat(addr.lat).toFixed(5)}, {parseFloat(addr.lng).toFixed(5)}</p>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                </div>

                                {/* Main 2-col layout */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                    {/* ════ LEFT COLUMN ════ */}
                                    <div className="space-y-3">

                                        {/* Provider Card */}
                                        {prov && (
                                            <Card title="Provider" icon={<Briefcase className="w-3 h-3 text-primary" />}>
                                                <div className="flex items-center gap-2.5 mb-2">
                                                    <div className="w-9 h-9 bg-gradient-to-br from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                                        {prov.profilePicUrl && prov.profilePicUrl !== 'default-provider.jpg'
                                                            ? <img src={prov.profilePicUrl} alt="Provider" className="w-full h-full object-cover" />
                                                            : <User className="w-4 h-4 text-white" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-secondary truncate">
                                                            {prov.businessName || prov.name || '—'}
                                                            {prov.providerId && <span className="ml-1 text-[10px] text-gray-400 font-mono">[{prov.providerId}]</span>}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 flex items-center gap-1 truncate"><Mail className="w-2.5 h-2.5" />{prov.email || '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-3 border-t border-gray-100 pt-2">
                                                    <InfoRow label="Phone"><span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{prov.phone || '—'}</span></InfoRow>
                                                    <InfoRow label="Experience">{prov.experience || '0'} yrs</InfoRow>
                                                    <InfoRow label="Service Area">{prov.serviceArea || '—'}</InfoRow>
                                                    <InfoRow label="Rating"><span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-yellow-500" />{prov.rating || '—'}</span></InfoRow>
                                                </div>
                                                {prov.services?.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {prov.services.slice(0, 3).map((s, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">{s.name || s}</span>
                                                        ))}
                                                        {prov.services.length > 3 && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full">+{prov.services.length - 3}</span>}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                    <span className="text-[10px] text-gray-400">Bank Status</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${prov.bankDetails?.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {prov.bankDetails?.verified ? 'Verified' : 'Pending'}
                                                    </span>
                                                </div>
                                                {bk.assignmentSource && (
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                        <span className="text-[10px] text-gray-400">Assigned From</span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">
                                                            {bk.assignmentSource}
                                                        </span>
                                                    </div>
                                                )}
                                            </Card>
                                        )}

                                        {/* Services Booked */}
                                        <Card title="Services Booked" icon={<Briefcase className="w-3 h-3 text-primary" />}>
                                            {selectedBooking.services?.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-secondary truncate">{item.service?.title || '—'}</p>
                                                        <p className="text-[10px] text-gray-400">{item.service?.category?.name || '—'} · Qty {item.quantity || 1}</p>
                                                    </div>
                                                    <span className="shrink-0 ml-2"><PriceDisplay amount={item.price * (item.quantity || 1)} type="bold-secondary" className="text-xs" /></span>
                                                </div>
                                            ))}
                                        </Card>

                                        {/* Status Timeline */}
                                        <Card title="Status Timeline" icon={<Activity className="w-3 h-3 text-primary" />}>
                                            {[
                                                { label: 'Booking Accepted', icon: CheckCircle, activeColor: 'text-green-600', activeBg: 'bg-green-50', ts: selectedBooking.booking.statusHistory?.find(h => h.status === 'accepted')?.timestamp, fallback: 'Pending' },
                                                { label: 'Service Started', icon: Activity, activeColor: 'text-blue-600', activeBg: 'bg-blue-50', ts: bk.serviceStartedAt, fallback: 'Not started' },
                                                { label: 'Service Completed', icon: Award, activeColor: 'text-indigo-600', activeBg: 'bg-indigo-50', ts: bk.serviceCompletedAt, fallback: 'Not completed' },
                                            ].map(({ label, icon: Icon, activeColor, activeBg, ts, fallback }) => (
                                                <div key={label} className="flex items-center gap-2.5 py-1">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ts ? activeBg : 'bg-gray-50'}`}>
                                                        <Icon className={`w-3.5 h-3.5 ${ts ? activeColor : 'text-gray-300'}`} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-secondary">{label}</p>
                                                        <p className="text-[10px] text-gray-400">{ts ? new Date(ts).toLocaleString() : fallback}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </Card>

                                        {/* PIN Verification Audit */}
                                        <Card title="PIN Verification Audit" icon={<Lock className="w-3 h-3 text-primary" />}>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                {[
                                                    { label: 'Arrival PIN', pin: getStartPin(bk), verified: !!bk.serviceStartedAt, ts: bk.serviceStartedAt },
                                                    { label: 'Completion PIN', pin: getCompletionPin(bk), verified: !!bk.serviceCompletedAt, ts: bk.serviceCompletedAt },
                                                ].map(({ label, pin, verified, ts }) => (
                                                    <div key={label} className="bg-white border border-gray-200 rounded-lg p-2.5">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
                                                            <PinBadge verified={verified} />
                                                        </div>
                                                        <p className="text-lg font-black text-secondary tracking-widest font-mono">{pin}</p>
                                                        {ts && <p className="text-[9px] text-gray-400 mt-1">{new Date(ts).toLocaleString()}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                            {(bk.startVerificationLocation || bk.completionVerificationLocation) && (
                                                <div className="border-t border-gray-100 pt-2">
                                                    {bk.startVerificationLocation && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-gray-400">Start Location</span>
                                                            <a href={`https://www.google.com/maps?q=${bk.startVerificationLocation.latitude},${bk.startVerificationLocation.longitude}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
                                                                <MapPin className="w-3 h-3" /> View Map
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {bk && ['accepted', 'in-progress', 'in_progress', 'scheduled', 'arriving', 'assigned'].includes(bk.status) && (
                                                <div className="mt-2 pt-2 border-t border-gray-100">
                                                    <AdminLiveTrackingMap
                                                        bookingId={bk._id}
                                                        address={bk.address}
                                                        status={bk.status}
                                                        provider={prov}
                                                        booking={bk}
                                                    />
                                                </div>
                                            )}
                                        </Card>
                                    </div>

                                    {/* ════ RIGHT COLUMN ════ */}
                                    <div className="space-y-3">

                                        {/* Service Evidence */}
                                        <Card title="Service Evidence (Before vs After)" icon={<Activity className="w-3 h-3 text-primary" />}>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: 'Before', images: bk.providerWorkProof?.beforeImages, loc: bk.providerWorkProof?.startLocation, ts: bk.serviceStartedAt, color: 'primary', hoverBorder: 'hover:border-primary', overlay: 'bg-black/40', overlayIcon: Eye },
                                                    { label: 'After', images: bk.providerWorkProof?.afterImages, loc: bk.providerWorkProof?.completionLocation, ts: bk.serviceCompletedAt, color: 'emerald', hoverBorder: 'hover:border-emerald-500', overlay: 'bg-emerald-500/40', overlayIcon: CheckSquare },
                                                ].map(({ label, images, loc, ts, color, hoverBorder, overlay, overlayIcon: OverlayIcon }) => (
                                                    <div key={label} className="bg-white border border-gray-200 rounded-lg p-2">
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                                                            {loc && (
                                                                <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer"
                                                                    className={`text-[9px] font-bold text-${color === 'primary' ? 'primary' : 'emerald-600'} flex items-center gap-0.5 bg-${color === 'primary' ? 'primary/5' : 'emerald-50'} px-1.5 py-0.5 rounded-full hover:underline`}>
                                                                    <MapPin className="w-2.5 h-2.5" />Map
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-1">
                                                            {images?.length > 0 ? images.map((img, idx) => (
                                                                <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer"
                                                                    className={`relative aspect-square rounded overflow-hidden border border-gray-100 ${hoverBorder} transition-all group`}>
                                                                    <img src={img.url} alt={`${label} ${idx}`} className="w-full h-full object-cover" />
                                                                    <div className={`absolute inset-0 ${overlay} opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                                                                        <OverlayIcon className="w-3 h-3 text-white" />
                                                                    </div>
                                                                </a>
                                                            )) : (
                                                                <div className="col-span-2 py-3 flex items-center justify-center border border-dashed border-gray-200 rounded">
                                                                    <p className="text-[9px] text-gray-400 italic">No photos</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {ts && <p className={`text-[9px] mt-1 flex items-center gap-0.5 font-medium ${color === 'primary' ? 'text-gray-400' : 'text-emerald-600'}`}><Clock className="w-2 h-2" />{new Date(ts).toLocaleString()}</p>}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Complaint Logs */}
                                            {bk.complaintProofs?.length > 0 && (
                                                <div className="mt-2 border-t border-gray-100 pt-2">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Complaint & Dispute Logs</p>
                                                    <div className="space-y-2">
                                                        {bk.complaintProofs.map((proof, pIdx) => (
                                                            <div key={pIdx} className="bg-gray-50 p-2 rounded border border-gray-100">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${proof.uploadedBy === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-primary/10 text-primary'}`}>
                                                                        {proof.uploadedBy}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400 font-mono">{proof.createdAt ? new Date(proof.createdAt).toLocaleDateString() : '—'}</span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-700 leading-snug mb-1">{proof.message}</p>
                                                                {proof.images?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {proof.images.map((img, iIdx) => (
                                                                            <a key={iIdx} href={img.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded overflow-hidden border border-gray-200 block">
                                                                                <img src={img.url} alt={`Proof ${iIdx}`} className="w-full h-full object-cover" />
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </Card>

                                        {/* Payment & Financial */}
                                        <Card title="Payment & Financials Summary" icon={<CreditCard className="w-3 h-3 text-primary" />}>
                                            <>
                                                <div className="space-y-3">
                                                    {/* Customer Invoice Summary */}
                                                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Invoice</p>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Service Price (Gross)</span>
                                                                <PriceDisplay amount={pay.subtotal} type="secondary" />
                                                            </div>
                                                            {pay.totalDiscount > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500">Coupon Discount</span>
                                                                    <PriceDisplay amount={pay.totalDiscount} type="negative" prefix="-" />
                                                                </div>
                                                            )}
                                                            {(() => {
                                                                const visiting = bk.visitingCharge || 0;
                                                                const rain = bk.rainCharge || 0;
                                                                const traffic = bk.trafficCharge || 0;
                                                                const night = bk.nightCharge || 0;
                                                                const demand = bk.demandSurge || 0;
                                                                const platform = bk.platformFee || 0;
                                                                const custom = bk.customCharges || 0;
                                                                const totalSur = visiting + rain + traffic + night + demand + platform + custom;
                                                                return totalSur > 0 ? (
                                                                    <div className="space-y-1 pt-1 border-t border-dashed border-gray-100 mt-1">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Surges & Fees Breakdown</span>
                                                                        {visiting > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Visiting Charge</span>
                                                                                <PriceDisplay amount={visiting} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        {rain > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Rain Charge</span>
                                                                                <PriceDisplay amount={rain} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        {traffic > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Traffic Charge</span>
                                                                                <PriceDisplay amount={traffic} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        {night > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Night Charge</span>
                                                                                <PriceDisplay amount={night} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        {demand > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Demand Surge</span>
                                                                                <PriceDisplay amount={demand} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        {platform > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Platform Fee</span>
                                                                                <PriceDisplay amount={platform} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        {custom > 0 && (
                                                                            <div className="flex justify-between pl-2 text-[11px]">
                                                                                <span className="text-gray-500">Custom Charge</span>
                                                                                <PriceDisplay amount={custom} type="secondary" prefix="+" />
                                                                            </div>
                                                                        )}
                                                                        <div className="flex justify-between pl-2 text-xs font-semibold pt-1 border-t border-gray-150 mt-1">
                                                                            <span className="text-gray-600">Total Surges & Fees</span>
                                                                            <PriceDisplay amount={totalSur} type="secondary" prefix="+" />
                                                                        </div>
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                            <div className="flex justify-between border-t border-gray-100 mt-2 pt-2 text-sm font-bold">
                                                                <span className="text-secondary">Total Billed to Customer</span>
                                                                <PriceDisplay amount={pay.totalAmount} type="primary" className="text-sm" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Settlement Splits (Where the money goes) */}
                                                    <div className="bg-teal-50/10 p-3 rounded-xl border border-teal-100/60">
                                                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-2">Settlement Splits</p>
                                                        <div className="space-y-2 text-xs">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="font-semibold text-secondary">Provider Settlement</p>
                                                                    <p className="text-[9px] text-gray-400">₹{(bk.providerEarnings || 0) - (bk.providerSurgeShare || 0)} Service + ₹{bk.providerSurgeShare || 0} Surcharges</p>
                                                                </div>
                                                                <PriceDisplay amount={bk.providerEarnings} type="green-bold" className="text-sm" />
                                                            </div>
                                                            <div className="flex justify-between border-t border-teal-150 mt-1 pt-1 font-bold text-teal-700">
                                                                <div>
                                                                    <p className="font-semibold text-gray-700">Platform Earning</p>
                                                                    <p className="text-[9px] text-gray-400"><PriceDisplay amount={bk.commissionAmount || 0} type="text-only" /> Commission + <PriceDisplay amount={bk.companySurgeShare || 0} type="text-only" /> Surge + <PriceDisplay amount={bk.platformFee || 0} type="text-only" /> Fee</p>
                                                                </div>
                                                                <PriceDisplay amount={(bk.commissionAmount || 0) + (bk.companySurgeShare || 0) + (bk.platformFee || 0)} type="text-only" className="text-sm" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Payment Sources Info */}
                                                    {(pay.walletAmountUsed > 0 || pay.onlineAmountPaid > 0) && (
                                                        <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-[10px]">
                                                            <p className="font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Payment Sources</p>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                                {pay.walletAmountUsed > 0 && <span className="text-gray-500">Wallet: <PriceDisplay amount={pay.walletAmountUsed} type="bold-secondary" className="font-bold text-secondary" /></span>}
                                                                {pay.onlineAmountPaid > 0 && <span className="text-gray-500">Online: <PriceDisplay amount={pay.onlineAmountPaid} type="bold-secondary" className="font-bold text-secondary" /></span>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Cancellation Info */}
                                                    {bk.status === 'cancelled' && (
                                                        <div className="bg-red-50 p-2.5 rounded-xl border border-red-100 space-y-1 text-xs text-secondary mt-2">
                                                            <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1">Cancellation Info</p>
                                                            <div className="flex justify-between"><span className="text-gray-400">Cancelled By:</span><span className="font-semibold capitalize">{bk.cancelledBy || 'Admin'}</span></div>
                                                            <div className="flex justify-between"><span className="text-gray-400">Reason:</span><span className="font-semibold text-right max-w-[65%] truncate" title={bk.cancellationReason}>{bk.cancellationReason || '—'}</span></div>
                                                            {bk.complaintId && <div className="flex justify-between"><span className="text-gray-400">Complaint:</span><span className="font-semibold">{bk.complaintId.complaintId || bk.complaintId}</span></div>}
                                                            {(bk.cancellationProgress?.refundAmount > 0 || bk.refundAmount > 0) && (
                                                                <>
                                                                    <div className="flex justify-between"><span className="text-gray-400">Refund:</span><PriceDisplay amount={bk.refundAmount} type="teal" /></div>
                                                                    <div className="flex justify-between"><span className="text-gray-400">Refund Destination:</span><span className="font-bold text-teal-755 uppercase">Wallet</span></div>
                                                                    <div className="flex justify-between"><span className="text-gray-400">Refund Status:</span><span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 font-bold uppercase">{bk.cancellationProgress?.status || bk.refundStatus || 'Completed'}</span></div>
                                                                    <div className="flex justify-between"><span className="text-gray-400">Refund Reference:</span><span className="font-mono text-[10px]">{bk.refundReference || '—'}</span></div>
                                                                    {bk.refundProcessedAt && <div className="flex justify-between"><span className="text-gray-400">Refund Date:</span><span>{new Date(bk.refundProcessedAt).toLocaleDateString()}</span></div>}
                                                                    {(bk.platformFee > 0 || bk.platformFeeRetained > 0) && <div className="flex justify-between"><span className="text-gray-400">Platform Fee Retained:</span><PriceDisplay amount={bk.platformFee || bk.platformFeeRetained} type="red-bold" /></div>}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="border-t border-gray-100 mt-2 pt-2 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-gray-500">Payment Status</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${['paid', 'escrow_hold'].includes(pay.status) ? 'bg-green-100 text-green-700' : pay.status === 'refunded' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {pay.status === 'escrow_hold' ? 'Escrow Hold' : (pay.status || '—')}
                                                        </span>
                                                    </div>
                                                    {selectedBooking.refundData?.decision && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-gray-500">Admin Refund</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedBooking.refundData.decision === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {selectedBooking.refundData.decision}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-gray-500">Payout Status</span>
                                                        <PayoutStatusBadge status={selectedBooking.payoutStatus} />
                                                    </div>
                                                    {selectedBooking.earningHoldStatus === 'held' && selectedBooking.payoutHoldUntil && (
                                                        <p className="text-[9px] text-red-400 text-right italic">Hold until {new Date(selectedBooking.payoutHoldUntil).toLocaleDateString()}</p>
                                                    )}
                                                    {pay.details?.transactionId ? (
                                                        <div className="flex justify-between items-center pt-0.5">
                                                            <span className="text-[10px] text-gray-500">Transaction</span>
                                                            <button onClick={() => navigateToTransaction(bk.bookingId || bk._id)} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
                                                                {pay.details.transactionId} <ExternalLink className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                    {!pay.details?.transactionId && ['paid', 'escrow_hold'].includes(bk.paymentStatus) && (
                                                        <div className="flex justify-end pt-0.5">
                                                            <button onClick={() => navigateToTransaction(bk.bookingId || bk._id)} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
                                                                View Transaction <ExternalLink className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        </Card>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex justify-between items-center">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-1.5 bg-gray-100 text-secondary text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                                {['pending', 'accepted', 'assigned', 'confirmed'].includes(bk.status) && (
                                    <button
                                        onClick={() => {
                                            fetchBookingComplaints(bk._id);
                                            setShowCancelModal(true);
                                        }}
                                        className="px-5 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        Cancel Booking
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}


            {showCancelModal && selectedBooking && (
                <CancelBookingModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    booking={selectedBooking.booking}
                    complaints={bookingComplaints}
                    onConfirm={handleCancelBookingByAdmin}
                    actionLoading={actionLoading}
                />
            )}

            {/* Reschedule Booking Modal */}
            {showRescheduleModal && selectedBooking && (
                <RescheduleModal
                    isOpen={showRescheduleModal}
                    onClose={() => setShowRescheduleModal(false)}
                    onConfirm={(date, time) => {
                        handleRescheduleBooking(selectedBooking._id, date, time);
                    }}
                    actionLoading={actionLoading}
                />
            )}

            {/* Assign Provider Modal */}
            {showAssignProviderModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-secondary">Assign Provider</h3>
                                <button
                                    onClick={() => setShowAssignProviderModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Provider
                                    </label>
                                    <input
                                        type="text"
                                        list="providerOptions"
                                        value={providerSearch}
                                        onChange={(e) => setProviderSearch(e.target.value)}
                                        placeholder="Search providers..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <datalist id="providerOptions">
                                        {getFilteredProviders(selectedBooking)
                                            .filter(p =>
                                                (p.providerId && p.providerId.toString().toLowerCase().includes(providerSearch.toLowerCase())) ||
                                                (p.businessName && p.businessName.toLowerCase().includes(providerSearch.toLowerCase())) ||
                                                (p.name && p.name.toLowerCase().includes(providerSearch.toLowerCase()))
                                            )
                                            .map(provider => (
                                                <option key={provider._id} value={provider._id}>
                                                    {provider.providerId ? `[${provider.providerId}] ` : ''}{provider.businessName || provider.name} (Bookings: {provider.completedBookings || 0}, Badge: {provider.performanceBadge || provider.performanceScore?.badge || 'Bronze'}) - {provider.serviceLocation?.city || provider.city || 'N/A'}
                                                </option>
                                            ))}
                                    </datalist>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Showing providers matching the service location
                                    </p>
                                </div>

                                <div className="flex space-x-3 pt-4">
                                    <button
                                        onClick={() => setShowAssignProviderModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const providerId = providerSearch;
                                            if (providerId) {
                                                handleAssignProvider(selectedBooking._id, providerId);
                                            } else {
                                                showToast('Please select a provider', 'error');
                                            }
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Assigning...' : 'Assign Provider'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <DeleteConfirmModal
                    isOpen={!!deleteConfirm}
                    onClose={() => setDeleteConfirm(null)}
                    onConfirm={() => {
                        if (deleteConfirm.type === 'user') {
                            handleDeleteUserBooking(deleteConfirm.userId, deleteConfirm.id);
                        } else {
                            handleDeleteBooking(deleteConfirm.id);
                        }
                    }}
                    actionLoading={actionLoading}
                    title={deleteConfirm.type === 'user' ? 'Delete User Booking' : 'Delete Booking'}
                />
            )}
        </div>
    );
};

export default AdminBookingsView;
