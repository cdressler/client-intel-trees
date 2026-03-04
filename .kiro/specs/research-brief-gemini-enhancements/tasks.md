# Implementation Plan: Research Brief, Gemini Provider, Case Study Category, Tree Types, Brief Library, Navigation & Multi-Provider Research

## Overview

Additive enhancements following existing codebase patterns. Tasks are ordered to build shared foundations first (types, database, server-side services), then routes, then client-side UI.

## Tasks

- [x] 1. Update shared type definitions
  - Add `'gemini'` to `AIProvider` union in `server/src/types.ts` and `client/src/types.ts`
  - Add `'case_study'` to `DocumentCategory` union in both files
  - Add `TreeType = 'client' | 'subject'` union type in both files
  - Add `treeType: TreeType` field to the `Tree` interface in both files
  - Add `Brief` and `BriefDetail` interfaces in both files
  - Add optional `briefText?: string` parameter to `researchClient` in the `AIProviderClient` interface
  - Add `ProviderResearchResult` and `MultiProviderResearchResponse` interfaces in both files
  - Add `ResearchRequestBody` interface with `providers: AIProvider[]` and optional `briefId` in both files
  - _Requirements: 3.6, 5.3, 6.4, 7.1, 11.5, 11.7_

- [x] 2. Apply database migrations
  - Add `tree_type TEXT NOT NULL DEFAULT 'client'` column to the `trees` table
  - Create `briefs` table: `id`, `name`, `file_type`, `text`, `created_at`
  - Create `settings` table: `key`, `value`; insert default row `('default_provider', 'claude')`
  - _Requirements: 6.2, 7.1, 10.5_

