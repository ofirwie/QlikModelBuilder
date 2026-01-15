// src/services/qlik-alert-service.ts

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'Alert' });

// Types for Qlik Cloud Alert APIs
interface AlertCondition {
  type: 'data' | 'compound';
  appId: string;
  measures: ConditionMeasure[];
  dimensions?: ConditionDimension[];
  selections?: Selection[];
  operand?: 'greaterThan' | 'lessThan' | 'equal' | 'between';
  threshold?: number;
  thresholdMax?: number; // for 'between' operand
}

interface ConditionMeasure {
  title: string;
  qLibraryId?: string;
  qNumFormat?: any;
}

interface ConditionDimension {
  field: string;
  title: string;
  qLibraryId?: string;
}

interface Selection {
  field: string;
  values: string[];
}

interface AlertRecipient {
  value: string; // user ID or group ID
  enabled: boolean;
  subscribed?: boolean;
  groups?: string[]; // A list of associated groups
  taskRecipientErrors?: any[];
  alertingTaskRecipientErrors?: any[];
}

interface Recipients {
  userIds: AlertRecipient[];
  groupIds?: AlertRecipient[];
}

interface ThrottlingResource {
  capacity: number;
  replenishRate: number;
  recurrenceRule: string;
  initialTokenCount: number;
  referenceTimestamp: string;
}

interface ScheduleOptions {
  timezone: string;
  recurrence: string[];
  startDateTime: string;
  endDateTime?: string;
}

interface AlertRequest {
  name: string;
  description?: string;
  appId: string;
  sheetId?: string;
  bookmarkId?: string;
  enabled?: boolean;
  triggerType: 'RELOAD' | 'SCHEDULED' | 'MANUAL';
  recipients: Recipients;
  condition: AlertCondition;
  throttling?: ThrottlingResource;
  scheduleOptions?: ScheduleOptions;
}

interface AlertUpdate {
  name?: string;
  description?: string;
  enabled?: boolean;
  recipients?: Recipients;
  throttling?: ThrottlingResource;
  scheduleOptions?: ScheduleOptions;
}

interface ConditionCreatePayload {
  type: 'data' | 'compound';
  dataCondition?: {
    conditionBase: {
      type: 'data';
      appId: string;
      bookmarkId?: string;
      description?: string;
      lastReloadTime: string;
    };
    headers: string[];
    measures: ConditionMeasure[];
    dimensions?: ConditionDimension[];
    selections?: Array<{
      count: number;
      field: string;
      selectedSummary: string | string[];
    }>;
    history?: {
      enabled: boolean;
    };
    conditionData: Record<string, any>; // This will contain operand-specific data
  };
  compoundCondition?: {
    // Add if needed for compound conditions
  };
}

interface ConditionResponse {
  condition?: {
    id: string;
    [key: string]: any;
  };
  id?: string;
  [key: string]: any;
}

interface CreateAlertResponse {
  success: boolean;
  alertId?: string;
  conditionId?: string;
  data?: any;
  message?: string;
  error?: string;
  suggestedSolution?: string;
  parsedRequest?: AlertRequest;
  conditionError?: string;
}

export class QlikAlertService {
  private apiClient: ApiClient;
  private cacheManager: CacheManager;
  private cache: Map<string, any> = new Map();

  constructor(apiClient: ApiClient, cacheManager: CacheManager) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
  }

  /**
   * Create an alert based on natural language prompt
   */ 
