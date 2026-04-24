import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/auth';
import { getSocket } from '../socket/socket';
import { Bell, X, Check, CheckCheck, BookOpen, CreditCard, AlertCircle } from 'lucide-react';

import * as NotificationService from '../services/NotificationService';

const NotificationBell = () => {
    const { token, API, user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            setLoading(true);
            const res = await NotificationService.getNotifications({ limit: 15 });
            if (res.data?.success) {
                setNotifications(res.data.data || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Initial fetch
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time updates via socket
    useEffect(() => {
        if (!token) return;
        const socket = getSocket();
        if (!socket) return;

        const handleNew = (notification) => {
            setNotifications(prev => [notification, ...prev].slice(0, 15));
            setUnreadCount(c => c + 1);
        };

        socket.on('new_notification', handleNew);
        return () => socket.off('new_notification', handleNew);
    }, [token]);

    // Request browser notification permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markRead = async (id) => {
        try {
            await NotificationService.markRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(c => Math.max(0, c - 1));
        } catch (err) { console.error(err); }
    };

    const markAllRead = async () => {
        try {
            await NotificationService.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) { console.error(err); }
    };

    const getIcon = (type) => {
        const cls = 'w-4 h-4';
        switch (type) {
            case 'booking': return <BookOpen className={`${cls} text-blue-500`} />;
            case 'payment': return <CreditCard className={`${cls} text-green-500`} />;
            case 'withdrawal': return <CreditCard className={`${cls} text-purple-500`} />;
            default: return <AlertCircle className={`${cls} text-gray-500`} />;
        }
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="relative overflow-visible z-[9999]" ref={dropdownRef}>
            {/* Optional UX Fix: Mobile Backdrop to close dropdown */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 sm:hidden bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Bell Button */}
            <button
                onClick={() => { setIsOpen(o => !o); if (!isOpen) fetchNotifications(); }}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown 
                1 & 2: Set fixed, top 60-80px, left 50%, -translate-x-1/2, w-95vw on mobile
                On desktop (sm:): absolute, right-0, top-full, w-80, remove translate
            */}
            {isOpen && (
                <div className="fixed sm:absolute top-[70px] sm:top-full left-1/2 sm:left-auto sm:right-0 -translate-x-1/2 sm:translate-x-0 mt-2 w-[95vw] sm:w-80 max-h-[70vh] bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-xs text-primary hover:text-teal-700 flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3 h-3" /> Mark all read
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-200 rounded">
                                <X className="w-3 h-3 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1 h-full max-h-[55vh] sm:max-h-80">
                        {loading ? (
                            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-6 text-center">
                                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n._id}
                                    onClick={() => !n.isRead && markRead(n._id)}
                                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex-shrink-0 p-1.5 bg-gray-100 rounded-full">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className={`text-sm font-medium truncate ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {n.title}
                                                </p>
                                                {!n.isRead && (
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                                            <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="px-4 py-2 text-center border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={fetchNotifications}
                                className="text-xs text-primary hover:text-teal-700"
                            >
                                Refresh
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
