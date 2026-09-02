import React from 'react';
import { Bell, Smartphone, Mail, ShieldAlert } from 'lucide-react';
import Processing from '../../../../components/ui/Processing';

const NotificationSettingsTab = ({
  notificationSettings,
  setNotificationSettings,
  isSaving,
  showToast
}) => {
  const handleToggle = (key) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    showToast('Notification settings updated successfully.', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 text-left">
        <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Notification Preferences</h3>
        
        <div className="space-y-4 divide-y divide-neutral-100">
          {/* Booking Alerts */}
          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-secondary">New Service Booking Alerts</h4>
                <p className="text-[11px] text-neutral-400 font-medium">Get real-time push notifications for new booking requests in your service area.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings?.bookingAlerts ?? true}
              onChange={() => handleToggle('bookingAlerts')}
              className="w-5 h-5 rounded border-gray-300 text-primary cursor-pointer"
            />
          </div>

          {/* SMS Notifications */}
          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-secondary">SMS Alerts</h4>
                <p className="text-[11px] text-neutral-400 font-medium">Receive urgent updates via SMS for immediate actions.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings?.smsAlerts ?? true}
              onChange={() => handleToggle('smsAlerts')}
              className="w-5 h-5 rounded border-gray-300 text-primary cursor-pointer"
            />
          </div>

          {/* Email Updates */}
          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-secondary">Email Reports & Updates</h4>
                <p className="text-[11px] text-neutral-400 font-medium">Weekly earnings summary and customer feedback reports via email.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings?.emailAlerts ?? false}
              onChange={() => handleToggle('emailAlerts')}
              className="w-5 h-5 rounded border-gray-300 text-primary cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-neutral-100">
          <Processing
            onClick={handleSave}
            loading={isSaving}
            loadingText="Updating..."
            className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold"
          >
            Save Notification Preferences
          </Processing>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsTab;
