import type { PageContent, InteractiveElement } from '@/types';

export class ContentExtractor {
  extractPageContent(): PageContent {
    // Basic content extraction without Readability
    const title = document.title;
    const url = window.location.href;
    
    // Get main content
    const content = this.extractMainContent();
    
    // Get excerpt (first 200 chars)
    const excerpt = content.substring(0, 200).trim() + '...';
    
    // Get site name
    const siteName = this.extractSiteName();
    
    return {
      title,
      url,
      content,
      excerpt,
      siteName,
    };
  }

  private extractMainContent(): string {
    // Try to find main content areas
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.main-content',
      '#main-content',
      '.content',
      '#content',
      '.post-content',
      '.article-content',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return this.getTextContent(element);
      }
    }

    // Fallback to body
    return this.getTextContent(document.body);
  }

  private getTextContent(element: Element): string {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as Element;
    
    // Remove script, style, and other non-content elements
    const selectorsToRemove = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      '.ad',
      '.advertisement',
      '.social-share',
      '.comments',
    ];

    selectorsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Get text content
    const text = clone.textContent || '';
    
    // Clean up whitespace
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  private extractSiteName(): string {
    // Try meta tags
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      return ogSiteName.getAttribute('content') || '';
    }

    // Try hostname
    return window.location.hostname.replace(/^www\./, '');
  }

  getPageContext(): { title: string; url: string; selection?: string } {
    const selection = window.getSelection()?.toString();
    
    return {
      title: document.title,
      url: window.location.href,
      selection: selection || undefined,
    };
  }

  getSelectedText(): string {
    return window.getSelection()?.toString() || '';
  }

  // ========== Agent-related methods ==========

  // DOM提取缓存
  private domCache: {
    elements: InteractiveElement[];
    timestamp: number;
    url: string;
  } | null = null;

  extractInteractiveDOM(maxElements = 100): InteractiveElement[] {
    const perfStart = performance.now();
    
    // 检查缓存（5秒内有效）
    const currentUrl = window.location.href;
    if (this.domCache && 
        this.domCache.url === currentUrl && 
        Date.now() - this.domCache.timestamp < 5000) {
      console.log(`[Extractor] ✅ 使用缓存，${this.domCache.elements.length}个元素`);
      return this.domCache.elements;
    }
    
    const elements: InteractiveElement[] = [];
    
    // 优化的选择器：更具体，减少查询范围
    const INTERACTIVE_SELECTOR = 
      'button:not([disabled]):not([hidden]), ' +
      'a[href]:not([hidden]), ' +
      'input:not([type="hidden"]):not([disabled]), ' +
      'textarea:not([disabled]), ' +
      'select:not([disabled]), ' +
      '[role="button"]:not([disabled]), ' +
      '[type="submit"]:not([disabled])';
    
    // 使用单次查询获取所有元素
    const allElements = document.querySelectorAll(INTERACTIVE_SELECTOR);
    
    // 限制处理数量，提高性能
    const elementsToProcess = Math.min(allElements.length, maxElements);
    
    for (let index = 0; index < elementsToProcess; index++) {
      const el = allElements[index];
      
      // 快速可见性检查（优化版）
      if (!this.isVisibleFast(el as HTMLElement)) continue;
      
      const element = el as HTMLElement;
      const rect = element.getBoundingClientRect();
      
      elements.push({
        id: this.generateUniqueId(element, index),
        selector: this.generateStableSelector(element, index),
        type: this.getElementType(element),
        tagName: element.tagName.toLowerCase(),
        text: this.getElementText(element),
        value: (element as HTMLInputElement).value || undefined,
        placeholder: (element as HTMLInputElement).placeholder || undefined,
        attributes: this.getRelevantAttributes(element),
        position: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        isVisible: true,
        context: this.getElementContext(element)
      });
    }
    
    // 更新缓存
    this.domCache = {
      elements,
      timestamp: Date.now(),
      url: currentUrl
    };
    
    const perfEnd = performance.now();
    console.log(`[Extractor] ✅ 提取${elements.length}个元素，耗时: ${(perfEnd - perfStart).toFixed(2)}ms`);
    
    return elements;
  }
  
  // 优化的可见性检查（更快）
  private isVisibleFast(element: HTMLElement): boolean {
    // 快速检查：offsetParent为null通常表示不可见
    if (!element.offsetParent) return false;
    
    // 检查元素大小
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    return true;
  }

  // 原有的详细检查方法已被 isVisibleFast 替代以提升性能
  // 保留此注释以供参考

  private generateUniqueId(element: HTMLElement, index: number): string {
    if (element.id) return `id-${element.id}`;
    if (element.getAttribute('name')) return `name-${element.getAttribute('name')}`;
    if (element.getAttribute('data-testid')) return `testid-${element.getAttribute('data-testid')}`;
    return `el-${element.tagName.toLowerCase()}-${index}`;
  }

  private generateStableSelector(element: HTMLElement, index: number): string {
    // 优先级：id > name > data-* > aria-label > class + type
    if (element.id) {
      return `#${element.id}`;
    }
    
    const name = element.getAttribute('name');
    if (name) {
      return `[name="${name}"]`;
    }
    
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }
    
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }
    
    // 使用 class + type
    const tagName = element.tagName.toLowerCase();
    const classes = Array.from(element.classList)
      .filter(c => !c.startsWith('js-') && !c.match(/^[a-f0-9]{6,}$/)) // 过滤动态类名
      .slice(0, 2); // 只取前两个类名
    
    if (classes.length > 0) {
      const type = element.getAttribute('type');
      if (type && tagName === 'input') {
        return `input[type="${type}"].${classes.join('.')}`;
      }
      return `${tagName}.${classes.join('.')}`;
    }
    
    // 最后使用 nth-of-type
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  private getElementType(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'input') {
      return (element as HTMLInputElement).type || 'text';
    }
    
    if (tagName === 'button') return 'button';
    if (tagName === 'a') return 'link';
    if (tagName === 'select') return 'select';
    if (tagName === 'textarea') return 'textarea';
    
    const role = element.getAttribute('role');
    if (role) return role;
    
    return tagName;
  }

  private getElementText(element: HTMLElement): string {
    // 对于按钮和链接，获取文本内容
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return element.textContent?.trim() || '';
    }
    
    // 对于输入框，获取 label
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
      // 尝试找到关联的 label
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          return label.textContent?.trim() || '';
        }
      }
      
      // 尝试找到父级 label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        return parentLabel.textContent?.trim() || '';
      }
      
      // 返回 placeholder 或 name
      const input = element as HTMLInputElement;
      return input.placeholder || input.name || '';
    }
    
    return element.textContent?.trim().substring(0, 50) || '';
  }

  private getRelevantAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    
    // 只提取有用的属性
    const relevantAttrs = [
      'type', 'name', 'id', 'class', 'href', 'value', 'placeholder',
      'aria-label', 'title', 'role', 'data-testid', 'required', 'disabled'
    ];
    
    relevantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    });
    
    return attrs;
  }

  private getElementContext(element: HTMLElement): string {
    // 获取元素的上下文信息（父级容器的文本）
    const parent = element.parentElement;
    if (!parent) return '';
    
    // 获取父级的简短描述
    const parentTag = parent.tagName.toLowerCase();
    const parentClasses = Array.from(parent.classList).slice(0, 2).join('.');
    
    return parentClasses ? `${parentTag}.${parentClasses}` : parentTag;
  }
}

export const contentExtractor = new ContentExtractor();

