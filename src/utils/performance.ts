// Performance optimization utilities for LingapLink

// Debounce function for expensive operations
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for rate limiting
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Memoization utility
export function memoize<T extends (...args: unknown[]) => unknown>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Lazy loading utility for components
export function lazyLoad<T>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: T
): () => Promise<T> {
  let cached: T | null = null;
  
  return async () => {
    if (cached) return cached;
    
    try {
      const module = await importFunc();
      cached = module.default;
      return cached;
    } catch (error) {
      console.error('Failed to lazy load module:', error);
      if (fallback) return fallback;
      throw error;
    }
  };
}

// Image optimization utility
export const ImageOptimizer = {
  // Preload critical images
  preloadImages(urls: string[]): void {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  },

  // Lazy load images with intersection observer
  lazyLoadImages(): void {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  },

  // Generate responsive image srcset
  generateSrcSet(baseUrl: string, widths: number[]): string {
    return widths
      .map(width => `${baseUrl}?w=${width} ${width}w`)
      .join(', ');
  }
};

// Bundle size optimization
export const BundleOptimizer = {
  // Track bundle size
  trackBundleSize(): void {
    if (process.env.NODE_ENV === 'development') {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            console.log(`Resource loaded: ${resourceEntry.name} (${resourceEntry.transferSize} bytes)`);
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
    }
  },

  // Analyze component render performance
  measureRenderTime<T>(componentName: string, renderFunc: () => T): T {
    const start = performance.now();
    const result = renderFunc();
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render time: ${end - start}ms`);
    }
    
    return result;
  }
};

// Memory management utilities
export const MemoryManager = {
  // Clear unused event listeners
  cleanupEventListeners(): void {
    // This would be implemented based on your event listener tracking
    console.log('Cleaning up event listeners...');
  },

  // Clear unused timers
  cleanupTimers(): void {
    // This would be implemented based on your timer tracking
    console.log('Cleaning up timers...');
  },

  // Force garbage collection (development only)
  forceGC(): void {
    if (process.env.NODE_ENV === 'development' && 'gc' in window) {
      (window as unknown as { gc(): void }).gc();
    }
  }
};

// Network optimization
export const NetworkOptimizer = {
  // Retry failed requests with exponential backoff
  async retryWithBackoff<T>(
    request: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await request();
      } catch (error) {
        lastError = error as Error;
        
        if (i === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  },

  // Cache API responses
  cacheResponse<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
  },

  // Get cached response
  getCachedResponse<T>(key: string): T | null {
    const cached = localStorage.getItem(`cache_${key}`);
    if (!cached) return null;
    
    try {
      const cacheEntry = JSON.parse(cached);
      const now = Date.now();
      
      if (now - cacheEntry.timestamp > cacheEntry.ttl) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return cacheEntry.data;
    } catch {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
  }
}; 