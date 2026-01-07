/**
 * Web Searcher - 网络搜索器
 * 
 * 通过 content script 操作搜索引擎页面进行搜索
 * 支持 Google、Bing、百度
 */

import type { 
  SearchResult, 
  SearchTask, 
  SearchEngine,
  DeepResearchConfig,
} from '@/types/deep-research';

/**
 * 搜索引擎配置
 */
const SEARCH_ENGINES: Record<SearchEngine, {
  name: string;
  searchUrl: (query: string) => string;
  resultSelector: string;
  titleSelector: string;
  linkSelector: string;
  snippetSelector: string;
}> = {
  google: {
    name: 'Google',
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    resultSelector: 'div.g',
    titleSelector: 'h3',
    linkSelector: 'a[href^="http"]',
    snippetSelector: 'div[data-sncf], div.VwiC3b',
  },
  bing: {
    name: 'Bing',
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    resultSelector: 'li.b_algo',
    titleSelector: 'h2 a',
    linkSelector: 'h2 a',
    snippetSelector: 'p, .b_caption p',
  },
  baidu: {
    name: '百度',
    searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
    resultSelector: 'div.result, div.c-container',
    titleSelector: 'h3 a',
    linkSelector: 'h3 a',
    snippetSelector: '.c-abstract, .content-right_8Zs40',
  },
};

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'search'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Web Searcher 类
 */
class WebSearcher {
  private config: DeepResearchConfig;

