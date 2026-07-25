import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ToggleSwitch } from './SharedComponents';

const MaintenanceTab = ({ systemSettings, handleTripleNestedChange }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" /> Maintenance Control Desk
      </h3>
      <p className="text-xs text-gray-500 mt-1 font-inter">Temporarily restrict platform access for customers or providers during maintenance.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-red-50/20 border border-red-100 p-6 rounded-2xl">
      <ToggleSwitch
        label="Freeze Customer App"
        description="Prevent customers from making bookings or viewing details."
        checked={systemSettings.maintenanceMode.customer.enabled}
        onChange={(val) => handleTripleNestedChange('maintenanceMode', 'customer', 'enabled', val)}
      />
      <ToggleSwitch
        label="Freeze Provider App"
        description="Block provider portal checkouts and job actions."
        checked={systemSettings.maintenanceMode.provider.enabled}
        onChange={(val) => handleTripleNestedChange('maintenanceMode', 'provider', 'enabled', val)}
      />

      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Global Notice Message</label>
        <textarea
          value={systemSettings.maintenanceMode.globalMessage}
          onChange={(e) => handleTripleNestedChange('maintenanceMode', 'globalMessage', null, e.target.value)}
          rows="3"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-200 outline-none text-secondary font-inter"
          placeholder="e.g. Server migration in progress..."
        />
      </div>
    </div>
  </div>
);

export default MaintenanceTab;
