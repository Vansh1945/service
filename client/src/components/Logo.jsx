import React from 'react';
import { FaBolt } from 'react-icons/fa';

const Logo = ({ size = 'text-2xl', withIcon = true }) => {
  return (
    <div className={`flex items-center ${withIcon ? 'space-x-2' : ''}`}>
      {withIcon && (
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-800">
          <FaBolt className="h-5 w-5 text-yellow-400" />
        </div>
      )}
      <span className={`font-bold ${size} text-white`}>
        RAJ <span className="text-yellow-400">ELECTRICAL</span>
      </span>
    </div>
  );
};

export default Logo;