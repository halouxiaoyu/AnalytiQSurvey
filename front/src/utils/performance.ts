/**
 * 性能优化工具集
 * 用于优化多并发场景下的前端性能
 */

import React, { useCallback, useRef, useEffect } from 'react';

// 请求去重缓存类
export class RequestCache {
  private cache = new Map<string, Promise<any>>();

  // 带去重的请求装饰器
  withDeduplication<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as Promise<T>;
    }

    const promise = requestFn()
      .finally(() => {
        this.cache.delete(key);
      });

    this.cache.set(key, promise);
    return promise;
  }

  // 清空缓存
  clear() {
    this.cache.clear();
  }

  // 删除特定缓存
  delete(key: string) {
    this.cache.delete(key);
  }
}

// 防抖 Hook
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const timerRef = useRef<NodeJS.Timeout>();

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      timerRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return debouncedFn as T;
}

// 节流 Hook
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const lastExecRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout>();

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastExecRef.current >= delay) {
        lastExecRef.current = now;
        fn(...args);
      } else {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        
        timerRef.current = setTimeout(() => {
          lastExecRef.current = Date.now();
          fn(...args);
        }, delay - (now - lastExecRef.current));
      }
    },
    [fn, delay]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return throttledFn as T;
}

// 内存泄漏防护 Hook
export function useUnmountProtection() {
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  return isUnmountedRef;
}

// 请求取消 Hook
export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const getController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { getController, controller: abortControllerRef.current };
}

// 错误重试装饰器
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxRetries: number = 3,
  delay: number = 1000
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;
        
        // 如果是取消请求，不重试
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        
        // 最后一次尝试，抛出错误
        if (i === maxRetries) {
          throw lastError;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    
    throw lastError!;
  }) as T;
}

// 批量请求处理器
export class BatchRequestProcessor {
  private pendingRequests: Array<{
    key: string;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  
  private batchTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private batchProcessor: (keys: string[]) => Promise<Record<string, any>>,
    private batchDelay: number = 50
  ) {}

  async request(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ key, resolve, reject });
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchDelay);
    });
  }

  private async processBatch() {
    if (this.pendingRequests.length === 0) return;
    
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    this.batchTimer = null;
    
    try {
      const keys = requests.map(req => req.key);
      const results = await this.batchProcessor(keys);
      
      requests.forEach(({ key, resolve }) => {
        resolve(results[key]);
      });
    } catch (error) {
      requests.forEach(({ reject }) => {
        reject(error);
      });
    }
  }
}

// 虚拟滚动优化 Hook
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    setScrollTop
  };
}

// 计算属性缓存 Hook（类似 Vue 的 computed）
export function useComputed<T>(compute: () => T, deps: React.DependencyList): T {
  return React.useMemo(compute, deps);
}

// 组件性能监控
export function measurePerformance(name: string) {
  return function <T extends React.ComponentType<any>>(Component: T): React.ComponentType<any> {
    const WrappedComponent = React.forwardRef((props, ref) => {
      const renderStart = performance.now();
      
      React.useEffect(() => {
        const renderEnd = performance.now();
        console.log(`[Performance] ${name} render time: ${renderEnd - renderStart}ms`);
      });
      
      return React.createElement(Component, { ...props, ref });
    });
    
    WrappedComponent.displayName = `Performance(${Component.displayName || Component.name})`;
    
    return WrappedComponent;
  };
}

// 导出单例请求缓存实例
export const globalRequestCache = new RequestCache(); 