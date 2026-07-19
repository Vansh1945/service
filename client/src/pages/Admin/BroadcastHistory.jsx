import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import { useNavigate } from 'react-router-dom';
import * as NotificationService from '../../services/NotificationService';
import {
    FiClock, FiUsers, FiLink, FiCheckCircle, FiAlertCircle,
    FiLoader, FiMessageSquare, FiRefreshCw, FiEye, FiDownload,
    FiCopy, FiTrash2, FiXCircle, FiFilter
} from 'react-icons/fi';
import { formatDate } from '../../utils/format';
import { toast } from 'react-toastify';

import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatsCard from '../../components/ui/StatsCard';

const STATUS_COLORS = {
    sent: 'bg-green-50 text-green-700 border-green-200',
    pending: 'bg-blue-50 text-blue-700 border-blue-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-50 text-gray-700 border-gray-200',
};

const BroadcastHistory = () => {
    useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [filterAudience, setFilterAudience] = useState('all');
    const [filters, setFilters] = useState({
        status: '',
        type: '',
        startDate: '',
        endDate: '',
        page: 1,
        limit: 20
    });

    const [confirmModal, setConfirmModal] = useState({ open: false, type: '', id: null, title: '' });
    const [detailModal, setDetailModal] = useState({ open: false, item: null });

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const res = await NotificationService.getBroadcastHistory({
                ...filters,
                audience: filterAudience === 'all' ? '' : filterAudience
            });
            if (res.data?.success) {
                setHistory(res.data.data || res.data.history || []);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error('Failed to load broadcast history');
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [filterAudience, filters.status, filters.type, filters.startDate, filters.endDate]);

    useEffect(() => {
        if (socket) {
            socket.on('broadcast_stats_updated', (data) => {
                setHistory(prevHistory => {
                    return prevHistory.map(item => {
                        if (item._id === data.broadcastId) {
                            return {
                                ...item,
                                totalSent: data.totalSent,
                                deliveredCount: data.deliveredCount,
                                readCount: data.readCount,
                                clickedCount: data.clickedCount
                            };
                        }
                        return item;
                    });
                });
            });

            return () => {
                socket.off('broadcast_stats_updated');
            };
        }
    }, [socket]);

    const handleAction = async (type, id) => {
        try {
            let res;
            if (type === 'delete') res = await NotificationService.deleteNotification(id);
            else if (type === 'cancel') res = await NotificationService.cancelNotification(id);
            else if (type === 'resend') res = await NotificationService.resendNotification(id);

            if (res.data.success) {
                toast.success(res.data.message || 'Action completed successfully');
                fetchHistory();
            }
        } catch (error) {
      console.error(error);
            toast.error('Action execution failed');
        } finally {
            setConfirmModal({ open: false, type: '', id: null, title: '' });
        }
    };

    const handleDuplicate = (item) => {
        // Pre-fill Compose Form by passing state to navigation
        navigate('/admin/compose-notification', {
            state: {
                preset: {
                    audience: item.audience,
                    title: item.title,
                    body: item.message,
                    url: item.url || '/',
                    priority: item.priority || 'normal',
                    targetZones: item.targetZones ? item.targetZones.map(z => z._id || z) : []
                }
            }
        });
    };

    const exportToCSV = () => {
        if (history.length === 0) {
            toast.warn('No records available to export.');
            return;
        }
        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Title,Type,Audience,Sent Date,Recipients,Delivered,Opened,Clicked,Failed,Status\n';

        history.forEach(item => {
            const title = `"${item.title.replace(/"/g, '""')}"`;
            const type = item.type || 'broadcast';
            const audience = item.audience || 'all';
            const sentDate = new Date(item.sentAt || item.createdAt).toLocaleDateString();
            const recipients = item.totalSent || 0;
            const delivered = item.deliveredCount || 0;
            const opened = item.readCount || 0;
            const clicked = item.clickedCount || 0;
            const failed = item.failureCount || 0;
            const status = item.status || 'sent';

            csvContent += `${title},${type},${audience},${sentDate},${recipients},${delivered},${opened},${clicked},${failed},${status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `broadcast_report_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV Report exported successfully.');
    };

    // Calculate Analytics Aggregate Cards
    const analytics = useMemo(() => {
        let total = history.length;
        let delivered = 0;
        let opened = 0;
        let clicked = 0;
        let failed = 0;

        history.forEach(item => {
            delivered += (item.deliveredCount || 0);
            opened += (item.readCount || 0);
            clicked += (item.clickedCount || 0);
            failed += (item.failureCount || 0);
        });

        const ctr = delivered > 0 ? ((clicked / delivered) * 100).toFixed(1) : '0.0';

        return { total, delivered, opened, ctr, failed };
    }, [history]);

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-inter">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiClock className="text-primary" /> Broadcast History
                    </h1>
                    <p className="text-gray-600 mt-1 text-sm font-inter">View complete delivery metrics, CTR engagement rates, and manage past broadcasts.</p>
                </div>
                <button
                    type="button"
                    onClick={exportToCSV}
                    className="bg-white border border-gray-300 text-gray-800 font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm text-sm"
                >
                    <FiDownload size={14} /> Export Report
                </button>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <StatsCard
                    title="Total Notifications"
                    value={analytics.total}
                />
                <StatsCard
                    title="Delivered"
                    value={analytics.delivered}
                    iconColor="text-green-600"
                    iconBg="bg-green-50"
                />
                <StatsCard
                    title="Opened"
                    value={analytics.opened}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                />
                <StatsCard
                    title="CTR (Click-Through)"
                    value={`${analytics.ctr}%`}
                />
                <StatsCard
                    title="Failed"
                    value={analytics.failed}
                    iconColor="text-red-650"
                    iconBg="bg-red-50"
                    className="col-span-2 md:col-span-1"
                />
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><FiFilter /> Filters:</div>
                    <select
                        value={filterAudience}
                        onChange={(e) => setFilterAudience(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                    >
                        <option value="all">All Audiences</option>
                        <option value="customer">Customers</option>
                        <option value="provider">Providers</option>
                    </select>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                    >
                        <option value="">All Statuses</option>
                        <option value="sent">Sent</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                        value={filters.type}
                        onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                    >
                        <option value="">All Types</option>
                        <option value="broadcast">Broadcast</option>
                        <option value="system">System</option>
                        <option value="booking">Booking</option>
                        <option value="payment">Payment</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                    />
                </div>
            </div>

            {/* Grid/Table history list */}
            {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-white border rounded-2xl">
                    <FiLoader className="animate-spin text-primary mb-2" size={24} />
                    <span className="text-sm">Loading history...</span>
                </div>
            ) : history.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-white border border-dashed rounded-2xl">
                    <FiMessageSquare className="mb-2 opacity-35" size={24} />
                    <span className="text-sm">No notification records match criteria.</span>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left text-xs font-semibold text-gray-700">
                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-5 py-3.5">Notification Title</th>
                                    <th className="px-5 py-3.5">Type</th>
                                    <th className="px-5 py-3.5">Target</th>
                                    <th className="px-5 py-3.5">Sent Date</th>
                                    <th className="px-5 py-3.5">Recipients</th>
                                    <th className="px-5 py-3.5">Delivered</th>
                                    <th className="px-5 py-3.5">Opened</th>
                                    <th className="px-5 py-3.5">Clicked / CTR</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {history.map(item => {
                                    const ctrVal = item.deliveredCount > 0 ? ((item.clickedCount || 0) / item.deliveredCount * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-4 max-w-[200px] truncate">
                                                <div className="font-bold text-gray-900 truncate">{item.title}</div>
                                                <div className="text-[10px] text-gray-400 truncate mt-0.5">{item.message}</div>
                                            </td>
                                            <td className="px-5 py-4 uppercase font-mono text-[10px] text-gray-500">{item.type || 'broadcast'}</td>
                                            <td className="px-5 py-4 capitalize">{item.audience || 'all'}</td>
                                            <td className="px-5 py-4">{formatDate(item.sentAt || item.createdAt)}</td>
                                            <td className="px-5 py-4 font-bold">{item.totalSent || 0}</td>
                                            <td className="px-5 py-4 text-green-600 font-bold">{item.deliveredCount || 0}</td>
                                            <td className="px-5 py-4 text-blue-600 font-bold">{item.readCount || 0}</td>
                                            <td className="px-5 py-4">
                                                <span className="font-bold">{item.clickedCount || 0}</span>
                                                <span className="text-[10px] text-gray-450 ml-1.5">({ctrVal}%)</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold ${STATUS_COLORS[item.status] || STATUS_COLORS.sent}`}>
                                                    {item.status || 'sent'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailModal({ open: true, item })}
                                                        className="text-gray-500 hover:text-primary p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                        title="View Details"
                                                    >
                                                        <FiEye size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicate(item)}
                                                        className="text-gray-500 hover:text-primary p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                        title="Duplicate"
                                                    >
                                                        <FiCopy size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmModal({ open: true, type: 'resend', id: item._id, title: 'Resend Notification?' })}
                                                        className="text-gray-500 hover:text-green-600 p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                        title="Resend"
                                                    >
                                                        <FiRefreshCw size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmModal({ open: true, type: 'delete', id: item._id, title: 'Delete from history?' })}
                                                        className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmModal.open}
                onClose={() => setConfirmModal({ open: false, type: '', id: null, title: '' })}
                onConfirm={() => handleAction(confirmModal.type, confirmModal.id)}
                title={confirmModal.title}
                message={confirmModal.type === 'delete'
                    ? 'Are you sure? This will remove the notification record from history.'
                    : 'This will re-route & re-broadcast this notification alert immediately.'}
                type={confirmModal.type === 'delete' ? 'danger' : 'confirm'}
                confirmText={confirmModal.type === 'delete' ? 'Delete' : 'Resend'}
            />

            {/* Details Modal */}
            <Modal
                isOpen={detailModal.open}
                onClose={() => setDetailModal({ open: false, item: null })}
                title="Notification Analytics Details"
            >
                {detailModal.item && (
                    <div className="space-y-4 text-xs font-semibold text-gray-750">
                        <div className="border bg-gray-50 p-3.5 rounded-xl">
                            <div className="text-[10px] text-gray-400 uppercase">Title</div>
                            <div className="text-sm font-bold text-gray-900 mt-0.5">{detailModal.item.title}</div>
                            <div className="text-[10px] text-gray-400 uppercase mt-2">Message</div>
                            <div className="text-gray-700 mt-0.5 whitespace-pre-wrap">{detailModal.item.message}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="border p-3.5 rounded-xl bg-white">
                                <div className="text-[10px] text-gray-400 uppercase">Target Audience</div>
                                <div className="text-sm font-bold capitalize mt-0.5">{detailModal.item.audience || 'all'}</div>
                            </div>
                            <div className="border p-3.5 rounded-xl bg-white">
                                <div className="text-[10px] text-gray-400 uppercase">Priority</div>
                                <div className="text-sm font-bold capitalize mt-0.5">{detailModal.item.priority || 'normal'}</div>
                            </div>
                            <div className="border p-3.5 rounded-xl bg-white">
                                <div className="text-[10px] text-gray-400 uppercase">CTA URL Route</div>
                                <div className="text-sm font-mono truncate mt-0.5" title={detailModal.item.url}>{detailModal.item.url || '/'}</div>
                            </div>
                            <div className="border p-3.5 rounded-xl bg-white">
                                <div className="text-[10px] text-gray-400 uppercase">Status</div>
                                <div className="text-sm font-bold capitalize mt-0.5">{detailModal.item.status || 'sent'}</div>
                            </div>
                        </div>

                        <div className="border p-3.5 rounded-xl bg-gray-50 space-y-2">
                            <div className="text-[10px] font-black text-gray-400 uppercase">Delivery & Response Funnel</div>
                            <div className="flex justify-between items-center text-xs py-1 border-b">
                                <span>Recipients Target:</span>
                                <span className="font-bold">{detailModal.item.totalSent || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-1 border-b">
                                <span>Delivered:</span>
                                <span className="font-bold text-green-600">{detailModal.item.deliveredCount || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-1 border-b">
                                <span>Opened (Read):</span>
                                <span className="font-bold text-blue-600">{detailModal.item.readCount || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-1 border-b">
                                <span>Clicked CTA:</span>
                                <span className="font-bold text-orange-600">{detailModal.item.clickedCount || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-1">
                                <span>Click Through Rate (CTR):</span>
                                <span className="font-bold text-primary">
                                    {detailModal.item.deliveredCount > 0 ? ((detailModal.item.clickedCount || 0) / detailModal.item.deliveredCount * 100).toFixed(1) : '0.0'}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default BroadcastHistory;
