import type { AgentAction } from '@/types';

export class PageAgent {
  async executeAction(action: AgentAction): Promise<string> {
    console.log(`[Agent] 执行操作:`, action.type, action.selector);
    
    switch (action.type) {
      case 'click':
        return this.clickElement(action);
      case 'fill':
        return this.fillInput(action);
      case 'scroll':
        return this.scrollPage(action);
      case 'navigate':
        return this.navigate(action);
      case 'extract':
        return this.extractData(action);
      case 'select':
        return this.selectOption(action);
      case 'check':
        return this.checkBox(action);
      case 'upload':
        return this.uploadFile(action);
      case 'hover':
        return this.hoverElement(action);
      case 'drag':
        return this.dragElement(action);
      case 'press':
        return this.pressKey(action);
      case 'wait':
        return this.waitFor(action);
      case 'submit':
        return this.submitForm(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private clickElement(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (action.selector) {
          const element = document.querySelector(action.selector) as HTMLElement;
          if (!element) {
            reject(new Error(`Element not found: ${action.selector}`));
            return;
          }
          element.click();
          resolve(`Clicked element: ${action.selector}`);
        } else if (action.x !== undefined && action.y !== undefined) {
          const element = document.elementFromPoint(action.x, action.y) as HTMLElement;
          if (!element) {
            reject(new Error(`No element at position (${action.x}, ${action.y})`));
            return;
          }
          element.click();
          resolve(`Clicked element at (${action.x}, ${action.y})`);
        } else {
          reject(new Error('Click action requires either selector or coordinates'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private fillInput(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector || action.value === undefined) {
          reject(new Error('Fill action requires selector and value'));
          return;
        }

        const element = document.querySelector(action.selector) as HTMLInputElement | HTMLTextAreaElement;
        if (!element) {
          reject(new Error(`Element not found: ${action.selector}`));
          return;
        }

        // Set value
        element.value = String(action.value);
        
        // Trigger input events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        resolve(`Filled ${action.selector} with: ${action.value}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private scrollPage(action: AgentAction): Promise<string> {
    return new Promise((resolve) => {
      if (action.selector) {
        const element = document.querySelector(action.selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          // 等待滚动动画完成（通常 300-500ms）
          setTimeout(() => {
            resolve(`Scrolled to element: ${action.selector}`);
          }, 500);
        } else {
          resolve(`Element not found: ${action.selector}`);
        }
      } else if (action.y !== undefined) {
        window.scrollTo({ top: action.y, behavior: 'smooth' });
        // 等待滚动动画完成
        setTimeout(() => {
          resolve(`Scrolled to Y position: ${action.y}`);
        }, 500);
      } else {
        resolve('No scroll target specified');
      }
    });
  }

  private navigate(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!action.url) {
        reject(new Error('Navigate action requires URL'));
        return;
      }
      window.location.href = action.url;
      resolve(`Navigating to: ${action.url}`);
    });
  }

  private extractData(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector) {
          reject(new Error('Extract action requires selector'));
          return;
        }

        const elements = document.querySelectorAll(action.selector);
        if (elements.length === 0) {
          reject(new Error(`No elements found: ${action.selector}`));
          return;
        }

        const data = Array.from(elements).map(el => {
          return {
            text: el.textContent?.trim(),
            html: el.innerHTML,
            attributes: this.getElementAttributes(el),
          };
        });

        resolve(JSON.stringify(data, null, 2));
      } catch (error) {
        reject(error);
      }
    });
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  // Helper to get interactive elements on page
  getInteractiveElements(): Array<{ selector: string; type: string; text: string }> {
    const elements: Array<{ selector: string; type: string; text: string }> = [];
    
    // Buttons
    document.querySelectorAll('button, [role="button"]').forEach((el, i) => {
      elements.push({
        selector: this.generateSelector(el, i, 'button'),
        type: 'button',
        text: el.textContent?.trim() || '',
      });
    });

    // Links
    document.querySelectorAll('a[href]').forEach((el, i) => {
      elements.push({
        selector: this.generateSelector(el, i, 'link'),
        type: 'link',
        text: el.textContent?.trim() || '',
      });
    });

    // Inputs
    document.querySelectorAll('input, textarea, select').forEach((el, i) => {
      const input = el as HTMLInputElement;
      elements.push({
        selector: this.generateSelector(el, i, 'input'),
        type: input.type || 'text',
        text: input.placeholder || input.name || '',
      });
    });

    return elements;
  }

  private generateSelector(element: Element, index: number, _type: string): string {
    // Try to get a unique selector
    if (element.id) {
      return `#${element.id}`;
    }
    
    const classes = Array.from(element.classList).filter(c => !c.startsWith('js-'));
    if (classes.length > 0) {
      return `.${classes.join('.')}`;
    }

    return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
  }

  // ========== 新增操作方法 ==========

  private selectOption(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector || action.value === undefined) {
          reject(new Error('Select action requires selector and value'));
          return;
        }

        const select = document.querySelector(action.selector) as HTMLSelectElement;
        if (!select) {
          reject(new Error(`Select element not found: ${action.selector}`));
          return;
        }

        if (select.tagName !== 'SELECT') {
          reject(new Error(`Element is not a select: ${action.selector}`));
          return;
        }

