import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AppError, AIProviderError } from '../errors.js';
import type {
  AIProviderClient,
  DocumentContent,
  DocumentInsights,
  ResearchFindings,
  RawDecisionTree,
} from '../types.js';

function parseJsonResponse(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(stripped);
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MODEL = 'gemini-1.5-pro';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Rate limit (429) or server errors (5xx) or network errors
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnreset') || msg.includes('enotfound')) return true;
  }
  return false;
}

function getStatusCode(error: unknown): number {
  if (error instanceof Error) {
    const msg = error.message;
    const match = msg.match(/\b(4\d{2}|5\d{2})\b/);
    if (match) return parseInt(match[1], 10);
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('429')) return 429;
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) return 503;
  }
  return 500;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES - 1) break;

      if (isRetryableError(error)) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      // Non-retryable client error — break immediately
      break;
    }
  }

  const statusCode = getStatusCode(lastError);
  const message =
    lastError instanceof Error ? lastError.message : 'Unknown error communicating with Gemini API';
  throw new AIProviderError('gemini', statusCode, message);
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

export class GeminiProvider implements AIProviderClient {
  readonly providerName = 'gemini' as const;
  private client: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) throw new AppError('VALIDATION_ERROR', 'GEMINI_API_KEY is not configured');
    this.client = new GoogleGenerativeAI(key);
  }

  private getModel(systemInstruction: string): GenerativeModel {
    return this.client.getGenerativeModel({ model: MODEL, systemInstruction });
  }

  async analyzeDocuments(documents: DocumentContent[]): Promise<DocumentInsights> {
    const model = this.getModel(ANALYZE_SYSTEM_PROMPT);
    const documentList = documents
      .map((doc) => `--- Document: ${doc.fileName} (ID: ${doc.id}) ---\n${doc.extractedText}`)
      .join('\n\n');

    const result = await withRetry(() =>
      model.generateContent(
        `Analyze the following work product documents and extract actionable insights that could inform client conversations. Focus on themes, deliverables, challenges, and opportunities mentioned in each document.\n\n${documentList}`
      )
    );

    const text = result.response.text();
    if (!text) throw new AIProviderError('gemini', 500, 'Unexpected response format from Gemini');
    return parseJsonResponse(text) as DocumentInsights;
  }

  async researchClient(clientName: string, briefText?: string): Promise<ResearchFindings> {
    const model = this.getModel(RESEARCH_SYSTEM_PROMPT);
    const userPrompt = briefText
      ? `Research the company "${clientName}" using the following brief as your research criteria:\n\n${briefText}`
      : `Research the company "${clientName}" and provide current business intelligence. Focus on recent earnings and financial performance, news and press releases, new products or service offerings, and current business challenges. Ground every finding in specific evidence and include source attribution. These findings will be used to prepare actionable conversation starters for client meetings.`;

    const result = await withRetry(() => model.generateContent(userPrompt));

    const text = result.response.text();
    if (!text) throw new AIProviderError('gemini', 500, 'Unexpected response format from Gemini');
    return parseJsonResponse(text) as ResearchFindings;
  }

  async generateDecisionTree(
    insights: DocumentInsights,
    research: ResearchFindings
  ): Promise<RawDecisionTree> {
    const model = this.getModel(TREE_SYSTEM_PROMPT);

    const result = await withRetry(() =>
      model.generateContent(
        `Generate a conversation decision tree for ${research.clientName} based on the following inputs.

DOCUMENT INSIGHTS:
${JSON.stringify(insights.insights, null, 2)}

CLIENT RESEARCH:
${JSON.stringify(research.findings, null, 2)}

Create root nodes that represent major conversation themes at the intersection of past work and current client intelligence. Under each root node, create leaf nodes with specific, actionable conversation starters — talking points or questions grounded in evidence from the documents and research. Every node must reference its source documents and/or research categories.`
      )
    );

    const text = result.response.text();
    if (!text) throw new AIProviderError('gemini', 500, 'Unexpected response format from Gemini');
    return parseJsonResponse(text) as RawDecisionTree;
  }
}
