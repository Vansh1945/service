import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, AlertCircle, X } from 'lucide-react';
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
  previewable = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const [showPreview, setShowPreview] = useState(false);
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
        rootMargin: '150px', // Preload images slightly before they enter the viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, src]);

  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setIsLoaded(false);
    setHasError(false);
  }

  if (!src) {
    return fallback || (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 p-2 ${className}`}>
        <ImageIcon className="w-5 h-5 opacity-60" />
      </div>
    );
  }

  const optimizedUrl = getOptimizedCloudinaryUrl(src, width);
  const lowResUrl = getOptimizedCloudinaryUrl(src, placeholderWidth);

  // Generate responsive srcSet for dynamic client resolution selection
  let srcSet = undefined;
  let sizes = undefined;
  if (src.startsWith('http') && src.includes('res.cloudinary.com')) {
    const widths = [320, 640, 960, 1280, 1920];
    srcSet = widths
      .map((w) => `${getOptimizedCloudinaryUrl(src, w)} ${w}w`)
      .join(', ');
    sizes = props.sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
  }

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  const handleContainerClick = (e) => {
    if (previewable) {
      setShowPreview(true);
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`relative overflow-hidden select-none ${previewable ? 'cursor-zoom-in' : ''} ${containerClassName}`}
        onClick={handleContainerClick}
      >
        {/* Shimmer/Blur-up Loading State */}
        {!isLoaded && !hasError && (
          <div className={`absolute inset-0 z-10 animate-shimmer flex items-center justify-center bg-gray-100/80 backdrop-blur-sm ${className}`}>
            {inView && (
              <img
                src={lowResUrl}
                alt=""
                className="w-full h-full object-cover blur-md opacity-50 scale-105 transition-opacity duration-300"
              />
            )}
          </div>
        )}

        {/* Fallback Error State */}
        {hasError && (
          fallback || (
            <div className={`flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg text-gray-400 p-4 min-h-[80px] ${className}`}>
              <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
              <span className="text-[10px] text-gray-400 font-semibold">Failed to load</span>
            </div>
          )
        )}

        {/* Optimized Responsive Image */}
        {inView && !hasError && (
          <img
            src={optimizedUrl}
            srcSet={srcSet}
            sizes={sizes}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            loading={lazy ? 'lazy' : 'eager'}
            className={`transition-all duration-500 ease-out ${
              isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-95 blur-sm'
            } ${className}`}
            {...props}
          />
        )}
      </div>

      {/* Lightbox Preview */}
      {previewable && showPreview && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPreview(false)}
              className="absolute -top-14 right-0 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-95 shadow-md border border-white/10"
              title="Close Preview"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={getOptimizedCloudinaryUrl(src, 1920)} // High-res preview
              alt={alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/15"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=500&auto=format&fit=crop';
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default CDNImage;
