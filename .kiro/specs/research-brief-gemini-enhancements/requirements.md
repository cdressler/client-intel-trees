# Requirements Document

## Introduction

This document covers enhancements to the client intelligence application:

1. **Research Brief Upload** — Users can optionally upload a research brief document to supply custom context/instructions to AI services when running research, instead of relying solely on the default research criteria.
2. **Gemini AI Provider** — Google Gemini is added as a third AI provider option alongside the existing Claude and ChatGPT providers.
3. **Case Study Document Category** — "Case Study" is added as a selectable document category when uploading documents.
4. **Client vs Subject Tree Types** — Trees are classified as either "client" trees (about individual clients) or "subject" trees (about topics/categories), with visual indicators in the workspace.
5. **Research Brief Library** — Research briefs are persisted in the database and managed through a dedicated library, allowing reuse across research sessions.
6. **Main Navigation** — A top-level navigation menu provides access to the Trees workspace, Research Briefs library, and Settings.
7. **Default AI Engine Setting** — Users can configure a default AI provider that is pre-selected when running research.

## Glossary

- **Application**: The client intelligence web application consisting of a React/TypeScript client and Node.js/TypeScript server.
- **Research_Engine**: The server-side service responsible for orchestrating AI-powered client research.
- **Provider_Factory**: The server-side factory that instantiates the correct AI provider client based on the selected provider.
- **AI_Provider**: An external AI service (Claude, ChatGPT, or Gemini) used to perform research and generate decision trees.
- **Gemini_Provider**: The Google Gemini AI provider client implementation.
- **Research_Brief**: A document containing custom context or instructions to guide AI research. Briefs are persisted in the Brief_Library and can be selected or uploaded during research.
- **Brief_Library**: The server-side persistent store of Research_Brief records, backed by the SQLite database.
- **Research_Section**: The client-side UI component where users configure and run research.
- **Documents_Section**: The client-side UI component where users upload and manage documents.
- **Provider_Selector**: The client-side UI component that allows users to select an AI provider.
- **Document_Category**: A classification label applied to an uploaded document (e.g., brief, schedule, deliverable, case study, other).
- **Standard_Research_Criteria**: The default set of research instructions built into the Application that are used when no Research_Brief is provided.
- **Tree_Type**: A classification applied to a tree at creation time, either `'client'` (about an individual client) or `'subject'` (about a topic or category).
- **Tree_Card**: The card UI element displayed in the workspace representing a single tree.
- **Navigation_Menu**: The top-level navigation component providing access to the Trees, Research Briefs, and Settings sections of the Application.
- **Brief_Management_Console**: The UI section where users can view, create, update, and delete briefs in the Brief_Library.
- **Settings_Page**: The UI section where users configure application-level preferences such as the default AI provider.
- **Default_Provider**: The AI_Provider pre-selected in the Provider_Selector when the user opens the Research_Section, as configured in the Settings_Page.
- **Multi_Provider_Selector**: The client-side UI component that allows users to select one or more AI providers via checkboxes for a single research run.
- **Provider_Research_Result**: A single AI provider's research output within a multi-provider research response, labeled by provider name.
- **Multi_Provider_Research_Response**: The server response to a multi-provider research request, containing a map of provider names to their respective Provider_Research_Results.
- **Research_Results_Display**: The client-side UI area that renders research results, showing each provider's output in a separate labeled section or tab.

---

## Requirements

### Requirement 1: Research Brief Upload — UI

**User Story:** As a user, I want to optionally supply a research brief when running research, so that I can provide custom context to the AI service instead of using the default research criteria.

#### Acceptance Criteria

1. THE Research_Section SHALL display three options for brief selection: use Standard_Research_Criteria (no brief), select an existing brief from the Brief_Library, or upload a new brief file.
2. WHEN the user selects the "upload new brief" option, THE Research_Section SHALL display a file upload control that accepts PDF, DOCX, and TXT file formats.
3. WHEN the user selects the Standard_Research_Criteria option, THE Research_Section SHALL hide the file upload control and use no Research_Brief when research is run.
4. WHEN the user selects a file that is not PDF, DOCX, or TXT, THE Research_Section SHALL display an error message indicating the accepted file formats.
5. WHEN the user has selected a valid Research_Brief file, THE Research_Section SHALL display the selected file name.
6. WHEN the user runs research with a Research_Brief selected or uploaded, THE Research_Section SHALL transmit the Research_Brief content to the server alongside the research request.
7. WHEN the user switches from a brief option back to Standard_Research_Criteria, THE Research_Section SHALL clear any previously selected or uploaded Research_Brief.
8. WHEN the user selects the "select from library" option, THE Research_Section SHALL display a list of available briefs from the Brief_Library for the user to choose from.
9. WHEN the user uploads a new brief file during research, THE Research_Section SHALL also save that brief to the Brief_Library for future reuse.

---

### Requirement 2: Research Brief Upload — Server Processing

**User Story:** As a developer, I want the server to accept and use a research brief when provided, so that the AI service receives custom context during research.

