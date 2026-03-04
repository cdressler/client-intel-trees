# Implementation Plan: Client Intelligence Tree

## Overview

Incremental build of a full-stack Client Intelligence Tree application. We start with project scaffolding and shared types, build the database layer, then implement each backend service (Tree, Document, Research, TreeGenerator) with its API routes, followed by the React frontend. Each phase wires into the previous one so there's no orphaned code.

The architecture uses a provider-agnostic AI integration layer supporting both Claude (Anthropic) and ChatGPT (OpenAI). Users choose which provider to use per operation, and the system records which provider produced each result.

## Tasks

- [x] 1. Project scaffolding and shared types
  - [x] 1.1 Initialize project structure with backend and frontend directories
    - Create root `package.json` with workspaces for `server/` and `client/`
    - Initialize `server/` with TypeScript, Express, and dependencies (`pdf-parse`, `mammoth`, `xlsx`, `better-sqlite3`, `multer`, `uuid`, `@anthropic-ai/sdk`)
    - Initialize `client/` with Vite + React + TypeScript
    - Configure Vitest and fast-check in `server/`
    - _Requirements: 7.1_

  - [x] 1.2 Define shared TypeScript types and constants
    - Create `server/src/types.ts` with all TypeScript types from the design (`Tree`, `TreeSummary`, `Document`, `DocumentMetadata`, `ResearchFinding`, `ResearchResult`, `ConversationNode`, `RootNode`, `LeafNode`, `DecisionTree`, `SupportedFileType`, `DocumentCategory`, `ResearchStatus`, `TreeGenerationStatus`)
    - Create `server/src/errors.ts` with `AppError` class and error codes (`VALIDATION_ERROR`, `NOT_FOUND`, `PRECONDITION_FAILED`, `EXTRACTION_FAILED`, `CLAUDE_API_ERROR`, `CLAUDE_UNAVAILABLE`, `INTERNAL_ERROR`) with HTTP status mapping
    - _Requirements: 2.2, 2.6, 3.2, 4.1, 7.3_

- [x] 2. Database layer
  - [x] 2.1 Implement SQLite database initialization and schema
    - Create `server/src/db.ts` that initializes SQLite with the schema from the design (tables: `trees`, `documents`, `research_results`, `decision_trees`)
    - Support in-memory mode for testing
    - _Requirements: 1.2, 2.3, 3.1, 4.1_

