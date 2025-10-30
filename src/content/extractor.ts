import type { PageContent } from '@/types';

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
}

export const contentExtractor = new ContentExtractor();

