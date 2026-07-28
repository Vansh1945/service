import React, { useState } from 'react';

const Tooltip = ({ content, children, position = 'top', className = '' }) => {
  const [show, setShow] = useState(false);

  const posClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && content && (
        <div
          className={`absolute z-40 px-2.5 py-1 text-[11px] font-medium text-white bg-secondary rounded-lg shadow-md whitespace-nowrap pointer-events-none ${
            posClasses[position] || posClasses.top
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
