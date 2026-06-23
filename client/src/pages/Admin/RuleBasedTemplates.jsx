import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../../context/auth';
import * as NotificationService from '../../services/NotificationService';
import * as SystemService from '../../services/SystemService';
import {
    FiBell, FiTarget, FiLoader, FiMessageSquare, FiSmile,
    FiEdit2, FiTrash2, FiXCircle, FiPlay, FiSettings
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import Modal from '../../components/ui/Modal';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

const STANDARD_EVENT_LABELS = {
    booking_created: 'Booking Created (booking_created)',
    provider_assigned: 'Provider Assigned (provider_assigned)',
    provider_accepted: 'Provider Accepted (provider_accepted)',
    provider_reached: 'Provider Reached (provider_reached)',
    work_started: 'Work Started (work_started)',
    payment_success: 'Payment Success (payment_success)',
    booking_completed: 'Booking Completed (booking_completed)',
    booking_cancelled: 'Booking Cancelled (booking_cancelled)',
    refund_initiated: 'Refund Initiated (refund_initiated)',
    refund_completed: 'Refund Completed (refund_completed)',
    dispute_created: 'Dispute Created (dispute_created)',
    dispute_resolved: 'Dispute Resolved (dispute_resolved)',
    provider_approved: 'Provider Approved (provider_approved)',
    provider_rejected: 'Provider Rejected (provider_rejected)',
    warranty_expiring: 'Warranty Expiring (warranty_expiring)',
    subscription_expiring: 'Subscription Expiring (subscription_expiring)'
};

const ALL_EVENTS = Object.keys(STANDARD_EVENT_LABELS);

const DYNAMIC_VARIABLES = [
    'customerName',
    'providerName',
    'bookingId',
    'serviceName',
    'amount',
    'date',
    'zone',
    'city'
];

const RuleBasedTemplates = () => {
    useAuth();

    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [templateModal, setTemplateModal] = useState({ open: false, item: null, isEdit: false });
    const [categories, setCategories] = useState([]);
    const [systemSettings, setSystemSettings] = useState(null);
    const [uploadingRingtone, setUploadingRingtone] = useState(false);
    const [showIconEmojiPicker, setShowIconEmojiPicker] = useState(false);

    const [templateForm, setTemplateForm] = useState({
        eventId: '',
        title: '',
        message: '',
        icon: '',
        ctaText: '',
        ctaUrl: '',
        priority: 'medium',
        targetAudience: {
            role: 'all',
            providerStatus: '',
            serviceCategory: '',
            bookingStatus: '',
            ratingGte: '',
            subscriptionPlan: ''
        },
        isActive: true
    });

    const templateTitleRef = useRef(null);
    const templateMessageRef = useRef(null);
    const [lastFocusedField, setLastFocusedField] = useState('message');

    const handleInsertVariable = (v) => {
        const placeholder = `{{${v}}}`;
        const ref = lastFocusedField === 'title' ? templateTitleRef : templateMessageRef;
        if (ref.current) {
            const input = ref.current;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const text = input.value;
            const before = text.substring(0, start);
            const after = text.substring(end, text.length);
            const newValue = before + placeholder + after;

            if (lastFocusedField === 'title') {
                setTemplateForm(prev => ({ ...prev, title: newValue }));
            } else {
                setTemplateForm(prev => ({ ...prev, message: newValue }));
            }

            setTimeout(() => {
                input.focus();
                input.setSelectionRange(start + placeholder.length, start + placeholder.length);
            }, 0);
        } else {
            setTemplateForm(prev => ({ ...prev, message: prev.message + placeholder }));
        }
    };

    const fetchTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const res = await NotificationService.getTemplates();
            if (res.data && res.data.success) {
                setTemplates(res.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            toast.error('Failed to fetch templates');
        } finally {
            setLoadingTemplates(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await SystemService.getCategories();
            if (res.data?.success) {
                setCategories(res.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchSystemSettings = async () => {
        try {
            const res = await SystemService.getSystemSettingAdmin();
            if (res.data && res.data.success) {
                setSystemSettings(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch system settings:', error);
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchCategories();
        fetchSystemSettings();
    }, []);

    const handleTemplateSubmit = async (e) => {
        e.preventDefault();

        if (!templateForm.eventId.trim() || !templateForm.title.trim() || !templateForm.message.trim()) {
            toast.error('Event ID, Title, and Message are required');
            return;
        }

        try {
            const dataToSave = {
                eventId: templateForm.eventId.trim(),
                title: templateForm.title.trim(),
                message: templateForm.message.trim(),
                icon: templateForm.icon.trim() || null,
                ctaText: templateForm.ctaText.trim() || null,
                ctaUrl: templateForm.ctaUrl.trim() || null,
                priority: templateForm.priority,
                targetAudience: {
                    role: templateForm.targetAudience.role,
                    providerStatus: templateForm.targetAudience.providerStatus.trim() || null,
                    serviceCategory: templateForm.targetAudience.serviceCategory || null,
                    bookingStatus: templateForm.targetAudience.bookingStatus.trim() || null,
                    ratingGte: templateForm.targetAudience.ratingGte ? Number(templateForm.targetAudience.ratingGte) : null,
                    subscriptionPlan: templateForm.targetAudience.subscriptionPlan.trim() || null
                },
                isActive: templateForm.isActive
            };

            let res;
            if (templateModal.isEdit && templateModal.item && templateModal.item._id) {
                res = await NotificationService.updateTemplate(templateModal.item._id, dataToSave);
            } else {
                res = await NotificationService.createTemplate(dataToSave);
            }

            if (res.data && res.data.success) {
                toast.success(templateModal.isEdit ? 'Template updated successfully' : 'Template created successfully');
                setTemplateModal({ open: false, item: null, isEdit: false });
                fetchTemplates();
            } else {
                toast.error(res.data.message || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving template:', error);
            const errMsg = error.response && error.response.data && error.response.data.message;
            toast.error(errMsg || 'Failed to save template');
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('Are you sure you want to delete this template?')) return;
        try {
            const res = await NotificationService.deleteTemplate(id);
            if (res.data && res.data.success) {
                toast.success('Template deleted successfully');
                fetchTemplates();
            } else {
                toast.error(res.data.message || 'Failed to delete template');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            toast.error('Failed to delete template');
        }
    };

    const handleToggleTemplateStatus = async (template) => {
        try {
            const updatedStatus = !template.isActive;
            const res = await NotificationService.updateTemplate(template._id, {
                ...template,
                isActive: updatedStatus
            });
            if (res.data && res.data.success) {
                toast.success(`Template ${updatedStatus ? 'activated' : 'deactivated'} successfully`);
                fetchTemplates();
            } else {
                toast.error(res.data.message || 'Failed to update template status');
            }
        } catch (error) {
            console.error('Error toggling template status:', error);
            toast.error('Failed to toggle status');
        }
    };

    const openTemplateModal = (item = null) => {
        if (item) {
            const targetAud = item.targetAudience || {};
            setTemplateForm({
                eventId: item.eventId || '',
                title: item.title || '',
                message: item.message || '',
                icon: item.icon || '',
                ctaText: item.ctaText || '',
                ctaUrl: item.ctaUrl || '',
                priority: item.priority || 'medium',
                targetAudience: {
                    role: targetAud.role || 'all',
                    providerStatus: targetAud.providerStatus || '',
                    serviceCategory: targetAud.serviceCategory || '',
                    bookingStatus: targetAud.bookingStatus || '',
                    ratingGte: targetAud.ratingGte || '',
                    subscriptionPlan: targetAud.subscriptionPlan || ''
                },
                isActive: item.isActive !== false
            });
            setTemplateModal({ open: true, item, isEdit: true });
        } else {
            setTemplateForm({
                eventId: '',
                title: '',
                message: '',
                icon: '',
                ctaText: '',
                ctaUrl: '',
                priority: 'medium',
                targetAudience: {
                    role: 'all',
                    providerStatus: '',
                    serviceCategory: '',
                    bookingStatus: '',
                    ratingGte: '',
                    subscriptionPlan: ''
                },
                isActive: true
            });
            setTemplateModal({ open: true, item: null, isEdit: false });
        }
    };

    const handleRingtoneUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'mp4'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) {
            toast.error('Invalid file format. Please upload an audio file (MP3, WAV, OGG, AAC, M4A).');
            return;
        }

        try {
            setUploadingRingtone(true);
            const formData = new FormData();
            formData.append('providerBookingRingtone', file);

            const res = await SystemService.updateSystemSetting(formData);
            if (res.data && res.data.success) {
                setSystemSettings(res.data.data);
                toast.success('Global booking ringtone uploaded successfully.');
            } else {
                toast.error((res.data && res.data.message) || 'Failed to upload ringtone.');
            }
        } catch (error) {
            console.error('Ringtone upload error:', error);
            toast.error(error.message || 'Failed to upload ringtone.');
        } finally {
            setUploadingRingtone(false);
        }
    };

    const playSample = () => {
        const url = systemSettings && systemSettings.providerBookingRingtone;
        if (!url) return;
        const audio = new Audio(url);
        audio.play().catch(err => {
            console.error('Play sample failed:', err);
            toast.error('Browser blocked audio playback. Please interact with the page first.');
        });
    };

    const renderMockMessage = (msg) => {
        if (!msg) return '';
        let replaced = msg;
        const mockVals = {
            customerName: 'Aman Sharma',
            providerName: 'Raj Kumar',
            bookingId: 'BK-89021',
            serviceName: 'AC Deep Cleaning',
            amount: '₹850',
            date: '25th June, 10:00 AM',
            zone: 'West Delhi',
            city: 'New Delhi'
        };
        DYNAMIC_VARIABLES.forEach(v => {
            replaced = replaced.replaceAll(`{{${v}}}`, mockVals[v]);
        });
        return replaced;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-inter">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiTarget className="text-primary" /> Rule-Based Event Templates
                    </h1>
                    <p className="text-gray-600 mt-1 text-sm">Configure automated FCM notifications triggered by system lifecycle events.</p>
                </div>
                <button
                    type="button"
                    onClick={() => openTemplateModal()}
                    className="bg-primary hover:bg-teal-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-sm"
                >
                    + Create Event Template
                </button>
            </div>

            {/* Booking Ringtone Settings Card */}
            <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-2xl p-5 border border-primary/20 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        🎵 Global Provider Booking Alert Sound
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Configure the custom sound track played on provider apps when bookings are generated, assigned, or re-routed.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {systemSettings?.providerBookingRingtone ? (
                        <>
                            <audio src={systemSettings.providerBookingRingtone} controls className="h-9 max-w-[200px]" />
                            <button
                                type="button"
                                onClick={playSample}
                                className="text-xs bg-primary hover:bg-teal-700 text-white font-bold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1"
                            >
                                <FiPlay size={12} /> Test Sound
                            </button>
                        </>
                    ) : (
                        <span className="text-xs text-red-500 font-bold bg-red-50 border border-red-150 px-2.5 py-1.5 rounded-lg">
                            No Alert Sound Configured
                        </span>
                    )}
                    <label className={`text-xs font-bold px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 cursor-pointer shadow-sm hover:bg-gray-50 flex items-center gap-1.5 transition-all ${uploadingRingtone ? 'opacity-70 pointer-events-none' : ''}`}>
                        {uploadingRingtone ? 'Uploading...' : 'Change Audio'}
                        <input type="file" onChange={handleRingtoneUpload} accept="audio/*" className="hidden" />
                    </label>
                </div>
            </div>

            {/* Templates List */}
            {loadingTemplates ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                    <FiLoader className="animate-spin text-primary mb-2" size={24} />
                    <span className="text-sm">Loading event templates...</span>
                </div>
            ) : templates.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-450 bg-white rounded-2xl border border-dashed border-gray-200">
                    <FiBell className="mb-2 opacity-30" size={24} />
                    <span className="text-sm font-semibold">No Event Templates Found</span>
                    <button
                        type="button"
                        onClick={() => openTemplateModal()}
                        className="mt-3 text-xs bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-sm"
                    >
                        Configure First Template
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map(tmpl => {
                        const targetAud = tmpl.targetAudience || {};
                        return (
                            <div key={tmpl._id} className="border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all bg-white flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-blue-50 text-blue-700 border-blue-200 font-mono">
                                            {tmpl.eventId}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${tmpl.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                                            tmpl.priority === 'medium' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}>
                                            {tmpl.priority} Priority
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleTemplateStatus(tmpl)}
                                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border transition-all ${tmpl.isActive
                                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                : 'bg-gray-150 text-gray-500 border-gray-250 hover:bg-gray-200'
                                                }`}
                                        >
                                            {tmpl.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-base">{tmpl.title}</h3>
                                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed font-mono whitespace-pre-wrap">
                                        {tmpl.message}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 items-center text-[10px]">
                                        <span className="text-gray-450 font-bold">Scope:</span>
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold capitalize">{targetAud.role || 'all'}</span>
                                        {targetAud.providerStatus && <span className="bg-gray-100 text-gray-650 px-2 py-0.5 rounded">Status: {targetAud.providerStatus}</span>}
                                        {targetAud.ratingGte && <span className="bg-gray-100 text-gray-650 px-2 py-0.5 rounded">Rating ≥ {targetAud.ratingGte}</span>}
                                        {targetAud.subscriptionPlan && <span className="bg-gray-100 text-gray-650 px-2 py-0.5 rounded">Plan: {targetAud.subscriptionPlan}</span>}
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-[10px] text-gray-400">Created: {new Date(tmpl.createdAt).toLocaleDateString()}</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openTemplateModal(tmpl)}
                                            className="text-primary hover:bg-primary/10 p-2 rounded-lg border border-primary/20 transition-all"
                                        >
                                            <FiEdit2 size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTemplate(tmpl._id)}
                                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg border border-red-200 transition-all"
                                        >
                                            <FiTrash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Template Save / Create Modal */}
            <Modal
                isOpen={templateModal.open}
                onClose={() => {
                    setTemplateModal({ open: false, item: null, isEdit: false });
                    setShowIconEmojiPicker(false);
                }}
                title={templateModal.isEdit ? 'Edit Event Template' : 'Create Event Template'}
            >
                <form onSubmit={handleTemplateSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Event Trigger ID *</label>
                        <select
                            value={templateForm.eventId}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, eventId: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-white"
                            required
                        >
                            <option value="">-- Select Event ID --</option>
                            {ALL_EVENTS.map(evtId => (
                                <option key={evtId} value={evtId}>{STANDARD_EVENT_LABELS[evtId]}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Notification Title *</label>
                        <input
                            type="text"
                            ref={templateTitleRef}
                            onFocus={() => setLastFocusedField('title')}
                            placeholder="e.g. New Booking Alert: {{serviceName}}"
                            value={templateForm.title}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-xl text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Message Body *</label>
                        <textarea
                            rows={3}
                            ref={templateMessageRef}
                            onFocus={() => setLastFocusedField('message')}
                            placeholder="e.g. You have a booking from {{customerName}} of {{amount}}."
                            value={templateForm.message}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, message: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-xl text-xs"
                            required
                        />
                        <div className="mt-2 text-xs">
                            <span className="font-semibold text-gray-500 block mb-1">Variables (click to insert):</span>
                            <div className="flex flex-wrap gap-1">
                                {DYNAMIC_VARIABLES.map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => handleInsertVariable(v)}
                                        className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded font-mono text-[10px]"
                                    >
                                        {"{{" + v + "}}"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preview Panel inside Modal */}
                    <div className="border border-dashed border-primary/30 bg-primary/5 rounded-xl p-3">
                        <label className="block text-[10px] font-black text-primary uppercase mb-1 flex items-center gap-1"><FiSettings size={10} /> Live Preview Rendering</label>
                        <div className="text-[11px] font-bold text-gray-800">{renderMockMessage(templateForm.title) || 'Mock Title'}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{renderMockMessage(templateForm.message) || 'Mock body content...'}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Priority</label>
                            <select
                                value={templateForm.priority}
                                onChange={(e) => setTemplateForm(prev => ({ ...prev, priority: e.target.value }))}
                                className="w-full px-3 py-1.5 border rounded-xl text-xs bg-white"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Icon ID</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="default_bell"
                                    value={templateForm.icon}
                                    onChange={(e) => setTemplateForm(prev => ({ ...prev, icon: e.target.value }))}
                                    className="w-full pl-3 pr-8 py-1.5 border rounded-xl text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowIconEmojiPicker(prev => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                                >
                                    <FiSmile size={14} />
                                </button>
                            </div>
                            {showIconEmojiPicker && (
                                <div className="absolute z-50 mt-1 right-0 shadow-2xl rounded-xl border border-gray-100 bg-white">
                                    <Suspense fallback={<div className="p-4 text-xs text-gray-500">Loading emoji picker...</div>}>
                                        <EmojiPicker 
                                            onEmojiClick={(emojiObj) => {
                                                setTemplateForm(prev => ({ ...prev, icon: emojiObj.emoji }));
                                                setShowIconEmojiPicker(false);
                                            }} 
                                            skinTonesDisabled 
                                            width={260} 
                                            height={300} 
                                        />
                                    </Suspense>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">CTA Text</label>
                            <input
                                type="text"
                                placeholder="e.g. View Details"
                                value={templateForm.ctaText}
                                onChange={(e) => setTemplateForm(prev => ({ ...prev, ctaText: e.target.value }))}
                                className="w-full px-3 py-1.5 border rounded-xl text-xs"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">CTA URL</label>
                            <input
                                type="text"
                                placeholder="/provider/bookings/{{bookingId}}"
                                value={templateForm.ctaUrl}
                                onChange={(e) => setTemplateForm(prev => ({ ...prev, ctaUrl: e.target.value }))}
                                className="w-full px-3 py-1.5 border rounded-xl text-xs font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Target Role</label>
                        <select
                            value={templateForm.targetAudience.role}
                            onChange={(e) => setTemplateForm(prev => ({
                                ...prev,
                                targetAudience: { ...prev.targetAudience, role: e.target.value }
                            }))}
                            className="w-full px-3 py-1.5 border rounded-xl text-xs bg-white"
                        >
                            <option value="all">All Roles</option>
                            <option value="customer">Customers</option>
                            <option value="provider">Providers</option>
                            <option value="admin">Admins</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="tmpl-active-checkbox"
                            checked={templateForm.isActive}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, isActive: e.target.checked }))}
                            className="rounded border-gray-300 text-primary h-4 w-4"
                        />
                        <label htmlFor="tmpl-active-checkbox" className="text-xs font-bold text-gray-700 cursor-pointer">
                            Active (automated notifications enabled)
                        </label>
                    </div>

                    <div className="pt-4 border-t flex gap-2">
                        <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-xl font-bold hover:bg-teal-700 transition-all text-xs">
                            Save Template
                        </button>
                        <button
                            type="button"
                            onClick={() => setTemplateModal({ open: false, item: null, isEdit: false })}
                            className="flex-1 bg-gray-100 text-gray-750 py-2 rounded-xl font-bold hover:bg-gray-250 transition-all text-xs"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default RuleBasedTemplates;
