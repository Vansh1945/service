import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const RescheduleModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionLoading = false,
  initialDate = "",
  initialTime = ""
}) => {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate);
      setTime(initialTime);
    }
  }, [isOpen, initialDate, initialTime]);

  if (!isOpen) return null;

  const handleUpdate = () => {
    onConfirm(date, time);
  };

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Date
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
                  New Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
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
                disabled={actionLoading}
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
