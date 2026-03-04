# Requirements Document

## Introduction

The Client Intelligence Tree is a web application that helps agency new business teams and program managers have smarter, more informed conversations with their clients. Users create a "tree" for a specific client, upload past work products (briefs, deliverables, schedules), and the application uses an AI provider (Claude or ChatGPT) to research the client's current business landscape (earnings, news, new offerings). By combining institutional knowledge of past work with real-time client intelligence, the application generates a two-level conversation decision tree — idea starters that help teams initiate conversations to drive new or expand existing business. Users can choose which AI provider to use for each operation, providing flexibility when one service experiences availability issues.

## Glossary

- **Tree**: A client-specific intelligence workspace containing uploaded documents, research results, and a generated conversation decision tree
- **Client**: The company or organization that the agency serves (e.g., Kyndryl)
- **Work_Product**: Documents uploaded by the user representing past or current work for a client — includes briefs, schedules, deliverable artifacts, and project documents
- **Client_Research**: Information gathered by the selected AI_Provider about a client's current business landscape, including earnings reports, recent news, and new services or offerings
- **AI_Provider**: An external large language model service used by the App for analysis — either Claude (Anthropic) or ChatGPT (OpenAI)
- **Provider_Selector**: The UI control that allows the User to choose which AI_Provider to use for a given AI-powered operation
- **Conversation_Node**: A single node in the decision tree representing a conversation topic or idea starter
- **Root_Node**: A top-level conversation theme derived from the intersection of past work and current client intelligence
- **Leaf_Node**: A second-level conversation point beneath a Root_Node, providing a specific talking point or question
- **Decision_Tree**: A two-level hierarchical structure of Root_Nodes and Leaf_Nodes that guides users through potential client conversations
- **App**: The Client Intelligence Tree web application
- **User**: An agency new business team member or program manager using the App
- **Document_Processor**: The component of the App responsible for ingesting, parsing, and extracting insights from uploaded Work_Products
- **Research_Engine**: The component of the App that uses the selected AI_Provider to gather and synthesize Client_Research
- **Tree_Generator**: The component of the App that combines Work_Product insights and Client_Research using the selected AI_Provider to produce a Decision_Tree

## Requirements

### Requirement 1: Client Tree Creation

**User Story:** As a User, I want to create a new Tree for a specific client, so that I can organize intelligence and conversation starters around that client relationship.

#### Acceptance Criteria

1. WHEN the User requests to create a new Tree, THE App SHALL prompt the User to provide a client name
2. WHEN the User submits a client name, THE App SHALL create a new Tree workspace associated with that client name
3. THE App SHALL display all existing Trees in a list view, showing the client name and creation date for each Tree
4. WHEN the User selects a Tree from the list, THE App SHALL navigate to that Tree's workspace
5. IF the User submits an empty client name, THEN THE App SHALL display a validation error message requesting a valid client name

### Requirement 2: Document Upload and Processing

**User Story:** As a User, I want to upload project documents for a client, so that the application understands the work my team has done for this client.

#### Acceptance Criteria

1. WHEN the User is within a Tree workspace, THE App SHALL provide a document upload interface
2. WHEN the User uploads one or more Work_Products, THE Document_Processor SHALL accept files in PDF, DOCX, PPTX, XLSX, and plain text formats
3. WHEN a Work_Product is uploaded, THE Document_Processor SHALL extract text content and store it associated with the Tree
4. THE App SHALL display a list of all uploaded Work_Products for the current Tree, showing file name, upload date, and file type
5. WHEN the User uploads a Work_Product, THE App SHALL allow the User to assign a project name and document category (brief, schedule, deliverable, or other) to the uploaded file
6. IF the User uploads a file in an unsupported format, THEN THE App SHALL display an error message listing the supported file formats
7. IF the Document_Processor fails to extract content from a file, THEN THE App SHALL notify the User that the file could not be processed and suggest re-uploading in a supported format

### Requirement 3: Automated Client Research

**User Story:** As a User, I want the application to automatically research my client's current business landscape, so that I have up-to-date intelligence without manual effort.

#### Acceptance Criteria

1. WHEN a Tree is created or when the User requests a research refresh, THE App SHALL present a Provider_Selector allowing the User to choose an AI_Provider (Claude or ChatGPT) for the research operation
2. WHEN the User confirms the research operation, THE Research_Engine SHALL use the selected AI_Provider to gather current information about the client, including recent earnings reports, news, and new services or offerings
3. WHEN the Research_Engine completes research, THE App SHALL display a summary of findings organized by category (financial performance, recent news, new offerings, and challenges)
4. THE Research_Engine SHALL include source attribution for each piece of Client_Research gathered
5. WHEN the User requests a research refresh, THE Research_Engine SHALL replace previous research results with newly gathered information
6. THE App SHALL record which AI_Provider was used for the most recent research operation and display the provider name alongside the research results
7. IF the Research_Engine cannot find sufficient information for a client, THEN THE App SHALL notify the User and suggest verifying the client name or providing additional context

