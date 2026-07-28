import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = "No Data Available",
  message = "There are no records to display at this time.",
  actionLabel,
  onAction,
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-neutral-100 shadow-sm ${className}`}>
      <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4 text-neutral-400">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-base font-bold text-secondary mb-1 tracking-tight">{title}</h4>
      <p className="text-sm text-neutral-500 max-w-sm font-medium mb-4">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
