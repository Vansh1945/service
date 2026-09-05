import React, { useState, useEffect, useRef } from 'react';
import {
  FiMail, FiSend, FiRotateCcw, FiSave, FiEye, FiCode,
  FiInfo, FiCheck, FiX, FiActivity, FiUser, FiCalendar,
  FiSliders, FiCopy, FiExternalLink, FiHelpCircle, FiChevronRight,
  FiLayout, FiMaximize2, FiSmartphone, FiMonitor
} from 'react-icons/fi';
import { toast } from '../../../components/ui/Toast';
import Button from '../../../components/ui/Button';
import Loader from '../../../components/ui/Loader';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';

import * as SystemService from '../../../services/SystemService';
import { useConfirm } from '../../../context/ConfirmContext';

const TEMPLATE_METADATA = {
  forgotPasswordOtp: {
    name: 'Forgot Password OTP',
    triggerEvent: '🔑 Password Reset Request',
    recipientRole: 'User / Provider',
    description: 'Sent automatically when a user or provider clicks "Forgot Password" to request an OTP code.',
    icon: <FiMail className="w-5 h-5" />,
    variables: ['otp', 'email', 'expiry']
  },
  providerRegistrationOtp: {
    name: 'Provider Registration OTP',
    triggerEvent: '📝 Provider Signup Step 1',
    recipientRole: 'Provider Applicant',
    description: 'Sent automatically during step 1 of provider registration to verify email via OTP.',
    icon: <FiMail className="w-5 h-5" />,
    variables: ['otp', 'email', 'expiry']
  },
  providerApproval: {
    name: 'Provider Account Approved',
    triggerEvent: '🎓 Admin Approves Provider Account',
    recipientRole: 'Service Provider',
    description: 'Sent when Admin clicks "Approve Provider". Contains account activation confirmation & PDF agreement download links.',
    icon: <FiCheck className="w-5 h-5 text-emerald-600" />,
    variables: ['name', 'providerName', 'reason', 'email', 'agreementPdfUrl', 'approvalLetterUrl']
  },
  providerRejection: {
    name: 'Provider Application Rejected',
    triggerEvent: '❌ Admin Rejects Provider Registration Application',
    recipientRole: 'Service Provider Applicant',
    description: 'Sent when Admin rejects a new provider registration request. Includes reason for rejection.',
    icon: <FiX className="w-5 h-5 text-rose-600" />,
    variables: ['name', 'reason']
  },
  providerRestricted: {
    name: 'Provider Account Restricted',
    triggerEvent: '⚠️ Admin Restricts Provider Account',
    recipientRole: 'Service Provider',
    description: 'Sent when Admin restricts a provider profile. Explains booking dispatch pause, remarks, and restriction duration.',
    icon: <FiInfo className="w-5 h-5 text-amber-600" />,
    variables: ['name', 'reason', 'durationDays']
  },
  providerSuspended: {
    name: 'Provider Account Suspended',
    triggerEvent: '⛔ Admin Suspends Provider Account',
    recipientRole: 'Service Provider',
    description: 'Sent when Admin suspends a provider account. Explains total login/dispatch pause and suspension reason.',
    icon: <FiX className="w-5 h-5 text-rose-600" />,
    variables: ['name', 'reason']
  },
  providerBlocked: {
    name: 'Provider Account Blocked',
    triggerEvent: '🚫 Admin Blocks Provider Account',
    recipientRole: 'Service Provider',
    description: 'Sent when Admin blocks a provider account. Explains session termination, block duration, and termination reason.',
    icon: <FiX className="w-5 h-5 text-red-700" />,
    variables: ['name', 'reason', 'durationDays']
  },
  contactReply: {
    name: 'Contact Inquiry Reply',
    triggerEvent: '💬 Support Team Replies to Message',
    recipientRole: 'Customer / Provider',
    description: 'Sent when Admin responds to a contact support inquiry from the Admin Panel.',
    icon: <FiMail className="w-5 h-5" />,
    variables: ['name', 'remark', 'reason', 'email']
  },
  withdrawApproved: {
    name: 'Payout Withdrawal Approved',
    triggerEvent: '💸 Admin Approves Earnings Payout',
    recipientRole: 'Service Provider',
    description: 'Sent when Admin approves a provider wallet/earnings withdrawal request.',
    icon: <FiActivity className="w-5 h-5 text-emerald-600" />,
    variables: ['name', 'withdrawAmount', 'remark', 'date']
  },
  withdrawRejected: {
    name: 'Payout Withdrawal Rejected',
    triggerEvent: '❌ Admin Rejects Payout Request',
    recipientRole: 'Service Provider',
    description: 'Sent when Admin rejects a provider wallet withdrawal request with explanation.',
    icon: <FiX className="w-5 h-5 text-rose-600" />,
    variables: ['name', 'withdrawAmount', 'reason', 'date']
  },
  complaintResponse: {
    name: 'Complaint Status Update',
    triggerEvent: '📋 Admin Resolves / Responds to Complaint',
    recipientRole: 'Customer',
    description: 'Sent when Admin resolves or updates a booking complaint status.',
    icon: <FiInfo className="w-5 h-5 text-blue-600" />,
    variables: ['name', 'bookingId', 'status', 'remark']
  },
  adminBookingCancelledCustomer: {
    name: 'Booking Cancelled (Sent to Customer)',
    triggerEvent: '🚫 Support Team Cancels Booking',
    recipientRole: 'Customer',
    description: 'Sent to customer when support team cancels a booking. Includes refund breakdown.',
    icon: <FiX className="w-5 h-5 text-rose-600" />,
    variables: ['name', 'bookingId', 'serviceName', 'cancellationReason', 'complaintId', 'refundAmount', 'platformFeeRetained', 'refundDestination', 'expectedRefundTimeline']
  },
  adminBookingCancelledProvider: {
    name: 'Booking Cancelled (Sent to Provider)',
    triggerEvent: '🚫 Support Team Cancels Assigned Booking',
    recipientRole: 'Service Provider',
    description: 'Sent to assigned provider when support team cancels a booking.',
    icon: <FiX className="w-5 h-5 text-rose-600" />,
    variables: ['name', 'bookingId', 'customerName', 'cancellationReason', 'complaintId']
  },
  refundCompleted: {
    name: 'Refund Completed Confirmation',
    triggerEvent: '💰 Refund Processed to Customer',
    recipientRole: 'Customer',
    description: 'Sent to customer when refund is successfully processed to wallet or bank account.',
    icon: <FiCheck className="w-5 h-5 text-emerald-600" />,
    variables: ['customerName', 'bookingId', 'refundId', 'amount', 'walletRefundAmount', 'gatewayRefundAmount', 'refundDestination']
  }
};

