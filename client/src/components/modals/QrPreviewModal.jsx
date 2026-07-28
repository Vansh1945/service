import React from 'react';
import Modal from '../ui/Modal';

const QrPreviewModal = ({ isOpen, onClose, title = "QR Code Preview", qrCodeUrl, value }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="flex flex-col items-center justify-center text-center py-4">
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 object-contain rounded-2xl border border-neutral-100 p-2 shadow-sm" />
        ) : (
          <div className="w-56 h-56 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400 text-xs font-semibold">
            No QR Code
          </div>
        )}
        {value && <p className="mt-4 text-xs font-mono font-bold text-secondary break-all bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200">{value}</p>}
      </div>
    </Modal>
  );
};

export default QrPreviewModal;
