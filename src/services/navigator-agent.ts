/**
 * Navigator Agent Service
 * 
 * 负责在真实网页环境中执行具体操作
 * 类似 Nanobrowser 的 Navigator 角色
 * 
 * 职责：
 * 1. 接收 Planner 发出的具体操作指令
 * 2. 在网页上执行点击、输入、滚动等操作
 * 3. 观察 DOM 变化并反馈结果
 * 4. 处理执行中的错误和异常
 */

import type {
  InteractiveElement,
  NavigatorConfig,
  NavigatorFeedback,
  PlanStep,
} from '@/types';
import { sendMessageToTab, getCurrentTab } from '@/utils/messaging';

// 默认配置
const DEFAULT_CONFIG: NavigatorConfig = {
  stepTimeout: 10000,         // 10 秒超时
  waitAfterAction: 500,       // 操作后等待 500ms
  maxElementsToAnalyze: 100,  // 最多分析 100 个元素
};

/**
 * Navigator Agent 类
 */
class NavigatorAgent {
  private config: NavigatorConfig;
  private isExecuting = false;
  private shouldStop = false;
  private previousDOMSnapshot: string[] = [];

  constructor(config: Partial<NavigatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NavigatorConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[Navigator] 配置已更新:', this.config);
  }

  /**
   * 获取当前页面的可交互元素
   */
  async getInteractiveDOM(): Promise<InteractiveElement[]> {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      console.warn('[Navigator] 没有活动标签页');
      return [];
    }

    try {
      const response = await sendMessageToTab<InteractiveElement[]>(tab.id, {
        type: 'GET_INTERACTIVE_DOM',
      });

      if (response.success && response.data) {
        // 保存 DOM 快照用于比较
        this.previousDOMSnapshot = response.data.map(el => el.selector);
        return response.data;
      }
    } catch (error) {
      console.error('[Navigator] 获取 DOM 失败:', error);
    }

    return [];
  }

  /**
   * 执行单个步骤
   */
  async executeStep(step: PlanStep): Promise<NavigatorFeedback> {
    console.log('[Navigator] 🔧 执行步骤:', step.description);

    const tab = await getCurrentTab();
    if (!tab?.id) {
      return {
        stepId: step.id,
        success: false,
        result: '没有活动标签页',
        domChanged: false,
        error: '没有活动标签页',
      };
    }

    try {
      // 特殊处理 navigate 操作
      if (step.action.type === 'navigate' && step.action.url) {
        return await this.executeNavigate(step, tab.id);
      }

      // 特殊处理 wait 操作
      if (step.action.type === 'wait') {
        return await this.executeWait(step);
      }

      // 其他操作通过 content script 执行
      const response = await sendMessageToTab<string>(tab.id, {
        type: 'EXECUTE_AGENT_ACTION',
        payload: step.action,
      });

      if (response.success && response.data) {
        // 等待 DOM 更新
        await this.waitForDOMUpdate();

        // 检查 DOM 变化
        const domChanged = await this.checkDOMChange(tab.id);

        return {
          stepId: step.id,
          success: true,
          result: response.data,
          domChanged,
          newElements: domChanged ? await this.getNewElements(tab.id) : undefined,
        };
      } else {
        return {
          stepId: step.id,
          success: false,
          result: response.error || '执行失败',
          domChanged: false,
          error: response.error,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error('[Navigator] ❌ 步骤执行失败:', errorMsg);

      return {
        stepId: step.id,
        success: false,
        result: errorMsg,
        domChanged: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 执行导航操作
   */
  private async executeNavigate(step: PlanStep, tabId: number): Promise<NavigatorFeedback> {
    const url = step.action.url;

    if (!url) {
      return {
        stepId: step.id,
        success: false,
        result: '缺少 URL',
        domChanged: false,
        error: '缺少 URL',
      };
    }

    // 验证 URL 格式
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // 尝试添加 https://
      if (url.includes('.')) {
        finalUrl = `https://${url}`;
      } else {
        // 可能是搜索查询
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    try {
      await chrome.tabs.update(tabId, { url: finalUrl });

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        stepId: step.id,
        success: true,
        result: `导航到: ${finalUrl}`,
        domChanged: true,
      };
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        result: `导航失败: ${error instanceof Error ? error.message : '未知错误'}`,
        domChanged: false,
        error: error instanceof Error ? error.message : '导航失败',
      };
    }
  }

  /**
   * 执行等待操作
   */
  private async executeWait(step: PlanStep): Promise<NavigatorFeedback> {
    const timeout = step.action.timeout || 1000;

    await new Promise(resolve => setTimeout(resolve, timeout));

    return {
      stepId: step.id,
      success: true,
      result: `等待 ${timeout}ms 完成`,
      domChanged: false,
    };
  }

  /**
   * 等待 DOM 更新
   */
  private async waitForDOMUpdate(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.config.waitAfterAction));
  }

  /**
   * 检查 DOM 是否发生变化
   */
  private async checkDOMChange(tabId: number): Promise<boolean> {
    try {
      const response = await sendMessageToTab<InteractiveElement[]>(tabId, {
        type: 'GET_INTERACTIVE_DOM',
      });

      if (response.success && response.data) {
        const currentSelectors = response.data.map(el => el.selector);
        const previousSet = new Set(this.previousDOMSnapshot);
        const currentSet = new Set(currentSelectors);

        // 检查是否有新增或删除的元素
        const hasNewElements = currentSelectors.some(s => !previousSet.has(s));
        const hasRemovedElements = this.previousDOMSnapshot.some(s => !currentSet.has(s));

        // 更新快照
        this.previousDOMSnapshot = currentSelectors;

        return hasNewElements || hasRemovedElements;
      }
    } catch (error) {
      console.warn('[Navigator] 检查 DOM 变化失败:', error);
    }

    return false;
  }

  /**
   * 获取新出现的元素
   */
  private async getNewElements(tabId: number): Promise<string[]> {
    try {
      const response = await sendMessageToTab<InteractiveElement[]>(tabId, {
        type: 'GET_INTERACTIVE_DOM',
      });

      if (response.success && response.data) {
        const previousSet = new Set(this.previousDOMSnapshot);
        return response.data
          .filter(el => !previousSet.has(el.selector))
          .slice(0, 10)
          .map(el => `${el.type}: ${el.text.substring(0, 30)}`);
      }
    } catch (error) {
      console.warn('[Navigator] 获取新元素失败:', error);
    }

    return [];
  }

  /**
   * 停止执行
   */
  stop(): void {
    console.log('[Navigator] ⏹️ 停止执行');
    this.shouldStop = true;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.isExecuting = false;
    this.shouldStop = false;
    this.previousDOMSnapshot = [];
  }

  /**
   * 是否正在执行
   */
  get executing(): boolean {
    return this.isExecuting;
  }

  /**
   * 是否应该停止
   */
  get stopped(): boolean {
    return this.shouldStop;
  }
}

// 导出单例
export const navigatorAgent = new NavigatorAgent();

// 导出类以便创建自定义实例
export { NavigatorAgent };

