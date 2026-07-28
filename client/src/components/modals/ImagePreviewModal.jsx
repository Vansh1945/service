import React from 'react';
import Modal from '../ui/Modal';

const ImagePreviewModal = ({ isOpen, onClose, title = "Image Preview", imageUrl }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="large">
      <div className="flex items-center justify-center p-2">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="max-h-[70vh] w-auto object-contain rounded-xl shadow-sm" />
        ) : (
          <div className="text-sm font-medium text-neutral-400 py-12">No image available</div>
        )}
      </div>
    </Modal>
  );
};

export default ImagePreviewModal;
