import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../../context/auth';
import { motion } from 'framer-motion';
import { useSocket } from '../../../socket/SocketContext';
import * as NotificationService from '../../../services/NotificationService';
import {
    FiBell, FiSend, FiUsers, FiLink, FiCheckCircle, FiAlertCircle,
    FiLoader, FiMessageSquare, FiTarget, FiClock, FiSmile, FiLayers, FiImage, FiUploadCloud
} from 'react-icons/fi';
const EmojiPicker = lazy(() => import('emoji-picker-react'));

import { toast } from '../../../components/ui/Toast';

import * as ZoneService from '../../../services/ZoneService';
import HierarchicalZoneSelector from '../../../components/HierarchicalZoneSelector';

const AUDIENCE_OPTIONS = [
    { value: 'all', label: 'All Users', desc: 'Customers + Providers + Admins', icon: '👥' },
    { value: 'customer', label: 'Customers', desc: 'Registered customers', icon: '🛒' },
    { value: 'provider', label: 'Providers', desc: 'Service providers', icon: '🔧' },
];

const QUICK_LINKS = [
    { label: 'Home', url: '/' },
    { label: 'Services', url: '/customer/services' },
    { label: 'Bookings', url: '/customer/bookings' },
    { label: 'Providers', url: '/provider/dashboard' },
];