- [x] 3. Implement GeminiProvider
  - [x] 3.1 Create `server/src/services/geminiProvider.ts`
    - Install `@google/generative-ai` as a dependency
    - Implement `GeminiProvider` class implementing `AIProviderClient`
    - Read `GEMINI_API_KEY` from env on construction; throw `AppError('VALIDATION_ERROR', ...)` if absent
    - Implement `analyzeDocuments`, `researchClient`, and `generateDecisionTree` using `model.generateContent`
    - Use `systemInstruction` field for system prompts; reuse existing prompt constants
    - Apply the same `withRetry` pattern, mapping Google SDK errors to `AIProviderError('gemini', ...)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 3.2 Write unit tests for GeminiProvider
    - Test constructor throws when `GEMINI_API_KEY` is absent
    - Test SDK errors are wrapped as `AIProviderError` with `provider === 'gemini'`
    - _Requirements: 3.4, 3.7_

  - [x] 3.3 Write property test for GeminiProvider error wrapping
    - **Property 10: Gemini API errors are wrapped as AIProviderError with provider 'gemini'**
    - **Validates: Requirements 3.7**

- [x] 4. Register GeminiProvider in ProviderFactory
  - Add `case 'gemini': return new GeminiProvider();` to `server/src/services/providerFactory.ts`
  - _Requirements: 3.5_

  - [x] 4.1 Write unit test for ProviderFactory
    - Test `getProviderClient('gemini')` returns a `GeminiProvider` instance
    - _Requirements: 3.5_

- [x] 5. Add extractTextFromBuffer to DocumentProcessor
  - Add `extractTextFromBuffer(buffer: Buffer, fileType: SupportedFileType): Promise<string>` to `server/src/services/documentProcessor.ts`
  - Reuse existing PDF/DOCX/TXT parsing logic via buffer-based paths
  - Add `'case_study'` to `VALID_CATEGORIES`
  - _Requirements: 2.5, 5.2_

  - [x] 5.1 Write unit tests for extractTextFromBuffer
    - Test returns non-empty string for minimal valid PDF, DOCX, and TXT buffers
    - Test `uploadDocument` accepts `'case_study'` as a valid category
    - _Requirements: 2.5, 5.2_

  - [x] 5.2 Write property test for extractTextFromBuffer
    - **Property 9: extractTextFromBuffer succeeds for all supported brief formats**
    - **Validates: Requirements 2.5**

- [x] 6. Implement BriefService
  - Create `server/src/services/briefService.ts`
  - Implement `listBriefs`, `getBrief`, `createBrief`, `updateBrief`, `deleteBrief`
  - `getBrief` throws `AppError('NOT_FOUND', ...)` when the ID does not exist
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [x] 6.1 Write unit tests for BriefService
    - Test `createBrief` inserts and returns a Brief with a generated ID
    - Test `getBrief` returns stored text
    - Test `updateBrief` replaces text while keeping the same ID
    - Test `deleteBrief` removes the row
    - Test `getBrief` throws NOT_FOUND for unknown ID
    - _Requirements: 7.2, 7.3, 7.4, 7.10_

  - [x] 6.2 Write property tests for BriefService round-trip
    - **Property 17: Brief create/read round-trip preserves text content**
    - **Property 18: Brief update replaces content while preserving identity**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 7. Implement SettingsService
  - Create `server/src/services/settingsService.ts`
  - Implement `getSetting(key)` and `setSetting(key, value)`
  - _Requirements: 10.2, 10.5_

  - [x] 7.1 Write unit tests for SettingsService
    - Test `setSetting` / `getSetting` round-trip
    - _Requirements: 10.2_

  - [x] 7.2 Write property test for settings round-trip
    - **Property 19: Default provider setting round-trip**
    - **Validates: Requirements 10.2**

- [x] 8. Update TreeService to support tree types
  - Add `treeType: TreeType` parameter to `createTree` in `server/src/services/treeService.ts`
  - Write `tree_type` on insert; include it in all tree query results
  - Validate `treeType` is `'client'` or `'subject'`; throw `AppError('VALIDATION_ERROR', ...)` otherwise
  - _Requirements: 6.1, 6.2, 6.7_

  - [x] 8.1 Write unit tests for TreeService tree type
    - Test `createTree` stores and returns the specified `treeType`
    - Test invalid `treeType` throws VALIDATION_ERROR
    - _Requirements: 6.2_

  - [x] 8.2 Write property test for tree type storage
    - **Property 15: Tree creation always stores the specified tree type**
    - **Validates: Requirements 6.2**

- [x] 9. Update ResearchEngine to accept and forward briefText, and add multi-provider fan-out
  - Add optional `briefText?: string` parameter to `runResearch` in `server/src/services/researchEngine.ts`
  - Forward `briefText` to `client.researchClient(name, briefText)`
  - Add `runMultiProviderResearch(treeId, name, providers, briefText?)` that calls `runResearch` for each provider via `Promise.allSettled` and returns a `MultiProviderResearchResponse`
  - _Requirements: 2.3, 11.6, 11.7, 11.8_

  - [x] 9.1 Write unit tests for ResearchEngine briefText forwarding
    - Test `runResearch` with `briefText` calls `researchClient` with that text
    - Test `runResearch` without `briefText` calls `researchClient` with `undefined`
    - _Requirements: 2.2, 2.3_

  - [x] 9.2 Write property tests for ResearchEngine brief forwarding
    - **Property 6: Brief text is extracted and forwarded to the AI provider**
    - **Property 7: Research without brief uses standard criteria (no briefText)**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 9.3 Write unit tests for runMultiProviderResearch
    - Test with two providers returns results for both
    - Test when one provider throws still returns results for the other with an error entry
    - _Requirements: 11.6, 11.7, 11.8_

  - [x] 9.4 Write property tests for multi-provider fan-out
    - **Property 23: Multi-provider response contains one result per requested provider**
    - **Property 24: A single failing provider does not suppress other providers' results**
    - **Validates: Requirements 11.6, 11.7, 11.8**

- [x] 10. Add Brief routes
  - Create `server/src/routes/briefs.ts` with GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id`
  - POST and PUT accept `multipart/form-data` (memory-storage multer); validate extension against `['pdf', 'docx', 'txt']`
  - Extract text via `DocumentProcessor.extractTextFromBuffer`; return HTTP 422 on extraction failure
  - Mount router at `/api/briefs` in `server/src/app.ts`
  - _Requirements: 7.5, 7.6, 7.7, 7.8, 7.9, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.1 Write unit tests for brief routes
    - Test POST `/api/briefs` with valid TXT file returns 201 with Brief
    - Test POST `/api/briefs` with unsupported extension returns 400
    - Test DELETE `/api/briefs/:id` with unknown ID returns 404
    - _Requirements: 7.7, 7.9, 8.5_

