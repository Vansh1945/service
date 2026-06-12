import React from 'react';

const Card = ({
  children,
  className = '',
  hoverable = true,
  ...props
}) => {
  const baseStyles = 'bg-white rounded-2xl border border-neutral-100 p-6 transition-all duration-200';
  const hoverStyles = hoverable ? 'shadow-sm hover:shadow-md' : 'shadow-none';

  return (
    <div
      className={`${baseStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