        select.value = String(action.value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));

        resolve(`Selected option "${action.value}" in ${action.selector}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private checkBox(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector) {
          reject(new Error('Check action requires selector'));
          return;
        }

        const checkbox = document.querySelector(action.selector) as HTMLInputElement;
        if (!checkbox) {
          reject(new Error(`Checkbox not found: ${action.selector}`));
          return;
        }

        if (checkbox.type !== 'checkbox' && checkbox.type !== 'radio') {
          reject(new Error(`Element is not a checkbox/radio: ${action.selector}`));
          return;
        }

        const shouldCheck = action.value !== false;
        checkbox.checked = shouldCheck;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('click', { bubbles: true }));

        resolve(`${shouldCheck ? 'Checked' : 'Unchecked'} ${action.selector}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private uploadFile(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector) {
          reject(new Error('Upload action requires selector'));
          return;
        }

        const input = document.querySelector(action.selector) as HTMLInputElement;
        if (!input) {
          reject(new Error(`File input not found: ${action.selector}`));
          return;
        }

        if (input.type !== 'file') {
          reject(new Error(`Element is not a file input: ${action.selector}`));
          return;
        }

        // 触发点击以打开文件选择对话框
        input.click();
        
        resolve(`Triggered file upload dialog for: ${action.selector}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private hoverElement(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector) {
          reject(new Error('Hover action requires selector'));
          return;
        }

        const element = document.querySelector(action.selector) as HTMLElement;
        if (!element) {
          reject(new Error(`Element not found: ${action.selector}`));
          return;
        }

        // 创建并触发鼠标事件
        const mouseoverEvent = new MouseEvent('mouseover', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        
        const mouseenterEvent = new MouseEvent('mouseenter', {
          bubbles: true,
          cancelable: true,
          view: window
        });

        element.dispatchEvent(mouseoverEvent);
        element.dispatchEvent(mouseenterEvent);

        resolve(`Hovered over: ${action.selector}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private dragElement(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.selector || !action.targetSelector) {
          reject(new Error('Drag action requires selector and targetSelector'));
          return;
        }

        const source = document.querySelector(action.selector) as HTMLElement;
        const target = document.querySelector(action.targetSelector) as HTMLElement;

        if (!source) {
          reject(new Error(`Source element not found: ${action.selector}`));
          return;
        }

        if (!target) {
          reject(new Error(`Target element not found: ${action.targetSelector}`));
          return;
        }

        // 模拟拖拽事件序列
        const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true });
        const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
        const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
        const dragEndEvent = new DragEvent('dragend', { bubbles: true, cancelable: true });

        source.dispatchEvent(dragStartEvent);
        target.dispatchEvent(dragOverEvent);
        target.dispatchEvent(dropEvent);
        source.dispatchEvent(dragEndEvent);

        resolve(`Dragged ${action.selector} to ${action.targetSelector}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private pressKey(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!action.key) {
          reject(new Error('Press action requires key'));
          return;
        }

        const element = action.selector 
          ? document.querySelector(action.selector) as HTMLElement
          : document.activeElement as HTMLElement || document.body;

        if (!element) {
          reject(new Error(`Element not found: ${action.selector}`));
          return;
        }

        // 键码映射
        const keyMap: Record<string, string> = {
          'Enter': 'Enter',
          'Tab': 'Tab',
          'Escape': 'Escape',
          'Space': ' ',
          'ArrowUp': 'ArrowUp',
          'ArrowDown': 'ArrowDown',
          'ArrowLeft': 'ArrowLeft',
          'ArrowRight': 'ArrowRight',
          'Backspace': 'Backspace',
          'Delete': 'Delete'
        };

        const key = keyMap[action.key] || action.key;

        const keyDownEvent = new KeyboardEvent('keydown', {
          key: key,
          bubbles: true,
          cancelable: true
        });

        const keyUpEvent = new KeyboardEvent('keyup', {
          key: key,
          bubbles: true,
          cancelable: true
        });

        element.dispatchEvent(keyDownEvent);
        element.dispatchEvent(keyUpEvent);

        // 特殊处理 Enter 键
        if (key === 'Enter') {
          // 如果是表单元素，尝试提交表单
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            const form = element.closest('form');
            if (form) {
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          }
        }

        resolve(`Pressed key "${action.key}" on ${action.selector || 'active element'}`);
      } catch (error) {
        reject(error);
      }
    });
  }

  private waitFor(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = action.timeout || 5000;
      const startTime = Date.now();

      if (action.selector) {
        // 等待元素出现
        const checkElement = () => {
          const element = document.querySelector(action.selector!);
          if (element) {
            resolve(`Element found: ${action.selector}`);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for element: ${action.selector}`));
            return;
          }

          setTimeout(checkElement, 100);
        };

        checkElement();
      } else {
        // 简单延迟
        setTimeout(() => {
          resolve(`Waited for ${timeout}ms`);
        }, timeout);
      }
    });
  }

  private submitForm(action: AgentAction): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        let form: HTMLFormElement | null = null;

        if (action.selector) {
          const element = document.querySelector(action.selector);
          if (!element) {
            reject(new Error(`Element not found: ${action.selector}`));
            return;
          }

          if (element.tagName === 'FORM') {
            form = element as HTMLFormElement;
          } else {
            form = element.closest('form');
          }
        } else {
          // 如果没有指定选择器，尝试找到页面上的第一个表单
          form = document.querySelector('form');
        }

        if (!form) {
          reject(new Error('No form found'));
          return;
        }

        // 触发提交事件（注意：这不会真正提交表单，只是触发事件）
        // 如果需要真正提交，可以使用 form.submit()
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        const canceled = !form.dispatchEvent(submitEvent);

        if (!canceled) {
          // 如果事件没有被取消，执行真正的提交
          form.submit();
          resolve(`Submitted form: ${action.selector || 'default form'}`);
        } else {
          resolve(`Submit event triggered (but prevented by page): ${action.selector || 'default form'}`);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const pageAgent = new PageAgent();

