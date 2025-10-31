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

  extractInteractiveDOM(): InteractiveElement[] {
    const elements: InteractiveElement[] = [];
    
    // 提取所有可交互元素
    const selectors = [
      'input:not([type="hidden"])', 
      'textarea', 
      'select', 
      'button', 
      'a[href]', 
      '[role="button"]', 
      '[role="link"]',
      '[onclick]',
      '[type="submit"]',
      '[contenteditable="true"]'
    ];
    
    const allElements = document.querySelectorAll(selectors.join(','));
    
    allElements.forEach((el, index) => {
      // 跳过不可见元素
      if (!this.isVisible(el)) return;
      
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
    });
    
    console.log(`[Extractor] 提取到 ${elements.length} 个可交互元素`);
    return elements;
  }

  private isVisible(element: Element): boolean {
    const el = element as HTMLElement;
    if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) {
      return false;
    }
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    return true;
  }

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

