import type { TranslatableElement, TranslationResult } from '@/types';

/**
 * DOM翻译器 - 负责页面元素的识别、提取和翻译结果注入
 * 
 * 功能：
 * - 智能识别可翻译元素
 * - 提取元素内容
 * - 注入翻译结果
 * - 保持页面格式
 */
export class DOMTranslator {
    private translatedElements: Map<string, HTMLElement> = new Map();
    private originalContents: Map<string, string> = new Map();

    /**
     * 提取页面中可翻译的元素
     */
    extractTranslatableElements(maxElements = 100): TranslatableElement[] {
        const elements: TranslatableElement[] = [];

        // 定义可翻译元素的选择器（针对学术论文）
        const selectors = [
            // 标题
            'article h1, article h2, article h3, article h4, article h5, article h6',
            'main h1, main h2, main h3, main h4, main h5, main h6',
            '.article-title, .paper-title, .section-title',

            // 段落
            'article p, main p',
            '.abstract p, .introduction p, .methods p, .results p, .discussion p, .conclusion p',

            // 列表项
            'article li, main li',

            // 图表说明
            'figcaption, .figure-caption, .table-caption',
            'figure p, .figure-description',

            // 引用
            'blockquote',

            // 表格单元格（谨慎处理）
            // 'td, th'
        ];

        const allElements = new Set<HTMLElement>();

        // 收集所有匹配的元素
        selectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    if (el instanceof HTMLElement && this.isElementTranslatable(el)) {
                        allElements.add(el);
                    }
                });
            } catch (error) {
                console.warn(`[DOMTranslator] 选择器错误: ${selector}`, error);
            }
        });

        // 转换为TranslatableElement数组
        let index = 0;
        for (const element of Array.from(allElements).slice(0, maxElements)) {
            const transElement = this.createTranslatableElement(element, index++);
            if (transElement) {
                elements.push(transElement);
            }
        }

        console.log(`[DOMTranslator] 提取了 ${elements.length} 个可翻译元素`);
        return elements;
    }

    /**
     * 判断元素是否可翻译
     */
    private isElementTranslatable(element: HTMLElement): boolean {
        // 跳过不可见元素
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // 跳过空元素
        const text = this.getElementTextContent(element);
        if (!text || text.trim().length < 10) {
            return false;
        }

        // 跳过已经有翻译标记的元素
        if (element.hasAttribute('data-translated')) {
            return false;
        }

        // 跳过代码块
        if (element.tagName === 'CODE' || element.tagName === 'PRE') {
            return false;
        }

        // 跳过包含公式的元素（MathML或LaTeX）
        if (element.querySelector('math, .math, .equation, .katex, .mathjax')) {
            return false;
        }

        return true;
    }

    /**
     * 创建可翻译元素对象
     */
    private createTranslatableElement(
        element: HTMLElement,
        index: number
    ): TranslatableElement | null {
        const content = this.getElementTextContent(element);
        if (!content) return null;

        const id = this.generateElementId(element, index);
        const type = this.getElementType(element);
        const priority = this.getElementPriority(element, type);

        return {
            id,
            element,
            selector: this.generateSelector(element),
            type,
            content,
            priority,
            translated: false
        };
    }

    /**
     * 获取元素的文本内容
     */
    private getElementTextContent(element: HTMLElement): string {
        // 对于某些元素，只获取直接文本节点
        if (element.tagName === 'P' || element.tagName.startsWith('H')) {
            return this.getDirectTextContent(element);
        }

        return element.textContent?.trim() || '';
    }

    /**
     * 获取直接文本内容（不包含子元素）
     */
    private getDirectTextContent(element: HTMLElement): string {
        let text = '';
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                // 包含一些内联元素的文本
                if (['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'U'].includes(el.tagName)) {
                    text += el.textContent;
                }
            }
        });
        return text.trim();
    }

    /**
     * 获取元素类型
     */
    private getElementType(element: HTMLElement): TranslatableElement['type'] {
        const tagName = element.tagName.toLowerCase();

        if (tagName.startsWith('h')) return 'heading';
        if (tagName === 'p') return 'paragraph';
        if (tagName === 'li') return 'list-item';
        if (tagName === 'td' || tagName === 'th') return 'table-cell';
        if (tagName === 'figcaption') return 'caption';
        if (tagName === 'blockquote') return 'quote';

        return 'text';
    }

    /**
     * 获取元素优先级（1-10）
     */
    private getElementPriority(element: HTMLElement, type: string): number {
        // 标题最高优先级
        if (type === 'heading') {
            const level = parseInt(element.tagName.charAt(1));
            return 10 - level; // H1=9, H2=8, H3=7...
        }

        // 摘要和结论高优先级
        const classList = element.className.toLowerCase();
        if (classList.includes('abstract')) return 9;
        if (classList.includes('conclusion')) return 8;

        // 图表说明
        if (type === 'caption') return 7;

        // 引用
        if (type === 'quote') return 6;

        // 普通段落和列表
        if (type === 'paragraph') return 5;
        if (type === 'list-item') return 4;

        return 3;
    }

    /**
     * 生成元素ID
     */
    private generateElementId(element: HTMLElement, index: number): string {
        if (element.id) return `trans-${element.id}`;
        return `trans-el-${index}-${Date.now()}`;
    }

    /**
     * 生成CSS选择器
     */
    private generateSelector(element: HTMLElement): string {
        if (element.id) return `#${element.id}`;

        const tagName = element.tagName.toLowerCase();
        const classes = Array.from(element.classList)
            .filter(c => !c.match(/^[a-f0-9]{6,}$/)) // 过滤动态类名
            .slice(0, 2)
            .join('.');

        if (classes) {
            return `${tagName}.${classes}`;
        }

        return tagName;
    }

    /**
     * 应用翻译结果到元素
     */
    applyTranslation(
        elementId: string,
        result: TranslationResult,
        mode: 'replace' | 'bilingual' = 'replace'
    ): boolean {
        const elements = this.extractTranslatableElements();
        const target = elements.find(e => e.id === elementId);

        if (!target || !target.element) {
            console.warn(`[DOMTranslator] 未找到元素: ${elementId}`);
            return false;
        }

        // 保存原始内容
        if (!this.originalContents.has(elementId)) {
            this.originalContents.set(elementId, target.element.innerHTML);
        }

        if (mode === 'replace') {
            // 替换模式：直接替换内容
            target.element.textContent = result.translated;
            target.element.setAttribute('data-translated', 'true');
            target.element.setAttribute('data-original', result.original);
            target.element.style.fontStyle = 'italic'; // 标记翻译文本
        } else {
            // 双语模式：显示原文和译文
            const original = this.originalContents.get(elementId) || target.element.innerHTML;
            target.element.innerHTML = `
        <div class="translation-container">
          <div class="original-text" style="color: #666; font-size: 0.9em; margin-bottom: 4px;">
            ${original}
          </div>
          <div class="translated-text" style="color: #000; font-weight: 500;">
            ${result.translated}
          </div>
        </div>
      `;
            target.element.setAttribute('data-translated', 'bilingual');
        }

        this.translatedElements.set(elementId, target.element);
        target.translated = true;

        return true;
    }

    /**
     * 恢复元素原始内容
     */
    restoreOriginal(elementId: string): boolean {
        const element = this.translatedElements.get(elementId);
        const original = this.originalContents.get(elementId);

        if (!element || !original) {
            return false;
        }

        element.innerHTML = original;
        element.removeAttribute('data-translated');
        element.removeAttribute('data-original');
        element.style.fontStyle = '';

        this.translatedElements.delete(elementId);
        return true;
    }

    /**
     * 恢复所有翻译
     */
    restoreAll() {
        const elementIds = Array.from(this.translatedElements.keys());
        elementIds.forEach(id => this.restoreOriginal(id));
        this.originalContents.clear();
        console.log(`[DOMTranslator] 已恢复所有翻译`);
    }

    /**
     * 获取翻译统计
     */
    getStats() {
        return {
            translated: this.translatedElements.size,
            cached: this.originalContents.size
        };
    }
}

export const domTranslator = new DOMTranslator();
