import React, { useState } from 'react';
import {
  Shield,
  Mail,
  Phone,
  Calendar,
  Star,
  AlertCircle,
  TrendingUp,
  MapPin,
  Briefcase,
  Banknote,
  FileText,
  X,
  CheckCircle,
  Eye,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  Printer,
  Loader2
} from 'lucide-react';
import { toast } from '../../../../components/ui/Toast';
import * as ProviderService from '../../../../services/ProviderService';
import { getProviderDossierPdf } from '../../../../services/AdminService';
import { formatDate, formatDateTime, formatAddress as formatAddressUtil } from '../../../../utils/format';

const formatAddress = (address) => formatAddressUtil(address);

const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">{label}</span>
    <span className={`text-xs sm:text-sm font-semibold text-neutral-800 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || 'N/A'}</span>
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-primary', bgColor = 'bg-white', children }) => (
  <div className={`${bgColor} rounded-xl border border-neutral-200/80 shadow-2xs overflow-hidden transition-all`}>
    <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50/60 border-b border-neutral-100">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} size={16} />}
      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{title}</h4>
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </div>
);

const StatPill = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center rounded-xl p-3.5 bg-white border border-neutral-200/80 shadow-2xs transition-all">
    <span className="text-xl font-bold text-neutral-800 leading-tight">{value}</span>
    <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mt-1 text-center">{label}</span>
  </div>
);

const getServiceBadges = (services) => {
  if (!services || services.length === 0) return null;
  return services.map((service, idx) => {
    const name = typeof service === 'object' ? (service.name || service.title || service._id) : service;
    return (
      <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 mr-1 mb-1">
        {name}
      </span>
    );
  });
};

const getStatusBadge = (provider) => {
  if (provider.deletionRequested) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white border border-amber-700 animate-pulse">
        🚨 Deletion Requested
      </span>
    );
  }
  if (provider.blockedTill && new Date(provider.blockedTill) > new Date()) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white border border-red-700">
        Blocked
      </span>
    );
  }
  if (provider.isSuspended) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
        <AlertCircle className="w-3 h-3 mr-1 animate-pulse" />Suspended
      </span>
    );
  }
  if (provider.performanceScore?.restrictionsActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Shield className="w-3 h-3 mr-1 text-amber-600 animate-pulse" />Restricted
      </span>
    );
  }
  if (provider.kycStatus === 'rejected') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Rejected
      </span>
    );
  }
  if (provider.approved) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />Approved
      </span>
    );
  }
  if (provider.kycStatus === 'pending') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      Inactive
    </span>
  );
};

const ProviderModal = ({
  provider,
  onClose,
  approvalRemarks,
  setApprovalRemarks,
  processingAction,
  handleStatusUpdate,
  handleDownloadPDF,
  onRefresh
}) => {
  const [previewDoc, setPreviewDoc] = useState(null);

  if (!provider) return null;
  const ps = provider.performanceScore || {};
  const bd = provider.bankDetails || {};

  const handlePermanentDelete = async (providerId) => {
    if (!window.confirm('Are you sure you want to permanently delete this provider account? This action cannot be undone.')) return;
    try {
      if (typeof processingAction === 'function') processingAction('permanent_delete');
      const res = await ProviderService.permanentDeleteAccount(providerId);
      if (res.data?.success) {
        toast.success(res.data.message || 'Provider account permanently deleted');
        onClose();
        if (typeof onRefresh === 'function') onRefresh();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete provider account');
    }
  };

  const handleRejectDeletion = async (providerId) => {
    try {
      const res = await ProviderService.rejectDeletionRequest(providerId);
      if (res.data?.success) {
        toast.success(res.data.message || 'Deletion request rejected successfully');
        onClose();
        if (typeof onRefresh === 'function') onRefresh();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reject deletion request');
    }
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrintDossierPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const targetId = provider.providerId || provider._id;
      const res = await getProviderDossierPdf(targetId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);

      // Open in a new tab so admin can immediately view and use the browser's native Print (Ctrl+P) dialog
      window.open(blobUrl, '_blank');

      // Also trigger a clean download fallback
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Provider_Dossier_${provider.providerId || provider._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Provider dossier PDF generated successfully!');
    } catch (err) {
      console.error('Error generating provider dossier PDF:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to generate provider PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-neutral-200/80 animate-scale-up">
        {/* Header */}
        <div className="bg-neutral-50/80 p-5 sm:p-6 relative border-b border-neutral-200/70">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-full transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={provider.profilePicUrl || '/default-avatar.png'}
                  alt={provider.name || "Provider profile photo"}
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                  className="w-14 h-14 rounded-full object-cover border border-neutral-200 bg-white shadow-2xs shrink-0"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-neutral-800 tracking-tight">{provider.name}</h2>
                  {getStatusBadge(provider)}
                  {ps.restrictionsActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                      <Shield size={10} /> Restricted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1.5 flex-wrap font-medium">
                  <span className="font-mono text-neutral-700 bg-neutral-200/60 px-2 py-0.5 rounded-md text-[11px] font-bold">
                    #{provider.providerId || provider._id?.slice(-8)}
                  </span>
                  <span className="flex items-center gap-1"><Mail size={12} className="text-neutral-400" />{provider.email}</span>
                  {provider.phone && <span className="flex items-center gap-1"><Phone size={12} className="text-neutral-400" />{provider.phone}</span>}
                  <span className="flex items-center gap-1"><Calendar size={12} className="text-neutral-400" />Joined {formatDate(provider.registrationDate || provider.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {provider.averageRating > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <Star size={16} className="text-amber-500 fill-amber-500" />
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-800 leading-none block">{provider.averageRating.toFixed(1)}</span>
                    <span className="text-[9px] text-amber-600 font-semibold uppercase tracking-wider block mt-0.5">Avg Rating</span>
                  </div>
                </div>
              )}

              <button
                onClick={handlePrintDossierPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-60 cursor-pointer"
                title="Print or download complete Provider dossier PDF with all documents on single pages"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / PDF Dossier</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-4">

          {/* Restriction Alert */}
          {ps.restrictionsActive && (
            <div className="bg-danger-light/40 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-danger">Account Restricted</p>
                <p className="text-xs text-danger mt-0.5">
                  {ps.restrictionReason || 'Restricted due to poor performance or excessive complaints.'}
                </p>
                {ps.restrictedUntil && (
                  <p className="text-xs text-danger mt-0.5">
                    Until: {formatDateTime(ps.restrictedUntil)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Performance Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill
              label="Completed Jobs"
              value={provider.completedBookings || 0}
            />
            <StatPill
              label="Cancelled Jobs"
              value={provider.canceledBookings || 0}
            />
            <StatPill
              label="Experience"
              value={`${provider.experience || 0}y`}
            />
            <StatPill
              label="Performance Badge"
              value={ps.badge || 'bronze'}
            />
          </div>

          {/* Performance Metrics */}
          <SectionCard title="Performance Metrics" icon={TrendingUp} iconColor="text-primary">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Rating" value={ps.rating > 0 ? `⭐ ${ps.rating.toFixed(1)}` : 'No ratings yet'} />
              <InfoRow label="On-Time %" value={`${ps.onTimePercentage?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Completion %" value={`${ps.completionPercentage?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Cancellation Ratio" value={`${ps.cancellationRatio?.toFixed(1) || '0.0'}%`} />
              <InfoRow label="Complaint Ratio" value={`${ps.complaintRatio?.toFixed(1) || '0.0'}%`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">COD Risk</span>
                <span className={`text-xs sm:text-sm font-bold ${ps.codAbuseRisk === 'HIGH' ? 'text-danger' :
                  ps.codAbuseRisk === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{ps.codAbuseRisk || 'LOW'}</span>
              </div>
            </div>
          </SectionCard>

          {/* Contact Information */}
          <SectionCard title="Contact Information" icon={Mail} iconColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Email" value={provider.email} />
              <InfoRow label="Phone" value={provider.phone} />
              <InfoRow label="Date of Birth" value={formatDate(provider.dateOfBirth)} />
              <InfoRow label="Address" value={formatAddress(provider.address)} />
            </div>
            {(provider.address?.s2CellId || provider.address?.s2CellIdPrecise) && (
              <div className="mt-4 bg-neutral-900 text-neutral-100 p-3.5 rounded-xl border border-neutral-800">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin size={12} className="text-teal-400" /> S2 Geofence Telemetry
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {provider.address?.s2CellId && (
                    <div className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-neutral-400 font-medium">Level 13 (≈1km²)</span>
                      <span className="font-mono text-xs text-teal-300 font-semibold">{provider.address.s2CellId}</span>
                    </div>
                  )}
                  {provider.address?.s2CellIdPrecise && (
                    <div className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-neutral-400 font-medium">Level 15 (≈150m²)</span>
                      <span className="font-mono text-xs text-emerald-300 font-semibold">{provider.address.s2CellIdPrecise}</span>
                    </div>
                  )}
                  {provider.address?.lat && provider.address?.lng && (
                    <div className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-neutral-400 font-medium">Coords</span>
                      <span className="font-mono text-xs text-neutral-300">
                        {parseFloat(provider.address.lat).toFixed(5)}, {parseFloat(provider.address.lng).toFixed(5)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Professional Information */}
          <SectionCard title="Professional Information" icon={Briefcase} iconColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-2">Services Offered</span>
                <div className="flex flex-wrap gap-1.5">
                  {getServiceBadges(provider.services) || <span className="text-xs text-neutral-500">N/A</span>}
                </div>
              </div>
              <InfoRow label="Service Area" value={provider.serviceArea} />
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1.5">KYC Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${provider.kycStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  provider.kycStatus === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                  {provider.kycStatus?.charAt(0).toUpperCase() + provider.kycStatus?.slice(1) || 'N/A'}
                </span>
                {provider.rejectionReason && (
                  <p className="text-xs text-rose-600 mt-1">Reason: {provider.rejectionReason}</p>
                )}
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1.5">Test Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${provider.testPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}>
                  {provider.testPassed ? '✓ Passed' : 'Not Passed'}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Identity & KYC Documents (ID Proofs) */}
          {(() => {
            const kycDocs = [];
            const hasAadhaar = Boolean(provider.aadhaarFront || provider.aadhaarBack);
            const hasPan = Boolean(provider.panCard);

            if (hasAadhaar) {
              kycDocs.push({
                id: 'aadhaarFront',
                title: 'Aadhaar Card (Front)',
                subtitle: provider.aadhaarNumber || provider.kycDetails?.aadhaarNumber 
                  ? `Aadhaar: ${provider.aadhaarNumber || provider.kycDetails?.aadhaarNumber}` 
                  : 'Front identity with photograph',
                url: provider.aadhaarFront,
                icon: FileText
              });
              kycDocs.push({
                id: 'aadhaarBack',
                title: 'Aadhaar Card (Back)',
                subtitle: 'Back side containing address',
                url: provider.aadhaarBack,
                icon: FileText
              });
            }

            if (hasPan || (!hasAadhaar && !hasPan)) {
              kycDocs.push({
                id: 'panCard',
                title: 'PAN Card',
                subtitle: provider.panNumber || provider.kycDetails?.panNumber 
                  ? `PAN: ${provider.panNumber || provider.kycDetails?.panNumber}` 
                  : 'Government tax identification card',
                url: provider.panCard,
                icon: FileText
              });
            }

            // Always show Live Selfie
            kycDocs.push({
              id: 'liveSelfie',
              title: 'Live Verification Selfie',
              subtitle: 'Real-time face verification photo',
              url: provider.liveSelfie,
              icon: Camera
            });

            const uploadedCount = kycDocs.filter(d => !!d.url).length;

            return (
              <SectionCard
                title={`Identity & KYC Documents (${uploadedCount}/${kycDocs.length} Verified)`}
                icon={Shield}
                iconColor="text-teal-600"
              >
                <div className={`grid gap-3.5 ${kycDocs.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {kycDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`border rounded-xl p-3 flex flex-col justify-between transition-all ${
                        doc.url
                          ? 'bg-neutral-50/70 border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs'
                          : 'bg-neutral-50/30 border-dashed border-neutral-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            doc.url ? 'bg-teal-50 text-teal-700 border border-teal-200/60' : 'bg-neutral-100 text-neutral-400'
                          }`}>
                            <doc.icon size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-800 leading-snug">{doc.title}</p>
                            <p className="text-[10px] text-neutral-400 leading-tight truncate max-w-[140px] sm:max-w-[160px]">{doc.subtitle}</p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            doc.url
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {doc.url ? 'Uploaded' : 'Missing'}
                        </span>
                      </div>

                      {doc.url ? (
                        <div className="relative rounded-lg overflow-hidden border border-neutral-200 bg-neutral-900/5 group/img aspect-video flex items-center justify-center">
                          <img
                            src={doc.url}
                            alt={doc.title}
                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-neutral-900/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="px-2.5 py-1.5 bg-white text-neutral-800 text-xs font-semibold rounded-lg shadow hover:bg-neutral-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={12} />
                              Preview
                            </button>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-neutral-800 text-white rounded-lg shadow hover:bg-neutral-700 transition-colors cursor-pointer"
                              title="Open original in new tab"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 flex flex-col items-center justify-center text-neutral-400 p-3 text-center">
                          <ImageIcon size={20} className="text-neutral-300 mb-1" />
                          <span className="text-[11px] font-medium text-neutral-400">Document not uploaded</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          })()}

          {/* Bank & Payout Details */}
          {provider.bankDetails && (
            <SectionCard title="Bank & Payout Verification" icon={Banknote} iconColor="text-primary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Account Name" value={bd.accountName} />
                <InfoRow label="Account Number" value={bd.accountNo} mono />
                <InfoRow label="Bank Name" value={bd.bankName} />
                <InfoRow label="IFSC Code" value={bd.ifsc} mono />
                <InfoRow label="UPI ID" value={bd.upiId || 'N/A'} mono />
                <InfoRow label="Preferred Payout Method" value={bd.preferredMethod || 'bank_account'} />
                {bd.district && <InfoRow label="District" value={bd.district} />}
                {bd.address && (
                  <div className="sm:col-span-2">
                    <InfoRow label="Branch Address" value={bd.address} />
                  </div>
                )}
                <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-neutral-100">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Verification Status</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${bd.bankVerificationStatus === 'verified'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : bd.bankVerificationStatus === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                    {bd.bankVerificationStatus === 'verified'
                      ? '✓ Verified & Active'
                      : bd.bankVerificationStatus === 'rejected'
                        ? '✕ Rejected'
                        : '⏳ Pending Admin Review'}
                  </span>
                </div>
              </div>

              {/* Visual Comparison: Current vs Backup/Pending (If Re-verification Pending) */}
              {(() => {
                let backupData = null;
                if (provider.rejectionReason && provider.rejectionReason.startsWith('{') && provider.rejectionReason.endsWith('}')) {
                  try { backupData = JSON.parse(provider.rejectionReason); } catch (e) { backupData = null; }
                }
                if (!backupData) return null;

                const fields = [
                  { label: 'Holder Name', curr: backupData.accountName, proposed: bd.accountName },
                  { label: 'Account Number', curr: backupData.accountNo, proposed: bd.accountNo },
                  { label: 'IFSC Code', curr: backupData.ifsc, proposed: bd.ifsc },
                  { label: 'Bank Name', curr: backupData.bankName, proposed: bd.bankName },
                ];
                const changedFields = fields.filter(f => (f.curr || '').trim() !== (f.proposed || '').trim());

                return (
                  <div className="mt-4 pt-3 border-t border-neutral-100 bg-amber-50/40 p-4 rounded-xl border border-amber-200/80">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-2">
                      ⚠️ Visual Comparison (Current Verified vs New Proposed)
                    </span>
                    {changedFields.length === 0 ? (
                      <p className="text-xs text-amber-800 italic">No fields changed.</p>
                    ) : (
                      <div className="space-y-2">
                        {fields.map(f => {
                          const isChanged = (f.curr || '').trim() !== (f.proposed || '').trim();
                          return (
                            <div key={f.label} className={`grid grid-cols-3 gap-2 text-xs p-2 rounded-lg ${isChanged ? 'bg-amber-100 border border-amber-300 font-bold' : 'bg-white/60'}`}>
                              <span className="text-neutral-500 font-semibold">{f.label}</span>
                              <span className="text-neutral-700">Current: {f.curr || '—'}</span>
                              <span className={isChanged ? 'text-amber-900 font-extrabold' : 'text-neutral-700'}>
                                New: {f.proposed || '—'} {isChanged && '✏️'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Passbook / Cancelled Cheque Image */}
              {bd.passbookImage && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-2">Passbook / Cheque Document</span>
                  <div className="relative group/passbook rounded-xl overflow-hidden border border-neutral-200 shadow-2xs w-44 h-28 bg-neutral-900/5 flex items-center justify-center">
                    <img src={bd.passbookImage} alt="Passbook/Cheque" className="w-full h-full object-cover group-hover/passbook:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-neutral-900/50 opacity-0 group-hover/passbook:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ title: 'Bank Passbook / Cheque Document', url: bd.passbookImage })}
                        className="px-2.5 py-1.5 bg-white text-neutral-800 text-xs font-semibold rounded-lg shadow hover:bg-neutral-100 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                      <a
                        href={bd.passbookImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-neutral-800 text-white rounded-lg shadow hover:bg-neutral-700 transition-colors cursor-pointer"
                        title="Open in new tab"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Verification History Timeline */}
              {Array.isArray(bd.verificationHistory) && bd.verificationHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-2">Verification Timeline</span>
                  <div className="space-y-2">
                    {bd.verificationHistory.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
                        <span className="font-semibold uppercase tracking-wider text-neutral-700">{item.status}</span>
                        <span className="text-neutral-400">{formatDateTime(item.timestamp)}</span>
                        <span className="text-neutral-500 italic">{item.reason || 'No remarks'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Legal Contracts & Signatures */}
          <SectionCard title="Legal Contracts & Signatures" icon={FileText} iconColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-neutral-200/80 p-4 rounded-xl bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs sm:text-sm mb-1">Provider Service Agreement</h4>
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Legal contract containing self declaration and digital signature logs.</p>
                </div>
                {provider.legalAcceptance?.agreementAccepted ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(provider._id, 'agreement')}
                    className="text-center py-2 px-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg transition-all duration-200 font-semibold text-xs block w-full shadow-2xs cursor-pointer"
                  >
                    Download/View Agreement PDF
                  </button>
                ) : (
                  <button disabled className="py-2 px-3 bg-neutral-100 text-neutral-400 rounded-lg font-medium text-xs cursor-not-allowed w-full">
                    Agreement Pending Acceptance
                  </button>
                )}
              </div>
              <div className="border border-neutral-200/80 p-4 rounded-xl bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs sm:text-sm mb-1">Official Approval Letter</h4>
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Registration confirmation letter with approved service details.</p>
                </div>
                {provider.approved ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(provider._id, 'approval')}
                    className="text-center py-2 px-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg transition-all duration-200 font-semibold text-xs block w-full shadow-2xs cursor-pointer"
                  >
                    Download/View Approval Letter
                  </button>
                ) : (
                  <button disabled className="py-2 px-3 bg-neutral-100 text-neutral-400 rounded-lg font-medium text-xs cursor-not-allowed w-full">
                    Approval Letter Pending Activation
                  </button>
                )}
              </div>
            </div>
            {provider.legalAcceptance?.acceptedAt && (
              <div className="mt-4 pt-3 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-neutral-500 font-medium">
                <div>Accepted At: {formatDateTime(provider.legalAcceptance.acceptedAt)}</div>
                <div>Version: {provider.legalAcceptance.version}</div>
                <div>IP: {provider.legalAcceptance.ipAddress || 'N/A'}</div>
                {provider.digitalSignature?.signatureUrl && (
                  <div className="flex items-center gap-2">
                    <span>Signature:</span>
                    <img src={provider.digitalSignature.signatureUrl} alt="Signature" className="h-6 object-contain bg-white border rounded" />
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Deletion Request Alert */}
          {provider.deletionRequested && (
            <SectionCard title="Account Deletion Request" icon={Shield} iconColor="text-rose-600" bgColor="bg-rose-50/60">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 text-xs">
                    <AlertCircle size={15} className="text-rose-600" />
                    <span>Provider Requested Account Deletion</span>
                  </div>
                  <span className="text-[10px] text-rose-600 font-bold">
                    Requested: {provider.deletionRequestedAt ? formatDate(provider.deletionRequestedAt) : 'Recently'}
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium">
                  Reason: <span className="italic">{provider.deletionReason || 'Provider requested account deletion'}</span>
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(provider._id)}
                    disabled={processingAction}
                    className="py-2 px-3 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <X size={13} />
                    {processingAction === 'permanent_delete' ? 'Deleting…' : 'Approve & Permanently Delete Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectDeletion(provider._id)}
                    disabled={processingAction}
                    className="py-2 px-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle size={13} />
                    {processingAction === 'reject_deletion' ? 'Rejecting…' : 'Reject Deletion Request'}
                  </button>
                </div>
              </div>
            </SectionCard>
          )}

        </div>

        {/* ── Sticky Footer ── */}
        <div className="flex-shrink-0 px-6 py-3.5 border-t border-neutral-200/80 bg-neutral-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Document Lightbox Preview Modal */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-xs animate-fade-in"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 text-white border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-teal-400" />
                  <h3 className="text-sm font-bold tracking-tight">{previewDoc.title}</h3>
                  <span className="text-xs text-neutral-400 hidden sm:inline">| {provider.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium"
                    title="Open original file in new tab"
                  >
                    <ExternalLink size={14} />
                    <span className="hidden sm:inline">Open in Tab</span>
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-neutral-950/40 overflow-auto flex items-center justify-center min-h-[300px] max-h-[75vh]">
                <img
                  src={previewDoc.url}
                  alt={previewDoc.title}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-md"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderModal;
