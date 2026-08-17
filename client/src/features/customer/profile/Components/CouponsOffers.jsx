import { useEffect } from 'react';
import { Gift, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../../context/auth';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { getAvailableCoupons } from '../../../../services/CouponService';

const CouponsOffers = ({ coupons, setCoupons, couponsLoading, setCouponsLoading, profile, onBack }) => {
    const { user } = useAuth();

    const renderBackHeader = (title) => (
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-neutral-100 xl:hidden">
            <button onClick={onBack} className="p-1 rounded-full hover:bg-neutral-100 transition-colors">
                <ArrowLeft className="w-4.5 h-4.5 text-neutral-600" />
            </button>
            <h2 className="text-sm font-black text-secondary uppercase tracking-wider">{title}</h2>
        </div>
    );

    useEffect(() => {
        const fetchCoupons = async () => {
            try {
                setCouponsLoading(true);
                const res = await getAvailableCoupons();
                if (res.data?.success) {
                    setCoupons(res.data.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch coupons', err);
            } finally {
                setCouponsLoading(false);
            }
        };

        if (user) {
            fetchCoupons();
        }
    }, [user, setCoupons, setCouponsLoading]);

    return (
        <div className="space-y-4">
            {renderBackHeader('Offers & Coupons')}

            {couponsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />)}
                </div>
            ) : coupons.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-neutral-100 p-8 shadow-sm">
                    <Gift className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-neutral-400">No coupons available</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {coupons.map(coupon => {
                        const userId = user?.id || user?._id;
                        const hasRedeemed = coupon?.usedBy?.some(u => {
                            const uId = u?.user?._id || u?.user || u;
                            return uId && userId && uId.toString() === userId.toString();
                        });
                        const isUsed = hasRedeemed || (coupon.isFirstBooking && profile.firstBookingUsed);

                        return (
                            <div key={coupon._id} className="bg-white border border-neutral-100 rounded-xl p-4 shadow-sm flex flex-col justify-between text-left hover:border-primary/20 transition-all">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">
                                            {coupon.discountValue}% OFF
                                        </span>
                                        {isUsed && (
                                            <span className="text-[9px] font-black uppercase bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">
                                                Used
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-xs font-bold text-secondary">{coupon.code}</h4>
                                    <p className="text-[10px] text-neutral-400 mt-1">Min Order: {formatCurrency(coupon.minBookingValue)}</p>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-50">
                                    <span className="text-[9px] text-neutral-400">Exp: {formatDate(coupon.expiryDate)}</span>
                                    <button
                                        onClick={() => {
                                            if (isUsed) return;
                                            navigator.clipboard.writeText(coupon.code);
                                            toast.success(`Copied: ${coupon.code}`);
                                        }}
                                        disabled={isUsed}
                                        className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors ${isUsed
                                                ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                                                : 'bg-neutral-50 hover:bg-neutral-100 text-primary border-neutral-150'
                                            }`}
                                    >
                                        {isUsed ? 'Used' : 'Apply Code'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CouponsOffers;
