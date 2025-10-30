import type { AIProvider, AIMessage, AIProviderConfig } from '@/types';

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    const model = this.config.model || 'gemini-pro';
    const apiKey = this.config.apiKey;

    // Convert messages to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Add system message as first user message if exists
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      contents.unshift({
        role: 'user',
        parts: [{ text: `System instructions: ${systemMessage.content}` }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      
      // Gemini returns JSON array of responses
      try {
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          const parsed = JSON.parse(line);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        }
      } catch (e) {
        // Continue on parse errors
      }
    }

    return fullContent;
  }
}

