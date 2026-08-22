import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User } from 'lucide-react';

const RescheduleModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionLoading = false,
  initialDate = "",
  initialTime = "",
  providerName = "",
  currentDate = "",
  currentTime = ""
}) => {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate);
      setTime(initialTime);
      setReason("");
    }
  }, [isOpen, initialDate, initialTime]);

  if (!isOpen) return null;

  const handleUpdate = () => {
    onConfirm(date, time, reason);
  };

  const formattedCurrentDate = currentDate
    ? (new Date(currentDate).toString() !== 'Invalid Date'
        ? new Date(currentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : currentDate)
    : (initialDate ? (new Date(initialDate).toString() !== 'Invalid Date' ? new Date(initialDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : initialDate) : '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-premium">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-3">
            <h3 className="text-lg font-bold text-secondary">Reschedule Booking</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-650 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            {(formattedCurrentDate || currentTime || providerName) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-gray-700">Current Schedule</div>
                <div className="flex items-center gap-4 text-gray-600">
                  {formattedCurrentDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> {formattedCurrentDate}
                    </span>
                  )}
                  {(currentTime || initialTime) && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary" /> {currentTime || initialTime}
                    </span>
                  )}
                </div>
                {providerName && (
                  <div className="flex items-center gap-1 text-gray-600 pt-0.5">
                    <User className="w-3.5 h-3.5 text-primary" /> Provider: <span className="font-medium text-gray-800">{providerName}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Reason for Rescheduling <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <span className="text-xs text-gray-400">{reason.length}/300</span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                placeholder="e.g. Work schedule changed, personal emergency..."
                rows={3}
                maxLength={300}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none"
              />
            </div>

            <div className="flex space-x-3 pt-4 border-t mt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-750 font-semibold rounded-lg hover:bg-gray-250 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={actionLoading || !date || !time}
                className="flex-1 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Update Schedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
