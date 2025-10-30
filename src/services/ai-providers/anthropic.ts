import type { AIProvider, AIMessage, AIProviderConfig } from '@/types';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<string> {
    // Separate system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemMessages.map(m => m.content).join('\n') || undefined,
        messages: conversationMessages.map(m => ({ 
          role: m.role === 'assistant' ? 'assistant' : 'user', 
          content: m.content 
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API request failed');
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
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const content = parsed.delta.text;
              fullContent += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullContent;
  }
}

