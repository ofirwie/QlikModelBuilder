/**
 * Simple Natural Language Service
 * Wrapper around Qlik Insight Advisor / NL Query API
 * Works on both Cloud and On-Premise
 *
 * Cloud: /api/v1/apps/{appId}/insight-analyses/actions/recommend
 * On-Premise: /api/v1/nl/query
 */

import { ApiClient } from '../utils/api-client.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'NaturalLanguage' });

export interface SimpleNLInput {
  text: string;
  appId?: string;
}

export interface SimpleNLResult {
  success: boolean;
  response?: any;
  error?: string;
}

export class SimpleNaturalLanguageService {
  private apiClient: ApiClient;
  private platform: 'cloud' | 'on-premise';

  constructor(apiClient: ApiClient, platform: 'cloud' | 'on-premise' = 'cloud') {
    this.apiClient = apiClient;
    this.platform = platform;
  }

  /**
   * Ask question via Insight Advisor API
   * Routes to platform-specific implementation
   */
  async askQuestion(input: SimpleNLInput): Promise<SimpleNLResult> {
    log.debug(`[SimpleNL] Question (platform: ${this.platform}):`, input.text);

    try {
      // Route to platform-specific implementation
      if (this.platform === 'on-premise') {
        return await this.askQuestionOnPremise(input);
      }

      // Cloud: If appId provided, use direct app insight
      if (input.appId) {
        return await this.askAppQuestion(input.appId, input.text);
      }

      // Otherwise try natural language API
      return await this.askNaturalLanguageQuestion(input.text);

    } catch (error) {
      log.debug('[SimpleNL] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * On-premise implementation using /api/v1/nl/query endpoint
   * Requires Insight Advisor Chat license
   *
   * API Reference: https://help.qlik.com/en-US/sense-developer/November2025/Subsystems/NaturalLangAPI/Content/Sense_NaturalLangAPI/NaturalLangAPI-Connect.htm
   *
   * Request format:
   * - text (required): The natural language query
   * - app (optional): { id: "appId" } to target specific app
   * - disableConversationContext (optional): Turn off context
   * - disableFollowups (optional): Disable follow-up recommendations
   * - disableNarrative (optional): Return only charts, no text
   */
  private async askQuestionOnPremise(input: SimpleNLInput): Promise<SimpleNLResult> {
    try {
      // Build request body per API spec
      const requestBody: any = {
        text: input.text
      };

      // Add app target if provided
      if (input.appId) {
        requestBody.app = { id: input.appId };
      }

      // On-premise NL Query API endpoint: POST /api/v1/nl/query
      log.debug(`[SimpleNL] On-premise NL query: ${input.text}`);
      const response = await this.apiClient.makeRequest(
        '/api/v1/nl/query',
        'POST',
        requestBody
      );

      return {
        success: true,
        response
      };
    } catch (error) {
      log.debug('[SimpleNL] NL Query API error:', error);

      // Return error with helpful message
      return {
        success: false,
        error: `Natural Language query failed. ` +
               `Ensure Insight Advisor Chat is enabled and licensed in QMC. ` +
               `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Ask question for specific app via Insight Advisor
   */
  private async askAppQuestion(appId: string, question: string): Promise<SimpleNLResult> {
    try {
      const response = await this.apiClient.makeRequest(
        `/api/v1/apps/${appId}/insight-analyses/actions/recommend`,
        'POST',
        {
          text: question,
          targetAnalysis: {}
        }
      );

      return {
        success: true,
        response
      };
    } catch (error) {
      // Try alternative endpoint
      try {
        const altResponse = await this.apiClient.makeRequest(
          `/api/v1/questions/actions/ask`,
          'POST',
          {
            text: question,
            app: { id: appId }
          }
        );

        return {
          success: true,
          response: altResponse
        };
      } catch (altError) {
        throw error; // Throw original error
      }
    }
  }

  /**
   * Ask question via natural language endpoint (auto app detection)
   */
  private async askNaturalLanguageQuestion(question: string): Promise<SimpleNLResult> {
    const response = await this.apiClient.makeRequest(
      '/api/v1/questions/actions/ask',
      'POST',
      { text: question }
    );

    return {
      success: true,
      response
    };
  }
}
