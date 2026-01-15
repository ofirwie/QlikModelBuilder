/**
 * Qlik Answers Handlers - Connect MCP tools to Qlik Answers service
 * Note: Qlik Answers is Cloud-only feature
 */

import { QlikAnswersService } from '../services/qlik-answers-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'AnswersHandlers' });

/**
 * Cloud-only gate - returns error for on-premise
 */
function checkCloudOnly(platform: string): { content: Array<{ type: string; text: string }> } | null {
  if (platform === 'on-premise') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Qlik Answers (AI Assistant) is only available on Qlik Cloud',
          reason: 'Qlik Answers requires Qlik Cloud AI/ML infrastructure and LLM integration',
          platform: 'on-premise',
          suggestion: 'Use qlik_search to find apps and datasets manually'
        }, null, 2)
      }]
    };
  }
  return null;
}

/**
 * Handler for qlik_answers_list_assistants tool
 * List Qlik Answers AI assistants
 */
export async function handleAnswersListAssistants(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AnswersHandlers] qlik_answers_list_assistants called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    const answersService = new QlikAnswersService(apiClient, cacheManager);
    return await answersService.handleListAssistants(args);
  } catch (error) {
    log.debug('[AnswersHandlers] Error in qlik_answers_list_assistants:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}

/**
 * Handler for qlik_answers_get_assistant tool
 * Get details of a specific assistant
 */
export async function handleAnswersGetAssistant(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AnswersHandlers] qlik_answers_get_assistant called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    const answersService = new QlikAnswersService(apiClient, cacheManager);
    return await answersService.handleGetAssistant(args);
  } catch (error) {
    log.debug('[AnswersHandlers] Error in qlik_answers_get_assistant:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}

/**
 * Handler for qlik_answers_ask_question tool
 * Ask a question to a Qlik Answers AI assistant
 */
export async function handleAnswersAskQuestion(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AnswersHandlers] qlik_answers_ask_question called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    if (!args.assistantId) {
      throw new Error('assistantId is required');
    }
    if (!args.question) {
      throw new Error('question is required');
    }

    const answersService = new QlikAnswersService(apiClient, cacheManager);
    return await answersService.handleAskQuestion(args);
  } catch (error) {
    log.debug('[AnswersHandlers] Error in qlik_answers_ask_question:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}
