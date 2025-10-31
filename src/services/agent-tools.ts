import type { AITool } from '@/types';

/**
 * 定义所有可用的 Agent Tools
 * 这些 tools 会发送给 AI，让 AI 根据用户意图选择调用
 */
export const agentTools: AITool[] = [
  {
    name: 'get_page_content',
    description: '获取当前网页的内容和信息。当用户询问"这个页面讲什么"、"总结页面"或需要基于页面内容回答问题时使用。',
    parameters: {
      type: 'object',
      properties: {
        include_full_content: {
          type: 'boolean',
          description: '是否包含完整的页面文本内容，默认 true'
        }
      }
    }
  },
  
  {
    name: 'web_search',
    description: '在搜索引擎（Google、百度等）上搜索信息。当用户想要查找、搜索、了解某个话题时使用。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '要搜索的关键词或问题'
        },
        engine: {
          type: 'string',
          enum: ['google', 'baidu', 'bing'],
          description: '搜索引擎选择，默认为 google'
        }
      },
      required: ['query']
    }
  },
  
  {
    name: 'navigate_to_url',
    description: '导航到指定的网址。当用户想要访问、打开某个网站时使用。',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要访问的完整 URL 或网站名称（如"百度"、"GitHub"）'
        }
      },
      required: ['url']
    }
  },
  
  {
    name: 'click_element',
    description: '点击页面上的元素（按钮、链接等）。当用户想要点击某个按钮或链接时使用。',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '元素的 CSS 选择器或描述性文本（如"提交按钮"、"登录链接"）'
        }
      },
      required: ['selector']
    }
  },
  
  {
    name: 'fill_form',
    description: '填写表单字段。当用户想要在输入框中输入文字时使用。',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '输入框的选择器或描述（如"搜索框"、"用户名输入框"）'
        },
        value: {
          type: 'string',
          description: '要填写的内容'
        }
      },
      required: ['selector', 'value']
    }
  },
  
  {
    name: 'scroll_page',
    description: '滚动页面。当用户想要向下滚动、到底部、到顶部时使用。',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['top', 'bottom', 'down', 'up'],
          description: '滚动方向：top（顶部）、bottom（底部）、down（向下）、up（向上）'
        },
        distance: {
          type: 'number',
          description: '滚动距离（像素），可选'
        }
      },
      required: ['direction']
    }
  },
  
  {
    name: 'extract_content',
    description: '从页面中提取特定内容。当用户想要获取页面上的某些信息时使用。',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '要提取内容的元素选择器'
        },
        type: {
          type: 'string',
          enum: ['text', 'html', 'attribute'],
          description: '提取类型：文本、HTML 或属性'
        }
      },
      required: ['selector']
    }
  },
  
  {
    name: 'wait_for_element',
    description: '等待某个元素出现或页面加载完成。在执行操作后需要等待页面更新时使用。',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '要等待的元素选择器'
        },
        timeout: {
          type: 'number',
          description: '超时时间（毫秒），默认 5000'
        }
      }
    }
  },
  
  {
    name: 'submit_form',
    description: '提交表单。当用户想要提交、发送表单时使用。',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '表单或提交按钮的选择器，可选'
        }
      }
    }
  },
  
  {
    name: 'select_option',
    description: '在下拉框中选择选项。当用户想要从下拉列表中选择内容时使用。',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '下拉框的选择器'
        },
        value: {
          type: 'string',
          description: '要选择的选项值或文本'
        }
      },
      required: ['selector', 'value']
    }
  },
  
  {
    name: 'play_video',
    description: '在视频网站（B站、YouTube等）上搜索并播放视频。当用户想要观看、播放视频时使用。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '要搜索的视频关键词'
        },
        platform: {
          type: 'string',
          enum: ['bilibili', 'youtube', 'auto'],
          description: '视频平台，默认 auto（自动选择）'
        }
      },
      required: ['query']
    }
  }
];

/**
 * Tool 调用结果接口
 */
export interface ToolCallResult {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * 执行 Tool 调用
 */
export async function executeToolCall(
  toolName: string, 
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  console.log(`[AgentTools] 执行 tool: ${toolName}`, args);
  
  // 这里会调用实际的执行逻辑
  // 暂时返回一个占位结果
  return {
    success: true,
    result: `Tool ${toolName} 调用成功，参数: ${JSON.stringify(args)}`
  };
}

