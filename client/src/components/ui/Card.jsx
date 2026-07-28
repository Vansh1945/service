import React from 'react';

const Card = ({ children, className = '', header, footer, padding = true }) => {
  return (
    <div className={`bg-white border border-neutral-100 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${className}`}>
      {header && <div className="px-6 py-4 border-b border-neutral-100 font-bold text-secondary text-sm">{header}</div>}
      <div className={padding ? 'p-6' : ''}>{children}</div>
      {footer && <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 rounded-b-2xl">{footer}</div>}
    </div>
  );
};

export default Card;