  constructor(config?: Partial<DeepResearchConfig>) {
    this.config = {
      maxIterations: 3,
      maxPagesPerIteration: 3,
      searchDepth: 'medium',
      preferredEngines: ['google', 'bing'],
      interactiveMode: true,
      requirePlanApproval: true,
      requireSearchApproval: false,
      requirePageApproval: true,
      language: 'auto',
      verbose: true,
      ...config,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DeepResearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 执行搜索任务
   * 
   * @param queries 搜索关键词列表
   * @param engine 搜索引擎
   * @param maxResults 最大结果数
   */
  async search(
    queries: string[],
    engine: SearchEngine = 'google',
    maxResults: number = 10
  ): Promise<SearchTask> {
    const query = queries.join(' ');
    console.log(`[WebSearcher] 🔍 搜索: "${query}" (${engine})`);

    const task: SearchTask = {
      id: generateId('task'),
      query,
      engine,
      status: 'running',
      results: [],
    };

    try {
      // 获取搜索结果
      const results = await this.executeSearch(query, engine, maxResults);
      task.results = results;
      task.status = 'completed';
      
      console.log(`[WebSearcher] ✅ 找到 ${results.length} 个结果`);
    } catch (error) {
      console.error('[WebSearcher] ❌ 搜索失败:', error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '搜索失败';
    }

    return task;
  }

  /**
   * 并行搜索多个引擎
   */
  async searchMultiEngine(
    queries: string[],
    engines: SearchEngine[] = this.config.preferredEngines,
    maxResultsPerEngine: number = 5
  ): Promise<SearchTask[]> {
    console.log(`[WebSearcher] 🔍 多引擎搜索: ${engines.join(', ')}`);

    const tasks = await Promise.all(
      engines.map(engine => this.search(queries, engine, maxResultsPerEngine))
    );

    return tasks;
  }

  /**
   * 执行单次搜索
   * 
   * 通过 content script 在新标签页中执行搜索
   */
  private async executeSearch(
    query: string,
    engine: SearchEngine,
    maxResults: number
  ): Promise<SearchResult[]> {
    const engineConfig = SEARCH_ENGINES[engine];
    const searchUrl = engineConfig.searchUrl(query);

    // 方案: 通过消息发送到 background，让 background 打开标签页并提取结果
    return new Promise((resolve, reject) => {
      // 发送消息给 background script
      chrome.runtime.sendMessage(
        {
          type: 'DEEP_RESEARCH_SEARCH',
          payload: {
            url: searchUrl,
            engine,
            selectors: {
              result: engineConfig.resultSelector,
              title: engineConfig.titleSelector,
              link: engineConfig.linkSelector,
              snippet: engineConfig.snippetSelector,
            },
            maxResults,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response?.success && response.data) {
            const results: SearchResult[] = response.data.map((item: {
              title: string;
              url: string;
              snippet: string;
            }, index: number) => ({
              id: generateId('result'),
              title: item.title || '无标题',
              url: item.url || '',
              snippet: item.snippet || '',
              engine,
              rank: index + 1,
              timestamp: Date.now(),
            }));
            resolve(results);
          } else {
            // 如果 background 没有响应，尝试备用方案
            console.warn('[WebSearcher] Background 未响应，尝试备用方案');
            this.fallbackSearch(query, engine, maxResults)
              .then(resolve)
              .catch(reject);
          }
        }
      );

      // 超时处理
      setTimeout(() => {
        reject(new Error('搜索超时'));
      }, 30000);
    });
  }

  /**
   * 备用搜索方案 - 模拟搜索结果
   * 
   * 当 background script 不可用时使用
   * 实际使用时应该实现真正的搜索逻辑
   */
  private async fallbackSearch(
    query: string,
    engine: SearchEngine,
    _maxResults: number
  ): Promise<SearchResult[]> {
    console.log('[WebSearcher] 使用备用搜索方案');

    // 返回搜索引擎链接，让用户手动查看
    const engineConfig = SEARCH_ENGINES[engine];
    const searchUrl = engineConfig.searchUrl(query);

    return [{
      id: generateId('result'),
      title: `在 ${engineConfig.name} 中搜索: ${query}`,
      url: searchUrl,
      snippet: `点击此链接在 ${engineConfig.name} 中查看搜索结果`,
      engine,
      rank: 1,
      timestamp: Date.now(),
    }];
  }

  /**
   * 获取搜索引擎 URL
   */
  getSearchUrl(query: string, engine: SearchEngine): string {
    return SEARCH_ENGINES[engine].searchUrl(query);
  }

  /**
   * 合并去重搜索结果
   */
  mergeResults(tasks: SearchTask[]): SearchResult[] {
    const seen = new Set<string>();
    const merged: SearchResult[] = [];

    for (const task of tasks) {
      if (task.status !== 'completed') continue;

      for (const result of task.results) {
        // 使用 URL 去重
        const normalizedUrl = this.normalizeUrl(result.url);
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl);
          merged.push(result);
        }
      }
    }

    // 按 rank 排序（越小越靠前）
    merged.sort((a, b) => a.rank - b.rank);

    return merged;
  }

  /**
   * 标准化 URL（用于去重）
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // 移除 www 前缀和尾部斜杠
      return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  /**
   * 过滤搜索结果
   * 
   * 移除不可用或低质量的结果
   */
  filterResults(results: SearchResult[]): SearchResult[] {
    return results.filter(result => {
      // 检查 URL 有效性
      if (!result.url || !result.url.startsWith('http')) {
        return false;
      }

      // 排除一些不适合的网站
      const excludedDomains = [
        'google.com/search',
        'bing.com/search',
        'baidu.com/s',
        'facebook.com',
        'twitter.com',
        'instagram.com',
      ];

      for (const domain of excludedDomains) {
        if (result.url.includes(domain)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 格式化搜索结果为可读文本
   */
  formatResultsAsText(results: SearchResult[]): string {
    if (results.length === 0) {
      return '未找到相关结果';
    }

    let text = `### 🔍 搜索结果 (${results.length} 个)\n\n`;
    
    results.forEach((result, index) => {
      text += `**${index + 1}. ${result.title}**\n`;
      text += `   ${result.url}\n`;
      if (result.snippet) {
        text += `   > ${result.snippet.substring(0, 150)}${result.snippet.length > 150 ? '...' : ''}\n`;
      }
      text += '\n';
    });

    return text;
  }
}

// 导出单例
export const webSearcher = new WebSearcher();

// 导出类以便创建自定义实例
export { WebSearcher, SEARCH_ENGINES };

