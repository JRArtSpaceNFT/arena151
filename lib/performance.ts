/**
 * Performance Monitoring Utilities
 * 
 * Track Core Web Vitals and custom performance metrics
 */

export interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  fcp?: number; // First Contentful Paint
}

let metrics: PerformanceMetrics = {};

// Report Web Vitals to console (or analytics endpoint)
export function reportWebVitals(metric: { name: string; value: number }) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Perf] ${metric.name}:`, metric.value.toFixed(2), 'ms');
  }
  
  // Store metrics
  if (metric.name === 'LCP') metrics.lcp = metric.value;
  if (metric.name === 'FID') metrics.fid = metric.value;
  if (metric.name === 'CLS') metrics.cls = metric.value;
  if (metric.name === 'TTFB') metrics.ttfb = metric.value;
  if (metric.name === 'FCP') metrics.fcp = metric.value;
}

export function getMetrics(): PerformanceMetrics {
  return { ...metrics };
}

// Mark custom performance events
export function markPerformance(name: string) {
  if (typeof window === 'undefined') return;
  
  try {
    performance.mark(name);
  } catch {}
}

// Measure time between two marks
export function measurePerformance(name: string, startMark: string, endMark: string) {
  if (typeof window === 'undefined') return;
  
  try {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    
    if (process.env.NODE_ENV === 'development' && measure) {
      console.log(`[Perf] ${name}:`, measure.duration.toFixed(2), 'ms');
    }
    
    return measure?.duration;
  } catch {}
}

// Lazy image loading observer
export function observeLazyImages() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;
        
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px', // Start loading 50px before image enters viewport
  });

  // Observe all images with data-src
  document.querySelectorAll('img[data-src]').forEach((img) => {
    imageObserver.observe(img);
  });
}

// Preload critical resources
export function preloadCriticalAssets(urls: string[]) {
  if (typeof document === 'undefined') return;

  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = getResourceType(url);
    link.href = url;
    document.head.appendChild(link);
  });
}

function getResourceType(url: string): string {
  if (url.match(/\.(jpg|jpeg|png|webp|avif|gif)$/i)) return 'image';
  if (url.match(/\.(mp3|wav|ogg)$/i)) return 'audio';
  if (url.match(/\.(mp4|webm)$/i)) return 'video';
  if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'font';
  if (url.match(/\.(css)$/i)) return 'style';
  if (url.match(/\.(js)$/i)) return 'script';
  return 'fetch';
}

// Check if user is on a slow connection
export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
}

// Detect if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
