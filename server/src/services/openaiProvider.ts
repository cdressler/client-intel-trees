import OpenAI from 'openai';
import { AIProviderError } from '../errors.js';
import type {
  AIProviderClient,
  DocumentContent,
  DocumentInsights,
  ResearchFindings,
  RawDecisionTree,
} from '../types.js';

function parseJsonResponse(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(stripped);
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 120_000;
const MODEL = 'gpt-4o';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES - 1) break;

      if (error instanceof OpenAI.RateLimitError) {
        const retryAfter = error.headers?.get?.('retry-after') ?? (error.headers as Record<string, string> | undefined)?.['retry-after'];
        const delayMs = retryAfter
          ? parseInt(String(retryAfter), 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }

      if (error instanceof OpenAI.APIConnectionError) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      if (error instanceof OpenAI.APIError && error.status !== undefined && error.status >= 500) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      if (error instanceof OpenAI.APIError && error.status !== undefined && error.status < 500) {
        break;
      }

      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  if (lastError instanceof OpenAI.APIConnectionError) {
    throw new AIProviderError('chatgpt', 503, lastError.message);
  }
  if (lastError instanceof OpenAI.APIError) {
    throw new AIProviderError('chatgpt', lastError.status ?? 500, lastError.message);
  }
  if (lastError instanceof Error) {
    throw new AIProviderError('chatgpt', 500, lastError.message);
  }
  throw new AIProviderError('chatgpt', 500, 'Unknown error communicating with OpenAI API');
}

export const ANALYZE_SYSTEM_PROMPT = `You are an expert business analyst. Analyze the provided work product documents and extract key themes and insights. Return your analysis as valid JSON matching this schema:
{
  "insights": [
    {
      "documentId": "string (the document ID provided)",
      "fileName": "string",
      "keyThemes": ["string"],
      "summary": "string (concise summary of the document's key points)"
    }
  ]
}
Return ONLY the JSON object, no additional text.`;

export const RESEARCH_SYSTEM_PROMPT = `You are a business intelligence researcher. Research the given company and provide findings organized into four categories: financial_performance, recent_news, new_offerings, and challenges. Each finding must include a source attribution. Return your analysis as valid JSON matching this schema:
{
  "clientName": "string",
  "findings": [
    {
      "category": "financial_performance | recent_news | new_offerings | challenges",
      "title": "string (brief title)",
      "summary": "string (actionable summary grounded in evidence)",
      "source": "string (source attribution)"
    }
  ]
}
Return ONLY the JSON object, no additional text.`;

export const TREE_SYSTEM_PROMPT = `You are a strategic conversation planner for agency teams. Generate a two-level conversation decision tree that combines institutional knowledge from past work products with current client intelligence. Each conversation starter must be actionable and grounded in specific evidence from the provided documents and research.

Return your output as valid JSON matching this schema:
{
  "rootNodes": [
    {
      "id": "string (unique identifier)",
      "title": "string (conversation theme)",
      "content": "string (theme description and context)",
      "rationale": "string (why this theme is relevant, citing specific evidence)",
      "sourceDocumentIds": ["string (IDs of documents that informed this node)"],
      "sourceResearchCategories": ["string (research categories that informed this node)"],
      "leafNodes": [
        {
          "id": "string (unique identifier)",
          "title": "string (specific talking point)",
          "content": "string (conversation starter or question)",
          "rationale": "string (evidence-based justification)",
          "sourceDocumentIds": ["string"],
          "sourceResearchCategories": ["string"]
        }
      ]
    }
  ]
}
Return ONLY the JSON object, no additional text.`;

export class OpenAIProvider implements AIProviderClient {
  readonly providerName = 'chatgpt' as const;
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY ?? '',
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });
  }

  async analyzeDocuments(documents: DocumentContent[]): Promise<DocumentInsights> {
    const documentList = documents
      .map((doc) => `--- Document: ${doc.fileName} (ID: ${doc.id}) ---\n${doc.extractedText}`)
      .join('\n\n');

    const response = await withRetry(() =>
      this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze the following work product documents and extract actionable insights that could inform client conversations. Focus on themes, deliverables, challenges, and opportunities mentioned in each document.\n\n${documentList}`,
          },
        ],
      })
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new AIProviderError('chatgpt', 500, 'Unexpected response format from OpenAI');
    return parseJsonResponse(text) as DocumentInsights;
  }

  async researchClient(clientName: string): Promise<ResearchFindings> {
    const response = await withRetry(() =>
      this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Research the company "${clientName}" and provide current business intelligence. Focus on recent earnings and financial performance, news and press releases, new products or service offerings, and current business challenges. Ground every finding in specific evidence and include source attribution. These findings will be used to prepare actionable conversation starters for client meetings.`,
          },
        ],
      })
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new AIProviderError('chatgpt', 500, 'Unexpected response format from OpenAI');
    return parseJsonResponse(text) as ResearchFindings;
  }

  async generateDecisionTree(
    insights: DocumentInsights,
    research: ResearchFindings
  ): Promise<RawDecisionTree> {
    const response = await withRetry(() =>
      this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: TREE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Generate a conversation decision tree for ${research.clientName} based on the following inputs.

DOCUMENT INSIGHTS:
${JSON.stringify(insights.insights, null, 2)}

CLIENT RESEARCH:
${JSON.stringify(research.findings, null, 2)}

Create root nodes that represent major conversation themes at the intersection of past work and current client intelligence. Under each root node, create leaf nodes with specific, actionable conversation starters — talking points or questions grounded in evidence from the documents and research. Every node must reference its source documents and/or research categories.`,
          },
        ],
      })
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new AIProviderError('chatgpt', 500, 'Unexpected response format from OpenAI');
    return parseJsonResponse(text) as RawDecisionTree;
  }
}
