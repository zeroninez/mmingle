// components/OptimizedImage.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  width = 400,
  height = 300,
  className = "",
  priority = false,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  if (hasError) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
      >
        <span className="text-gray-500 text-sm">
          이미지를 불러올 수 없습니다
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={handleLoad}
        onError={handleError}
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}
