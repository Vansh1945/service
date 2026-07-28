import React from 'react';
import Modal from '../ui/Modal';

const PdfPreviewModal = ({ isOpen, onClose, title = "Document Preview", pdfUrl }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xlarge">
      <div className="w-full h-[70vh] flex items-center justify-center bg-neutral-100 rounded-xl overflow-hidden">
        {pdfUrl ? (
          <iframe src={pdfUrl} title={title} className="w-full h-full border-none" />
        ) : (
          <div className="text-sm font-medium text-neutral-400">No PDF document available</div>
        )}
      </div>
    </Modal>
  );
};

export default PdfPreviewModal;
