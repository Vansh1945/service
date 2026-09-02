import React from 'react';
import { Inbox, Calendar, Bell, Wrench, Heart, ShieldAlert } from 'lucide-react';

const PRESETS = {
  bookings: {
    icon: Calendar,
    title: 'No bookings yet',
    message: 'Book an electrical service and your bookings will appear here.',
    actionLabel: 'Book a Service',
    defaultPath: '/customer/services'
  },
  notifications: {
    icon: Bell,
    title: "You're all caught up",
    message: 'New notifications and status updates will appear here.'
  },
  services: {
    icon: Wrench,
    title: 'No services match your filters',
    message: 'Try removing a filter or searching for another service.',
    actionLabel: 'Clear Filters'
  },
  favorites: {
    icon: Heart,
    title: 'No favorites saved yet',
    message: 'Save your preferred service providers for fast one-click re-booking.',
    actionLabel: 'Explore Providers',
    defaultPath: '/customer/services'
  }
};

const EmptyState = ({
  type,
  icon: IconProp,
  title: titleProp,
  message: messageProp,
  actionLabel: actionLabelProp,
  onAction,
  className = ""
}) => {
  const preset = type && PRESETS[type] ? PRESETS[type] : null;
  const Icon = IconProp || (preset ? preset.icon : Inbox);
  const title = titleProp || (preset ? preset.title : "No Data Available");
  const message = messageProp || (preset ? preset.message : "There are no records to display at this time.");
  const actionLabel = actionLabelProp || (preset ? preset.actionLabel : null);

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
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