- [x] 3. Tree Service and API routes
  - [x] 3.1 Implement TreeService
    - Create `server/src/services/treeService.ts` implementing `createTree`, `listTrees`, `getTree`
    - `createTree` validates non-empty, non-whitespace client name; generates UUID; inserts into `trees` table
    - `listTrees` returns `TreeSummary[]` with document count, research status, and tree generation status via JOINs
    - `getTree` returns full `Tree` or throws `NOT_FOUND`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 6.1_

  - [x] 3.2 Write property tests for TreeService
    - **Property 1: Tree creation round-trip** — generate random non-whitespace strings, create tree, get tree, verify clientName matches
    - **Validates: Requirements 1.2**
    - **Property 2: Empty client name rejection** — generate random whitespace-only strings, verify createTree rejects
    - **Validates: Requirements 1.5**
    - **Property 3: Dashboard lists all trees with required fields** — create random sets of trees, listTrees, verify all present with required fields
    - **Validates: Requirements 1.3, 6.1**

  - [x] 3.3 Implement tree API routes
    - Create `server/src/routes/trees.ts` with `GET /api/trees`, `POST /api/trees`, `GET /api/trees/:treeId`
    - Wire request validation and error handling middleware
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 4. Checkpoint — Core tree CRUD
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Document Processor and API routes
  - [x] 5.1 Implement text extraction utilities
    - Create `server/src/services/documentProcessor.ts` with `extractText(filePath, fileType)` supporting PDF (`pdf-parse`), DOCX (`mammoth`), PPTX (OOXML zip extraction), XLSX (`xlsx`/SheetJS), and plain text
    - Validate file type before processing; throw `VALIDATION_ERROR` for unsupported types with list of supported formats
    - Wrap extraction in try/catch; throw `EXTRACTION_FAILED` on failure with re-upload suggestion
    - _Requirements: 2.2, 2.3, 2.6, 2.7_

  - [x] 5.2 Implement document upload and listing
    - Add `uploadDocument(treeId, file, metadata)` and `listDocuments(treeId)` to DocumentProcessor
    - Store files on disk under `uploads/{treeId}/`; store metadata and extracted text in `documents` table
    - Accept `projectName` and `category` metadata; enforce category enum validation
    - After upload, if tree has a current decision tree, mark it as `outdated` by updating `trees.updated_at`
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 5.1_

  - [x] 5.3 Write property tests for Document Processor
    - **Property 4: Supported file types are accepted** — generate files of each supported type, upload, verify success
    - **Validates: Requirements 2.2**
    - **Property 5: Document upload preserves metadata and extracts text** — generate documents with random metadata, upload, retrieve, verify fields preserved and extractedText non-null
    - **Validates: Requirements 2.3, 2.5**
    - **Property 6: Document list completeness** — upload random document sets, listDocuments, verify all present with required fields
    - **Validates: Requirements 2.4**
    - **Property 7: Unsupported file type rejection** — generate random unsupported extensions, upload, verify rejection with supported formats in error message
    - **Validates: Requirements 2.6**

  - [x] 5.4 Implement document API routes
    - Create `server/src/routes/documents.ts` with `GET /api/trees/:treeId/documents` and `POST /api/trees/:treeId/documents` (multipart via multer)
    - Wire file size limit (10MB default) and file type validation
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

