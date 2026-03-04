import type { AIProvider, AIProviderClient } from '../types.js';
import { ClaudeProvider } from './claudeProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { GeminiProvider } from './geminiProvider.js';

export function getProviderClient(provider: AIProvider): AIProviderClient {
  switch (provider) {
    case 'claude':
      return new ClaudeProvider();
    case 'chatgpt':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
  }
}
