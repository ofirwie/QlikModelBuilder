// Place this file in src/services/qlik-answers-service.ts

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'Answers' });

// ===== TYPE DEFINITIONS =====
interface Assistant {
  id: string;
  name: string;
  tags: string[];
  title?: string;
  ownerId: string;
  spaceId: string;
  tenantId: string;
  createdAt: string;
  createdBy: string;
  hasAvatar?: boolean;
  updatedAt: string;
  updatedBy: string;
  description: string;
  knowledgeBases: string[];
  welcomeMessage: string;
  customProperties: Record<string, any>;
  defaultPromptType?: 'thread' | 'oneshot';
  orderedStarterIds?: string[];
}

interface Thread {
  id: string;
  name: string;
  ownerId: string;
  favorite: boolean;
  messages?: Message[];
  createdAt: string;
  deletedAt?: string;
  updatedAt: string;
  hasFeedback: boolean;
  summaryStats: SummaryStats;
}

interface Message {
  id: string;
  role: 'human' | 'ai';
  content: string;
  sources: Source[];
  createdAt: string;
}

interface Source {
  chunks: Chunk[];
  source: string;
  documentId: string;
  datasourceId: string;
  lastIndexedAt?: string;
  knowledgebaseId: string;
}

interface Chunk {
  text?: string;
  chunkId: string;
}

interface SummaryStats {
  likes: number;
  other?: number;
  reviews: number;
  dislikes: number;
  unhelpful?: number;
  inaccurate?: number;
  irrelevant?: number;
  repetitive?: number;
  unanswered?: number;
  interactions: number;
}

interface InvokeResponse {
  output: string;
  sources: Source[];
  question?: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  datasources: string[];
  createdAt: string;
  updatedAt: string;
  lastIndexedAt?: string;
  status?: string;
}

// ===== SERVICE IMPLEMENTATION =====
export class QlikAnswersService {
  private apiClient: ApiClient;
  private cacheManager: CacheManager;
  
