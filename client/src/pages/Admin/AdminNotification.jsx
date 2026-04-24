import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as NotificationService from '../../services/NotificationService';
import {
    FiBell, FiSend, FiUsers, FiLink, FiCheckCircle, FiAlertCircle,
    FiLoader, FiMessageSquare, FiTarget, FiClock, FiRefreshCw, FiSmile
} from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';

// ─── Audience Options ────────────────────────────────────────────────────────
const AUDIENCE_OPTIONS = [
    { value: 'all',      label: 'All Users',      desc: 'Customers + Providers', icon: '👥' },
    { value: 'customer', label: 'Customers',      desc: 'Registered customers',  icon: '🛒' },
    { value: 'provider', label: 'Providers',      desc: 'Service providers',     icon: '🔧' },
];

// ─── Quick Deep-link Suggestions ─────────────────────────────────────────────
const QUICK_LINKS = [
    { label: 'Home',         url: '/'                        },
    { label: 'Services',     url: '/customer/services'       },
    { label: 'Bookings',     url: '/customer/bookings'       },
    { label: 'Providers',    url: '/provider/dashboard'      },
];

// ─── Notification Type Presets ────────────────────────────────────────────────
const PRESETS = [
    {
        label:    '🎉 Festival Offer',
        title:    'Special Festival Discount!',
        body:     'Get up to 30% off on all services this festive season. Book now!',
        url:      '/customer/services',
        audience: 'all',
    },
    {
        label:    '📅 Booking Reminder',
        title:    'Your Service is Due Soon',
        body:     "Don't forget your upcoming service booking. Stay on schedule!",
        url:      '/customer/bookings',
        audience: 'customer',
    },
    {
        label:    '🔔 Provider Alert',
        title:    'New Opportunity',
        body:     'New service requests are available in your area. Check dashboard.',
        url:      '/provider/dashboard',
        audience: 'provider',
    },
];

