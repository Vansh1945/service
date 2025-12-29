import React from 'react';

const PWAUpdatePrompt = ({ onUpdate, onReinstall }) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 bg-orange-600 text-white p-4 rounded-lg shadow-lg z-50">
      <p className="mb-2">App configuration has changed. Please update or reinstall the app.</p>
      <div className="flex space-x-2">
        <button
          onClick={onUpdate}
          className="bg-white text-orange-600 px-4 py-2 rounded font-semibold hover:bg-gray-100"
        >
          Update App
        </button>
        <button
          onClick={onReinstall}
          className="bg-gray-800 text-white px-4 py-2 rounded font-semibold hover:bg-gray-700"
        >
          Reinstall App
        </button>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
