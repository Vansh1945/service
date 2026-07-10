import React, { useState, useEffect, useRef } from 'react';
import {
  FiFileText, FiSave, FiRotateCcw, FiEye, FiSliders,
  FiChevronRight, FiCheck, FiCopy, FiInfo, FiTrash2, FiExternalLink, FiX
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import * as SystemService from '../../services/SystemService';
import { useConfirm } from '../../context/ConfirmContext';

const DYNAMIC_VARIABLES = [
  'companyName', 'companyLogo', 'companyAddress', 'companyEmail', 'companyPhone', 'companyWebsite',
  'providerName', 'providerId', 'providerEmail', 'providerPhone', 'providerCategory', 'providerStatus',
  'approvalDate', 'agreementDate', 'documentNumber', 'verificationStatus', 'aadhaarNumberMasked', 'panNumberMasked',
  'currentAddress', 'permanentAddress', 'bankName', 'accountNumberMasked', 'ifsc', 'branch', 'city', 'state',
  'adminName', 'generatedDate', 'generatedTime', 'agreementVersion', 'supportEmail', 'supportPhone', 'currentYear',
  'otp', 'expiry', 'email', 'name', 'reason', 'agreementPdfUrl', 'approvalLetterUrl', 'remark', 'withdrawAmount',
  'customerName', 'bookingId', 'serviceName', 'amount', 'street'
];

const FormField = ({ label, value, onChange, placeholder, type = 'text', textarea = false, rows = 3, fieldRef = null, onFocus = null }) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      {textarea ? (
        <textarea
          ref={fieldRef}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          placeholder={placeholder}
          rows={rows}
          className="w-full p-3 font-mono text-xs border rounded-xl bg-gray-50/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-secondary"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-secondary"
        />
      )}
    </div>
  );
};