- [x] 11. Add Settings routes
  - Create `server/src/routes/settings.ts` with GET `/default-provider` and PUT `/default-provider`
  - Validate provider value against `VALID_PROVIDERS`; return HTTP 400 on invalid value
  - Mount router at `/api/settings` in `server/src/app.ts`
  - _Requirements: 10.1, 10.2_

  - [x] 11.1 Write unit tests for settings routes
    - Test GET returns the stored default provider
    - Test PUT with invalid provider returns 400
    - _Requirements: 10.1, 10.2_

- [x] 12. Update research route to handle brief selection, upload, and multi-provider requests
  - Update `POST /api/trees/:treeId/research` in `server/src/routes/research.ts`
  - Accept `multipart/form-data` (with `providers` JSON array, optional `briefFile` + `briefName`) or `application/json` (with `providers` array, optional `briefId`)
  - Validate `providers` is a non-empty array of valid `AIProvider` values; return HTTP 400 otherwise
  - When `briefFile` present: extract text, save to Brief_Library via `BriefService.createBrief`, use text
  - When `briefId` present: fetch text via `BriefService.getBrief(briefId)`
  - Pass `providers` and `briefText` to `ResearchEngine.runMultiProviderResearch`; return `MultiProviderResearchResponse` as HTTP 200
  - Update `VALID_PROVIDERS` to include `'gemini'`
  - _Requirements: 1.6, 1.9, 2.1, 2.4, 2.5, 3.5, 11.5, 11.6, 11.7_

  - [x] 12.1 Write unit tests for research route brief handling and multi-provider validation
    - Test route rejects brief file with unsupported extension with HTTP 400
    - Test route returns 422 when text extraction fails
    - Test route returns 404 when `briefId` does not exist
    - Test route returns 400 when `providers` is empty or missing
    - Test route returns 400 when `providers` contains an invalid provider value
    - _Requirements: 2.4, 2.5, 7.10, 11.4_

- [x] 13. Update tree creation route to require tree type
  - Update the create-tree route in `server/src/routes/` to accept and validate `treeType`
  - Pass `treeType` to `TreeService.createTree`
  - _Requirements: 6.1, 6.2_

- [x] 14. Checkpoint — Ensure all server-side tests pass
  - Ensure all tests pass; ask the user if questions arise.

- [x] 15. Update client API (`client/src/api.ts`)
  - Update `runResearch` to accept `providers: AIProvider[]` (array), optional `briefFile?: File`, and `briefId?: string`; return `MultiProviderResearchResponse`
  - Update `createTree` to accept `treeType: TreeType`
  - Add `listBriefs`, `createBrief`, `updateBrief`, `deleteBrief`
  - Add `getDefaultProvider`, `setDefaultProvider`
  - _Requirements: 1.6, 6.1, 7.5–7.9, 10.1, 10.2, 11.5_

  - [x] 15.1 Write property test for client API brief sending
    - **Property 5: Research request with brief transmits the brief reference**
    - **Validates: Requirements 1.6**