- [x] 6. Checkpoint — Document processing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Multi-provider AI integration layer
  - [x] 7.1 Update types and errors for multi-provider support
    - Add `AIProvider` type (`'claude' | 'chatgpt'`) to `server/src/types.ts`
    - Add `provider: AIProvider` field to `ResearchResult` and `DecisionTree` interfaces
    - Add `lastProvider: AIProvider | null` field to `Tree` and `TreeSummary` interfaces
    - Add `AIProviderClient` interface, `DocumentContent`, `DocumentInsight`, `DocumentInsights`, `ResearchFindings`, `RawLeafNode`, `RawRootNode`, `RawDecisionTree` types
    - Update `server/src/errors.ts`: replace `CLAUDE_API_ERROR`/`CLAUDE_UNAVAILABLE` with `AI_PROVIDER_ERROR`/`AI_PROVIDER_UNAVAILABLE`; add `AIProviderError` class with `provider`, `statusCode`, and `originalMessage` fields
    - _Requirements: 7.1, 7.5_

  - [x] 7.2 Update database schema for multi-provider support
    - Add `provider TEXT NOT NULL CHECK(provider IN ('claude', 'chatgpt'))` column to `research_results` table
    - Add `provider TEXT NOT NULL CHECK(provider IN ('claude', 'chatgpt'))` column to `decision_trees` table
    - Add `last_provider TEXT CHECK(last_provider IN ('claude', 'chatgpt'))` column to `trees` table
    - Update `server/src/db.ts` schema initialization with the new columns
    - _Requirements: 3.6, 4.7, 7.1_

  - [x] 7.3 Install OpenAI SDK dependency
    - Add `openai` package to `server/` workspace
    - _Requirements: 7.1_

  - [x] 7.4 Implement AIProviderClient interface with ClaudeProvider
    - Refactor existing `server/src/services/claudeClient.ts` into `server/src/services/aiProviderClient.ts` defining the `AIProviderClient` interface
    - Create `server/src/services/claudeProvider.ts` implementing `AIProviderClient` with `providerName = 'claude'`
    - Implement `analyzeDocuments`, `researchClient`, `generateDecisionTree` using Anthropic SDK (`claude-sonnet-4-20250514` model)
    - Implement retry logic: 3 attempts with exponential backoff (1s, 2s, 4s), respect `Retry-After` on 429, 120s timeout
    - Wrap errors in `AIProviderError` with `provider: 'claude'`
    - Use structured prompts requesting actionable conversation starters grounded in evidence
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [x] 7.5 Implement OpenAIProvider
    - Create `server/src/services/openaiProvider.ts` implementing `AIProviderClient` with `providerName = 'chatgpt'`
    - Implement `analyzeDocuments`, `researchClient`, `generateDecisionTree` using OpenAI SDK (`gpt-4o` model)
    - Implement retry logic: 3 attempts with exponential backoff (1s, 2s, 4s), respect `Retry-After` on 429, 120s timeout
    - Wrap errors in `AIProviderError` with `provider: 'chatgpt'`
    - Use structurally equivalent prompts to ClaudeProvider for consistent output quality
    - _Requirements: 7.1, 7.3, 7.5, 7.6, 7.7_

  - [x] 7.6 Implement getProviderClient factory
    - Create `server/src/services/providerFactory.ts` with `getProviderClient(provider: AIProvider): AIProviderClient`
    - Return `ClaudeProvider` for `'claude'`, `OpenAIProvider` for `'chatgpt'`
    - _Requirements: 7.1_

  - [x] 7.7 Write unit tests for ClaudeProvider
    - Test retry logic with mocked Anthropic SDK failures
    - Test timeout handling
    - Test rate limit respect (`Retry-After` header)
    - Test error wrapping in `AIProviderError` with `provider: 'claude'`
    - _Requirements: 7.3, 7.5_

  - [x] 7.8 Write unit tests for OpenAIProvider
    - Test retry logic with mocked OpenAI SDK failures
    - Test timeout handling
    - Test rate limit respect (`Retry-After` header)
    - Test error wrapping in `AIProviderError` with `provider: 'chatgpt'`
    - _Requirements: 7.3, 7.5_

  - [x] 7.9 Write property test for provider factory
    - **Property 15: Provider factory resolves valid implementations**
    - Generate random valid `AIProvider` values → `getProviderClient` → verify `providerName` matches
    - **Validates: Requirements 7.1**

  - [x] 7.10 Write property test for provider error identification
    - **Property 17: Provider errors identify the failing provider**
    - Generate random `AIProviderError` instances → verify `provider`, `statusCode`, and `originalMessage` are present
    - **Validates: Requirements 7.5**

  - [x] 7.11 Write property test for equivalent prompt structures
    - **Property 19: Equivalent prompt structures across providers**
    - Generate random document insights and research findings → construct prompts for both providers → verify structural equivalence
    - **Validates: Requirements 7.7**

  - [x] 7.12 Clean up old Claude-only files
    - Remove `server/src/services/claudeClient.ts` and `server/src/services/claudeClient.test.ts` after migration is complete
    - Verify no remaining imports reference the old files
    - _Requirements: 7.1_

- [x] 8. Checkpoint — Multi-provider AI layer
  - Ensure all tests pass, ask the user if questions arise.

- [-] 9. Research Engine and API routes
  - [x] 9.1 Implement ResearchEngine
    - Create `server/src/services/researchEngine.ts` implementing `runResearch(treeId, clientName, provider)` and `getResearch(treeId)`
    - `runResearch` resolves the `AIProviderClient` via `getProviderClient(provider)`, calls `researchClient`, stores findings JSON in `research_results` table with `provider` field (UPSERT to replace previous)
    - Update `trees.last_provider` to the selected provider after successful research
    - Detect insufficient results and return specific message suggesting client name verification
    - After research refresh, if tree has a current decision tree, mark it as `outdated`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 7.1_

  - [x] 9.2 Write property tests for Research Engine
    - **Property 8: Research results are categorized with sources** — generate research results, verify all four categories present and every finding has non-empty source
    - **Validates: Requirements 3.2, 3.4**
    - **Property 9: Research refresh replaces previous results** — create tree with research, refresh, verify new completedAt timestamp
    - **Validates: Requirements 3.5**
    - **Property 10: AI operations record the selected provider** — run research with random provider selection, verify stored result has matching `provider` field
    - **Validates: Requirements 3.6**

  - [x] 9.3 Implement research API routes
    - Create `server/src/routes/research.ts` with `GET /api/trees/:treeId/research` and `POST /api/trees/:treeId/research`
    - POST body accepts `{ provider }` parameter (`'claude'` or `'chatgpt'`), defaults to `'claude'` if omitted
    - Validate `provider` parameter; reject invalid values with `VALIDATION_ERROR`
    - Display loading state support via response structure including provider name
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 7.2_

