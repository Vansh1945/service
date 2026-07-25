import React from 'react';

export const ToggleSwitch = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-all duration-200">
    <div className="space-y-0.5 pr-4">
      <label className="text-sm font-semibold text-secondary font-inter">{label}</label>
      {description && <p className="text-xs text-gray-500 font-inter">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 outline-none ${checked ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

export const SettingInput = ({ label, name, value, onChange, placeholder, type = 'text', icon: Icon = null, description = null, min = null, max = null }) => {
  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-semibold text-secondary mb-2 font-inter">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          min={min}
          max={max}
          className={`w-full ${Icon ? 'pl-10' : 'px-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-inter text-secondary`}
        />
      </div>
      {description && <p className="text-xs text-gray-500 mt-1.5 font-inter">{description}</p>}
    </div>
  );
};
