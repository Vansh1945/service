import React from 'react';
import { Bell } from 'lucide-react';
import { ToggleSwitch } from './SharedComponents';

const NotificationsTab = ({ systemSettings, handleNestedChange }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" /> Global Alert Switches
      </h3>
      <p className="text-xs text-gray-500 mt-1 font-inter">Enable or disable push notifications, emails, SMS alerts, and role-based notifications.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ToggleSwitch
        label="Push Notifications"
        description="Enable real-time push alerts via Google Firebase Cloud Messaging."
        checked={systemSettings.notificationSettings.pushEnabled}
        onChange={(val) => handleNestedChange('notificationSettings', 'pushEnabled', val)}
      />
      <ToggleSwitch
        label="Email Alerts"
        description="Enable system emails, receipts, verification codes, and statements."
        checked={systemSettings.notificationSettings.emailEnabled}
        onChange={(val) => handleNestedChange('notificationSettings', 'emailEnabled', val)}
      />
      <ToggleSwitch
        label="SMS Gateway"
        description="Allow text messages for mission-critical notifications."
        checked={systemSettings.notificationSettings.smsEnabled}
        onChange={(val) => handleNestedChange('notificationSettings', 'smsEnabled', val)}
      />
      <ToggleSwitch
        label="Provider Dashboard Alerts"
        description="Enable real-time job booking dashboard notification banners for providers."
        checked={systemSettings.notificationSettings.providerAlerts}
        onChange={(val) => handleNestedChange('notificationSettings', 'providerAlerts', val)}
      />
      <ToggleSwitch
        label="Customer Dashboard Alerts"
        description="Enable support feedback and status alert popups on customer dashboards."
        checked={systemSettings.notificationSettings.customerAlerts}
        onChange={(val) => handleNestedChange('notificationSettings', 'customerAlerts', val)}
      />
    </div>
  </div>
);

export default NotificationsTab;