- [-] 10. Tree Generator and API routes
  - [x] 10.1 Implement TreeGenerator
    - Create `server/src/services/treeGenerator.ts` implementing `generateTree(treeId, provider)`, `getCurrentTree(treeId)`, `getPreviousTree(treeId)`
    - `generateTree` validates preconditions: at least one document exists and research is complete; throws `PRECONDITION_FAILED` otherwise
    - Resolves `AIProviderClient` via `getProviderClient(provider)`, calls `generateDecisionTree` with all document insights and research findings
    - Validates AI response structure (root nodes with leaf nodes, non-empty fields)
    - On generation, marks previous decision tree as `is_current = 0`, inserts new tree as `is_current = 1` with `provider` field
    - Updates `trees.last_provider` to the selected provider after successful generation
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 5.2, 5.3, 7.1_

  - [x] 10.2 Write property tests for Tree Generator
    - **Property 11: Decision tree structural integrity** — generate decision trees, verify at least one root node, each root has at least one leaf, all nodes have non-empty title/content/rationale
    - **Validates: Requirements 4.2, 4.4**
    - **Property 12: Node rationale references sources** — verify every node has at least one sourceDocumentId or sourceResearchCategory
    - **Validates: Requirements 4.6**
    - **Property 13: Outdated indicator after changes** — generate tree, upload doc or refresh research, verify treeStatus becomes outdated
    - **Validates: Requirements 5.1**
    - **Property 14: Regeneration produces new tree and retains previous** — generate, regenerate, verify current/previous state
    - **Validates: Requirements 5.2, 5.3**
    - **Property 10: AI operations record the selected provider** — generate tree with random provider selection, verify stored result has matching `provider` field
    - **Validates: Requirements 4.7**
    - **Property 18: AI prompts include all source material** — verify prompt sent to AI provider references all documents and research
    - **Validates: Requirements 7.6**

  - [x] 10.3 Implement decision tree API routes
    - Create `server/src/routes/decisionTree.ts` with `GET /api/trees/:treeId/decision-tree`, `POST /api/trees/:treeId/decision-tree`, `GET /api/trees/:treeId/decision-tree/previous`
    - POST body accepts `{ provider }` parameter (`'claude'` or `'chatgpt'`), defaults to `'claude'` if omitted
    - Validate `provider` parameter; reject invalid values with `VALIDATION_ERROR`
    - _Requirements: 4.1, 4.4, 4.6, 4.7, 5.2, 5.3_

- [x] 11. Backend wiring and error handling middleware
  - [x] 11.1 Wire Express app with all routes and middleware
    - Create `server/src/app.ts` mounting all route modules under `/api`
    - Add global error handling middleware that maps `AppError` and `AIProviderError` to consistent JSON error responses with correct HTTP status codes; include `provider` field in response for AI-provider-related errors
    - Add request body parsing (JSON + multipart) and CORS configuration
    - Create `server/src/index.ts` entry point that starts the server
    - _Requirements: 7.3, 7.5_

