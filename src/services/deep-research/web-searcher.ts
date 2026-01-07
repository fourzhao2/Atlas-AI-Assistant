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
 * 
 * 注意：搜索引擎的 HTML 结构经常变化，这里提供多个备用选择器
 * 选择器按优先级排序，用逗号分隔，CSS 会自动匹配第一个有效的
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
    // Google 搜索结果容器 - 多个备用选择器
    resultSelector: 'div.g, div[data-hveid], div.hlcw0c',
    // 标题选择器 - h3 是最常见的
    titleSelector: 'h3, [role="heading"]',
    // 链接选择器 - 优先匹配 http 开头的链接
    linkSelector: 'a[href^="http"]:not([href*="google.com/search"]), a[data-ved]',
    // 摘要选择器 - Google 经常更改这个
    snippetSelector: 'div[data-sncf], div.VwiC3b, div[style*="-webkit-line-clamp"], span.aCOpRe',
  },
  bing: {
    name: 'Bing',
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    // Bing 搜索结果容器
    resultSelector: 'li.b_algo, .b_algo',
    // 标题通常在 h2 > a 中
    titleSelector: 'h2 a, h2',
    linkSelector: 'h2 a, a.tilk',
    snippetSelector: 'p, .b_caption p, .b_algoSlug',
  },
  baidu: {
    name: '百度',
    searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
    // 百度搜索结果容器
    resultSelector: 'div.result, div.c-container, div.result-op',
    titleSelector: 'h3 a, .c-title a, .t a',
    linkSelector: 'h3 a, .c-title a, .t a',
    snippetSelector: '.c-abstract, .content-right_8Zs40, .c-span-last, .c-color-text',
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
      let settled = false;
      
      // 超时处理 - 使用标志避免竞态条件
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('搜索超时'));
        }
      }, 30000);
      
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
          // 如果已经超时处理过，忽略此回调
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          
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

