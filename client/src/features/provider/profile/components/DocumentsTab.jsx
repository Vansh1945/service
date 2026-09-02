import React from 'react';
import { FileText, Upload, CheckCircle2, AlertTriangle, Eye, Shield, Lock } from 'lucide-react';
import Processing from '../../../../components/ui/Processing';

const DocumentsTab = ({
  profileData,
  kycBadge,
  uploadingDoc,
  handleFileUpload,
  setPreviewImage
}) => {
  const badge = kycBadge || (() => {
    switch (profileData?.kycStatus) {
      case 'approved': return { label: 'Verified', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700' };
      case 'rejected': return { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700' };
      case 'pending': return { label: 'Under Review', bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700' };
      default: return { label: 'Not Submitted', bg: 'bg-neutral-100 text-neutral-600 border-neutral-200', text: 'text-neutral-600' };
    }
  })();

  const getDynamicDocuments = () => {
    // 1. Core Registration Uploaded Documents (Uploadable/Editable by Provider)
    const list = [
      { key: 'aadhaarFront', label: 'Aadhaar Card (Front)', value: profileData?.aadhaarFront, isReadOnly: false },
      { key: 'aadhaarBack', label: 'Aadhaar Card (Back)', value: profileData?.aadhaarBack, isReadOnly: false },
      { key: 'panCard', label: 'PAN Card', value: profileData?.panCard, isReadOnly: false },
      { key: 'liveSelfie', label: 'Live Verification Selfie', value: profileData?.liveSelfie, isReadOnly: false },
      { key: 'passbookImage', label: 'Bank Passbook / Cancelled Cheque', value: profileData?.bankDetails?.passbookImage || profileData?.passbookImage, isReadOnly: false },
    ];

    // 2. Auto-Generated System Documents (Read-Only post approval)
    list.push({
      key: 'agreementPdfUrl',
      label: 'Agreement Document (PDF)',
      value: profileData?.agreementPdfUrl,
      isReadOnly: true,
      badgeText: 'Auto Generated'
    });

    list.push({
      key: 'approvalLetterUrl',
      label: 'Approval Letter',
      value: profileData?.approvalLetterUrl,
      isReadOnly: true,
      badgeText: 'Auto Generated'
    });

    return list;
  };

  const documents = getDynamicDocuments();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Verification Summary Banner */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Document Status</span>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${badge.bg} ${badge.text}`}>
              KYC Status: {badge.label}
            </span>
          </div>
          {profileData.rejectionReason && profileData.kycStatus === 'rejected' && (
            <p className="text-xs text-red-600 font-semibold mt-2">
              Rejection Reason: {profileData.rejectionReason}
            </p>
          )}
        </div>
        <div className="text-xs text-neutral-400 font-medium max-w-sm">
          Please ensure all document photos are clear, unblurred, and readable for instant verification.
        </div>
      </div>

      {/* Documents List/Grid - Compact & Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {documents.map((doc) => {
          const isUploaded = Boolean(doc.value);
          const isUploading = uploadingDoc === doc.key;
          const isSystemDoc = doc.isReadOnly;
          const isKycApproved = profileData?.kycStatus === 'approved';

          // Provider can upload/replace ONLY IF it's not a system doc AND KYC is not yet approved
          const canUpload = !isSystemDoc && !isKycApproved;

          return (
            <div key={doc.key} className="bg-white rounded-xl border border-neutral-100 shadow-xs p-3 space-y-2 text-left">
              {/* Card Header & Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                    {isUploaded ? (
                      <img src={doc.value} alt={doc.label || "Document preview"} loading="lazy" decoding="async" width={32} height={32} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-secondary truncate" title={doc.label}>{doc.label}</h4>
                    <span className="text-[10px] text-neutral-400 font-bold block truncate">
                      {isSystemDoc ? 'System Document' : isKycApproved ? 'Verified & Locked' : isUploaded ? 'Uploaded (Pending Review)' : 'Action Required'}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${isSystemDoc
                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                    : isUploaded
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                  {isSystemDoc ? (doc.badgeText || 'Auto') : isUploaded ? 'Uploaded' : 'Missing'}
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-100">
                {isUploaded && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(doc.value)}
                    className={`py-1.5 bg-neutral-100 hover:bg-neutral-200 text-secondary rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 ${canUpload ? 'px-3' : 'w-full'}`}
                    title="View Document"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Document</span>
                  </button>
                )}

                {canUpload && (
                  <label className="block flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(doc.key, e.target.files[0])}
                      disabled={isUploading}
                      className="hidden"
                    />
                    <Processing
                      type="button"
                      loading={isUploading}
                      loadingText="Uploading..."
                      className="w-full py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5 inline-block" />
                      <span>{isUploaded ? 'Replace' : 'Upload'}</span>
                    </Processing>
                  </label>
                )}

                {!isUploaded && !canUpload && (
                  <div className="w-full py-1.5 bg-neutral-50 border border-neutral-150 rounded-lg text-[11px] font-semibold text-neutral-400 text-center">
                    {isSystemDoc ? 'Pending Generation' : 'Not Provided'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentsTab;
