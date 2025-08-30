import React, { useEffect, useState } from 'react';

interface PerformanceMetrics {
  bundleSize: string;
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    bundleSize: '0 KB',
    loadTime: 0,
    renderTime: 0,
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Measure bundle size
    const measureBundleSize = () => {
      if ('performance' in window) {
        const entries = performance.getEntriesByType('resource');
        const jsEntries = entries.filter(entry => 
          entry.name.endsWith('.js') || entry.name.endsWith('.chunk.js')
        );
        
        const totalSize = jsEntries.reduce((total, entry) => {
          const transferSize = (entry as any).transferSize || 0;
          return total + transferSize;
        }, 0);

        return `${(totalSize / 1024).toFixed(1)} KB`;
      }
      return 'Unknown';
    };

    // Measure load time
    const measureLoadTime = () => {
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as any;
        return navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0;
      }
      return 0;
    };

    // Measure render time
    const measureRenderTime = () => {
      if ('performance' in window) {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        
        return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
      }
      return 0;
    };

    // Measure memory usage (if available)
    const measureMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return memory.usedJSHeapSize / 1024 / 1024; // MB
      }
      return undefined;
    };

    const updateMetrics = () => {
      setMetrics({
        bundleSize: measureBundleSize(),
        loadTime: measureLoadTime(),
        renderTime: measureRenderTime(),
        memoryUsage: measureMemoryUsage(),
      });
    };

    // Update metrics after initial render
    const timer = setTimeout(updateMetrics, 1000);

    // Update metrics periodically
    const interval = setInterval(updateMetrics, 10000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="performance-toggle"
        aria-label="Show performance metrics"
      >
        📊
      </button>
    );
  }

  return (
    <div className="performance-metrics">
      <div className="metric">
        <span>Bundle:</span>
        <span>{metrics.bundleSize}</span>
      </div>
      <div className="metric">
        <span>Load:</span>
        <span>{metrics.loadTime.toFixed(0)}ms</span>
      </div>
      <div className="metric">
        <span>Render:</span>
        <span>{metrics.renderTime.toFixed(0)}ms</span>
      </div>
      {metrics.memoryUsage && (
        <div className="metric">
          <span>Memory:</span>
          <span>{metrics.memoryUsage.toFixed(1)}MB</span>
        </div>
      )}
      <button
        onClick={() => setIsVisible(false)}
        className="close-metrics"
        aria-label="Hide performance metrics"
      >
        ×
      </button>
    </div>
  );
};

export default PerformanceMonitor;
