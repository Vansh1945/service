import { useState, useEffect } from 'react';
import { Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { getWalletHistory } from '../../../../services/CustomerService';
import { formatCurrency, formatDateTime } from '../../../../utils/format';
import usePagination from '../../../../hooks/usePagination';
import Pagination from '../../../../components/ui/Pagination';

const WalletActivity = ({ profile, onBack }) => {
    const [transactions, setTransactions] = useState({ data: [], summary: {} });
    const [loading, setLoading] = useState(false);

    const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

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

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                setLoading(true);
                const res = await getWalletHistory();
                if (res.data?.success) {
                    const data = res.data.data || [];
                    setTransactions({
                        data,
                        summary: {}
                    });
                    setPaginationData({
                        total: data.length,
                        limit: 10
                    });
                }
            } catch (error) {
                console.error('Failed to fetch wallet history', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, [setPaginationData]);

    const debitedAmount = transactions?.data
        ?.filter(t => t.type === 'debit')
        ?.reduce((acc, t) => acc + t.amount, 0) || 0;

    const startIndex = (currentPage - 1) * limit;
    const paginatedTransactions = transactions?.data?.slice(startIndex, startIndex + limit) || [];

    return (
        <div className="space-y-4">
            {renderBackHeader('Wallet & Activity')}
            
            {/* Wallet Card */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm flex flex-row items-center justify-between gap-2 text-left w-full">
                <div>
                    <p className="text-neutral-400 text-[10px] font-black uppercase tracking-wider">Available Balance</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-secondary tracking-tight mt-1">
                        {formatCurrency(profile?.wallet?.availableBalance || 0)}
                    </h3>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    <div className="bg-neutral-50 rounded-xl px-2.5 py-1.5 border border-neutral-100 text-left min-w-[75px] sm:min-w-[90px]">
                        <p className="text-[8px] text-neutral-400 font-bold uppercase">Refunds</p>
                        <p className="text-[11px] sm:text-xs font-bold text-secondary mt-0.5">{formatCurrency(profile?.wallet?.totalRefunded || 0)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl px-2.5 py-1.5 border border-neutral-100 text-left min-w-[75px] sm:min-w-[90px]">
                        <p className="text-[8px] text-neutral-400 font-bold uppercase">Debited</p>
                        <p className="text-[11px] sm:text-xs font-bold text-secondary mt-0.5">
                            {formatCurrency(debitedAmount)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Transaction History (Google Pay Style) */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50/50 flex items-center justify-between border-b border-neutral-100">
                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Transaction History</h3>
                    <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {transactions?.data?.length || 0} entries
                    </span>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="text-center py-10 animate-pulse">
                            <Wallet className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-neutral-400">Loading history...</p>
                        </div>
                    ) : paginatedTransactions.length > 0 ? (
                        <div className="divide-y divide-neutral-100">
                            {paginatedTransactions.map(entry => {
                                const isCredit = entry.type === 'credit';
                                const amountColor = isCredit ? 'text-emerald-600' : 'text-neutral-700';
                                const IconComponent = isCredit ? ArrowDownLeft : ArrowUpRight;
                                const iconBg = isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-600';

                                return (
                                    <div key={entry._id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            <div className="text-left min-w-0">
                                                 <p className="text-xs font-bold text-secondary leading-tight truncate" title={entry.reason}>{entry.reason}</p>
                                                 <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                     <p className="text-[9px] text-neutral-400">{formatDateTime(entry.createdAt)}</p>
                                                     {entry.booking?.bookingId && (
                                                         <>
                                                             <span className="w-1 h-1 rounded-full bg-neutral-300" />
                                                             <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">
                                                                 ID: {entry.booking.bookingId}
                                                             </span>
                                                         </>
                                                     )}
                                                 </div>
                                             </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className={`text-xs font-black ${amountColor}`}>
                                                {isCredit ? '+' : '−'}{formatCurrency(entry.amount)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <Wallet className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-neutral-400">No activity yet</p>
                        </div>
                    )}
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    limit={limit}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};

export default WalletActivity;
