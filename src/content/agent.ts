import type { AgentAction } from '@/types';

export class PageAgent {
  async executeAction(action: AgentAction): Promise<string> {
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
        element.value = action.value;
        
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
          resolve(`Scrolled to element: ${action.selector}`);
        } else {
          resolve(`Element not found: ${action.selector}`);
        }
      } else if (action.y !== undefined) {
        window.scrollTo({ top: action.y, behavior: 'smooth' });
        resolve(`Scrolled to Y position: ${action.y}`);
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

  private generateSelector(element: Element, index: number, type: string): string {
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
}

export const pageAgent = new PageAgent();