### Requirement 4: Conversation Decision Tree Generation

**User Story:** As a User, I want the application to generate a conversation decision tree based on past work and client research, so that I have actionable conversation starters for client meetings.

#### Acceptance Criteria

1. WHEN the User requests tree generation and the Tree contains at least one Work_Product and completed Client_Research, THE App SHALL present a Provider_Selector allowing the User to choose an AI_Provider (Claude or ChatGPT) for the generation operation
2. WHEN the User confirms tree generation, THE Tree_Generator SHALL use the selected AI_Provider to produce a Decision_Tree with a depth of two levels (Root_Nodes and Leaf_Nodes)
3. THE Tree_Generator SHALL derive Root_Nodes from themes that intersect past Work_Product insights with current Client_Research findings
4. THE Tree_Generator SHALL generate Leaf_Nodes under each Root_Node, each containing a specific conversation starter, talking point, or question
5. WHEN the Decision_Tree is generated, THE App SHALL display the tree in a visual, navigable format showing Root_Nodes and their associated Leaf_Nodes
6. WHEN the User selects a Conversation_Node, THE App SHALL display the rationale behind that node, referencing the specific Work_Products and Client_Research that informed the suggestion
7. THE App SHALL record which AI_Provider was used for the most recent tree generation and display the provider name alongside the Decision_Tree
8. IF the User requests tree generation without any uploaded Work_Products, THEN THE App SHALL display a message indicating that at least one Work_Product is required
9. IF the User requests tree generation without completed Client_Research, THEN THE App SHALL display a message indicating that client research must be completed first

### Requirement 5: Tree Regeneration and Refinement

**User Story:** As a User, I want to regenerate or refine the conversation tree as new documents are uploaded or research is refreshed, so that my conversation starters stay current and relevant.

#### Acceptance Criteria

1. WHEN the User uploads additional Work_Products or refreshes Client_Research after a Decision_Tree has been generated, THE App SHALL indicate that the tree may be outdated
2. WHEN the User requests tree regeneration, THE Tree_Generator SHALL produce a new Decision_Tree incorporating all current Work_Products and the latest Client_Research
3. THE App SHALL retain the previously generated Decision_Tree until a new one is generated, allowing the User to reference the prior version

### Requirement 6: User Interface and Navigation

**User Story:** As a User, I want a clean, intuitive interface to navigate between my client trees and their contents, so that I can efficiently prepare for client conversations.

#### Acceptance Criteria

1. THE App SHALL provide a dashboard view listing all Trees with client name, number of uploaded documents, research status, and tree generation status
2. WHEN the User is within a Tree workspace, THE App SHALL provide navigation between three sections: Documents, Research, and Conversation Tree
3. THE App SHALL render as a responsive web application accessible from desktop and tablet browsers
4. WHEN the User navigates between sections within a Tree workspace, THE App SHALL preserve the state of each section

### Requirement 7: Multi-Provider AI Integration

**User Story:** As a User, I want to choose between Claude and ChatGPT for AI-powered operations, so that I can switch providers when one service is unavailable and still get insightful, contextually relevant conversation suggestions.

#### Acceptance Criteria

1. THE App SHALL support two AI_Providers: Claude (Anthropic API) and ChatGPT (OpenAI API)
2. WHEN the User initiates an AI-powered operation (Client_Research or Decision_Tree generation), THE App SHALL present a Provider_Selector defaulting to the most recently used AI_Provider for that Tree
3. THE App SHALL integrate with both the Claude API and the ChatGPT API for Client_Research gathering, Work_Product analysis, and Decision_Tree generation
4. WHEN the selected AI_Provider is processing a request, THE App SHALL display a loading indicator with a description of the current operation and the name of the AI_Provider being used
5. IF the selected AI_Provider API returns an error or is unavailable, THEN THE App SHALL display a user-friendly error message identifying the failing provider and allow the User to retry the operation or switch to the other AI_Provider
6. THE App SHALL send Work_Product content and Client_Research to the selected AI_Provider with structured prompts that request actionable conversation starters grounded in specific evidence
7. THE App SHALL maintain equivalent prompt structures for both AI_Providers so that output quality and format remain consistent regardless of provider selection
8. WHILE no AI_Provider has been previously selected for a Tree, THE App SHALL default the Provider_Selector to Claude