const EmailTemplate = () => {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState({});
  const [selectedType, setSelectedType] = useState('forgotPasswordOtp');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Editor draft state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Live preview rendered states
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTab] = useState('preview'); // 'preview' | 'code'
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'

  // Test modal states
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // System metadata audit details
  const [auditMeta, setAuditMeta] = useState(null);

  const textareaRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (templates[selectedType]) {
      const template = templates[selectedType];
      setSubject(template.subject || '');
      setBody(template.body || '');
      setIsActive(template.isActive !== false);
    }
  }, [selectedType, templates]);

  useEffect(() => {
    // Generate live preview whenever body or subject changes (with a slight debounce)
    const delayDebounceFn = setTimeout(() => {
      if (subject && body) {
        generatePreview();
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [subject, body]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await SystemService.getEmailTemplates();
      if (response.data?.success && response.data.data) {
        setTemplates(response.data.data);
        // Also extract top level audit metadata if exists
        if (response.data.metadata || response.data.audit) {
          setAuditMeta(response.data.metadata || response.data.audit);
        }
      } else {
        toast.error('Failed to load email templates.');
      }
    } catch (error) {
      console.error('Error fetching email templates:', error);
      toast.error('Failed to connect to email settings service.');
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async () => {
    if (!subject || !body) return;
    setIsPreviewLoading(true);
    try {
      const response = await SystemService.previewEmailTemplate({
        type: selectedType,
        subject,
        body
      });
      if (response.data?.success && response.data.data) {
        setPreviewSubject(response.data.data.subject);
        setPreviewHtml(response.data.data.html);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.warning('Email subject cannot be empty.');
      return;
    }
    if (!body.trim()) {
      toast.warning('Email body markup cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await SystemService.updateEmailTemplate(selectedType, {
        subject,
        body,
        isActive
      });

      if (response.data?.success) {
        toast.success(`🎉 ${TEMPLATE_METADATA[selectedType].name} saved successfully!`);
        // Update local template state
        setTemplates(prev => ({
          ...prev,
          [selectedType]: {
            ...prev[selectedType],
            subject,
            body,
            isActive,
            updatedAt: new Date()
          }
        }));

        // Fetch again to update audit logs
        const refreshResponse = await SystemService.getEmailTemplates();
        if (refreshResponse.data?.success) {
          setAuditMeta(refreshResponse.data.metadata || null);
        }
      }
    } catch (error) {
      console.error('Save template error:', error);
      toast.error(error.response?.data?.message || 'Failed to save template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async () => {
    const confirmRestore = await confirm({
      title: 'Restore Default Template',
      message: `Are you sure you want to restore ${TEMPLATE_METADATA[selectedType].name} to its original default design? All your custom modifications for this template will be lost.`,
      type: 'warning',
      confirmText: 'Restore',
    });
    if (!confirmRestore) return;

    setIsRestoring(true);
    try {
      const response = await SystemService.restoreDefaultTemplate({ type: selectedType });
      if (response.data?.success && response.data.data) {
        toast.success(`Default template for ${TEMPLATE_METADATA[selectedType].name} restored!`);
        setTemplates(prev => ({
          ...prev,
          [selectedType]: response.data.data
        }));

        // Refresh audit logs
        const refreshResponse = await SystemService.getEmailTemplates();
        if (refreshResponse.data?.success) {
          setAuditMeta(refreshResponse.data.metadata || null);
        }
      }
    } catch (error) {
      console.error('Restore default template error:', error);
      toast.error('Failed to restore default template.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail || !testEmail.trim()) {
      toast.warning('Please enter a valid recipient email address.');
      return;
    }

    setIsTesting(true);
    try {
      const response = await SystemService.testSendEmailTemplate({
        type: selectedType,
        testEmail: testEmail.trim(),
        subject,
        body
      });
      if (response.data?.success) {
        toast.success(`✉️ Test email dispatched successfully to ${testEmail}! Check your inbox.`);
        setShowTestModal(false);
        setTestEmail('');
      } else {
        toast.error('Test dispatch failed.');
      }
    } catch (error) {
      console.error('Test send error:', error);
      toast.error(error.response?.data?.message || 'Failed to dispatch test email.');
    } finally {
      setIsTesting(false);
    }
  };

  const insertVariable = (variable) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const placeholder = `{{${variable}}}`;
    const newValue = before + placeholder + after;

    setBody(newValue);

    // Maintain focus and update cursor selection
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader text="Loading Email Template Management Workspace..." />
      </div>
    );
  }

  const currentMeta = TEMPLATE_METADATA[selectedType];
  const allVariables = [...(currentMeta?.variables || []), 'companyName'];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-inter">
      {/* Header Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-inter">
            Email Template Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convert existing hardcoded emails into admin-controlled responsive Handlebars templates in real time.
          </p>
        </div>

        {/* Global audit meta badge */}
        {auditMeta && (
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 self-start md:self-auto text-xs">
            <FiUser className="text-primary w-4 h-4" />
            <div>
              <p className="text-gray-400 font-medium">Last Modified By</p>
              <p className="font-semibold text-secondary truncate max-w-[150px]">
                {auditMeta.updatedBy || 'System Admin'}
              </p>
            </div>
            <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
            <FiCalendar className="text-accent w-4 h-4" />
            <div>
              <p className="text-gray-400 font-medium">Updated At</p>
              <p className="font-semibold text-secondary">
                {auditMeta.updatedAt ? new Date(auditMeta.updatedAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Navigation: Template Selector Tabs */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400 font-inter">
            System Templates ({Object.keys(TEMPLATE_METADATA).length})
          </div>
          <nav className="space-y-1">
            {Object.entries(TEMPLATE_METADATA).map(([key, data]) => {
              const active = selectedType === key;
              const isTemplateActive = templates[key]?.isActive !== false;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left font-medium text-sm group ${active
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-secondary hover:bg-primary/5 hover:text-primary'
                    }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span className={active ? 'text-white' : 'text-gray-400 group-hover:text-primary'}>
                      {data.icon}
                    </span>
                    <span className="truncate">{data.name}</span>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full ${isTemplateActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}></span>
                    <FiChevronRight className={`w-4 h-4 transition-transform duration-200 ${active ? 'translate-x-0.5 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'
                      }`} />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Template Editor Workspace */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          {/* Active Template Information banner */}
          <div className="border-b border-gray-150 pb-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-secondary font-inter">
                Editing: {currentMeta?.name}
              </h2>

              {/* Active Toggle Switch */}
              <div className="flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">
                  {isActive ? 'Active (Live)' : 'Inactive (Disabled)'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-primary' : 'bg-gray-300'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>
            <div className="mt-3 p-3 bg-teal-50/70 rounded-xl border border-teal-100 text-xs space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-teal-900 flex items-center gap-1.5">
                  <FiInfo className="text-teal-600 w-4 h-4" /> Trigger Event: {currentMeta?.triggerEvent}
                </span>
                {currentMeta?.recipientRole && (
                  <span className="bg-teal-100 text-teal-800 font-semibold px-2.5 py-0.5 rounded-md text-[11px]">
                    Target Recipient: {currentMeta.recipientRole}
                  </span>
                )}
              </div>
              <p className="text-teal-700 text-xs leading-relaxed">
                {currentMeta?.description}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Subject Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Email Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject with template tags, e.g. Your verification OTP: {{otp}}"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-secondary font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 placeholder-gray-300 shadow-inner bg-gray-50/50"
              />
            </div>

            {/* Template Body Markup Textarea */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  HTML Body Markup (Handlebars Support)
                </label>
                <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                  <FiCode className="w-3.5 h-3.5" />
                  <span>Responsive Email Layout</span>
                </div>
              </div>

              <div className="relative rounded-xl border border-gray-200 overflow-hidden shadow-inner bg-gray-50/50">
                <textarea
                  id="template-body-textarea"
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Insert responsive HTML markup using Handlesbars format tags..."
                  rows={20}
                  className="w-full p-4 font-mono text-xs text-secondary leading-relaxed bg-transparent focus:ring-0 focus:border-transparent border-0 outline-none resize-y min-h-[400px]"
                />
              </div>
            </div>
          </div>

          {/* Action CTA Panel */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-150">
            {/* Restore Default Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestore}
              isLoading={isRestoring}
              leftIcon={<FiRotateCcw className="w-4 h-4 text-red-600" />}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Restore Default
            </Button>

            {/* Test Send & Save Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTestModal(true)}
                leftIcon={<FiSend className="w-4 h-4" />}
              >
                Test Dispatch
              </Button>

              <Button
                onClick={handleSave}
                isLoading={isSaving}
                size="sm"
                leftIcon={<FiSave className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel: Variable Explorer & Sandboxed Live Preview */}
        <div className="lg:col-span-4 space-y-6">

          {/* Visual Variable Badges Box */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center space-x-2">
              <FiSliders className="text-primary w-5 h-5" />
              <h3 className="font-bold text-secondary text-sm uppercase tracking-wider font-inter">
                Variable Explorer
              </h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Click any variable tag below to inject its handlebars placeholder value directly into the body editor pane at the cursor position.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {allVariables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 border border-gray-150 text-primary hover:border-primary hover:bg-primary/5 transition-all duration-150 cursor-pointer shadow-sm"
                >
                  <span className="text-[10px] text-primary/70 font-mono">{"{{"}</span>
                  <span className="font-mono text-secondary">{variable}</span>
                  <span className="text-[10px] text-primary/70 font-mono">{"}}"}</span>
                </button>
              ))}
            </div>
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-800">
              <FiInfo className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                Make sure to include appropriate fallback text if needed. Global variable <span className="font-semibold">{"{{companyName}}"}</span> is resolved from settings.
              </p>
            </div>
          </div>

          {/* Sandboxed Live Compiled HTML Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col h-[580px]">
            {/* Preview Toolbar */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <FiEye className="text-primary w-5 h-5" />
                <span className="font-bold text-secondary text-sm uppercase tracking-wider font-inter">
                  Compiled Live Preview
                </span>
              </div>

              {/* Device Mode Switcher */}
              <div className="flex bg-gray-200/80 p-0.5 rounded-lg border border-gray-300">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-secondary'
                    }`}
                  title="Desktop View"
                >
                  <FiMonitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-secondary'
                    }`}
                  title="Mobile View"
                >
                  <FiSmartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Compiled subject line info box */}
            <div className="px-4 py-2.5 border-b border-gray-150 bg-gray-50/50 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 select-none">Subject:</span>
              <span className="text-xs font-semibold text-secondary truncate">
                {previewSubject || '(Subject Draft Preview)'}
              </span>
            </div>

            {/* Sandbox Render area */}
            <div className="flex-1 bg-gray-100 p-4 flex justify-center items-stretch overflow-hidden relative">
              {isPreviewLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-100 shadow-md">
                    <div className=" rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-xs text-gray-500 font-semibold font-inter">Compiling template...</span>
                  </div>
                </div>
              )}

              {previewHtml ? (
                <div
                  className={`bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-all duration-300 flex flex-col ${previewDevice === 'mobile' ? 'w-[360px] max-w-full' : 'w-full'
                    }`}
                >
                  <iframe
                    title="Live Sandboxed Preview"
                    srcDoc={previewHtml}
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-300 rounded-2xl w-full">
                  <FiMail className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500 font-inter">No Preview Compiled</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[200px] leading-relaxed font-inter">
                    Start entering your Subject and HTML Body markup to automatically generate a compiled layout.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Test Dispatch Modal */}
      {showTestModal && (
        <Modal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          title="SMTP Dispatch Tester"
          size="small"
        >
          <div className="space-y-4">
            <p className="text-gray-400 text-xs">
              Verify final template layout inside real mail clients.
            </p>

            <form onSubmit={handleTestSend} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Test Recipient Address
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-secondary font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
                <p className="text-[10px] text-gray-400 leading-relaxed font-inter">
                  We will compile a temporary render using realistic system mock-data values (e.g. otp, amount, client details) and send the email immediately using the active SMTP server settings.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTestModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isTesting}
                  size="sm"
                  leftIcon={<FiSend className="w-4 h-4" />}
                >
                  Send Live Test
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EmailTemplate;