#### Acceptance Criteria

1. WHEN a research request is received with a Research_Brief reference, THE Research_Engine SHALL retrieve or extract the brief text before invoking the AI_Provider.
2. WHEN a research request is received without a Research_Brief reference, THE Research_Engine SHALL use the Standard_Research_Criteria when invoking the AI_Provider.
3. WHEN the Research_Brief text is available, THE Research_Engine SHALL pass the Research_Brief text to the AI_Provider's research method as additional context.
4. IF the Research_Brief file cannot be parsed or text cannot be extracted, THEN THE Research_Engine SHALL return an error response with a descriptive message.
5. THE Research_Engine SHALL support Research_Brief files in PDF, DOCX, and TXT formats.
6. WHEN a Research_Brief is provided, THE AI_Provider SHALL incorporate the Research_Brief text into the research prompt in place of the Standard_Research_Criteria.

---

### Requirement 3: Gemini AI Provider — Implementation

**User Story:** As a developer, I want a Gemini provider implementation, so that the application can use Google Gemini as an AI backend.

#### Acceptance Criteria

1. THE Gemini_Provider SHALL implement the AIProviderClient interface, providing `analyzeDocuments`, `researchClient`, and `generateDecisionTree` methods.
2. THE Gemini_Provider SHALL use the Google Gemini API to fulfill each AIProviderClient method.
3. WHEN the Gemini_Provider is instantiated, THE Gemini_Provider SHALL read the Gemini API key from the server environment configuration.
4. IF the Gemini API key is not configured, THEN THE Gemini_Provider SHALL throw a descriptive configuration error on instantiation.
5. THE Provider_Factory SHALL return a Gemini_Provider instance when the selected provider is `'gemini'`.
6. THE Application SHALL add `'gemini'` to the AIProvider type in both server and client type definitions.
7. WHEN the Gemini API returns an error response, THE Gemini_Provider SHALL throw a provider error consistent with the error handling pattern used by the Claude and ChatGPT providers.

---

### Requirement 4: Gemini AI Provider — UI

**User Story:** As a user, I want to select Google Gemini as my AI provider, so that I can use it for research and decision tree generation.

#### Acceptance Criteria

1. THE Provider_Selector SHALL display "Gemini" as a selectable option alongside "Claude" and "ChatGPT".
2. WHEN the user selects "Gemini", THE Provider_Selector SHALL pass `'gemini'` as the selected AIProvider value.
3. WHEN research or tree generation is run with the Gemini provider, THE Research_Section SHALL display "Gemini" in loading and completion status labels.
4. WHEN a provider error occurs with the Gemini provider, THE Application SHALL display the provider error with an option to retry or switch providers, consistent with the existing error handling for Claude and ChatGPT.

---

### Requirement 5: Case Study Document Category

**User Story:** As a user, I want to categorize an uploaded document as a "Case Study", so that I can accurately classify documents of that type.

#### Acceptance Criteria

1. THE Documents_Section SHALL include "Case Study" as a selectable option in the document category dropdown.
2. WHEN the user selects "Case Study" and uploads a document, THE Application SHALL store the document with the category value `'case_study'`.
3. THE Application SHALL add `'case_study'` to the DocumentCategory type in both server and client type definitions.
4. WHEN a document with category `'case_study'` is displayed in the documents list, THE Documents_Section SHALL render the category label as "Case Study".

---

### Requirement 6: Client vs Subject Tree Types

**User Story:** As a user, I want to specify whether a tree is about a client or a subject area, so that I can organize and distinguish different kinds of intelligence trees in my workspace.

#### Acceptance Criteria

1. WHEN the user creates a new tree, THE Application SHALL require the user to select a Tree_Type of either `'client'` or `'subject'`.
2. THE Application SHALL store the Tree_Type value alongside the tree record in the database.
3. WHEN a Tree_Card is displayed in the workspace, THE Application SHALL render a visible badge or indicator showing whether the tree is a `'client'` tree or a `'subject'` tree.
4. THE Application SHALL add `'client'` and `'subject'` to the TreeType union type in both server and client type definitions.
5. WHEN a `'subject'` tree is created, THE Application SHALL accept a subject name (e.g., "gaming") in place of a client name.
6. WHEN a `'client'` tree is created, THE Application SHALL behave as it does today, using a client name.
7. THE Application SHALL use the Tree_Type throughout all tree-related operations to correctly label and contextualize the tree.

---

### Requirement 7: Research Brief Library — Persistence

**User Story:** As a user, I want my research briefs to be saved and reusable, so that I do not have to re-upload the same brief every time I run research.

#### Acceptance Criteria

