import React from 'react';
import { FaPlug, FaBolt } from 'react-icons/fa';

const Logo = ({ size = 'text-2xl', withIcon = true, isDark = false }) => {
  return (
    <div className={`flex items-center ${withIcon ? 'space-x-2' : ''}`}>
      {withIcon && (
        <div className="relative flex items-center justify-center h-10 w-10">
          {/* Outer Circle */}
          <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-r-orange-500 rotate-90"></div>
          {/* Plug Icon */}
          <FaPlug className="text-teal-500 h-4 w-4" />
          {/* Bolt Overlay */}
          <FaBolt className="absolute text-orange-500 h-3 w-3 top-1 right-1" />
        </div>
      )}

      <div className={`font-semibold ${size}`}>
        <span className="text-teal-500">Raj</span>{' '}
        <span className={`${isDark ? 'text-white' : 'text-gray-700'}`}>
          Electrical Services
        </span>
      </div>
    </div>
  );
};

export default Logo;
