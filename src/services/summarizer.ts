import type { PageContent, PageSummary, AIMessage } from '@/types';
import { aiService } from './ai-service';
import { storage } from './storage';

class SummarizerService {
  async summarizePage(pageContent: PageContent): Promise<PageSummary> {
    // Check if we already have a recent summary for this URL
    const existingSummary = await storage.getPageSummary(pageContent.url);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    if (existingSummary && existingSummary.timestamp > oneHourAgo) {
      return existingSummary;
    }

    // Create prompt for summarization
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant that summarizes web pages concisely. 
Provide a clear summary in Chinese (简体中文) and extract 3-5 key points.
Format your response as JSON with this structure:
{
  "summary": "一段简短的总结（2-3句话）",
  "keyPoints": ["要点1", "要点2", "要点3"]
}`,
      },
      {
        role: 'user',
        content: `Please summarize this web page:\n\nTitle: ${pageContent.title}\n\nContent:\n${pageContent.content.substring(0, 8000)}`,
      },
    ];

    // Get AI response
    let fullResponse = '';
    await aiService.chat(messages, (chunk) => {
      fullResponse += chunk;
    });

    // Parse response
    try {
      // Try to extract JSON from the response
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const summary: PageSummary = {
          summary: parsed.summary || fullResponse,
          keyPoints: parsed.keyPoints || [],
          timestamp: Date.now(),
          url: pageContent.url,
        };

        // Save to storage
        await storage.addPageSummary(summary);
        
        return summary;
      }
    } catch (e) {
      // If parsing fails, use the full response as summary
    }

    // Fallback if JSON parsing fails
    const summary: PageSummary = {
      summary: fullResponse,
      keyPoints: [],
      timestamp: Date.now(),
      url: pageContent.url,
    };

    await storage.addPageSummary(summary);
    return summary;
  }

  async summarizeText(text: string, context?: string): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes text concisely in Chinese (简体中文).',
      },
      {
        role: 'user',
        content: context 
          ? `Context: ${context}\n\nPlease summarize the following text:\n\n${text}`
          : `Please summarize the following text:\n\n${text}`,
      },
    ];

    let summary = '';
    await aiService.chat(messages, (chunk) => {
      summary += chunk;
    });

    return summary;
  }

  async answerQuestion(question: string, pageContent: PageContent): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that answers questions about web page content in Chinese (简体中文).',
      },
      {
        role: 'user',
        content: `Based on this web page:\n\nTitle: ${pageContent.title}\nContent: ${pageContent.content.substring(0, 8000)}\n\nQuestion: ${question}`,
      },
    ];

    let answer = '';
    await aiService.chat(messages, (chunk) => {
      answer += chunk;
    });

    return answer;
  }
}

export const summarizerService = new SummarizerService();

