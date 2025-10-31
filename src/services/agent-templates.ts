import type { AgentAction } from '@/types';

export interface AgentTemplate {
  patterns: string[];
  handler: (query: string, context?: { url: string; title: string }) => Promise<AgentAction[]>;
}

// 预定义的场景模板
export const agentTemplates: Record<string, AgentTemplate> = {
  // 搜索场景
  search: {
    patterns: ['搜索', 'search', '查找', '找', '搜一下', '搜一搜'],
    handler: async (query: string, context) => {
      const currentUrl = context?.url || window.location.href;
      const hostname = new URL(currentUrl).hostname;
      
      // 如果已经在搜索引擎页面
      if (hostname.includes('google.com')) {
        return [
          { type: 'fill', selector: 'input[name="q"]', value: query },
          { type: 'press', key: 'Enter' }
        ];
      } else if (hostname.includes('baidu.com')) {
        return [
          { type: 'fill', selector: '#kw', value: query },
          { type: 'click', selector: '#su' }
        ];
      } else if (hostname.includes('bing.com')) {
        return [
          { type: 'fill', selector: 'input[name="q"]', value: query },
          { type: 'press', key: 'Enter' }
        ];
      }
      
      // 不在搜索引擎，先导航过去
      return [
        { type: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }
      ];
    }
  },

  // 视频播放场景
  playVideo: {
    patterns: ['播放', 'play', '看视频', '观看', '打开视频'],
    handler: async (query: string, context) => {
      const currentUrl = context?.url || window.location.href;
      const hostname = new URL(currentUrl).hostname;
      
      // B站
      if (hostname.includes('bilibili.com')) {
        // 如果已经在B站，执行搜索
        return [
          { type: 'click', selector: '.nav-search-btn' },
          { type: 'wait', selector: 'input.nav-search-input', timeout: 1000 },
          { type: 'fill', selector: 'input.nav-search-input', value: query },
          { type: 'press', key: 'Enter' },
          { type: 'wait', selector: '.video-item', timeout: 3000 },
          { type: 'click', selector: '.video-item:first-child a' }
        ];
      }
      
      // YouTube
      if (hostname.includes('youtube.com')) {
        return [
          { type: 'fill', selector: 'input#search', value: query },
          { type: 'click', selector: 'button#search-icon-legacy' },
          { type: 'wait', selector: 'ytd-video-renderer', timeout: 3000 },
          { type: 'click', selector: 'ytd-video-renderer:first-child a#video-title' }
        ];
      }
      
      // 不在视频网站，导航到B站搜索
      return [
        { type: 'navigate', url: `https://www.bilibili.com/search?keyword=${encodeURIComponent(query)}` },
        { type: 'wait', selector: '.video-item', timeout: 5000 },
        { type: 'click', selector: '.video-item:first-child a' }
      ];
    }
  },

  // 表单填写场景
  fillForm: {
    patterns: ['填写表单', 'fill form', '填表', '填写'],
    handler: async (_query: string) => {
      // 这个需要更复杂的逻辑，可能需要 AI 解析用户要填写的内容
      // 这里只是一个简单的示例
      return [
        { type: 'extract', selector: 'form input, form textarea, form select' }
      ];
    }
  },

  // 导航场景
  navigate: {
    patterns: ['打开', 'open', '访问', 'visit', '去', 'goto', '跳转'],
    handler: async (query: string) => {
      // 尝试从查询中提取 URL
      const urlPattern = /(https?:\/\/[^\s]+)|([a-zA-Z0-9-]+\.(com|cn|net|org|io|gov|edu)[^\s]*)/;
      const match = query.match(urlPattern);
      
      if (match) {
        let url = match[0];
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        return [{ type: 'navigate', url }];
      }
      
      // 识别常见网站名称
      const siteMap: Record<string, string> = {
        '百度': 'https://www.baidu.com',
        'baidu': 'https://www.baidu.com',
        '谷歌': 'https://www.google.com',
        'google': 'https://www.google.com',
        'B站': 'https://www.bilibili.com',
        'bilibili': 'https://www.bilibili.com',
        '哔哩哔哩': 'https://www.bilibili.com',
        '知乎': 'https://www.zhihu.com',
        'zhihu': 'https://www.zhihu.com',
        '微博': 'https://www.weibo.com',
        'weibo': 'https://www.weibo.com',
        '淘宝': 'https://www.taobao.com',
        'taobao': 'https://www.taobao.com',
        '京东': 'https://www.jd.com',
        'jd': 'https://www.jd.com',
        'github': 'https://github.com'
      };
      
      for (const [key, url] of Object.entries(siteMap)) {
        if (query.toLowerCase().includes(key.toLowerCase())) {
          return [{ type: 'navigate', url }];
        }
      }
      
      // 默认使用 Google 搜索
      return [
        { type: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }
      ];
    }
  },

  // 滚动场景
  scroll: {
    patterns: ['滚动', 'scroll', '向下', '向上', '到底部', '到顶部'],
    handler: async (query: string) => {
      if (query.includes('底部') || query.includes('bottom') || query.includes('向下')) {
        return [{ type: 'scroll', y: document.body.scrollHeight }];
      }
      
      if (query.includes('顶部') || query.includes('top') || query.includes('向上')) {
        return [{ type: 'scroll', y: 0 }];
      }
      
      return [{ type: 'scroll', y: window.scrollY + 500 }];
    }
  }
};

/**
 * 检测指令是否匹配某个模板
 */
export function matchTemplate(instruction: string): { template: AgentTemplate; match: string } | null {
  const lowerInstruction = instruction.toLowerCase();
  
  for (const [_key, template] of Object.entries(agentTemplates)) {
    for (const pattern of template.patterns) {
      if (lowerInstruction.includes(pattern.toLowerCase())) {
        return { template, match: pattern };
      }
    }
  }
  
  return null;
}

/**
 * 根据指令生成操作序列
 */
export async function generateActionsFromTemplate(
  instruction: string, 
  context?: { url: string; title: string }
): Promise<AgentAction[] | null> {
  const match = matchTemplate(instruction);
  
  if (!match) {
    return null;
  }
  
  try {
    // 提取查询关键词（移除模板匹配的部分）
    let query = instruction;
    for (const pattern of match.template.patterns) {
      query = query.replace(new RegExp(pattern, 'gi'), '').trim();
    }
    
    // 如果没有剩余关键词，使用原始指令
    if (!query) {
      query = instruction;
    }
    
    const actions = await match.template.handler(query, context);
    console.log(`[AgentTemplates] 匹配模板，生成 ${actions.length} 个操作`);
    
    return actions;
  } catch (error) {
    console.error('[AgentTemplates] 模板执行失败:', error);
    return null;
  }
}