async createAlertFromPrompt(
  prompt: string, 
  appId: string, 
  existingConditionId?: string
): Promise<CreateAlertResponse> {
  try {
    log.debug('[AlertService] Creating alert from prompt:', prompt);
    
    // Parse the natural language prompt
    const alertRequest = this.parseAlertPrompt(prompt, appId);
    log.debug('[AlertService] Parsed alert request:', JSON.stringify(alertRequest, null, 2));
    
    // Use existing condition ID if provided, otherwise try to create one
    let conditionId: string;
    
    if (existingConditionId) {
      conditionId = existingConditionId;
      log.debug('[AlertService] Using existing condition ID:', conditionId);
    } else {
      try {
        // Create the condition with proper structure
        const conditionResponse = await this.createCondition(alertRequest.condition);
        
        // The condition ID is in conditionResponse.condition.dataCondition.conditionBase.id
        if (conditionResponse.condition?.dataCondition?.conditionBase?.id) {
          conditionId = conditionResponse.condition.dataCondition.conditionBase.id;
        } else if (conditionResponse.condition?.id) {
          conditionId = conditionResponse.condition.id;
        } else {
          // Log the full response to debug
          log.debug('[AlertService] Full condition response:', JSON.stringify(conditionResponse, null, 2));
          
          // Check if there are errors in the response
          if (conditionResponse.errors && conditionResponse.errors.length > 0) {
            const errorMessages = conditionResponse.errors.map((e: any) => e.title).join(', ');
            throw new Error(`Condition creation failed with errors: ${errorMessages}`);
          }
          
          throw new Error('Condition created but no ID found in response');
        }
        
        log.debug('[AlertService] Created new condition with ID:', conditionId);
        
      } catch (conditionError) {
        log.debug('[AlertService] Failed to create condition:', conditionError);
        
        // Return helpful error message for condition creation failure
        return {
          success: false,
          error: 'Failed to create condition',
          message: 'Unable to create condition. This might be because:\n' +
                  '1. The conditions API is not enabled for your tenant\n' +
                  '2. You need to provide an existing conditionId\n' +
                  '3. The condition parameters are invalid\n\n' +
                  'Try using an existing condition ID or contact your Qlik administrator.',
          suggestedSolution: 'Use qlik_alert_create_with_condition_id instead with an existing condition ID',
          parsedRequest: alertRequest,
          conditionError: conditionError instanceof Error ? conditionError.message : String(conditionError)
        };
      }
    }
    
    // Create the alert task with the condition ID
    const alertPayload = {
      name: alertRequest.name,
      description: alertRequest.description,
      appId: alertRequest.appId,
      enabled: alertRequest.enabled ?? true,
      triggerType: alertRequest.triggerType,
      recipients: alertRequest.recipients,
      conditionId: conditionId,
      ...(alertRequest.sheetId && { sheetId: alertRequest.sheetId }),
      ...(alertRequest.bookmarkId && { bookmarkId: alertRequest.bookmarkId }),
      ...(alertRequest.scheduleOptions && { scheduleOptions: alertRequest.scheduleOptions }),
      ...(alertRequest.throttling && { throttling: alertRequest.throttling })
    };

    log.debug('[AlertService] Creating alert with payload:', JSON.stringify(alertPayload, null, 2));
    const response = await this.apiClient.makeRequest('/api/v1/data-alerts', 'POST', alertPayload);
    
    return {
      success: true,
      alertId: response.id,
      conditionId: conditionId,
      data: response,
      message: `Alert "${alertRequest.name}" created successfully`
    };

  } catch (error) {
    log.debug('[AlertService] Error creating alert:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      error: errorMessage,
      message: `Failed to create alert: ${errorMessage}`
    };
  }
}

  /**
   * Create alert with existing condition ID
   */
  async createAlertWithConditionId(prompt: string, appId: string, conditionId: string): Promise<any> {
    return this.createAlertFromPrompt(prompt, appId, conditionId);
  }

  /**
   * Update an existing alert based on prompt
   */
  async updateAlertFromPrompt(alertId: string, prompt: string): Promise<any> {
    try {
      log.debug('[AlertService] Updating alert:', alertId);
      
      // Get existing alert
      const existingAlert = await this.getAlert(alertId);
      
      // Parse update request
      const updates = this.parseUpdatePrompt(prompt);
      
      // Update the alert - use custom PATCH implementation since ApiClient doesn't support PATCH directly
      const url = `${(this.apiClient as any).config.tenantUrl}/data-alerts/${alertId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${(this.apiClient as any).config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update alert: ${response.status} - ${errorText}`);
      }
      
      return {
        success: true,
        alertId,
        message: `Alert updated successfully`,
        updates
      };

    } catch (error) {
      log.debug('[AlertService] Error updating alert:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to update alert: ${errorMessage}`);
    }
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string): Promise<any> {
    try {
      await this.apiClient.makeRequest(`/api/v1/data-alerts/${alertId}`, 'DELETE');
      
      return {
        success: true,
        alertId,
        message: 'Alert deleted successfully'
      };
    } catch (error) {
      log.debug('[AlertService] Error deleting alert:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to delete alert: ${errorMessage}`);
    }
  }

  /**
   * Get all alerts
   */
  async listAlerts(options: {
    spaceId?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (options.spaceId) params.append('spaceId', options.spaceId);
      if (options.enabled !== undefined) params.append('enabled', options.enabled.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());

      const endpoint = params.toString() ? `/api/v1/data-alerts?${params.toString()}` : '/api/v1/data-alerts';
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      
      return {
        success: true,
        alerts: response.data || response,
        total: response.meta?.totalItems || (response.data ? response.data.length : 0)
      };
    } catch (error) {
      log.debug('[AlertService] Error listing alerts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to list alerts: ${errorMessage}`);
    }
  }

  /**
   * Get specific alert details
   */
  async getAlert(alertId: string): Promise<any> {
    try {
      const response = await this.apiClient.makeRequest(`/api/v1/data-alerts/${alertId}`, 'GET');
      return response;
    } catch (error) {
      log.debug('[AlertService] Error getting alert:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to get alert: ${errorMessage}`);
    }
  }

  /**
   * Trigger alert manually
   */
  async triggerAlert(alertId: string): Promise<any> {
    try {
      const response = await this.apiClient.makeRequest('/api/v1/data-alerts/actions/trigger', 'POST', {
        alertIds: [alertId]
      });
      
      return {
        success: true,
        alertId,
        executionId: response.executionId,
        message: 'Alert triggered successfully'
      };
    } catch (error) {
      log.debug('[AlertService] Error triggering alert:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to trigger alert: ${errorMessage}`);
    }
  }

  /**
   * Get alert execution history
   */
  async getAlertExecutions(alertId: string, limit: number = 20): Promise<any> {
    try {
      const response = await this.apiClient.makeRequest(`/api/v1/data-alerts/${alertId}/executions?limit=${limit}`, 'GET');
      
      return {
        success: true,
        executions: response.data || response,
        total: response.meta?.totalItems
      };
    } catch (error) {
      log.debug('[AlertService] Error getting alert executions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to get alert executions: ${errorMessage}`);
    }
  }

  /**
   * Update alert recipients
   */
  async updateAlertRecipients(alertId: string, operations: any[]): Promise<any> {
    try {
      // Use custom PATCH implementation since ApiClient doesn't support PATCH directly
      const url = `${(this.apiClient as any).config.tenantUrl}/data-alerts/${alertId}/recipients`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${(this.apiClient as any).config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(operations)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update recipients: ${response.status} - ${errorText}`);
      }
      
      return {
        success: true,
        alertId,
        message: 'Recipients updated successfully'
      };
    } catch (error) {
      log.debug('[AlertService] Error updating recipients:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to update recipients: ${errorMessage}`);
    }
  }

  /**
   * Get alert settings for tenant
   */
  async getAlertSettings(): Promise<any> {
    try {
      const response = await this.apiClient.makeRequest('/api/v1/data-alerts/settings', 'GET');
      return response;
    } catch (error) {
      log.debug('[AlertService] Error getting alert settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to get alert settings: ${errorMessage}`);
    }
  }

  /**
   * Enable/disable data alerting for tenant
   */
  async updateAlertSettings(enableDataAlerting: boolean): Promise<any> {
    try {
      await this.apiClient.makeRequest('/api/v1/data-alerts/settings', 'PUT', {
        'enable-data-alerting': enableDataAlerting
      });
      
      return {
        success: true,
        message: `Data alerting ${enableDataAlerting ? 'enabled' : 'disabled'} for tenant`
      };
    } catch (error) {
      log.debug('[AlertService] Error updating alert settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to update alert settings: ${errorMessage}`);
    }
  }

  // Helper Methods

  /**
   * Create a condition for the alert
   */
 private async createCondition(conditionRequest: AlertCondition): Promise<ConditionResponse> {
  // Based on the API response, it seems the condition structure should be different
  // The API is expecting the condition data in a specific format
  const conditionPayload = {
    type: 'data',
    dataCondition: {
      conditionBase: {
        type: 'data',
        appId: conditionRequest.appId,
        description: 'Condition created from alert prompt',
        lastReloadTime: new Date().toISOString()
      },
      // The API seems to want these in conditionData with a specific structure
      conditionData: {
        qHyperCubeDef: {
          qMeasures: conditionRequest.measures.map(m => ({
            qDef: {
              qDef: m.title  // This might need to be the measure expression
            }
          })),
          qDimensions: conditionRequest.dimensions?.map(d => ({
            qDef: {
              qFieldDefs: [d.field]
            }
          })) || []
        },
        condition: {
          operand: conditionRequest.operand || 'lessThan',
          threshold: conditionRequest.threshold || 100,
          ...(conditionRequest.thresholdMax && { thresholdMax: conditionRequest.thresholdMax })
        }
      }
    }
  };

  log.debug('[AlertService] Creating condition with payload:', JSON.stringify(conditionPayload, null, 2));
  const response = await this.apiClient.makeRequest('/api/v1/conditions', 'POST', conditionPayload);
  return response as ConditionResponse;
}

  /**
   * Parse natural language prompt into alert request
   */
  private parseAlertPrompt(prompt: string, appId: string): AlertRequest {
    const promptLower = prompt.toLowerCase();
    
    // Extract alert name - improved regex to handle quoted names better
    let alertName = 'Data Alert'; // default
    
    // Try to find quoted alert name first - look for "Name it" or similar patterns
    const nameItMatch = prompt.match(/name\s+it\s+"([^"]+)"/i);
    if (nameItMatch) {
      alertName = nameItMatch[1];
    } else {
      // Try to find other quoted alert name patterns
      const quotedNameMatch = prompt.match(/(?:alert\s+)?(?:called|named)\s+"([^"]+)"/i);
      if (quotedNameMatch) {
        alertName = quotedNameMatch[1];
      } else {
        // Try to find unquoted alert name
        const unquotedNameMatch = prompt.match(/(?:create\s+an?\s+alert\s+called|alert\s+called|create.*alert.*called)\s+([^"]+?)(?:\s+that|\s+when|,|\.)/i);
        if (unquotedNameMatch) {
          alertName = unquotedNameMatch[1].trim();
        }
      }
    }

    log.debug('[AlertService] Parsed alert name:', alertName);

    // Extract trigger type
    let triggerType: 'RELOAD' | 'SCHEDULED' | 'MANUAL' = 'RELOAD';
    if (promptLower.includes('schedule') || promptLower.includes('daily') || promptLower.includes('hourly') || promptLower.includes('weekly') || promptLower.includes('every day') || promptLower.includes('check every day')) {
      triggerType = 'SCHEDULED';
    } else if (promptLower.includes('manual') || promptLower.includes('trigger manually')) {
      triggerType = 'MANUAL';
    }

    // Extract measure/metric information
    const measures = this.extractMeasures(prompt); // Use original prompt, not lowercase
    
    // Extract threshold and operand
    const { operand, threshold, thresholdMax } = this.extractThreshold(prompt); // Use original prompt
    
    // Extract recipients
    const recipients = this.extractRecipients(promptLower);
    
    // Extract schedule if needed
    let scheduleOptions: ScheduleOptions | undefined;
    if (triggerType === 'SCHEDULED') {
      scheduleOptions = this.extractSchedule(promptLower);
    }

    // Extract throttling if mentioned
    let throttling: ThrottlingResource | undefined;
    if (promptLower.includes('throttle') || promptLower.includes('limit')) {
      throttling = this.extractThrottling(promptLower);
    }

    log.debug('[AlertService] Parsed request:', {
      name: alertName,
      triggerType,
      measures,
      operand,
      threshold,
      recipients
    });

    return {
      name: alertName,
      description: `Alert created from prompt: ${prompt}`,
      appId,
      enabled: true,
      triggerType,
      recipients,
      condition: {
        type: 'data',
        appId,
        measures,
        operand,
        threshold,
        thresholdMax
      },
      scheduleOptions,
      throttling
    };
  }

  /**
   * Extract measures from prompt
   */
  private extractMeasures(prompt: string): ConditionMeasure[] {
    const measures: ConditionMeasure[] = [];
    
    // Look for specific measure names in parentheses - like "Revenue (TRY)"
    const measureInParensMatch = prompt.match(/(\w+)\s*\([^)]+\)/g);
    if (measureInParensMatch) {
      measureInParensMatch.forEach(match => {
        const measureName = match.split('(')[0].trim();
        if (!measures.find(m => m.title.toLowerCase() === measureName.toLowerCase())) {
          measures.push({
            title: measureName
          });
        }
      });
    }
    
    // If no parentheses measures found, look for common measure keywords
    if (measures.length === 0) {
      const measurePatterns = [
        { regex: /\brevenue\b/gi, name: 'Revenue' },
        { regex: /\bsales\b/gi, name: 'Sales' },
        { regex: /\bprofit\b/gi, name: 'Profit' },
        { regex: /\bincome\b/gi, name: 'Income' },
        { regex: /\bearnings\b/gi, name: 'Earnings' }
      ];

      measurePatterns.forEach(({ regex, name }) => {
        if (regex.test(prompt) && !measures.find(m => m.title.toLowerCase() === name.toLowerCase())) {
          measures.push({ title: name });
        }
      });
    }

    // Default measure if none found
    if (measures.length === 0) {
      measures.push({ title: 'Sales' });
    }

    log.debug('[AlertService] Parsed measures:', measures);
    return measures;
  }

  /**
   * Extract threshold and comparison operand
   */
  private extractThreshold(prompt: string): { operand: 'greaterThan' | 'lessThan' | 'equal' | 'between'; threshold?: number; thresholdMax?: number } {
    let operand: 'greaterThan' | 'lessThan' | 'equal' | 'between' = 'greaterThan';
    let threshold: number | undefined;
    let thresholdMax: number | undefined;

    // Extract operand
    if (prompt.includes('greater than') || prompt.includes('more than') || prompt.includes('above') || prompt.includes('exceeds') || prompt.includes('>')) {
      operand = 'greaterThan';
    } else if (prompt.includes('less than') || prompt.includes('below') || prompt.includes('under') || prompt.includes('drops below') || prompt.includes('falls below') || prompt.includes('<')) {
      operand = 'lessThan';
    } else if (prompt.includes('equal to') || prompt.includes('equals') || prompt.includes('=')) {
      operand = 'equal';
    } else if (prompt.includes('between')) {
      operand = 'between';
    }

    // Extract threshold values - handle commas in numbers
    const numberPattern = /([\d,]+(?:\.\d+)?)/g;
    const numbers = prompt.match(numberPattern);
    
    if (numbers) {
      // Remove commas and convert to number
      const cleanNumbers = numbers.map(n => parseFloat(n.replace(/,/g, '')));
      threshold = cleanNumbers[0];
      
      if (operand === 'between' && cleanNumbers.length > 1) {
        thresholdMax = cleanNumbers[1];
      }
    }

    log.debug('[AlertService] Parsed threshold:', { operand, threshold, thresholdMax });
    return { operand, threshold, thresholdMax };
  }

  /**
   * Extract recipients from prompt
   */
  private extractRecipients(prompt: string): Recipients {
    const recipients: Recipients = {
      userIds: []
    };

    // Look for email patterns
    const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const emails = prompt.match(emailPattern);
    
    if (emails) {
      emails.forEach(email => {
        recipients.userIds.push({
          value: email,
          enabled: true,
          subscribed: true,
          groups: ['addedIndividually']
        });
      });
    }

    // Look for team mentions with better context
    const teamPatterns = [
      { regex: /finance\s+team/i, id: 'finance-team' },
      { regex: /revenue\s+managers?/i, id: 'revenue-managers' },
      { regex: /sales\s+team/i, id: 'sales-team' },
      { regex: /management\s+team/i, id: 'management-team' },
      { regex: /admin\s+team/i, id: 'admin-team' }
    ];

    teamPatterns.forEach(({ regex, id }) => {
      if (regex.test(prompt)) {
        recipients.userIds.push({
          value: id,
          enabled: true,
          subscribed: true,
          groups: ['addedIndividually']
        });
      }
    });

    // Look for explicit user mentions but be more careful about context
    // Only match if the word after "send to" or "notify" looks like a user/email
    const explicitUserPattern = /(?:notify|send\s+(?:notifications\s+)?to)\s+([\w@.-]+@[\w.-]+|[A-Z][\w.-]+)/gi;
    let userMatch;
    while ((userMatch = explicitUserPattern.exec(prompt)) !== null) {
      const userValue = userMatch[1];
      // Only add if it looks like a username, email, or proper noun
      if (userValue.includes('@') || /^[A-Z]/.test(userValue)) {
        recipients.userIds.push({
          value: userValue,
          enabled: true,
          subscribed: true,
          groups: ['addedIndividually']
        });
      }
    }

    // Default recipient if none found and it's a notification request
    if (recipients.userIds.length === 0) {
      if (prompt.includes('notify') || prompt.includes('notification') || prompt.includes('email') || prompt.includes('send')) {
        recipients.userIds.push({
          value: 'default-notification-recipient',
          enabled: true,
          subscribed: true,
          groups: ['addedIndividually']
        });
      } else {
        recipients.userIds.push({
          value: 'default-user-id',
          enabled: true,
          subscribed: true,
          groups: ['addedIndividually']
        });
      }
    }

    log.debug('[AlertService] Parsed recipients:', recipients);
    return recipients;
  }

  /**
   * Extract schedule from prompt
   */
  private extractSchedule(prompt: string): ScheduleOptions {
    let recurrence = ['RRULE:FREQ=DAILY;INTERVAL=1']; // Default daily
    let startDateTime = new Date().toISOString().split('T')[0] + 'T09:00:00'; // Default 9 AM
    
    // Look for specific times
    const timeMatch = prompt.match(/(\d{1,2})\s*(?::|am|pm)/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const adjustedHour = hour <= 12 ? hour.toString().padStart(2, '0') : hour.toString();
      startDateTime = new Date().toISOString().split('T')[0] + `T${adjustedHour}:00:00`;
    }

    // Look for frequency patterns
    if (prompt.includes('hourly')) {
      recurrence = ['RRULE:FREQ=HOURLY;INTERVAL=1'];
    } else if (prompt.includes('weekly')) {
      recurrence = ['RRULE:FREQ=WEEKLY;INTERVAL=1'];
    } else if (prompt.includes('monthly')) {
      recurrence = ['RRULE:FREQ=MONTHLY;INTERVAL=1'];
    } else if (prompt.includes('daily') || prompt.includes('every day')) {
      recurrence = ['RRULE:FREQ=DAILY;INTERVAL=1'];
    }

    return {
      timezone: 'UTC',
      recurrence,
      startDateTime
    };
  }

  /**
   * Extract throttling configuration
   */
  private extractThrottling(prompt: string): ThrottlingResource {
    return {
      capacity: 10,
      replenishRate: 1,
      recurrenceRule: 'RRULE:FREQ=HOURLY;INTERVAL=1',
      initialTokenCount: 10,  
      referenceTimestamp: new Date().toISOString()
    };
  }

  /**
   * Parse update prompt
   */
  private parseUpdatePrompt(prompt: string): AlertUpdate {
    const updates: AlertUpdate = {};
    const promptLower = prompt.toLowerCase();

    // Check for name changes
    const nameMatch = promptLower.match(/(?:rename|change name|name)\s+(?:to\s+)?"([^"]+)"/);
    if (nameMatch) {
      updates.name = nameMatch[1];
    }

    // Check for enable/disable
    if (promptLower.includes('enable') || promptLower.includes('activate') || promptLower.includes('turn on')) {
      updates.enabled = true;
    } else if (promptLower.includes('disable') || promptLower.includes('deactivate') || promptLower.includes('turn off')) {
      updates.enabled = false;
    }

    // Check for description changes
    const descMatch = promptLower.match(/(?:description|desc)\s+(?:to\s+)?"([^"]+)"/);
    if (descMatch) {
      updates.description = descMatch[1];
    }

    return updates;
  }

  /**
   * Get alert analytics and insights
   */
  async getAlertAnalytics(): Promise<any> {
    try {
      const alerts = await this.listAlerts();
      const settings = await this.getAlertSettings();

      const analytics = {
        totalAlerts: alerts.total,
        enabledAlerts: alerts.alerts.filter((a: any) => a.enabled).length,
        disabledAlerts: alerts.alerts.filter((a: any) => !a.enabled).length,
        byTriggerType: {
          reload: alerts.alerts.filter((a: any) => a.triggerType === 'RELOAD').length,
          scheduled: alerts.alerts.filter((a: any) => a.triggerType === 'SCHEDULED').length,
          manual: alerts.alerts.filter((a: any) => a.triggerType === 'MANUAL').length
        },
        settings
      };

      return {
        success: true,
        analytics
      };
    } catch (error) {
      log.debug('[AlertService] Error getting alert analytics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw error;
    }
  }
}

// Export types
export {
  AlertRequest,
  AlertUpdate,
  AlertCondition,
  Recipients,
  ThrottlingResource,
  ScheduleOptions
};