- [x] 12. Checkpoint — Full backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend — Dashboard and navigation
  - [x] 13.1 Set up React app structure and API client
    - Configure React Router with routes for `/` (dashboard) and `/trees/:treeId` (workspace)
    - Create `client/src/api.ts` with typed fetch wrappers for all backend endpoints, including `provider` parameter in research and tree generation calls
    - Set up error handling: toast notifications for API errors; AI-provider errors (502/503) show failing provider name and offer "Retry" and "Switch to [other provider]" actions
    - _Requirements: 6.3, 7.2, 7.3, 7.5_

  - [x] 13.2 Implement Dashboard view
    - Create Dashboard component displaying tree list as cards (client name, document count, research status, tree status, creation date)
    - Add "Create New Tree" button with client name input and validation (empty name shows error)
    - Clicking a tree card navigates to `/trees/:treeId`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1_

- [x] 14. Frontend — Tree Workspace
  - [x] 14.1 Implement Tree Workspace with tab navigation
    - Create Workspace layout with tabs: Documents, Research, Conversation Tree
    - Preserve state across tab switches using client-side state
    - _Requirements: 6.2, 6.4_

  - [x] 14.2 Implement Documents section
    - File upload dropzone accepting PDF, DOCX, PPTX, XLSX, TXT
    - Form fields for project name and document category (brief, schedule, deliverable, other)
    - Table listing uploaded documents with file name, project name, category, upload date, file type
    - Show error for unsupported file types listing supported formats
    - Show error notification when extraction fails with re-upload suggestion
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_

  - [x] 14.3 Implement Provider Selector component
    - Create reusable `ProviderSelector` component as a dropdown/toggle between "Claude" and "ChatGPT"
    - Default to the tree's `lastProvider` value, or `'claude'` if null
    - Display inline before action buttons for research and tree generation operations
    - _Requirements: 7.1, 7.2, 7.8_

  - [x] 14.4 Write property test for provider selector defaults
    - **Property 16: Provider selector defaults to last used provider**
    - Generate trees with random `lastProvider` values (including null) → verify default is `lastProvider` or `'claude'` when null
    - **Validates: Requirements 7.2, 7.8**

  - [x] 14.5 Implement Research section
    - Provider Selector shown before triggering research, defaulting to most recently used provider for this tree (or Claude if none)
    - "Run Research" / "Refresh Research" button
    - Display research findings in categorized cards: Financial Performance, Recent News, New Offerings, Challenges
    - Show source attribution for each finding
    - Provider name badge displayed alongside research results (e.g., "Researched with Claude")
    - Loading indicator with operation description and provider name during research
    - Handle insufficient results message suggesting client name verification
    - On AI provider error, show failing provider name and offer "Retry" or "Switch to [other provider]"
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.2, 7.4, 7.5_

  - [x] 14.6 Implement Conversation Tree section
    - Provider Selector shown before triggering tree generation, defaulting to most recently used provider for this tree (or Claude if none)
    - Visual tree display with expandable root nodes showing leaf nodes
    - Clicking a node shows rationale panel referencing source Work Products and Research
    - "Generate Tree" / "Regenerate Tree" button
    - Provider name badge displayed alongside the decision tree (e.g., "Generated with ChatGPT")
    - Outdated indicator when documents or research changed since last generation
    - Link to view previous tree version
    - Precondition messages: require at least one document and completed research
    - Loading indicator with provider name during generation
    - On AI provider error, show failing provider name and offer "Retry" or "Switch to [other provider]"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 7.2, 7.4, 7.5_

- [x] 15. Frontend — Responsive layout and polish
  - [x] 15.1 Add responsive layout and accessibility
    - Ensure responsive design works on desktop and tablet viewports
    - Add proper ARIA labels, keyboard navigation, and focus management
    - Style consistent error states, loading states, and empty states across all sections
    - _Requirements: 6.3_

- [x] 16. Final checkpoint — Full application
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Both AI providers are mocked in all tests using stubs that return structured responses
- Database tests use in-memory SQLite for isolation
- Task 7 replaces the previously completed single-provider Claude client with a multi-provider architecture; existing `claudeClient.ts` and `claudeClient.test.ts` files should be refactored/removed as part of this task
