import React from 'react';
import { AlertTriangle, Info, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';
import Modal from './Modal';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message = 'Are you sure you want to proceed?',
  type = 'warning', // 'danger' | 'warning' | 'info' | 'success' | 'confirm'
  confirmText,
  cancelText = 'Cancel',
  loading = false,
}) => {
  const themes = {
    danger: {
      icon: AlertOctagon,
      iconClass: 'text-red-600 bg-red-50',
      btnClass: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      defaultConfirmText: 'Delete',
    },
    warning: {
      icon: AlertTriangle,
      iconClass: 'text-yellow-600 bg-yellow-50',
      btnClass: 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500',
      defaultConfirmText: 'Confirm',
    },
    success: {
      icon: CheckCircle2,
      iconClass: 'text-green-600 bg-green-50',
      btnClass: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
      defaultConfirmText: 'OK',
    },
    info: {
      icon: Info,
      iconClass: 'text-blue-600 bg-blue-50',
      btnClass: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      defaultConfirmText: 'OK',
    },
    confirm: {
      icon: HelpCircle,
      iconClass: 'text-primary bg-primary/10',
      btnClass: 'bg-primary hover:bg-primary/95 text-white focus:ring-primary',
      defaultConfirmText: 'Yes',
    },
  };

  const theme = themes[type] || themes.confirm;
  const Icon = theme.icon;
  const finalConfirmText = confirmText || theme.defaultConfirmText;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={null} size="small" showClose={false}>
      <div className="flex flex-col p-2">
        <div className="flex items-center mb-4">
          <Icon className={`w-6 h-6 mr-3 shrink-0 ${theme.iconClass.split(' ')[0]}`} />
          <h3 className="text-lg font-bold text-secondary">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end space-x-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${theme.btnClass}`}
          >
            {loading ? 'Processing...' : finalConfirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
