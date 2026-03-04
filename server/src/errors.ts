import type { AIProvider } from './types.js';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PRECONDITION_FAILED'
  | 'EXTRACTION_FAILED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  PRECONDITION_FAILED: 412,
  EXTRACTION_FAILED: 422,
  AI_PROVIDER_ERROR: 502,
  AI_PROVIDER_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = HTTP_STATUS_MAP[code];
  }
}

export class AIProviderError extends Error {
  public readonly provider: AIProvider;
  public readonly statusCode: number;
  public readonly originalMessage: string;

  constructor(provider: AIProvider, statusCode: number, originalMessage: string) {
    super(`${provider} API error (${statusCode}): ${originalMessage}`);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalMessage = originalMessage;
  }
}
