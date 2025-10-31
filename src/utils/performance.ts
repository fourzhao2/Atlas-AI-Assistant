/**
 * 性能监控工具
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 100; // 只保留最近100条记录

  /**
   * 测量函数执行时间
   */
  measure(label: string): () => void {
    const start = performance.now();
    const startTime = Date.now();
    
    return () => {
      const duration = performance.now() - start;
      const metric: PerformanceMetric = {
        name: label,
        duration,
        timestamp: startTime,
      };
      
      this.metrics.push(metric);
      
      // 限制记录数量
      if (this.metrics.length > this.maxMetrics) {
        this.metrics.shift();
      }
      
      // 根据耗时使用不同的日志级别
      if (duration > 1000) {
        console.warn(`[Perf] ⚠️ ${label}: ${duration.toFixed(2)}ms (慢)`);
      } else if (duration > 500) {
        console.log(`[Perf] ⏱️ ${label}: ${duration.toFixed(2)}ms`);
      } else if (duration > 100) {
        console.log(`[Perf] ✅ ${label}: ${duration.toFixed(2)}ms`);
      } else {
        console.log(`[Perf] ⚡ ${label}: ${duration.toFixed(2)}ms (快)`);
      }
      
      return duration;
    };
  }

  /**
   * 测量异步函数执行时间
   */
  async measureAsync<T>(
    label: string, 
    fn: () => Promise<T>
  ): Promise<T> {
    const endMeasure = this.measure(label);
    try {
      const result = await fn();
      endMeasure();
      return result;
    } catch (error) {
      endMeasure();
      throw error;
    }
  }

  /**
   * 获取性能统计
   */
  getStats(metricName?: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    total: number;
  } {
    const filtered = metricName
      ? this.metrics.filter(m => m.name === metricName)
      : this.metrics;

    if (filtered.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, total: 0 };
    }

    const durations = filtered.map(m => m.duration);
    const total = durations.reduce((a, b) => a + b, 0);

    return {
      count: filtered.length,
      avg: total / filtered.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      total,
    };
  }

  /**
   * 获取最近的性能记录
   */
  getRecentMetrics(count = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * 打印性能报告
   */
  printReport(): void {
    if (this.metrics.length === 0) {
      console.log('[Perf] 📊 暂无性能数据');
      return;
    }

    console.group('[Perf] 📊 性能报告');
    
    // 按操作分组统计
    const groupedMetrics = new Map<string, number[]>();
    this.metrics.forEach(m => {
      if (!groupedMetrics.has(m.name)) {
        groupedMetrics.set(m.name, []);
      }
      groupedMetrics.get(m.name)!.push(m.duration);
    });

    // 打印每个操作的统计
    groupedMetrics.forEach((durations, name) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      console.log(
        `${name}:`,
        `次数=${durations.length},`,
        `平均=${avg.toFixed(2)}ms,`,
        `最小=${min.toFixed(2)}ms,`,
        `最大=${max.toFixed(2)}ms`
      );
    });

    console.groupEnd();
  }

  /**
   * 清除记录
   */
  clear(): void {
    this.metrics = [];
  }
}

// 导出单例
export const perfMonitor = new PerformanceMonitor();

// 导出便捷函数
export const measurePerf = (label: string) => perfMonitor.measure(label);
export const measurePerfAsync = <T>(label: string, fn: () => Promise<T>) => 
  perfMonitor.measureAsync(label, fn);