const TemplateManagement = () => {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Editor states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [hasLetterHead, setHasLetterHead] = useState(true);
  const [headerText, setHeaderText] = useState('');
  const [body, setBody] = useState('');
  const [footerText, setFooterText] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [authorizedSignatory, setAuthorizedSignatory] = useState('');
  const [hasCompanySeal, setHasCompanySeal] = useState(true);
  const [hasQrSection, setHasQrSection] = useState(true);
  const [hasWatermark, setHasWatermark] = useState(true);

  // Focused field tracker to insert placeholders
  const [lastFocusedField, setLastFocusedField] = useState('body');
  const bodyRef = useRef(null);
  const termsRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      // Find active version
      const activeVersion = selectedTemplate.versions.find(v => v.isActive) || selectedTemplate.versions[0] || {};
      setTitle(activeVersion.title || '');
      setSubtitle(activeVersion.subtitle || '');
      setHasLetterHead(activeVersion.hasLetterHead !== false);
      setHeaderText(activeVersion.headerText || '');
      setBody(activeVersion.body || '');
      setFooterText(activeVersion.footerText || '');
      setTerms(activeVersion.terms || '');
      setNotes(activeVersion.notes || '');
      setAuthorizedSignatory(activeVersion.authorizedSignatory || '');
      setHasCompanySeal(activeVersion.hasCompanySeal !== false);
      setHasQrSection(activeVersion.hasQrSection !== false);
      setHasWatermark(activeVersion.hasWatermark !== false);

      // Load preview for active version
      generatePreview(selectedTemplate.key, activeVersion);
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await SystemService.getTemplates();
      if (response.data?.success) {
        setTemplates(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedTemplate(response.data.data[0]);
        }
      } else {
        toast.error('Failed to load document templates.');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates.');
    } finally {
      setLoading(false);
    }
  };

  const getFormState = () => ({
    title,
    subtitle,
    hasLetterHead,
    headerText,
    body,
    footerText,
    terms,
    notes,
    authorizedSignatory,
    hasCompanySeal,
    hasQrSection,
    hasWatermark
  });

  const generatePreview = async (key = selectedTemplate?.key, customState = null) => {
    if (!key) return;
    setIsPreviewLoading(true);
    try {
      const state = customState || getFormState();
      const response = await SystemService.previewTemplate(key, state);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(url);
    } catch (error) {
      if (error.message === 'silent_cancel') return;
      console.error('Error rendering template preview:', error);
      toast.error('Failed to compile PDF preview.');
    } finally {
      setIsPreviewLoading(false);
    }

  };

  const handleSaveDraft = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      const response = await SystemService.saveTemplateVersion(selectedTemplate.key, getFormState());
      if (response.data?.success) {
        toast.success(`🎉 Saved new draft version for ${selectedTemplate.name}!`);
        // Re-fetch template to get the new versions list
        const refresh = await SystemService.getTemplateByKey(selectedTemplate.key);
        if (refresh.data?.success) {
          const updatedTemplate = refresh.data.data;
          setTemplates(prev => prev.map(t => t.key === updatedTemplate.key ? updatedTemplate : t));
          setSelectedTemplate(updatedTemplate);
        }
      } else {
        toast.error(response.data?.message || 'Failed to save template version.');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template version.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (version) => {
    if (!selectedTemplate) return;
    try {
      const response = await SystemService.publishTemplateVersion(selectedTemplate.key, version);
      if (response.data?.success) {
        toast.success(`🚀 Version ${version} published for ${selectedTemplate.name}!`);
        const refresh = await SystemService.getTemplateByKey(selectedTemplate.key);
        if (refresh.data?.success) {
          const updatedTemplate = refresh.data.data;
          setTemplates(prev => prev.map(t => t.key === updatedTemplate.key ? updatedTemplate : t));
          setSelectedTemplate(updatedTemplate);
        }
      } else {
        toast.error('Failed to publish version.');
      }
    } catch (error) {
      console.error('Error publishing version:', error);
      toast.error('Failed to publish version.');
    }
  };

  const handleRestore = async (version) => {
    if (!selectedTemplate) return;
    try {
      const response = await SystemService.restoreTemplateVersion(selectedTemplate.key, version);
      if (response.data?.success) {
        toast.success(`🔄 Restored version ${version} details!`);
        const refresh = await SystemService.getTemplateByKey(selectedTemplate.key);
        if (refresh.data?.success) {
          const updatedTemplate = refresh.data.data;
          setTemplates(prev => prev.map(t => t.key === updatedTemplate.key ? updatedTemplate : t));
          setSelectedTemplate(updatedTemplate);
        }
      } else {
        toast.error('Failed to restore version.');
      }
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version.');
    }
  };

  const handleDuplicate = async (version) => {
    if (!selectedTemplate) return;
    try {
      const response = await SystemService.duplicateTemplateVersion(selectedTemplate.key, version);
      if (response.data?.success) {
        toast.success(`📋 Duplicated version ${version} successfully!`);
        const refresh = await SystemService.getTemplateByKey(selectedTemplate.key);
        if (refresh.data?.success) {
          const updatedTemplate = refresh.data.data;
          setTemplates(prev => prev.map(t => t.key === updatedTemplate.key ? updatedTemplate : t));
          setSelectedTemplate(updatedTemplate);
        }
      } else {
        toast.error('Failed to duplicate version.');
      }
    } catch (error) {
      console.error('Error duplicating version:', error);
      toast.error('Failed to duplicate version.');
    }
  };

  const insertVariable = (variable) => {
    const placeholder = `{{${variable}}}`;
    if (lastFocusedField === 'body') {
      const start = bodyRef.current?.selectionStart || 0;
      const end = bodyRef.current?.selectionEnd || 0;
      const nextBody = body.substring(0, start) + placeholder + body.substring(end);
      setBody(nextBody);
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.selectionStart = bodyRef.current.selectionEnd = start + placeholder.length;
          bodyRef.current.focus();
        }
      }, 50);
    } else if (lastFocusedField === 'terms') {
      const start = termsRef.current?.selectionStart || 0;
      const end = termsRef.current?.selectionEnd || 0;
      const nextTerms = terms.substring(0, start) + placeholder + terms.substring(end);
      setTerms(nextTerms);
      setTimeout(() => {
        if (termsRef.current) {
          termsRef.current.selectionStart = termsRef.current.selectionEnd = start + placeholder.length;
          termsRef.current.focus();
        }
      }, 50);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-inter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-secondary tracking-tight">Dynamic Template Workspace</h1>
          <p className="text-xs text-gray-400 mt-1">
            Edit live document variables, layout styling features, and preview generated output.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left side: Template list */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50 border-b border-gray-150">
            <span className="font-bold text-secondary text-xs uppercase tracking-wider">Available Templates</span>
          </div>
          <nav className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {templates.map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => setSelectedTemplate(tpl)}
                className={`w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${selectedTemplate?.key === tpl.key ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
              >
                <div>
                  <div className="font-bold text-secondary text-sm">{tpl.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{tpl.description}</div>
                </div>
                <FiChevronRight className={`text-gray-400 w-4 h-4 transition-transform ${selectedTemplate?.key === tpl.key ? 'transform translate-x-1 text-primary' : ''}`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Center: Template configuration form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="border-b border-gray-150 pb-4">
            <h2 className="text-lg font-bold text-secondary font-inter">
              Configure layout: {selectedTemplate?.name}
            </h2>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
              {selectedTemplate?.description}
            </p>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Title & Subtitle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Document Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. PROVIDER SERVICE AGREEMENT"
              />
              <FormField
                label="Subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Terms and Conditions Policy"
              />
            </div>

            {/* Header text */}
            <FormField
              label="Header Section Line"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="e.g. OFFICIAL PLATFORM CONTRACT"
            />

            {/* Layout Toggles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs font-semibold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLetterHead}
                  onChange={(e) => setHasLetterHead(e.target.checked)}
                  className="rounded text-primary focus:ring-0"
                />
                Letterhead
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWatermark}
                  onChange={(e) => setHasWatermark(e.target.checked)}
                  className="rounded text-primary focus:ring-0"
                />
                Watermark
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCompanySeal}
                  onChange={(e) => setHasCompanySeal(e.target.checked)}
                  className="rounded text-primary focus:ring-0"
                />
                Seal & Stamp
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasQrSection}
                  onChange={(e) => setHasQrSection(e.target.checked)}
                  className="rounded text-primary focus:ring-0"
                />
                QR Section
              </label>
            </div>

            {/* Body */}
            <FormField
              label="Document Body Content (Handlebars supported)"
              fieldRef={bodyRef}
              value={body}
              onFocus={() => setLastFocusedField('body')}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type dynamic body template..."
              textarea
              rows={8}
            />

            {/* Terms */}
            <FormField
              label="Terms & Conditions (one per line)"
              fieldRef={termsRef}
              value={terms}
              onFocus={() => setLastFocusedField('terms')}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Type legal terms..."
              textarea
              rows={4}
            />

            {/* Footer and Signatory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Footer Line"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Page 1 of 1"
              />
              <FormField
                label="Authorized Signatory Position"
                value={authorizedSignatory}
                onChange={(e) => setAuthorizedSignatory(e.target.value)}
                placeholder="e.g. Operations Manager"
              />
            </div>

            {/* Notes */}
            <FormField
              label="Bottom Notes / Disclaimer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Disclaimer or system generated note..."
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-150">
            <button
              onClick={() => generatePreview()}
              disabled={isPreviewLoading}
              className="flex items-center px-4 py-2 rounded-xl border hover:bg-gray-50 font-bold text-sm"
            >
              <FiEye className="mr-2" />
              Refresh Preview
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-teal-700"
            >
              <FiSave className="mr-2" />
              {isSaving ? 'Saving Draft...' : 'Save Draft Version'}
            </button>
          </div>
        </div>

        {/* Right side: Preview & Variable Badges & Versions List */}
        <div className="lg:col-span-4 space-y-6">
          {/* Variables list */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center space-x-2">
              <FiSliders className="text-primary w-5 h-5" />
              <h3 className="font-bold text-secondary text-sm uppercase tracking-wider">Variable Explorer</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
              {DYNAMIC_VARIABLES.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-semibold bg-gray-50 hover:bg-primary/5 hover:border-primary border border-gray-150 text-secondary cursor-pointer"
                >
                  {"{{" + v + "}}"}
                </button>
              ))}
            </div>
          </div>

          {/* Iframe dynamic preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[400px] flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-secondary text-sm uppercase tracking-wider">Live Preview</span>
              {isPreviewLoading && <div className="text-xs text-primary font-semibold">Compiling...</div>}
            </div>
            <div className="flex-1 bg-gray-100 p-2 flex justify-center items-stretch relative">
              {pdfUrl ? (
                <iframe
                  title="PDF Live preview"
                  src={pdfUrl}
                  className="w-full h-full border-0 bg-white rounded-lg shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 w-full text-gray-400">
                  <FiEye size={36} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No Preview Generated</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



export default TemplateManagement;