const ComposeNotification = () => {
    useAuth();
    const { socket } = useSocket();

    const [form, setForm] = useState({
        audience: 'all',
        providerStatus: 'all', // 'all' | 'approved' | 'pending'
        title: '',
        body: '',
        url: '/',
        scheduledTime: '',
        targetZones: [],
        priority: 'normal',
        ctaText: '',
        imageUrl: ''
    });

    const [broadcastScope, setBroadcastScope] = useState('global'); // 'global' | 'zone_specific'
    const [zones, setZones] = useState([]);
    const [isScheduled, setIsScheduled] = useState(false);
    const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
    const [result, setResult] = useState(null);
    const [message, setMessage] = useState('');
    const [showPicker, setShowPicker] = useState(null); // 'title' | 'body' | null
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [estimatedCount, setEstimatedCount] = useState(null);
    const [estimating, setEstimating] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const handleImageFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        setUploadingImage(true);
        try {
            const res = await NotificationService.uploadNotificationImage(formData);
            if (res.data?.success && res.data?.url) {
                setForm(prev => ({ ...prev, imageUrl: res.data.url }));
                toast.success('Image uploaded successfully!');
            } else {
                toast.error(res.data?.message || 'Upload failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploadingImage(false);
        }
    };

    const fetchZones = async () => {
        try {
            const res = await ZoneService.getAllZones({ limit: 1000, status: 'active' });
            if (res.data?.success) {
                setZones(res.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching zones:', error);
        }
    };

    useEffect(() => {
        fetchZones();
    }, []);

    // Calculate Estimated Recipients dynamically
    useEffect(() => {
        const calculateRecipients = async () => {
            setEstimating(true);
            try {
                const statsRes = await NotificationService.getAdminDashboardStats();
                if (statsRes.data?.success) {
                    const stats = statsRes.data.data;
                    let base = 0;
                    if (form.audience === 'all') {
                        base = stats.totalActiveDevices || 0;
                    } else if (form.audience === 'customer') {
                        base = stats.customerDevices || 0;
                    } else if (form.audience === 'provider') {
                        base = stats.providerDevices || 0;
                    }

                    // Apply zone filters deduction visually
                    let multiplier = 1.0;
                    if (form.targetZones.length > 0) multiplier *= 0.3;

                    const est = Math.max(1, Math.round(base * multiplier));
                    setEstimatedCount(est);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setEstimating(false);
            }
        };

        const timeout = setTimeout(calculateRecipients, 500);
        return () => clearTimeout(timeout);
    }, [form.audience, form.targetZones]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEmojiClick = (emojiObj) => {
        if (showPicker === 'title') {
            setForm(prev => ({ ...prev, title: prev.title + emojiObj.emoji }));
        } else if (showPicker === 'body') {
            setForm(prev => ({ ...prev, body: prev.body + emojiObj.emoji }));
        }
        setShowPicker(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.title.trim() || !form.body.trim()) {
            setStatus('error');
            setMessage('Title and message are required.');
            toast.error('Title and message are required.');
            return;
        }

        setStatus('loading');
        setResult(null);

        try {
            const res = await NotificationService.sendBroadcast({
                audience: form.audience,
                providerStatus: form.audience === 'provider' ? form.providerStatus : 'all',
                title: form.title.trim(),
                body: form.body.trim(),
                url: form.url.trim() || '/',
                type: 'broadcast',
                scheduledTime: isScheduled && form.scheduledTime ? form.scheduledTime : null,
                sendNow: !isScheduled,
                targetZones: form.targetZones,
                priority: form.priority,
                ctaText: form.ctaText,
                imageUrl: form.imageUrl
            });

            const data = res.data;

            if (data.success) {
                setStatus('success');
                setMessage(data.message || 'Notification processed successfully!');
                toast.success(data.message || 'Sent successfully!');
                setResult(data.data);
                resetForm();
            } else {
                setStatus('error');
                setMessage(data.message || 'Broadcast failed.');
                toast.error(data.message);
                setResult(data.data || null);
            }
        } catch (err) {
            console.error('[ComposeNotification] Error:', err);
            setStatus('error');
            setMessage('Network error. Please try again.');
            toast.error('Failed to send notification');
        }
    };

    const handleSaveDraft = () => {
        localStorage.setItem('notif_draft', JSON.stringify({ form, isScheduled, broadcastScope }));
        toast.info('Draft saved locally!');
    };

    const handleLoadDraft = () => {
        const draft = localStorage.getItem('notif_draft');
        if (draft) {
            const parsed = JSON.parse(draft);
            setForm(parsed.form);
            setIsScheduled(parsed.isScheduled);
            setBroadcastScope(parsed.broadcastScope);
            toast.success('Draft loaded!');
        } else {
            toast.warn('No draft found.');
        }
    };

    const resetForm = () => {
        setBroadcastScope('global');
        setForm({
            audience: 'all',
            title: '',
            body: '',
            url: '/',
            scheduledTime: '',
            targetZones: [],
            priority: 'normal',
            ctaText: '',
            imageUrl: ''
        });
        setIsScheduled(false);
        setStatus(null);
        setResult(null);
        setMessage('');
        setShowPicker(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-inter">
            {/* Page Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiSend className="text-primary" /> Compose Notification
                    </h1>
                    <p className="text-gray-600 mt-1 text-sm">Create, target, schedule and manually dispatch broadcast notifications.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleLoadDraft}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
                    >
                        Load Draft
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="bg-white border border-gray-355 text-gray-850 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm"
                    >
                        Save Draft
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Left Column: Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 space-y-6">
                        {/* Title & Type */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 pb-3 border-b border-gray-100 flex items-center gap-2">
                                <FiBell className="text-primary" /> Compose Details
                            </h2>
                        </div>

                        {/* Audience Selection */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <FiTarget className="text-primary" /> Target Audience *
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {AUDIENCE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, audience: opt.value }))}
                                        className={`py-2.5 px-3 rounded-xl border text-left transition-all duration-200 flex items-center gap-2.5 ${form.audience === opt.value
                                            ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="text-lg shrink-0">{opt.icon}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs truncate">{opt.label}</span>
                                                {form.audience === opt.value && <FiCheckCircle size={14} className="text-primary shrink-0 ml-1" />}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {form.audience === 'provider' && (
                                <div className="mt-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/60 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="shrink-0">
                                        <span className="text-xs font-bold text-emerald-900 block">Filter Provider Status</span>
                                        <span className="text-[10px] text-emerald-700 font-medium">Target specific provider groups</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
                                        {[
                                            { value: 'all', label: 'All Providers', icon: '👥' },
                                            { value: 'approved', label: 'Approved', icon: '✅' },
                                            { value: 'pending', label: 'Pending', icon: '⏳' }
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setForm(prev => ({ ...prev, providerStatus: opt.value }))}
                                                className={`py-1.5 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                                                    form.providerStatus === opt.value
                                                        ? 'bg-primary text-white border-primary shadow-xs'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                <span className="text-xs">{opt.icon}</span>
                                                <span>{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Priority Selector */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-750 mb-2">Notification Priority</label>
                            <div className="grid grid-cols-4 gap-2">
                                {['low', 'normal', 'high', 'critical'].map(prio => (
                                    <button
                                        key={prio}
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, priority: prio }))}
                                        className={`py-2 px-3 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all ${form.priority === prio
                                            ? prio === 'critical' ? 'bg-red-600 border-red-600 text-white shadow-md' :
                                              prio === 'high' ? 'bg-orange-500 border-orange-500 text-white shadow-md' :
                                              prio === 'normal' ? 'bg-primary border-primary text-white shadow-md' :
                                              'bg-gray-600 border-gray-600 text-white shadow-md'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {prio}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Basic Fields */}
                        <div className="space-y-4">
                            {/* Title input */}
                            <div className="relative">
                                <label className="block text-sm font-semibold text-gray-755 mb-1.5 flex items-center gap-2">
                                    <FiMessageSquare className="text-gray-400" /> Title *
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="title"
                                        value={form.title}
                                        onChange={handleChange}
                                        placeholder="Enter notification title (e.g. Weekend Special offer! 🎉)"
                                        maxLength={80}
                                        required
                                        className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPicker(prev => prev === 'title' ? null : 'title')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-primary transition-colors rounded-full"
                                    >
                                        <FiSmile size={18} />
                                    </button>
                                </div>
                                {showPicker === 'title' && (
                                    <div className="absolute z-50 mt-1 right-0 shadow-2xl rounded-xl border border-gray-100 bg-white">
                                        <Suspense fallback={<div className="p-4 text-xs text-gray-500">Loading emoji picker...</div>}>
                                            <EmojiPicker onEmojiClick={handleEmojiClick} skinTonesDisabled width={300} height={350} />
                                        </Suspense>
                                    </div>
                                )}
                            </div>

                            {/* Body input */}
                            <div className="relative">
                                <label className="block text-sm font-semibold text-gray-755 mb-1.5">Message Body *</label>
                                <div className="relative">
                                    <textarea
                                        name="body"
                                        value={form.body}
                                        onChange={handleChange}
                                        placeholder="Write your custom notification body text..."
                                        maxLength={200}
                                        required
                                        rows={3}
                                        className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPicker(prev => prev === 'body' ? null : 'body')}
                                        className="absolute right-3 top-3 p-1.5 text-gray-400 hover:text-primary transition-colors rounded-full"
                                    >
                                        <FiSmile size={18} />
                                    </button>
                                </div>
                                {showPicker === 'body' && (
                                    <div className="absolute z-50 mt-1 right-0 shadow-2xl rounded-xl border border-gray-100 bg-white">
                                        <Suspense fallback={<div className="p-4 text-xs text-gray-500">Loading emoji picker...</div>}>
                                            <EmojiPicker onEmojiClick={handleEmojiClick} skinTonesDisabled width={300} height={350} />
                                        </Suspense>
                                    </div>
                                )}
                            </div>

                            {/* Notification Image File Upload */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FiImage className="text-primary" /> Notification Image (Optional)
                                </label>

                                {form.imageUrl ? (
                                    <div className="flex items-center justify-between gap-3 p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl max-w-sm animate-fade-in">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <img src={form.imageUrl} alt="Uploaded notification preview" className="w-10 h-10 object-cover rounded-lg border border-emerald-200 shrink-0" />
                                            <div className="min-w-0">
                                                <span className="text-xs font-bold text-emerald-900 block truncate">Image Attached</span>
                                                <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1"><FiCheckCircle size={11} /> Ready to send</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                                            className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all shrink-0"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <label className={`inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl font-bold text-xs cursor-pointer transition-all ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {uploadingImage ? <FiLoader className="animate-spin" size={15} /> : <FiUploadCloud size={15} />}
                                        <span>{uploadingImage ? 'Uploading Image...' : 'Upload Image File'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageFileUpload}
                                            disabled={uploadingImage}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* CTA Button Text */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-755 mb-1.5">CTA Button Text</label>
                                    <input
                                        type="text"
                                        name="ctaText"
                                        value={form.ctaText}
                                        onChange={handleChange}
                                        placeholder="e.g. View Offer"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-755 mb-1.5 flex items-center gap-2">
                                        <FiLink className="text-gray-400" /> CTA URL/Route
                                    </label>
                                    <input
                                        type="text"
                                        name="url"
                                        value={form.url}
                                        onChange={handleChange}
                                        placeholder="/customer/services"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {QUICK_LINKS.map(ql => (
                                    <button
                                        key={ql.url}
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, url: ql.url }))}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all ${form.url === ql.url
                                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {ql.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Broadcast Scope Selection */}
                        <div className="pt-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                                <FiTarget className="text-primary" /> Broadcast Scope *
                            </label>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBroadcastScope('global');
                                        setForm(prev => ({ ...prev, targetZones: [] }));
                                    }}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all duration-200 ${broadcastScope === 'global'
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-gray-200 text-gray-650 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    🌐 Global Broadcast
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBroadcastScope('zone_specific')}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all duration-200 ${broadcastScope === 'zone_specific'
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-gray-200 text-gray-650 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    📍 Zone-Targeted Broadcast
                                </button>
                            </div>
                        </div>

                        {/* Zone Selector */}
                        {broadcastScope === 'zone_specific' && (
                            <div className="animate-fade-in">
                                <HierarchicalZoneSelector
                                    zones={zones}
                                    selectedZoneIds={form.targetZones}
                                    onChange={(newZoneIds) => setForm(prev => ({ ...prev, targetZones: newZoneIds }))}
                                    label="Target Zones (State/City/Micro)"
                                />
                            </div>
                        )}

                        {/* Scheduling */}
                        <div className="pt-2">
                            <label className="flex items-center gap-2 cursor-pointer mb-3">
                                <input
                                    type="checkbox"
                                    checked={isScheduled}
                                    onChange={(e) => setIsScheduled(e.target.checked)}
                                    className="rounded border-gray-300 text-primary h-4 w-4"
                                />
                                <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <FiClock className="text-primary" /> Schedule for later dispatch
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
                                        className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1.5">Automatically broadcast at selected timezone date & time.</p>
                                </div>
                            )}
                        </div>

                        {/* Banners */}
                        {status === 'success' && (
                            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 flex gap-3 items-start">
                                <FiCheckCircle className="mt-0.5 text-green-500 flex-shrink-0" size={18} />
                                <div>
                                    <h4 className="font-bold text-sm">{message}</h4>
                                    {result && (
                                        <p className="text-xs mt-1 text-green-600">Successfully matched {result.sent} active users.</p>
                                    )}
                                </div>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex gap-3 items-start">
                                <FiAlertCircle className="mt-0.5 text-red-500 flex-shrink-0" size={18} />
                                <div>
                                    <h4 className="font-bold text-sm">{message}</h4>
                                </div>
                            </div>
                        )}

                        {/* Submit & Reset Actions */}
                        <div className="pt-5 border-t border-gray-200 flex gap-3">
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="flex-1 bg-primary hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
                            >
                                {status === 'loading' ? (
                                    <><FiLoader className="animate-spin" /> Processing...</>
                                ) : (
                                    <><FiSend /> {isScheduled ? 'Schedule Broadcast' : 'Send Broadcast Now'}</>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="bg-white border border-gray-300 text-gray-700 font-bold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all"
                            >
                                Reset
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Column: Phone Live Preview & Estimated Count */}
                <div className="space-y-6">
                    {/* Est Card */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Estimated Recipients</h3>
                        <div className="flex items-baseline gap-2">
                            {estimating ? (
                                <span className="text-2xl font-black text-gray-400 animate-pulse">Calculating...</span>
                            ) : (
                                <span className="text-3xl font-black text-gray-900">{estimatedCount ?? 0}</span>
                            )}
                            <span className="text-xs text-gray-500 font-semibold">devices matched</span>
                        </div>
                        <p className="text-[10px] text-gray-450 mt-1">Based on current active registers & targeted filters.</p>
                    </div>

                    {/* Live Preview UI */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col items-center">
                        <h3 className="text-sm font-bold text-gray-800 mb-6 w-full flex items-center gap-2">
                            <FiBell className="text-primary" /> Live Mock Preview
                        </h3>

                        <div className="relative w-[230px] h-[400px] border-[6px] border-gray-900 rounded-[2rem] shadow-xl overflow-hidden bg-gray-50 scale-95 origin-top">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-gray-900 rounded-b-xl z-20"></div>
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-white to-blue-500/5"></div>
                            <div className="px-4 pt-2.5 flex justify-between items-center text-[8px] font-bold text-gray-400 relative z-10">
                                <span>9:41 AM</span>
                                <div className="flex gap-1 items-center">
                                    <span className="w-2.5 h-1 border border-gray-400 rounded-sm"></span>
                                </div>
                            </div>

                            <div className="mt-4 px-2 relative z-10">
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={form.title + form.body}
                                    className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-white/50 p-2.5 flex gap-2 items-start"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 overflow-hidden">
                                        {!logoLoaded && <FiBell className="text-primary" size={14} />}
                                        <img
                                            src="/icon-192.png"
                                            alt="App"
                                            className={`w-6 h-6 object-contain transition-opacity duration-250 ${logoLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                                            onLoad={() => setLogoLoaded(true)}
                                            onError={() => setLogoLoaded(false)}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-[7px] font-bold text-primary uppercase tracking-tight">SERVICE PLATFORM</span>
                                            <span className="text-[7px] text-gray-450">now</span>
                                        </div>
                                        <div className="text-[10px] font-black text-gray-900 leading-tight truncate">
                                            {form.title || 'Notification Title'}
                                        </div>
                                        <div className="text-[9px] text-gray-600 line-clamp-3 mt-0.5 leading-snug">
                                            {form.body || 'Your message text body will preview here...'}
                                        </div>
                                        {form.imageUrl && (
                                            <img src={form.imageUrl} className="mt-1.5 w-full h-16 object-cover rounded-lg" alt="Attached Preview" />
                                        )}
                                        {form.ctaText && (
                                            <div className="mt-2 text-center text-[8px] bg-primary text-white py-1 rounded font-bold uppercase tracking-wider">
                                                {form.ctaText}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                            <div className="absolute bottom-1 w-14 h-0.5 bg-gray-300 rounded-full left-1/2 -translate-x-1/2"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComposeNotification;