- [x] 16. Update ResearchSection with brief library UI and multi-provider selection
  - Replace `useBrief` boolean with `briefMode: 'none' | 'library' | 'upload'` state
  - Add `selectedBriefId`, `briefFile`, `briefFileError`, `libraryBriefs` state
  - Replace single-provider `Provider_Selector` with `Multi_Provider_Selector` (checkboxes); add `selectedProviders: AIProvider[]` and `providerSelectionError` state
  - On mount, load Default_Provider from `getDefaultProvider()` and initialise `selectedProviders` to `[defaultProvider]`
  - Validate `selectedProviders.length > 0` before submitting; set `providerSelectionError` if empty
  - Render three brief options: standard criteria, select from library, upload new brief
  - When `briefMode === 'library'`: fetch and display brief list for selection
  - When `briefMode === 'upload'`: show file input (`.pdf,.docx,.txt`), validate extension, display file name
  - When `briefMode === 'none'`: clear all brief state
  - When uploading a new brief during research, save to library first then use returned ID
  - Call `runResearch(treeId, selectedProviders, briefFile?, briefId?)` and pass `MultiProviderResearchResponse` to `Research_Results_Display`
  - Update `providerDisplayName` map to include `'gemini'` → `'Gemini'`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 4.3, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 16.1 Write property tests for ResearchSection brief UI
    - **Property 1: Brief file type validation rejects non-PDF/DOCX/TXT files**
    - **Property 2: Valid brief file name is displayed**
    - **Property 3: Brief upload control visibility matches briefMode state**
    - **Property 4: Switching to standard criteria clears the brief selection**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.7**

  - [x] 16.2 Write property test for provider status labels
    - **Property 11: Status labels display the correct provider name**
    - **Validates: Requirements 4.3**

  - [x] 16.3 Write property test for default provider pre-selection
    - **Property 21: Multi_Provider_Selector pre-checks the default provider on mount**
    - **Validates: Requirements 11.2**

  - [x] 16.4 Write property test for empty provider selection validation
    - **Property 22: Submitting with no providers selected shows a validation error**
    - **Validates: Requirements 11.4**

- [x] 17. Implement MultiProviderSelector
  - Create `client/src/components/MultiProviderSelector.tsx`
  - Render a checkbox for each available provider (Claude, ChatGPT, Gemini)
  - Accept `selectedProviders: AIProvider[]` and `onChange: (providers: AIProvider[]) => void` props
  - Use in ResearchSection in place of the existing single-select ProviderSelector
  - _Requirements: 11.1, 11.2, 11.3_

  - [x] 17.1 Write unit tests for MultiProviderSelector
    - Test all three provider checkboxes are rendered
    - Test checking/unchecking a provider calls `onChange` with the updated array
    - _Requirements: 11.1, 11.3_

- [x] 18. Add Gemini option to ProviderSelector (retained for Settings)
  - Add `<option value="gemini">Gemini</option>` to `client/src/components/ProviderSelector.tsx`
  - This component is now used only in SettingsPage for the default provider setting
  - _Requirements: 4.1, 4.2_

  - [x] 18.1 Write unit test for ProviderSelector
    - Test component renders a "Gemini" option
    - _Requirements: 4.1_

- [x] 19. Add Case Study category to DocumentsSection
  - Add `<option value="case_study">Case Study</option>` to the category dropdown in `client/src/components/DocumentsSection.tsx`
  - Add `case_study` to the category label map so it renders as `"Case Study"`
  - _Requirements: 5.1, 5.4_

  - [x] 19.1 Write unit tests for DocumentsSection case study category
    - Test "Case Study" option appears in the category dropdown
    - Test document with `category === 'case_study'` renders label `"Case Study"`
    - _Requirements: 5.1, 5.4_

  - [x] 19.2 Write property tests for case study category rendering
    - **Property 13: Documents uploaded with category 'case_study' are stored with that category**
    - **Property 14: Documents with category 'case_study' render the label "Case Study"**
    - **Validates: Requirements 5.2, 5.4**

- [x] 20. Update tree creation UI and Tree_Cards for tree type
  - Add a tree type selector (radio: "Client" / "Subject") to the tree creation flow in `Dashboard.tsx` or `Workspace.tsx`
  - Pass `treeType` to `createTree` API call
  - Update Tree_Card to display a badge (`CLIENT` or `SUBJECT`) based on `treeType`
  - _Requirements: 6.1, 6.3, 6.5, 6.6_

  - [x] 20.1 Write unit tests for tree type UI
    - Test tree creation form includes a tree type selector
    - Test Tree_Card renders the correct badge for each tree type
    - _Requirements: 6.1, 6.3_

  - [x] 20.2 Write property test for Tree_Card badge
    - **Property 16: Tree_Card badge matches the stored tree type**
    - **Validates: Requirements 6.3**