  constructor(apiClient: ApiClient, cacheManager: CacheManager) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    log.debug('🤖 Initializing Qlik Answers Service...');
  }

  // ===== ASSISTANT MANAGEMENT =====
  async listAssistants(params: any = {}) {
    const { limit = 50, offset = 0, sortBy, spaceId, search } = params;
    const queryParams = new URLSearchParams();

    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());
    if (sortBy) queryParams.append('sort', sortBy);
    if (spaceId) queryParams.append('spaceId', spaceId);

    const response = await this.apiClient.makeRequest(
      `/api/v1/assistants?${queryParams}`,
      'GET'
    );

    // If search parameter provided, filter results by name
    if (search && response.data) {
      const searchLower = search.toLowerCase();
      response.data = response.data.filter((assistant: any) =>
        assistant.name?.toLowerCase().includes(searchLower) ||
        assistant.description?.toLowerCase().includes(searchLower) ||
        assistant.title?.toLowerCase().includes(searchLower)
      );
    }

    return response;
  }

  async createAssistant(params: any) {
    const response = await this.apiClient.makeRequest(
      '/api/v1/assistants',
      'POST',
      params
    );
    return response;
  }

  async getAssistant(assistantId: string) {
    const response = await this.apiClient.makeRequest(
      `/api/v1/assistants/${assistantId}`,
      'GET'
    );
    return response;
  }

  async deleteAssistant(assistantId: string) {
    await this.apiClient.makeRequest(
      `/api/v1/assistants/${assistantId}`,
      'DELETE'
    );
    return { success: true, message: 'Assistant deleted successfully' };
  }

  // ===== Q&A FUNCTIONALITY =====
  async askQuestion(params: any) {
    const {
      assistantId,
      question,
      threadId,
      createNewThread = true,
      threadName,
      includeText = true,
      stream = false
    } = params;

    let actualThreadId = threadId;

    // Create a new thread if needed
    if (!threadId && createNewThread) {
      const threadResponse = await this.apiClient.makeRequest(
        `/api/v1/assistants/${assistantId}/threads`,
        'POST',
        {
          name: threadName || `Conversation: ${new Date().toISOString()}`
        }
      );
      actualThreadId = threadResponse.id;
    }

    if (!actualThreadId) {
      throw new Error('Thread ID is required or createNewThread must be true');
    }

    // Choose endpoint based on streaming preference
    const endpoint = stream ? 'stream' : 'invoke';
    const url = `/api/v1/assistants/${assistantId}/threads/${actualThreadId}/actions/${endpoint}`;

    const requestBody = {
      input: {
        prompt: question,
        promptType: 'thread',
        includeText
      }
    };

    if (stream) {
      // For now, we'll handle streaming as non-streaming
      // You can implement proper streaming later
      log.debug('Streaming mode requested but will return complete response');
    }

    const response = await this.apiClient.makeRequest(url, 'POST', requestBody);
    
    return {
      threadId: actualThreadId,
      ...response
    };
  }

  // ===== THREAD MANAGEMENT =====
  async listThreads(params: any) {
    const { assistantId, limit = 50, offset = 0 } = params;
    const queryParams = new URLSearchParams();

    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());

    const response = await this.apiClient.makeRequest(
      `/api/v1/assistants/${assistantId}/threads?${queryParams}`,
      'GET'
    );
    return response;
  }

  async getThread(assistantId: string, threadId: string) {
    const response = await this.apiClient.makeRequest(
      `/api/v1/assistants/${assistantId}/threads/${threadId}`,
      'GET'
    );
    return response;
  }

  async deleteThread(assistantId: string, threadId: string) {
    await this.apiClient.makeRequest(
      `/api/v1/assistants/${assistantId}/threads/${threadId}`,
      'DELETE'
    );
    return { success: true, message: 'Thread deleted successfully' };
  }

  // ===== KNOWLEDGE BASE MANAGEMENT =====
  async listKnowledgeBases(params: any = {}) {
    const { limit = 50, offset = 0, sortBy } = params;
    const queryParams = new URLSearchParams();

    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());
    if (sortBy) queryParams.append('sort', sortBy);

    const response = await this.apiClient.makeRequest(
      `/api/v1/knowledgebases?${queryParams}`,
      'GET'
    );
    return response;
  }

  async indexKnowledgeBase(knowledgebaseId: string) {
    const response = await this.apiClient.makeRequest(
      `/api/v1/knowledgebases/${knowledgebaseId}/actions/index`,
      'POST'
    );
    return {
      success: true,
      message: 'Indexing initiated',
      ...response
    };
  }

  async getKnowledgeBaseStatus(knowledgebaseId: string) {
    const response = await this.apiClient.makeRequest(
      `/api/v1/knowledgebases/${knowledgebaseId}`,
      'GET'
    );
    return response;
  }

  // ===== HANDLER METHODS FOR MCP =====
  async handleListAssistants(args: any) {
    log.debug('[QlikAnswers] Listing assistants...', args.search ? `Search: ${args.search}` : '');

    try {
      const result = await this.listAssistants(args);
      const assistants = result.data || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            totalCount: assistants.length,
            search: args.search || null,
            assistants: assistants.map((a: any) => ({
              id: a.id,
              name: a.name,
              title: a.title,
              description: a.description,
              spaceId: a.spaceId,
              knowledgeBases: a.knowledgeBases,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt
            }))
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to list assistants:', error);

      // Check for 405 error - Qlik Answers not enabled
      if (error.message?.includes('405')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Qlik Answers is not available on this tenant (405 Not Allowed)',
              hint: 'Qlik Answers requires a specific license. Contact your Qlik administrator to enable this feature.',
              documentation: 'https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm'
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to list assistants'
          }, null, 2)
        }]
      };
    }
  }

  async handleCreateAssistant(args: any) {
    log.debug('[QlikAnswers] Creating assistant...');
    
    try {
      const result = await this.createAssistant(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            assistant: result
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to create assistant:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to create assistant'
          }, null, 2)
        }]
      };
    }
  }

  async handleAskQuestion(args: any) {
    log.debug('[QlikAnswers] Asking question...');
    
    try {
      const result = await this.askQuestion(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            threadId: result.threadId,
            output: result.output,
            sources: result.sources,
            question: args.question
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to ask question:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to ask question'
          }, null, 2)
        }]
      };
    }
  }

  async handleListThreads(args: any) {
    log.debug('[QlikAnswers] Listing threads...');
    
    try {
      const result = await this.listThreads(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            totalCount: result.meta?.countTotal || result.data?.length || 0,
            threads: result.data || []
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to list threads:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to list threads'
          }, null, 2)
        }]
      };
    }
  }

  async handleGetThread(args: any) {
    log.debug('[QlikAnswers] Getting thread...');
    
    try {
      const result = await this.getThread(args.assistantId, args.threadId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            thread: result
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to get thread:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to get thread'
          }, null, 2)
        }]
      };
    }
  }

  async handleDeleteThread(args: any) {
    log.debug('[QlikAnswers] Deleting thread...');
    
    try {
      const result = await this.deleteThread(args.assistantId, args.threadId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to delete thread:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to delete thread'
          }, null, 2)
        }]
      };
    }
  }

  async handleListKnowledgeBases(args: any) {
    log.debug('[QlikAnswers] Listing knowledge bases...');
    
    try {
      const result = await this.listKnowledgeBases(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            totalCount: result.meta?.countTotal || result.data?.length || 0,
            knowledgeBases: result.data || []
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to list knowledge bases:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to list knowledge bases'
          }, null, 2)
        }]
      };
    }
  }

  async handleGetAssistant(args: any) {
    log.debug('[QlikAnswers] Getting assistant...');
    
    try {
      const result = await this.getAssistant(args.assistantId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            assistant: result
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to get assistant:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to get assistant'
          }, null, 2)
        }]
      };
    }
  }

  async handleDeleteAssistant(args: any) {
    log.debug('[QlikAnswers] Deleting assistant...');
    
    try {
      const result = await this.deleteAssistant(args.assistantId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to delete assistant:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to delete assistant'
          }, null, 2)
        }]
      };
    }
  }

  async handleIndexKnowledgeBase(args: any) {
    log.debug('[QlikAnswers] Indexing knowledge base...');
    
    try {
      const result = await this.indexKnowledgeBase(args.knowledgebaseId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to index knowledge base:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to index knowledge base'
          }, null, 2)
        }]
      };
    }
  }

  async handleGetKnowledgeBaseStatus(args: any) {
    log.debug('[QlikAnswers] Getting knowledge base status...');
    
    try {
      const result = await this.getKnowledgeBaseStatus(args.knowledgebaseId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            knowledgeBase: result
          }, null, 2)
        }]
      };
    } catch (error: any) {
      log.debug('[QlikAnswers] Failed to get knowledge base status:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to get knowledge base status'
          }, null, 2)
        }]
      };
    }
  }
}