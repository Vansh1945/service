import React from 'react';

const Loader = ({ size = 'medium', text = 'Please Wait...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-6 animate-fade-in">
    <div className="relative flex items-center justify-center">
      {/* Outer Pulse Ring */}
      <div className="absolute w-16 h-16 rounded-full border-4 border-primary/20 animate-ping"></div>
      
      {/* Middle Rotating Ring */}
      <div className="w-12 h-12 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin"></div>
      
      {/* Inner Dot */}
      <div className="absolute w-4 h-4 bg-primary/80 rounded-full animate-pulse"></div>
    </div>
    {text && (
      <p className="mt-4 text-xs font-extrabold text-neutral-400 uppercase tracking-wider animate-pulse">
        {text}
      </p>
    )}
  </div>
);

export default Loader;