1. THE Application SHALL persist Research_Brief records in the database, storing at minimum the brief name, file type, extracted text content, and creation timestamp.
2. WHEN a user uploads a new brief (either from the Brief_Management_Console or during research), THE Brief_Library SHALL store the brief and make it available for future research sessions.
3. WHEN a user uploads a new version of an existing brief, THE Brief_Library SHALL replace the stored brief content while preserving the brief's identity and name.
4. WHEN a user deletes a brief, THE Brief_Library SHALL remove the brief record from the database.
5. THE Brief_Library SHALL expose an API endpoint to list all stored briefs.
6. THE Brief_Library SHALL expose an API endpoint to retrieve a single brief by ID.
7. THE Brief_Library SHALL expose an API endpoint to create a new brief via file upload.
8. THE Brief_Library SHALL expose an API endpoint to update an existing brief via file upload.
9. THE Brief_Library SHALL expose an API endpoint to delete a brief by ID.
10. IF a brief referenced in a research request does not exist in the Brief_Library, THEN THE Research_Engine SHALL return an error response with a descriptive message.

---

### Requirement 8: Research Brief Management Console

**User Story:** As a user, I want a dedicated interface to manage my brief library, so that I can create, update, and delete briefs independently of running research.

#### Acceptance Criteria

1. THE Brief_Management_Console SHALL display a list of all briefs in the Brief_Library, showing at minimum the brief name and creation date.
2. WHEN the user uploads a new brief file in the Brief_Management_Console, THE Brief_Management_Console SHALL save the brief to the Brief_Library and display it in the list.
3. WHEN the user selects an existing brief and uploads a replacement file, THE Brief_Management_Console SHALL update the brief in the Brief_Library.
4. WHEN the user deletes a brief, THE Brief_Management_Console SHALL remove the brief from the Brief_Library and update the displayed list.
5. WHEN a brief upload or update fails, THE Brief_Management_Console SHALL display a descriptive error message.
6. THE Brief_Management_Console SHALL accept PDF, DOCX, and TXT file formats for brief uploads.

---

### Requirement 9: Main Navigation Menu

**User Story:** As a user, I want a top-level navigation menu, so that I can move between the Trees workspace, the Research Briefs library, and Settings without losing context.

#### Acceptance Criteria

1. THE Navigation_Menu SHALL be persistently visible in the Application and SHALL contain three navigation items: "Trees", "Research Briefs", and "Settings".
2. WHEN the user selects "Trees", THE Application SHALL display the workspace showing all Tree_Cards.
3. WHEN the user selects "Research Briefs", THE Application SHALL display the Brief_Management_Console.
4. WHEN the user selects "Settings", THE Application SHALL display the Settings_Page.
5. THE Navigation_Menu SHALL visually indicate the currently active section.
6. WHEN the Application first loads, THE Navigation_Menu SHALL default to the "Trees" section.

---

### Requirement 10: Default AI Engine Setting

**User Story:** As a user, I want to set a default AI provider, so that my preferred provider is pre-selected every time I run research without having to change it manually.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a selector allowing the user to choose a Default_Provider from the available AI providers (Claude, ChatGPT, Gemini).
2. WHEN the user saves a Default_Provider selection, THE Application SHALL persist the preference and apply it in future sessions.
3. WHEN the Research_Section is opened, THE Provider_Selector SHALL pre-select the Default_Provider configured in the Settings_Page.
4. WHEN no Default_Provider has been configured, THE Provider_Selector SHALL use a system default (Claude).
5. THE Application SHALL store the Default_Provider preference in the database or in persistent client-side storage.

---

### Requirement 11: Multi-Provider Research Selection

**User Story:** As a user, I want to select multiple AI providers when running research, so that I can compare results from different providers side by side in a single research run.

#### Acceptance Criteria

1. THE Research_Section SHALL replace the single-provider Provider_Selector with a Multi_Provider_Selector that renders one checkbox per available AI provider (Claude, ChatGPT, Gemini).
2. WHEN the Research_Section is opened, THE Multi_Provider_Selector SHALL pre-check the Default_Provider configured in the Settings_Page.
3. THE Multi_Provider_Selector SHALL allow the user to check any combination of one or more providers before running research.
4. IF the user attempts to run research with no providers selected, THEN THE Research_Section SHALL display a validation error and SHALL NOT submit the research request.
5. WHEN the user runs research with multiple providers selected, THE Research_Section SHALL submit a single research request containing the array of selected provider identifiers.
6. WHEN a multi-provider research request is received, THE Research_Engine SHALL execute the research call against each selected provider and collect all results.
7. WHEN all provider research calls have completed, THE Research_Engine SHALL return a Multi_Provider_Research_Response containing one Provider_Research_Result per selected provider, keyed by provider name.
8. IF one provider's research call fails during a multi-provider request, THEN THE Research_Engine SHALL include that provider's error in the Multi_Provider_Research_Response and SHALL continue collecting results from the remaining providers.
9. WHEN the Multi_Provider_Research_Response is received by the client, THE Research_Results_Display SHALL render each provider's result in a separate labeled section, identified by the provider name.
10. WHEN the decision tree display renders results from a multi-provider research run, THE ConversationTreeSection SHALL display each provider's tree output in a separate labeled tab or section, allowing the user to compare outputs.
11. WHERE only one provider is selected, THE Research_Section SHALL behave identically to the previous single-provider flow, and THE Research_Results_Display SHALL render a single result without tabs.