// ─── Component ────────────────────────────────────────────────────────────────
const AdminNotification = () => {
    const { token, API } = useAuth();

    const [form, setForm] = useState({
        audience: 'all',
        title:    '',
        body:     '',
        url:      '/',
        scheduledTime: '',
    });
    const [isScheduled, setIsScheduled] = useState(false);
    const [status,  setStatus]  = useState(null); // null | 'loading' | 'success' | 'error'
    const [result,  setResult]  = useState(null);
    const [message, setMessage] = useState('');
    const [showPicker, setShowPicker] = useState(null); // 'title' | 'body' | null
    const [logoLoaded, setLogoLoaded] = useState(false);

    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [filter, setFilter] = useState('all');

    const filteredHistory = history.filter(h => filter === 'all' || h.audience === filter);

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const res = await NotificationService.getBroadcastHistory();
            if (res.data?.success) {
                setHistory(res.data.history);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleResend = (item) => {
        applyPreset({
            audience: item.audience,
            title: item.title,
            body: item.message,
            url: item.url || '/'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const applyPreset = (preset) => {
        setForm({
            audience: preset.audience,
            title:    preset.title,
            body:     preset.body,
            url:      preset.url,
        });
        setStatus(null);
        setResult(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.title.trim() || !form.body.trim()) {
            setStatus('error');
            setMessage('Title and message are required.');
            return;
        }

        setStatus('loading');
        setResult(null);

        try {
            const res = await NotificationService.sendBroadcast({
                audience: form.audience,
                title:    form.title.trim(),
                body:     form.body.trim(),
                url:      form.url.trim() || '/',
                type:     'broadcast',
                scheduledTime: isScheduled && form.scheduledTime ? form.scheduledTime : null,
            });

            const data = res.data;

            if (data.success) {
                setStatus('success');
                setMessage(data.message || 'Broadcast scheduled successfully!');
                setResult(data.data);
                fetchHistory(); // Refresh history
            } else {
                setStatus('error');
                setMessage(data.message || 'Broadcast failed. Check if users have notifications enabled.');
                setResult(data.data || null);
            }
        } catch (err) {
            console.error('[AdminNotification] Error:', err);
            setStatus('error');
            setMessage('Network error. Please check your connection and try again.');
        }
    };

    const resetForm = () => {
        setForm({ audience: 'all', title: '', body: '', url: '/', scheduledTime: '' });
        setIsScheduled(false);
        setStatus(null);
        setResult(null);
        setMessage('');
        setShowPicker(null);
    };

    const handleEmojiClick = (emojiObj) => {
        if (showPicker === 'title') {
            setForm(prev => ({ ...prev, title: prev.title + emojiObj.emoji }));
        } else if (showPicker === 'body') {
            setForm(prev => ({ ...prev, body: prev.body + emojiObj.emoji }));
        }
        setShowPicker(null); // Optional: close picker after select, or leave open for multiple emojis
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            
            {/* ── Page Header ── */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiBell className="text-primary" /> Broadcast Notification
                    </h1>
                    <p className="text-gray-600 mt-1">Send real-time push notifications to your users via Firebase Cloud Messaging.</p>
                </div>
            </div>

            {/* ── Main Layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                
                {/* ── Left Column: Compose Form ── */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-5 md:p-6">
                        <div className="flex items-center mb-6 border-b pb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Compose Notification</h2>
                        </div>

                        {/* Audience Selector */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <FiTarget className="text-primary" /> Target Audience *
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {AUDIENCE_OPTIONS.map(opt => (
                                    <label
                                        key={opt.value}
                                        className={`relative flex flex-col p-4 cursor-pointer rounded-lg border-2 transition-all duration-200 ${
                                            form.audience === opt.value 
                                            ? 'border-primary bg-primary/5' 
                                            : 'border-gray-200 hover:border-primary/30 bg-gray-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="audience"
                                            value={opt.value}
                                            checked={form.audience === opt.value}
                                            onChange={handleChange}
                                            className="sr-only"
                                        />
                                        <div className="text-2xl mb-2">{opt.icon}</div>
                                        <span className={`font-semibold text-sm ${form.audience === opt.value ? 'text-primary' : 'text-gray-800'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="text-xs text-gray-500 mt-1">{opt.desc}</span>
                                        
                                        {/* Status checkmark */}
                                        {form.audience === opt.value && (
                                            <div className="absolute top-3 right-3 text-primary">
                                                <FiCheckCircle size={18} />
                                            </div>
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-5">
                            {/* Title */}
                            <div className="relative">
                                <label htmlFor="notif-title" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <FiMessageSquare className="text-gray-400" /> Notification Title *
                                </label>
                                <div className="relative">
                                    <input
                                        id="notif-title"
                                        type="text"
                                        name="title"
                                        value={form.title}
                                        onChange={handleChange}
                                        placeholder="e.g. Special Offer Today! 🎉"
                                        maxLength={80}
                                        required
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors duration-200"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPicker(prev => prev === 'title' ? null : 'title')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-primary transition-colors rounded-full hover:bg-gray-100"
                                        title="Add Emoji"
                                    >
                                        <FiSmile size={18} />
                                    </button>
                                </div>
                                <div className="text-xs text-gray-400 text-right mt-1">{form.title.length}/80 chars</div>
                                
                                {showPicker === 'title' && (
                                    <div className="absolute z-50 mt-1 right-0 w-[300px] max-w-[calc(100vw-3rem)] sm:max-w-none shadow-2xl rounded-xl border border-gray-100">
                                        <EmojiPicker onEmojiClick={handleEmojiClick} skinTonesDisabled width="100%" height={380} />
                                    </div>
                                )}
                            </div>

                            {/* Message */}
                            <div className="relative">
                                <label htmlFor="notif-body" className="block text-sm font-medium text-gray-700 mb-1">
                                    Message Body *
                                </label>
                                <div className="relative">
                                    <textarea
                                        id="notif-body"
                                        name="body"
                                        value={form.body}
                                        onChange={handleChange}
                                        placeholder="Write your notification message here... 🚀🔥⏱️"
                                        maxLength={200}
                                        required
                                        rows={3}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors duration-200 resize-y"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPicker(prev => prev === 'body' ? null : 'body')}
                                        className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-primary transition-colors rounded-full hover:bg-gray-100"
                                        title="Add Emoji"
                                    >
                                        <FiSmile size={18} />
                                    </button>
                                </div>
                                <div className="text-xs text-gray-400 text-right mt-1">{form.body.length}/200 chars</div>

                                {showPicker === 'body' && (
                                    <div className="absolute z-50 mt-1 right-0 w-[300px] max-w-[calc(100vw-3rem)] sm:max-w-none shadow-2xl rounded-xl border border-gray-100">
                                        <EmojiPicker onEmojiClick={handleEmojiClick} skinTonesDisabled width="100%" height={380} />
                                    </div>
                                )}
                            </div>

                            {/* Deep Link URL */}
                            <div>
                                <label htmlFor="notif-url" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <FiLink className="text-gray-400" /> Deep Link URL <span className="text-gray-400 font-normal">(on click)</span>
                                </label>
                                <input
                                    id="notif-url"
                                    type="text"
                                    name="url"
                                    value={form.url}
                                    onChange={handleChange}
                                    placeholder="/customer/services"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm transition-colors duration-200"
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {QUICK_LINKS.map(ql => (
                                        <button
                                            key={ql.url}
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, url: ql.url }))}
                                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                                form.url === ql.url 
                                                ? 'bg-primary/10 border-primary text-primary font-medium' 
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {ql.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scheduling Section */}
                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input 
                                        type="checkbox" 
                                        checked={isScheduled} 
                                        onChange={(e) => setIsScheduled(e.target.checked)}
                                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                        <FiClock className="text-primary" /> Schedule for later
                                    </span>
                                </label>

                                {isScheduled && (
                                    <div className="pl-6 animate-fade-in">
                                        <input
                                            type="datetime-local"
                                            name="scheduledTime"
                                            value={form.scheduledTime}
                                            onChange={handleChange}
                                            min={new Date().toISOString().slice(0, 16)}
                                            required={isScheduled}
                                            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors duration-200 text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5">
                                            Notification will be automatically dispatched at the selected time.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Banners */}
                        {status === 'success' && (
                            <div className="mt-6 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex gap-3 items-start">
                                <FiCheckCircle className="mt-0.5 flex-shrink-0 text-green-500" size={18} />
                                <div>
                                    <h4 className="font-semibold text-sm">{message}</h4>
                                    {result && (
                                        <p className="text-xs mt-1 text-green-600">
                                            Successfully sent to {result.sent} devices. ({result.total} total targets)
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="mt-6 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex gap-3 items-start">
                                <FiAlertCircle className="mt-0.5 flex-shrink-0 text-red-500" size={18} />
                                <div>
                                    <h4 className="font-semibold text-sm">{message}</h4>
                                    {result && (
                                        <p className="text-xs mt-1 text-red-600">
                                            Failed for {result.failed} devices.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-8 pt-5 border-t flex flex-col sm:flex-row gap-3">
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="flex-1 bg-primary hover:bg-teal-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {status === 'loading' ? (
                                    <><FiLoader className="animate-spin" /> Sending...</>
                                ) : (
                                    <><FiSend /> Broadcast Alert</>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="sm:w-32 bg-white border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Right Column: Preview & Presets ── */}
                <div className="flex flex-col gap-6">
                    
                    {/* Live Preview Card */}
                    <div className="bg-white rounded-lg shadow-sm border p-5">
                        <h3 className="text-sm font-bold text-gray-800 mb-4 px-1">Native Preview</h3>
                        
                        <div className="bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200/60">
                            {/* Device Header Simulator */}
                            <div className="bg-gray-800 px-3 py-1.5 flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                            </div>
                            
                            {/* Alert Body Simulator */}
                            <div className="p-4 bg-white/90 m-2 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 overflow-hidden">
                                        {!logoLoaded && <FiBell className="text-primary" size={18} />}
                                        <img
                                            src="/icon-192.png"
                                            alt="App"
                                            className={`w-8 h-8 object-contain transition-opacity duration-200 ${logoLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                                            onLoad={() => setLogoLoaded(true)}
                                            onError={() => setLogoLoaded(false)}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900 truncate">
                                            {form.title || "Notification Title"}
                                        </div>
                                        <div className="text-xs text-gray-600 line-clamp-2 mt-0.5 leading-relaxed">
                                            {form.body || "Your message body will appear here..."}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs px-1 text-gray-500">
                            <div className="flex items-center gap-1">
                                <FiUsers className="text-primary" />
                                <span className="capitalize">{form.audience}</span>
                            </div>
                            <div className="flex items-center gap-1 max-w-[120px] truncate">
                                <FiLink className="text-primary" />
                                <span className="truncate">{form.url}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Presets Menu */}
                    <div className="bg-white rounded-lg shadow-sm border p-5">
                        <h3 className="text-sm font-bold text-gray-800 mb-3 px-1">Quick Presets</h3>
                        <div className="space-y-2">
                            {PRESETS.map((preset, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => applyPreset(preset)}
                                    className="w-full text-left p-3 rounded-lg border border-gray-100 bg-gray-50 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                                >
                                    <div className="font-semibold text-sm text-gray-800 group-hover:text-primary transition-colors">{preset.label}</div>
                                    <div className="text-xs text-gray-500 mt-1 truncate">{preset.title}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Notification History ── */}
            <div className="bg-white rounded-lg shadow-sm border p-5 md:p-6 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <FiClock className="text-primary" /> Broadcast History
                    </h2>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap overflow-x-auto whitespace-nowrap scrollbar-hide p-1 bg-gray-100 rounded-lg">
                        {['all', 'customer', 'provider'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                                    filter === f 
                                    ? 'bg-white text-primary shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                        <FiLoader className="animate-spin text-primary mb-2" size={24} />
                        <span className="text-sm">Loading logs...</span>
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <div className="py-6 sm:py-10 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <FiBell className="mb-2 opacity-40" size={24} />
                        <span className="text-sm font-medium">No broadcast history found</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredHistory.map(item => (
                            <div key={item._id} className="border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all bg-white relative group">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{item.message}</p>
                                    </div>
                                    <button
                                        onClick={() => handleResend(item)}
                                        className="flex-shrink-0 text-primary bg-primary/10 hover:bg-primary hover:text-white px-2 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                                        title="Reuse exactly this template"
                                    >
                                        <FiRefreshCw size={12} /> <span className="hidden sm:inline">Resend</span>
                                    </button>
                                </div>
                                
                                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                        <FiUsers className="text-primary/70" />
                                        <span className="capitalize">{item.audience}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 max-w-[120px] truncate">
                                        <FiLink className="text-primary/70" />
                                        <span className="truncate">{item.url || '/'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <FiClock className="text-primary/70" />
                                        <span>{new Date(item.sentAt || item.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">
                                        Tgt: {item.totalSent || 0}
                                    </span>
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                                        OK: {item.successCount || 0}
                                    </span>
                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                                        Fail: {item.failureCount || 0}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminNotification;
