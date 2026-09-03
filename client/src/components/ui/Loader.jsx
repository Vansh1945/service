import React from 'react';
import { Zap } from 'lucide-react';

const Loader = ({ size = 'medium', text = 'Please Wait...', fullScreen = false, className = '' }) => {
  // Size options
  const sizeMap = {
    small: {
      ring: 'w-10 h-10 border-2',
      icon: 'w-4 h-4',
      textSize: 'text-xs',
      container: 'min-h-[100px] p-2',
    },
    medium: {
      ring: 'w-16 h-16 border-[3px]',
      icon: 'w-6 h-6',
      textSize: 'text-xs',
      container: 'min-h-[40vh] p-6',
    },
    large: {
      ring: 'w-24 h-24 border-4',
      icon: 'w-9 h-9',
      textSize: 'text-sm',
      container: 'min-h-[60vh] p-8',
    },
  };

  const config = sizeMap[size] || sizeMap.medium;

  const content = (
    <div className={`flex flex-col items-center justify-center ${config.container} w-full animate-fade-in ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Soft Ambient Electrical Glow */}
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse" />
        {/* Outer Pulsing Ring */}
        <div className={`absolute ${config.ring} rounded-full border-primary/20 animate-ping`} />
        {/* Sleek Spinning Gradient Ring */}
        <div className={`${config.ring} rounded-full border-transparent border-t-primary border-r-accent animate-spin`} />
        {/* Central Electrical Icon */}
        <div className="absolute flex items-center justify-center">
          <Zap className={`${config.icon} text-primary fill-primary/20 animate-pulse`} />
        </div>
      </div>
      {/* Loading Text */}
      {text && (
        <p className={`mt-4 ${config.textSize} font-extrabold tracking-widest text-neutral-400 uppercase animate-pulse text-center`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
        {content}
      </div>
    );
  }

  return content;
};

export default Loader;