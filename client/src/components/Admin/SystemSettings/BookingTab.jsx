import React from 'react';
import { Calendar, ShieldAlert } from 'lucide-react';
import { ToggleSwitch, SettingInput } from './SharedComponents';

const BookingTab = ({ systemSettings, handleNestedChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-secondary pb-1 border-b border-gray-100 font-poppins flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" /> Booking Rules & Allocations
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-inter">Configure booking flow, provider assignment, cancellation limits, and scheduling behavior.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ToggleSwitch
          label="Auto Assign Provider"
          description={systemSettings.bookingSettings.autoAssignProvider ? "Nearest provider auto assignment enabled" : "Providers can manually accept bookings"}
          checked={systemSettings.bookingSettings.autoAssignProvider}
          onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignProvider', val)}
        />
        <ToggleSwitch
          label="Enable Provider Acceptance Timeout"
          description="Automatically unassign booking if provider does not accept within the timeout window."
          checked={systemSettings.bookingSettings.enableProviderAcceptTimeout}
          onChange={(val) => handleNestedChange('bookingSettings', 'enableProviderAcceptTimeout', val)}
        />

        {systemSettings.bookingSettings.enableProviderAcceptTimeout && (
          <SettingInput
            label="Provider Acceptance Timeout (Minutes)"
            value={systemSettings.bookingSettings.providerAcceptTimeoutMinutes}
            onChange={(e) => handleNestedChange('bookingSettings', 'providerAcceptTimeoutMinutes', Number(e.target.value))}
            type="number"
            min="1"
            description="Time in minutes after which an unaccepted auto-assigned booking is released back to pending."
          />
        )}

        <ToggleSwitch
          label="Allow Pay after Service (COD)"
          description="Enable customers to pay with physical cash directly to the provider upon service completion."
          checked={systemSettings.bookingSettings.allowCOD}
          onChange={(val) => handleNestedChange('bookingSettings', 'allowCOD', val)}
        />
        <ToggleSwitch
          label="Live GPS Tracking"
          description="Enable dynamic real-time provider location tracking on Leaflet map for customers."
          checked={systemSettings.bookingSettings.trackingEnabled}
          onChange={(val) => handleNestedChange('bookingSettings', 'trackingEnabled', val)}
        />

        <SettingInput
          label="Live Tracking Interval (Seconds)"
          value={systemSettings.bookingSettings.trackingInterval}
          onChange={(e) => handleNestedChange('bookingSettings', 'trackingInterval', Number(e.target.value))}
          type="number"
          min="1"
          description="Interval (in seconds) between successive live telemetry coordinate packets sent from en-route providers."
        />
        <SettingInput
          label="Auto-Assign Search Radius (KM)"
          value={systemSettings.bookingSettings.autoAssignRadius}
          onChange={(e) => handleNestedChange('bookingSettings', 'autoAssignRadius', Number(e.target.value))}
          type="number"
          min="1"
          description="Maximum radius distance (in kilometers) scanned around a booking to match nearby online Providers."
        />
        <SettingInput
          label="Cancellation Window (Minutes)"
          value={systemSettings.bookingSettings.cancellationWindowMinutes}
          onChange={(e) => handleNestedChange('bookingSettings', 'cancellationWindowMinutes', Number(e.target.value))}
          type="number"
          min="0"
          description="Period during which a customer can cancel a booking without penalty charges."
        />
        <SettingInput
          label="Refund Review Period (Hours)"
          value={systemSettings.bookingSettings.refundReviewHours}
          onChange={(e) => handleNestedChange('bookingSettings', 'refundReviewHours', Number(e.target.value))}
          type="number"
          min="0"
          description="Maximum hours after which a disputed refund request is automatically reviewed."
        />
        <SettingInput
          label="Provider Response SLA (Hours)"
          value={systemSettings.bookingSettings.providerResponseSlaHours}
          onChange={(e) => handleNestedChange('bookingSettings', 'providerResponseSlaHours', Number(e.target.value))}
          type="number"
          min="1"
          description="Time limit for providers to submit test results or updates before trigger warnings."
        />
        <SettingInput
          label="Refund Processing SLA (Hours)"
          value={systemSettings.bookingSettings.refundProcessingSlaHours}
          onChange={(e) => handleNestedChange('bookingSettings', 'refundProcessingSlaHours', Number(e.target.value))}
          type="number"
          min="1"
          description="Required timeframe for processing refund requests to customer wallets/gateways."
        />
        <SettingInput
          label="Complaint Window (Days)"
          value={systemSettings.bookingSettings.complaintWindowDays ?? 7}
          onChange={(e) => handleNestedChange('bookingSettings', 'complaintWindowDays', Number(e.target.value))}
          type="number"
          min="1"
          max="90"
          description="Number of days after service completion within which customers can file a complaint or dispute."
        />
        <SettingInput
          label="Max Bookings per Provider"
          value={systemSettings.bookingSettings.maxBookingsPerProvider}
          onChange={(e) => handleNestedChange('bookingSettings', 'maxBookingsPerProvider', Number(e.target.value))}
          type="number"
          min="1"
          description="Maximum concurrent active bookings a single service provider is permitted to hold."
        />
        <SettingInput
          label="Max Future Booking Scope (Days)"
          value={systemSettings.bookingSettings.maxBookingDays}
          onChange={(e) => handleNestedChange('bookingSettings', 'maxBookingDays', Number(e.target.value))}
          type="number"
          min="1"
          description="Number of days in the future customers can schedule appointments."
        />
        <SettingInput
          label="Booking Time Slot Interval (Minutes)"
          value={systemSettings.bookingSettings.slotInterval}
          onChange={(e) => handleNestedChange('bookingSettings', 'slotInterval', Number(e.target.value))}
          type="number"
          min="5"
          description="Time division sizing (in minutes) for scheduling calendars."
        />
        <SettingInput
          label="Daily Start Time (HH:MM)"
          value={systemSettings.bookingSettings.startTime}
          onChange={(e) => handleNestedChange('bookingSettings', 'startTime', e.target.value)}
          placeholder="09:00"
          description="Daily start time limit for booking appointments."
        />
        <SettingInput
          label="Daily End Time (HH:MM)"
          value={systemSettings.bookingSettings.endTime}
          onChange={(e) => handleNestedChange('bookingSettings', 'endTime', e.target.value)}
          placeholder="21:00"
          description="Daily deadline time limit for final booking slots."
        />

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Booking Mode</label>
          <select
            value={systemSettings.bookingSettings.bookingMode || 'hybrid'}
            onChange={(e) => handleNestedChange('bookingSettings', 'bookingMode', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
          >
            <option value="flexible">Flexible</option>
            <option value="slot-based">Slot Based</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <p className="text-xs text-gray-500 mt-1.5 font-inter">Determine how appointment times are matched and resolved.</p>
        </div>

        <ToggleSwitch
          label="Emergency Booking"
          description="Allow system to dispatch emergency bookings."
          checked={systemSettings.bookingSettings?.emergencyAssignment !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'emergencyAssignment', val)}
        />

        <ToggleSwitch
          label="Instant Booking Option"
          description="Allow customers to select instant booking options."
          checked={systemSettings.bookingSettings?.instantBooking !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'instantBooking', val)}
        />

        <ToggleSwitch
          label="Manual Assignment"
          description="Allow admin manual assignment."
          checked={systemSettings.bookingSettings?.manualAssignment !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'manualAssignment', val)}
        />

        <ToggleSwitch
          label="Offer Queue"
          description="Enable provider job offer queueing."
          checked={systemSettings.bookingSettings?.offerQueue !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'offerQueue', val)}
        />

        <ToggleSwitch
          label="Auto Assign Scheduled"
          description="Auto assign for scheduled bookings."
          checked={systemSettings.bookingSettings?.autoAssignScheduled !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignScheduled', val)}
        />

        <ToggleSwitch
          label="Auto Assign Instant"
          description="Auto assign for instant bookings."
          checked={systemSettings.bookingSettings?.autoAssignInstant !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignInstant', val)}
        />

        <ToggleSwitch
          label="Auto Assign Emergency"
          description="Auto assign for emergency bookings."
          checked={systemSettings.bookingSettings?.autoAssignEmergency !== false}
          onChange={(val) => handleNestedChange('bookingSettings', 'autoAssignEmergency', val)}
        />

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Emergency Response Time</label>
          <select
            value={systemSettings.bookingSettings?.emergencyResponseTime || 60}
            onChange={(e) => handleNestedChange('bookingSettings', 'emergencyResponseTime', Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
          >
            <option value={30}>30 sec</option>
            <option value={60}>60 sec</option>
            <option value={90}>90 sec</option>
            <option value={120}>120 sec</option>
          </select>
          <p className="text-xs text-gray-500 mt-1.5 font-inter">Time provider has to accept before escalating.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-secondary mb-2 font-inter">Admin Response Time</label>
          <select
            value={systemSettings.bookingSettings?.adminResponseTime || 30}
            onChange={(e) => handleNestedChange('bookingSettings', 'adminResponseTime', Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary bg-white"
          >
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hour</option>
            <option value={360}>6 hour</option>
            <option value={480}>8 hour</option>
            <option value={600}>10 hour</option>
            <option value={720}>12 hour</option>
          </select>
          <p className="text-xs text-gray-500 mt-1.5 font-inter">Timeout for admin reassignment before cancellation.</p>
        </div>

        <SettingInput
          label="Minimum Completion Images Required"
          value={systemSettings.bookingSettings.minCompletedImages || 1}
          onChange={(e) => handleNestedChange('bookingSettings', 'minCompletedImages', Number(e.target.value))}
          type="number"
          min="1"
          description="The minimum number of completion proof photos a provider must upload to resolve a job."
        />

        <div className="md:col-span-2 border border-gray-100 rounded-2xl p-6 bg-gray-50/50 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-primary" /> Trusted Provider Rules
            </h4>
            <p className="text-xs text-gray-500 mt-1 font-inter">Set minimum requirements for providers to qualify for priority and emergency bookings.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingInput
              label="Minimum Average Rating"
              value={systemSettings.bookingSettings.trustedProviderRules?.minRating || 4.0}
              onChange={(e) => {
                const rules = systemSettings.bookingSettings.trustedProviderRules || {};
                handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, minRating: Number(e.target.value) });
              }}
              type="number"
              min="0"
              max="5"
              step="0.1"
            />
            <SettingInput
              label="Minimum Completed Jobs"
              value={systemSettings.bookingSettings.trustedProviderRules?.minCompletedJobs || 5}
              onChange={(e) => {
                const rules = systemSettings.bookingSettings.trustedProviderRules || {};
                handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, minCompletedJobs: Number(e.target.value) });
              }}
              type="number"
              min="0"
            />
            <SettingInput
              label="Maximum Cancellation Rate (%)"
              value={systemSettings.bookingSettings.trustedProviderRules?.maxCancellationRate || 15}
              onChange={(e) => {
                const rules = systemSettings.bookingSettings.trustedProviderRules || {};
                handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, maxCancellationRate: Number(e.target.value) });
              }}
              type="number"
              min="0"
              max="100"
            />
            <SettingInput
              label="Emergency Provider Response Time (Minutes)"
              value={systemSettings.bookingSettings.trustedProviderRules?.providerResponseTimeMinutes || 5}
              onChange={(e) => {
                const rules = systemSettings.bookingSettings.trustedProviderRules || {};
                handleNestedChange('bookingSettings', 'trustedProviderRules', { ...rules, providerResponseTimeMinutes: Number(e.target.value) });
              }}
              type="number"
              min="1"
            />
          </div>
        </div>

        <div className="md:col-span-2 border border-gray-100 rounded-2xl p-6 bg-gray-50/50 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-secondary font-poppins flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-primary" /> SLA Threshold Configurations
            </h4>
            <p className="text-xs text-gray-500 mt-1 font-inter">Define response, arrival, and completion time limits used for booking monitoring.</p>
          </div>

          <div className="space-y-4">
            {/* Scheduled SLA */}
            <div className="border-b border-gray-200/60 pb-4">
              <h5 className="text-xs font-black text-secondary uppercase tracking-wider mb-3">Scheduled Bookings SLA</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SettingInput
                  label="At Risk (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.scheduled?.atRiskMinutes || 10}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const sched = thresholds.scheduled || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, scheduled: { ...sched, atRiskMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
                <SettingInput
                  label="Delayed (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.scheduled?.delayedMinutes || 15}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const sched = thresholds.scheduled || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, scheduled: { ...sched, delayedMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
                <SettingInput
                  label="Critical (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.scheduled?.criticalMinutes || 30}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const sched = thresholds.scheduled || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, scheduled: { ...sched, criticalMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
              </div>
            </div>

            {/* Instant SLA */}
            <div className="border-b border-gray-200/60 pb-4">
              <h5 className="text-xs font-black text-secondary uppercase tracking-wider mb-3">Instant Bookings SLA</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SettingInput
                  label="At Risk (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.instant?.atRiskMinutes || 15}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const inst = thresholds.instant || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, instant: { ...inst, atRiskMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
                <SettingInput
                  label="Delayed (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.instant?.delayedMinutes || 45}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const inst = thresholds.instant || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, instant: { ...inst, delayedMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
                <SettingInput
                  label="Critical (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.instant?.criticalMinutes || 60}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const inst = thresholds.instant || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, instant: { ...inst, criticalMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
              </div>
            </div>

            {/* Emergency SLA */}
            <div>
              <h5 className="text-xs font-black text-secondary uppercase tracking-wider mb-3">Emergency Bookings SLA</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SettingInput
                  label="At Risk (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.emergency?.atRiskMinutes || 5}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const emerg = thresholds.emergency || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, emergency: { ...emerg, atRiskMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
                <SettingInput
                  label="Delayed (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.emergency?.delayedMinutes || 15}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const emerg = thresholds.emergency || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, emergency: { ...emerg, delayedMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
                <SettingInput
                  label="Critical (Minutes)"
                  value={systemSettings.bookingSettings.slaThresholds?.emergency?.criticalMinutes || 20}
                  onChange={(e) => {
                    const thresholds = systemSettings.bookingSettings.slaThresholds || {};
                    const emerg = thresholds.emergency || {};
                    handleNestedChange('bookingSettings', 'slaThresholds', { ...thresholds, emergency: { ...emerg, criticalMinutes: Number(e.target.value) } });
                  }}
                  type="number"
                  min="1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingTab;