- [x] 21. Implement ResearchResultsDisplay
  - Create `client/src/components/ResearchResultsDisplay.tsx`
  - Accept a `MultiProviderResearchResponse` prop
  - When `results` contains exactly one provider: render that provider's findings directly without tabs
  - When `results` contains multiple providers: render a tab strip or accordion with one tab per provider, labeled by provider name; show findings or inline error per tab
  - _Requirements: 11.9, 11.11_

  - [x] 21.1 Write unit tests for ResearchResultsDisplay
    - Test single-provider response renders without tabs
    - Test multi-provider response renders one labeled section per provider
    - Test a provider error entry renders an error message within that provider's section
    - _Requirements: 11.9, 11.11_

  - [x] 21.2 Write property tests for ResearchResultsDisplay
    - **Property 25: Research_Results_Display renders one section per provider**
    - **Property 26: Single-provider response renders without tabs**
    - **Validates: Requirements 11.9, 11.11**

- [x] 22. Update ConversationTreeSection for multi-provider trees
  - Update `client/src/components/ConversationTreeSection.tsx` to accept either a single tree or a map of per-provider trees
  - When multiple provider trees are present: render a tab strip labeled by provider name for comparison
  - When only one provider tree is present: render as before without tabs
  - _Requirements: 11.10, 11.11_

  - [x] 22.1 Write unit tests for ConversationTreeSection multi-provider view
    - Test single tree renders without tabs
    - Test multiple provider trees render a tab per provider
    - _Requirements: 11.10, 11.11_

- [x] 23. Implement BriefManagementConsole
  - Create `client/src/components/BriefManagementConsole.tsx`
  - On mount, fetch and display all briefs (name, created date) via `listBriefs()`
  - Provide upload button to create a new brief (calls `createBrief`)
  - Provide replace button per row to update a brief (calls `updateBrief`)
  - Provide delete button per row (calls `deleteBrief`, refreshes list)
  - Display descriptive error messages on failure
  - Accept PDF, DOCX, TXT for uploads
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 23.1 Write unit tests for BriefManagementConsole
    - Test brief list is displayed on mount
    - Test create, update, delete actions call the correct API functions
    - Test error message is shown on upload failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 24. Implement SettingsPage
  - Create `client/src/components/SettingsPage.tsx`
  - On mount, fetch current default provider via `getDefaultProvider()`
  - Render a provider selector (Claude, ChatGPT, Gemini)
  - On change, call `setDefaultProvider(provider)`
  - _Requirements: 10.1, 10.2_

  - [x] 24.1 Write unit tests for SettingsPage
    - Test current default provider is pre-selected on mount
    - Test changing selection calls `setDefaultProvider`
    - _Requirements: 10.1, 10.2_

- [x] 25. Implement NavigationMenu and wire sections
  - Create `client/src/components/NavigationMenu.tsx` with "Trees", "Research Briefs", "Settings" items
  - Maintain `activeSection` state; render `Workspace`, `BriefManagementConsole`, or `SettingsPage` accordingly
  - Highlight the active nav item
  - Default to "Trees" on first load
  - Integrate `NavigationMenu` at the application root in `App.tsx` or `Workspace.tsx`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 25.1 Write unit tests for NavigationMenu
    - Test all three nav items are rendered
    - Test clicking each item renders the correct section
    - Test active item is visually indicated
    - Test default section is "Trees"
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 26. Verify Gemini provider error UI consistency
  - Confirm the existing `AIProviderError` toast handler already handles `provider === 'gemini'`
  - If not, update the error display logic to treat `'gemini'` identically to `'claude'` and `'chatgpt'`
  - _Requirements: 4.4_

  - [x] 26.1 Write property test for Gemini provider error UI
    - **Property 12: Provider errors for Gemini trigger the same error UI as other providers**
    - **Validates: Requirements 4.4**

- [x] 27. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- When a new brief is uploaded during research it is saved to the library (Req 1.9) — the brief is no longer transient
- `fast-check` should be added as a dev dependency if not already present for property-based tests
- Property tests run a minimum of 100 iterations each
- Database migrations (task 2) must run before any service or route tasks that depend on the new schema
- Multi-provider fan-out uses `Promise.allSettled` so a single provider failure never blocks the others (Req 11.8)
- The existing single-provider `ProviderSelector` is retained for the SettingsPage default-provider setting; the new `MultiProviderSelector` is used in ResearchSection
