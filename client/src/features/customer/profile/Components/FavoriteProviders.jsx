import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../../components/ui/Toast';

import { Star, Heart, ArrowLeft } from 'lucide-react';
import { getCustomerBookings } from '../../../../services/BookingService';
import { toggleFavoriteProvider } from '../../../../services/CustomerService';
import { useAuth } from '../../../../context/auth';

const FavoriteProviders = ({ profile, fetchProfile, onBack }) => {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const renderBackHeader = (title) => (
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-neutral-100">
            {onBack && (
                <button
                    onClick={onBack}
                    className="p-1 text-neutral-600 hover:text-secondary transition-colors shrink-0 flex items-center justify-center"
                    title="Back to Personal Details"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            )}
            <h2 className="text-sm font-black text-secondary uppercase tracking-wider">{title}</h2>
        </div>
    );

    const handleBookAgainFavorite = async (fp) => {
        try {
            setLoading(true);
            const res = await getCustomerBookings(new URLSearchParams({ status: 'completed' }));
            const pastBookings = res.data?.data || [];

            const originalBooking = pastBookings.find(
                b => (b.provider?._id || b.provider?.id || b.provider)?.toString() === fp.providerId?.toString()
            );

            if (originalBooking && originalBooking.services?.[0]?.service?._id) {
                navigate(`/customer/book-service/${originalBooking.services[0].service._id}`, {
                    state: { prefillBooking: originalBooking }
                });
            } else {
                toast.info("No past booking details found for this provider. Redirecting to service page...");
                navigate('/customer/services');
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to retrieve booking information.");
        } finally {
            setLoading(false);
        }
    };

    const [confirmRemoveId, setConfirmRemoveId] = useState(null);

    const handleRemoveFavorite = async (providerId) => {
        try {
            setLoading(true);
            const res = await toggleFavoriteProvider({ providerId });
            if (res.data?.success) {
                toast.success(res.data.message || 'Removed from favorites');
                if (fetchProfile) fetchProfile();
                if (refreshUser) refreshUser();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to remove favorite');
        } finally {
            setLoading(false);
        }
    };

    const favorites = profile?.favoriteProviders || [];

    return (
        <div className="space-y-4">
            {renderBackHeader('Favorite Providers')}

            {favorites.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-100 p-10 text-center shadow-sm">
                    <Heart className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-neutral-400">No favorites saved yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {favorites.map((fp) => (
                        <div key={fp.providerId} className="bg-white rounded-2xl border border-neutral-100 p-4 flex flex-col justify-between shadow-sm text-left hover:border-neutral-200 transition-all">
                            <div className="flex gap-3 items-start">
                                <img
                                    src={fp.profilePicUrl || `https://ui-avatars.com/api/?name=${fp.providerName}&background=0D9488&color=fff`}
                                    alt={fp.providerName || "Favorite provider"}
                                    loading="lazy"
                                    decoding="async"
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-xl object-cover border border-neutral-100"
                                />
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-secondary truncate">{fp.providerName}</h4>
                                    <span className="inline-block text-[9px] font-black uppercase text-primary bg-primary/5 px-2 py-0.5 rounded mt-1">
                                        {fp.category}
                                    </span>
                                    <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500 font-bold">
                                        <span className="flex items-center gap-0.5">
                                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                            {fp.rating > 0 ? fp.rating.toFixed(1) : 'New'}
                                        </span>
                                        <span>{fp.completedBookings || 0} bookings</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 border-t border-neutral-50 pt-3 mt-3 items-center justify-between">
                                {confirmRemoveId === fp.providerId ? (
                                    <div className="flex items-center gap-1.5 w-full justify-end">
                                        <span className="text-[10px] font-bold text-rose-600 mr-1">Remove?</span>
                                        <button
                                            onClick={() => setConfirmRemoveId(null)}
                                            className="px-2.5 py-1 text-[10px] font-bold text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                setConfirmRemoveId(null);
                                                handleRemoveFavorite(fp.providerId);
                                            }}
                                            disabled={loading}
                                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleBookAgainFavorite(fp)}
                                            disabled={loading}
                                            className="flex-1 py-1.5 text-[10px] font-bold text-white bg-primary rounded-lg transition-all active:scale-95 shadow-sm disabled:opacity-50"
                                        >
                                            Book Again
                                        </button>
                                        <button
                                            onClick={() => setConfirmRemoveId(fp.providerId)}
                                            disabled={loading}
                                            className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
                                        >
                                            Remove
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FavoriteProviders;
