import React from 'react';
import { User } from 'lucide-react';

const Avatar = ({ src, alt = 'Avatar', name, size = 'md', className = '' }) => {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const getInitials = (n) => {
    if (!n) return '';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-neutral-100 text-secondary border border-neutral-200 font-bold shrink-0 ${
        sizeStyles[size] || sizeStyles.md
      } ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : name ? (
        <span>{getInitials(name)}</span>
      ) : (
        <User className="w-1/2 h-1/2 text-neutral-400" />
      )}
    </div>
  );
};

export default Avatar;
