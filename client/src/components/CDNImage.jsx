import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { getOptimizedCloudinaryUrl } from '../utils/format';

const CDNImage = ({
  src,
  alt = 'Image',
  className = '',
  width = 800,
  placeholderWidth = 80,
  onClick,
  lazy = true,
  fallback,
  containerClassName = '',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!lazy) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Preload images 100px before they enter viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, src]);

  // Reset loading and error states if image source changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  if (!src) {
    return fallback || (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 p-2 ${className}`}>
        <ImageIcon className="w-5 h-5 opacity-60" />
      </div>
    );
  }

  const optimizedUrl = getOptimizedCloudinaryUrl(src, width);
  const lowResUrl = getOptimizedCloudinaryUrl(src, placeholderWidth);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${containerClassName}`}
      onClick={onClick}
    >
      {/* Premium Shimmer Loading State */}
      {!isLoaded && !hasError && (
        <div className={`absolute inset-0 z-10 animate-shimmer flex items-center justify-center bg-gray-100 ${className}`}>
          {/* Blur-up: low-resolution background image loaded instantly */}
          {inView && (
            <img
              src={lowResUrl}
              alt=""
              className="w-full h-full object-cover blur-sm opacity-40"
            />
          )}
        </div>
      )}

      {/* Fallback Premium Error State */}
      {hasError && (
        fallback || (
          <div className={`flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg text-gray-400 p-4 min-h-[80px] ${className}`}>
            <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
            <span className="text-[10px] text-gray-400 font-semibold">Failed to load</span>
          </div>
        )
      )}

      {/* Optimized Main Image */}
      {inView && !hasError && (
        <img
          src={optimizedUrl}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-all duration-500 ease-out ${
            isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-95 blur-sm'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
};

export default CDNImage;
