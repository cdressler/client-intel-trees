export type AIProvider = 'claude' | 'chatgpt' | 'gemini';
export type SupportedFileType = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'txt';
export type DocumentCategory = 'brief' | 'schedule' | 'deliverable' | 'case_study' | 'other';
export type TreeType = 'client' | 'subject';
export type ResearchStatus = 'none' | 'in_progress' | 'complete' | 'error';
export type TreeGenerationStatus = 'none' | 'in_progress' | 'generated' | 'outdated' | 'error';

export interface Tree {
  id: string;
  clientName: string;
  lastProvider: AIProvider | null;
  treeType: TreeType;
  createdAt: string;
  updatedAt: string;
}

export interface TreeSummary extends Tree {
  documentCount: number;
  researchStatus: ResearchStatus;
  treeStatus: TreeGenerationStatus;
}

export interface Document {
  id: string;
  treeId: string;
  fileName: string;
  filePath: string;
  fileType: SupportedFileType;
  projectName: string | null;
  category: DocumentCategory | null;
  extractedText: string | null;
  uploadedAt: string;
}

export interface DocumentMetadata {
  projectName?: string;
  category?: DocumentCategory;
}

export interface ResearchFinding {
  category: 'financial_performance' | 'recent_news' | 'new_offerings' | 'challenges';
  title: string;
  summary: string;
  source: string;
}

export interface ResearchResult {
  id: string;
  treeId: string;
  provider: AIProvider;
  findings: ResearchFinding[];
  completedAt: string;
}

export interface ConversationNode {
  id: string;
  title: string;
  content: string;
  rationale: string;
  sourceDocumentIds: string[];
  sourceResearchCategories: string[];
}

export interface RootNode extends ConversationNode {
  leafNodes: LeafNode[];
}

export interface LeafNode extends ConversationNode {}

export interface DecisionTree {
  id: string;
  treeId: string;
  provider: AIProvider;
  rootNodes: RootNode[];
  isCurrent: boolean;
  generatedAt: string;
}

export interface Brief {
  id: string;
  name: string;
  fileType: 'pdf' | 'docx' | 'txt';
  createdAt: string;
}

export interface BriefDetail extends Brief {
  text: string;
}

export interface ResearchFindings {
  clientName: string;
  findings: ResearchFinding[];
}

export interface ProviderResearchResult {
  provider: AIProvider;
  findings?: ResearchFindings;
  error?: string;
}

export interface MultiProviderResearchResponse {
  results: Record<AIProvider, ProviderResearchResult>;
}

export interface ResearchRequestBody {
  providers: AIProvider[];
  briefId?: string;
}
