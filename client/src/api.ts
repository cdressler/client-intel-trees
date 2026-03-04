import type {
  AIProvider,
  Tree,
  TreeType,
  TreeSummary,
  Document,
  Brief,
  DecisionTree,
  MultiProviderResearchResponse,
} from './types';

export class ApiError extends Error {
  code: string;
  provider?: AIProvider;
  statusCode: number;

  constructor(statusCode: number, code: string, message: string, provider?: AIProvider) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.provider = provider as AIProvider | undefined;
  }

  get isProviderError(): boolean {
    return this.statusCode === 502 || this.statusCode === 503;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = 'An unexpected error occurred';
    let provider: string | undefined;
    try {
      const body = await res.json();
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        provider = body.error.provider;
      }
    } catch {
      // response wasn't JSON — use defaults
    }
    throw new ApiError(res.status, code, message, provider as AIProvider | undefined);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (null as T);
}

// Trees
export function listTrees(): Promise<TreeSummary[]> {
  return request<TreeSummary[]>('/api/trees');
}

export function createTree(clientName: string, treeType: TreeType): Promise<Tree> {
  return request<Tree>('/api/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName, treeType }),
  });
}

export function getTree(treeId: string): Promise<Tree> {
  return request<Tree>(`/api/trees/${treeId}`);
}

// Documents
export function listDocuments(treeId: string): Promise<Document[]> {
  return request<Document[]>(`/api/trees/${treeId}/documents`);
}

export function uploadDocument(treeId: string, file: File, metadata?: { projectName?: string; category?: string }): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata?.projectName) formData.append('projectName', metadata.projectName);
  if (metadata?.category) formData.append('category', metadata.category);
  return request<Document>(`/api/trees/${treeId}/documents`, {
    method: 'POST',
    body: formData,
  });
}

// Research
export function getResearch(treeId: string): Promise<MultiProviderResearchResponse | null> {
  return request<MultiProviderResearchResponse | null>(`/api/trees/${treeId}/research`);
}

export function runResearch(
  treeId: string,
  providers: AIProvider[],
  briefFile?: File,
  briefId?: string,
): Promise<MultiProviderResearchResponse> {
  if (briefFile) {
    const formData = new FormData();
    formData.append('providers', JSON.stringify(providers));
    formData.append('briefFile', briefFile);
    formData.append('briefName', briefFile.name);
    return request<MultiProviderResearchResponse>(`/api/trees/${treeId}/research`, {
      method: 'POST',
      body: formData,
    });
  }
  return request<MultiProviderResearchResponse>(`/api/trees/${treeId}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers, briefId }),
  });
}

// Decision Tree
export async function getDecisionTree(treeId: string): Promise<DecisionTree[]> {
  const result = await request<DecisionTree | DecisionTree[] | null>(`/api/trees/${treeId}/decision-tree`);
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return [result];
}

export function generateDecisionTree(treeId: string, provider: AIProvider): Promise<DecisionTree> {
  return request<DecisionTree>(`/api/trees/${treeId}/decision-tree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
}

export function getPreviousDecisionTree(treeId: string): Promise<DecisionTree | null> {
  return request<DecisionTree | null>(`/api/trees/${treeId}/decision-tree/previous`);
}

// Briefs
export function listBriefs(): Promise<Brief[]> {
  return request<Brief[]>('/api/briefs');
}

export function createBrief(name: string, file: File): Promise<Brief> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  return request<Brief>('/api/briefs', {
    method: 'POST',
    body: formData,
  });
}

export function updateBrief(id: string, file: File): Promise<Brief> {
  const formData = new FormData();
  formData.append('file', file);
  return request<Brief>(`/api/briefs/${id}`, {
    method: 'PUT',
    body: formData,
  });
}

export function deleteBrief(id: string): Promise<void> {
  return request<void>(`/api/briefs/${id}`, {
    method: 'DELETE',
  });
}

// Settings
export function getDefaultProvider(): Promise<AIProvider> {
  return request<{ provider: AIProvider }>('/api/settings/default-provider')
    .then(res => res.provider);
}

export function setDefaultProvider(provider: AIProvider): Promise<void> {
  return request<void>('/api/settings/default-provider', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
}
