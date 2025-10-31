import type { AgentAction, AITool } from '@/types';
import { aiService } from './ai-service';

class ActionParser {
  private readonly tools: AITool[] = [
    {
      name: 'click',
      description: 'Click an element on the page',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'fill',
      description: 'Fill an input field with text',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input element',
          },
          value: {
            type: 'string',
            description: 'Value to fill in the input',
          },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'scroll',
      description: 'Scroll to an element or position',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to scroll to',
          },
          y: {
            type: 'number',
            description: 'Y position to scroll to',
          },
        },
      },
    },
    {
      name: 'navigate',
      description: 'Navigate to a URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to navigate to',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'extract',
      description: 'Extract data from elements matching a selector',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for elements to extract data from',
          },
        },
        required: ['selector'],
      },
    },
  ];

  async parseInstructions(instruction: string, context?: string): Promise<AgentAction[]> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are an agent that converts user instructions into web page actions.
Available actions: click, fill, scroll, navigate, extract.
${context ? `\n\nPage context:\n${context}` : ''}`,
      },
      {
        role: 'user' as const,
        content: instruction,
      },
    ];

    try {
      // chatWithTools 只接受两个参数：messages 和 tools，不接受 providerType
      const response = await aiService.chatWithTools(messages, this.tools);
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        return response.toolCalls.map((call: { name: string; arguments: Record<string, unknown> }) => this.toolCallToAction(call));
      }

      // If no tool calls, try to parse from text response
      return this.parseFromText(response.content);
    } catch (error) {
      console.error('Failed to parse instructions:', error);
      return [];
    }
  }

  private toolCallToAction(toolCall: { name: string; arguments: Record<string, unknown> }): AgentAction {
    const action: AgentAction = {
      type: toolCall.name as AgentAction['type'],
    };

    if ('selector' in toolCall.arguments) {
      action.selector = String(toolCall.arguments.selector);
    }
    if ('value' in toolCall.arguments) {
      action.value = String(toolCall.arguments.value);
    }
    if ('x' in toolCall.arguments) {
      action.x = Number(toolCall.arguments.x);
    }
    if ('y' in toolCall.arguments) {
      action.y = Number(toolCall.arguments.y);
    }
    if ('url' in toolCall.arguments) {
      action.url = String(toolCall.arguments.url);
    }

    return action;
  }

  private parseFromText(text: string): AgentAction[] {
    const actions: AgentAction[] = [];
    
    // Simple regex-based parsing as fallback
    const clickMatch = text.match(/click\s+(?:on\s+)?['"]?([^'"]+)['"]?/i);
    if (clickMatch) {
      actions.push({ type: 'click', selector: clickMatch[1] });
    }

    const fillMatch = text.match(/fill\s+['"]?([^'"]+)['"]?\s+with\s+['"]([^'"]+)['"]/i);
    if (fillMatch) {
      actions.push({ type: 'fill', selector: fillMatch[1], value: fillMatch[2] });
    }

    const navigateMatch = text.match(/(?:navigate|go)\s+to\s+['"]?([^'"]+)['"]?/i);
    if (navigateMatch) {
      actions.push({ type: 'navigate', url: navigateMatch[1] });
    }

    return actions;
  }

  getAvailableActions(): string[] {
    return this.tools.map(t => t.name);
  }
}

export const actionParser = new ActionParser();

