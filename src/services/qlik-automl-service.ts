// qlik-automl-service.ts - Complete AutoML Service with ALL ML APIs

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { DataCatalogService } from './data-catalog-service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'AutoML' });

// ===== COMPREHENSIVE TYPES AND INTERFACES =====

// Core Types
export interface ProfileInsightsRequest {
  dataSetId: string;
  target?: string;
  experimentType?: 'binary' | 'multiclass' | 'regression' | 'timeseries';
  shouldWait?: boolean;
}

export interface FeatureInsight {
  name: string;
  insights: string[];
  willBeDropped: boolean;
  cannotBeTarget: boolean;
  experimentTypes: string[];
  defaultFeatureType?: 'categorical' | 'numeric' | 'date' | 'freetext';
}

export interface ProfileInsightsResponse {
  id: string;
  status: 'pending' | 'error' | 'ready';
  insights?: FeatureInsight[];
  algorithms?: string[];
  defaultVersionConfig?: any;
}

// Experiment Types
export interface Experiment {
  id: string;
  name: string;
  ownerId: string;
  spaceId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface ExperimentVersion {
  id: string;
  name: string;
  status: string;
  target: string;
  experimentId: string;
  experimentType: string;
  experimentMode: string;
  versionNumber: number;
  topModelId?: string;
  algorithms: string[];
  createdAt: string;
  updatedAt: string;
}

// Model Types
export interface Model {
  id: string;
  name: string;
  status: string;
  algorithm: string;
  metrics: any;
  experimentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelApproval {
  modelId: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  comment?: string;
}

// Deployment Types
export interface Deployment {
  id: string;
  name: string;
  modelId: string;
  spaceId: string;
  enablePredictions: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  status?: string;
}

export interface DeploymentAlias {
  id: string;
  name: string;
  description?: string;
  deploymentId: string;
  createdAt: string;
  updatedAt: string;
}

// Prediction Types
export interface RealtimePredictionRequest {
  deploymentId: string;
  rows: any[][];
  schema: Array<{ name: string }>;
  includeShap?: boolean;
  includeSource?: boolean;
}

export interface BatchPredictionConfig {
  deploymentId: string;
  name: string;
  dataSetId: string;
  description?: string;
  indexColumn?: string;
  writeback: {
    format: 'parquet' | 'qvd' | 'csv';
    dstName: string;
    spaceId: string;
    dstShapName?: string;
    dstCoordShapName?: string;
    dstNotPredictedName?: string;
    dstSourceName?: string;
  };
  schedule?: BatchPredictionSchedule;
  applyDatasetChangeOnly?: boolean;
}

export interface BatchPredictionSchedule {
  timezone: string;
  startDateTime: string;
  endDateTime?: string;
  recurrence?: string[];
  applyDatasetChangeOnly?: boolean;
}

export interface BatchPrediction {
  id: string;
  name: string;
  deploymentId: string;
  dataSetId: string;
  status: 'modified' | 'ready' | 'error' | 'cancelled' | 'pending';
  createdAt: string;
  updatedAt: string;
  writeback: any;
  schedule?: BatchPredictionSchedule;
}

export interface PredictionJob {
  id: string;
  status: string;
  createdAt: string;
  startTime?: string;
  endTime?: string;
  progress?: number;
  error?: string;
}

// Monitoring Types
export interface ModelMonitoring {
  deploymentId: string;
  modelId: string;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    drift?: number;
  };
  lastChecked: string;
  alerts?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    timestamp: string;
  }>;
}

// Claude AI Integration Types
export interface ClaudeAnalysisRequest {
  experimentResults: any;
  modelMetrics: any;
  dataProfile: any;
  currentFeatures: string[];
}

export interface ClaudeRecommendation {
  shouldContinue: boolean;
  suggestedFeatures?: string[];
  featureEngineering?: {
    type: string;
    expression: string;
    rationale: string;
  }[];
  modelRecommendations?: {
    algorithm?: string;
    hyperparameters?: any;
    rationale?: string;
  };
}

// ===== MAIN SERVICE CLASS =====

export class QlikAutoMLService {
  private apiClient: ApiClient;
  private cacheManager: CacheManager;
  private catalogService?: DataCatalogService;

  constructor(apiClient: ApiClient, catalogService?: DataCatalogService) {
    this.apiClient = apiClient;
    this.cacheManager = new CacheManager();
    this.catalogService = catalogService;
  }

  // ===== PROFILE INSIGHTS =====
  // helper function to convert dataset ID to ML resource ID
  private async convertToMLResourceId(datasetId: string): Promise<{
  mlResourceId: string;
  datasetInfo?: any;
}> {
  log.debug(` Converting dataset ID: ${datasetId}`);
  
  // If we have catalog service, always try to get dataset details first
  if (this.catalogService) {
    try {
      const datasetInfo = await this.catalogService.getDatasetDetails(datasetId);
      
      // The ML resource ID is in the 'datasetId' field
      const mlResourceId = datasetInfo.datasetId || datasetInfo.resourceId;
      
      if (mlResourceId && mlResourceId !== datasetId) {
        log.debug(` Converted ${datasetId} to ML resource ID: ${mlResourceId}`);
        return { 
          mlResourceId, 
          datasetInfo 
        };
      }
      
      // If the IDs match or no different ID found, use the original
      log.debug(` Using original ID as ML resource ID: ${datasetId}`);
      return { 
        mlResourceId: datasetId, 
        datasetInfo 
      };
    } catch (error) {
      log.debug(` Could not fetch dataset details:`, error);
      // Fall through to length-based detection
    }
  }
  
  // Fallback: Check by length
  if (datasetId.length === 24) {
    log.debug(` Appears to be ML resource ID (24 chars): ${datasetId}`);
    return { mlResourceId: datasetId };
  }
  
  if (datasetId.length === 36) {
    log.debug(` Appears to be item ID (36 chars), but no catalog service available`);
    throw new Error(
      `Cannot convert item ID ${datasetId} to ML resource ID without catalog service. ` +
      `Please use the dataset's resourceId instead.`
    );
  }
  
  // Unknown format, return as-is
  log.debug(` Unknown ID format (${datasetId.length} chars), using as-is`);
  return { mlResourceId: datasetId };
}

async createProfileInsights(request: ProfileInsightsRequest): Promise<ProfileInsightsResponse> {
  log.debug(` Creating profile insights for dataset: ${request.dataSetId}`);
  
  // Convert to ML resource ID if needed
  const { mlResourceId, datasetInfo } = await this.convertToMLResourceId(request.dataSetId);
  
  log.debug(` Using ML resource ID: ${mlResourceId}`);
  if (datasetInfo) {
    log.debug(` Dataset name: ${datasetInfo.name || 'Unknown'}`);
    log.debug(` Dataset rows: ${datasetInfo.rowCount || 'Unknown'}`);
  }
  
  const endpoint = '/ml/profile-insights';
  
  // IMPORTANT: Do NOT include target in the initial profile insights request
  // The target is specified later when creating the experiment version
  const body = {
    data: {
      type: 'profile-insights',
      attributes: {
        dataSetId: mlResourceId
        // NO target or experimentType here for initial profiling
      }
    }
  };
  
  log.debug(` Request body:`, JSON.stringify(body, null, 2));

  try {
    const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
    
    // Handle async response (202 Accepted)
    if (response.data?.id && request.shouldWait !== false) {
      const profileId = response.data.id;
      log.debug(` Profile insights creation started, ID: ${profileId}`);
      log.debug(` Waiting for completion...`);
      return await this.waitForProfileInsights(profileId);
    }
    
    return this.normalizeProfileInsights(response);
  } catch (error: any) {
    log.debug('[ Profile insights error details:', error);
    
    if (error.message?.includes('404') || error.message?.includes('No record of data set')) {
      throw new Error(
        `Dataset not found with ML resource ID: ${mlResourceId}. ` +
        `Original ID: ${request.dataSetId}. ` +
        `This might mean: 1) The dataset doesn't exist, 2) You don't have access, ` +
        `3) The dataset is not available for ML operations.`
      );
    }
    
    throw error;
  }
}

 private async waitForProfileInsights(profileId: string): Promise<ProfileInsightsResponse> {
  const maxWaitTime = 60000; // 60 seconds
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();
  
  log.debug(` Polling for profile insights completion...`);
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // GET endpoint uses the profile ID as the path parameter
      const response = await this.apiClient.makeRequest(
        `/ml/profile-insights/${profileId}`,
        'GET'
      );
      
      const status = response.data?.attributes?.status;
      log.debug(` Profile status: ${status}`);
      
      if (status === 'ready' || status === 'completed') {
        log.debug(` Profile insights completed successfully`);
        return this.normalizeProfileInsights(response);
      }
      
      if (status === 'failed' || status === 'error') {
        const errorMsg = response.data?.attributes?.errorMessage || 'Unknown error';
        throw new Error(`Profile insights failed: ${errorMsg}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      // If it's a known error, throw it
      if (error.message?.includes('Profile insights failed')) {
        throw error;
      }
      // For other errors, log and continue polling
      log.debug(` Poll error (will retry):`, error.message);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error('Timeout waiting for profile insights to complete');
}

  async getProfileInsights(profileId: string): Promise<ProfileInsightsResponse> {
    const endpoint = `/ml/profile-insights/${profileId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeProfileInsights(response);
    } catch (error) {
      log.debug('[ Failed to get profile insights:', error);
      throw error;
    }
  }

  // ===== EXPERIMENTS =====

  async createExperiment(config: {
    name: string;
    spaceId?: string;
    description?: string;
  }): Promise<Experiment> {
    log.debug(` Creating experiment: ${config.name}`);
    
    const endpoint = '/ml/experiments';
    
    const body = {
      data: {
        type: 'experiment',
        attributes: {
          name: config.name,
          spaceId: config.spaceId,
          description: config.description
        }
      }
    };

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
      return this.normalizeExperiment(response);
    } catch (error) {
      log.debug('[ Failed to create experiment:', error);
      throw error;
    }
  }

  async getExperiment(experimentId: string): Promise<Experiment> {
    const endpoint = `/ml/experiments/${experimentId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeExperiment(response);
    } catch (error) {
      log.debug('[ Failed to get experiment:', error);
      throw error;
    }
  }

  async listExperiments(options?: {
    spaceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ experiments: Experiment[]; total: number }> {
    const endpoint = '/ml/experiments';
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    try {
      const response = await this.apiClient.makeRequest(
        params.toString() ? `${endpoint}?${params}` : endpoint,
        'GET'
      );
      
      let experiments = response.data || [];
      if (options?.spaceId) {
        experiments = experiments.filter((exp: any) => 
          exp.attributes?.spaceId === options.spaceId
        );
      }
      
      return {
        experiments: experiments.map((exp: any) => this.normalizeExperiment({ data: exp })),
        total: response.meta?.total || experiments.length
      };
    } catch (error) {
      log.debug('[ Failed to list experiments:', error);
      throw error;
    }
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    const endpoint = `/ml/experiments/${experimentId}`;
    
    try {
      await this.apiClient.makeRequest(endpoint, 'DELETE');
      log.debug(` Deleted experiment: ${experimentId}`);
    } catch (error) {
      log.debug('[ Failed to delete experiment:', error);
      throw error;
    }
  }

  // ===== EXPERIMENT VERSIONS =====

  async createExperimentVersion(
    experimentId: string,
    config: any
  ): Promise<ExperimentVersion> {
    log.debug(` Creating experiment version for training`);
    
    const endpoint = `/ml/experiments/${experimentId}/versions`;
    
    const body = {
      data: {
        type: 'experiment-version',
        attributes: config
      }
    };

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
      return this.normalizeExperimentVersion(response);
    } catch (error) {
      log.debug('[ Failed to create experiment version:', error);
      throw error;
    }
  }

  async getExperimentVersion(
    experimentId: string,
    versionId: string
  ): Promise<ExperimentVersion> {
    const endpoint = `/ml/experiments/${experimentId}/versions/${versionId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeExperimentVersion(response);
    } catch (error) {
      log.debug('[ Failed to get experiment version:', error);
      throw error;
    }
  }

  async listExperimentVersions(
    experimentId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ versions: ExperimentVersion[]; total: number }> {
    const endpoint = `/ml/experiments/${experimentId}/versions`;
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    try {
      const response = await this.apiClient.makeRequest(
        params.toString() ? `${endpoint}?${params}` : endpoint,
        'GET'
      );
      
      return {
        versions: response.data?.map((v: any) => this.normalizeExperimentVersion({ data: v })) || [],
        total: response.meta?.total || response.data?.length || 0
      };
    } catch (error) {
      log.debug('[ Failed to list experiment versions:', error);
      throw error;
    }
  }

  async waitForTraining(
    experimentId: string,
    versionId: string,
    maxWaitTimeMs: number = 3600000,
    intervalMs: number = 10000
  ): Promise<ExperimentVersion> {
    const startTime = Date.now();
    let lastStatus = '';
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      const version = await this.getExperimentVersion(experimentId, versionId);
      
      if (version.status !== lastStatus) {
        log.debug(` Training status: ${version.status}`);
        lastStatus = version.status;
      }
      
      if (version.status === 'ready') {
        return version;
      } else if (version.status === 'error' || version.status === 'cancelled') {
        throw new Error(`Training failed with status: ${version.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error('Training timed out');
  }

  // ===== MODELS =====

  async getModels(
    experimentId: string,
    options?: {
      versionId?: string;
      algorithm?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Model[]> {
    const endpoint = `/ml/experiments/${experimentId}/models`;
    const params = new URLSearchParams();
    
    if (options?.versionId) params.append('filter', `experimentVersionId:${options.versionId}`);
    if (options?.algorithm) params.append('filter', `algorithm:${options.algorithm}`);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    try {
      const response = await this.apiClient.makeRequest(
        params.toString() ? `${endpoint}?${params}` : endpoint,
        'GET'
      );
      
      return response.data?.map((model: any) => this.normalizeModel({ data: model })) || [];
    } catch (error) {
      log.debug('[ Failed to get models:', error);
      throw error;
    }
  }

  async getModel(
    experimentId: string,
    modelId: string
  ): Promise<Model> {
    const endpoint = `/ml/experiments/${experimentId}/models/${modelId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeModel(response);
    } catch (error) {
      log.debug('[ Failed to get model:', error);
      throw error;
    }
  }

  async getModelRecommendations(
    experimentId: string
  ): Promise<{
    bestModel?: Model;
    fastestModel?: Model;
    mostAccurateModel?: Model;
  }> {
    const endpoint = `/ml/experiments/${experimentId}/actions/recommend-models`;

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST');
      
      return {
        bestModel: response.data?.attributes?.bestModel,
        fastestModel: response.data?.attributes?.fastestModel,
        mostAccurateModel: response.data?.attributes?.mostAccurateModel
      };
    } catch (error) {
      log.debug('[ Failed to get model recommendations:', error);
      throw error;
    }
  } 

// ===== MODEL ACTIVATION/DEACTIVATION ===== 

async activateModels(deploymentId: string): Promise<void> {
  log.debug(` Activating models for deployment: ${deploymentId}`);
  
  const endpoint = `/ml/deployments/${deploymentId}/actions/activate-models`;
  
  try {
    // Make the request but don't expect JSON response (204 No Content)
    const response = await fetch(
      `${(this.apiClient as any).config.tenantUrl}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(this.apiClient as any).config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to activate models: ${response.status} - ${errorText}`);
    }
    
    // 204 No Content is success
    if (response.status === 204) {
      log.debug(` Models activated successfully for deployment: ${deploymentId}`);
      return;
    }
    
    // If we get here with 200/201, try to parse response
    if (response.status === 200 || response.status === 201) {
      const data = await response.json();
      log.debug(` Models activated successfully:`, data);
    }
  } catch (error) {
    log.debug('[ Failed to activate models:', error);
    throw error;
  }
}

async deactivateModels(deploymentId: string): Promise<void> {
  log.debug(` Deactivating models for deployment: ${deploymentId}`);
  
  const endpoint = `/ml/deployments/${deploymentId}/actions/deactivate-models`;
  
  try {
    // Make the request but don't expect JSON response (204 No Content)
    const response = await fetch(
      `${(this.apiClient as any).config.tenantUrl}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(this.apiClient as any).config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to deactivate models: ${response.status} - ${errorText}`);
    }
    
    // 204 No Content is success
    if (response.status === 204) {
      log.debug(` Models deactivated successfully for deployment: ${deploymentId}`);
      return;
    }
    
    // If we get here with 200/201, try to parse response
    if (response.status === 200 || response.status === 201) {
      const data = await response.json();
      log.debug(` Models deactivated successfully:`, data);
    }
  } catch (error) {
    log.debug('[ Failed to deactivate models:', error);
    throw error;
  }
}

 
  // ===== MODEL APPROVAL =====

  async approveModel(
    experimentId: string,
    modelId: string,
    comment?: string
  ): Promise<ModelApproval> {
    const endpoint = `/ml/experiments/${experimentId}/models/${modelId}/actions/approve`;
    
    const body = comment ? { comment } : {};

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
      return {
        modelId,
        isApproved: true,
        approvedAt: new Date().toISOString(),
        comment
      };
    } catch (error) {
      log.debug('[ Failed to approve model:', error);
      throw error;
    }
  }

  async disapproveModel(
    experimentId: string,
    modelId: string,
    comment?: string
  ): Promise<ModelApproval> {
    const endpoint = `/ml/experiments/${experimentId}/models/${modelId}/actions/disapprove`;
    
    const body = comment ? { comment } : {};

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
      return {
        modelId,
        isApproved: false,
        comment
      };
    } catch (error) {
      log.debug('[ Failed to disapprove model:', error);
      throw error;
    }
  }

  // ===== DEPLOYMENTS =====

  async deployModel(config: {
    modelId: string;
    name: string;
    spaceId?: string;
    description?: string;
    enablePredictions?: boolean;
  }): Promise<Deployment> {
    log.debug(` Deploying model: ${config.modelId}`);
    
    const endpoint = '/ml/deployments';
    
    const body = {
      data: {
        type: 'deployment',
        attributes: {
          modelId: config.modelId,
          name: config.name,
          spaceId: config.spaceId,
          description: config.description,
          enablePredictions: config.enablePredictions !== false
        }
      }
    };

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
      return this.normalizeDeployment(response);
    } catch (error) {
      log.debug('[ Failed to deploy model:', error);
      throw error;
    }
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    const endpoint = `/ml/deployments/${deploymentId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeDeployment(response);
    } catch (error) {
      log.debug('[ Failed to get deployment:', error);
      throw error;
    }
  }

  async listDeployments(options?: {
    spaceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ deployments: Deployment[]; total: number }> {
    const endpoint = '/ml/deployments';
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    try {
      const response = await this.apiClient.makeRequest(
        params.toString() ? `${endpoint}?${params}` : endpoint,
        'GET'
      );
      
      let deployments = response.data || [];
      if (options?.spaceId) {
        deployments = deployments.filter((dep: any) => 
          dep.attributes?.spaceId === options.spaceId
        );
      }
      
      return {
        deployments: deployments.map((dep: any) => this.normalizeDeployment({ data: dep })),
        total: response.meta?.total || deployments.length
      };
    } catch (error) {
      log.debug('[ Failed to list deployments:', error);
      throw error;
    }
  }

  async updateDeployment(
    deploymentId: string,
    updates: Array<{
      op: 'replace';
      path: string;
      value: any;
    }>
  ): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}`;
    
    try {
      // ML API uses PATCH for updates, but we'll use custom implementation
      // since base ApiClient doesn't support PATCH
      const url = `${(this.apiClient as any).config.tenantUrl}${endpoint}`;
      
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
        throw new Error(`Failed to update deployment: ${response.status} - ${errorText}`);
      }
      
      log.debug(` Updated deployment: ${deploymentId}`);
    } catch (error) {
      log.debug('[ Failed to update deployment:', error);
      throw error;
    }
  }

  async deleteDeployment(deploymentId: string): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}`;
    
    try {
      await this.apiClient.makeRequest(endpoint, 'DELETE');
      log.debug(` Deleted deployment: ${deploymentId}`);
    } catch (error) {
      log.debug('[ Failed to delete deployment:', error);
      throw error;
    }
  }

  // ===== ALIASES =====

  async createAlias(
    deploymentId: string,
    config: {
      name: string;
      description?: string;
    }
  ): Promise<DeploymentAlias> {
    const endpoint = `/ml/deployments/${deploymentId}/aliases`;
    
    const body = {
      data: {
        type: 'alias',
        attributes: {
          name: config.name,
          description: config.description
        }
      }
    };

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
      return this.normalizeAlias(response);
    } catch (error) {
      log.debug('[ Failed to create alias:', error);
      throw error;
    }
  }

  async getAlias(
    deploymentId: string,
    aliasId: string
  ): Promise<DeploymentAlias> {
    const endpoint = `/ml/deployments/${deploymentId}/aliases/${aliasId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeAlias(response);
    } catch (error) {
      log.debug('[ Failed to get alias:', error);
      throw error;
    }
  }

  async listAliases(
    deploymentId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ aliases: DeploymentAlias[]; total: number }> {
    const endpoint = `/ml/deployments/${deploymentId}/aliases`;
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    try {
      const response = await this.apiClient.makeRequest(
        params.toString() ? `${endpoint}?${params}` : endpoint,
        'GET'
      );
      
      return {
        aliases: response.data?.map((alias: any) => this.normalizeAlias({ data: alias })) || [],
        total: response.meta?.total || response.data?.length || 0
      };
    } catch (error) {
      log.debug('[ Failed to list aliases:', error);
      throw error;
    }
  }

  async deleteAlias(
    deploymentId: string,
    aliasId: string
  ): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}/aliases/${aliasId}`;
    
    try {
      await this.apiClient.makeRequest(endpoint, 'DELETE');
      log.debug(` Deleted alias: ${aliasId}`);
    } catch (error) {
      log.debug('[ Failed to delete alias:', error);
      throw error;
    }
  }

  // ===== REAL-TIME PREDICTIONS =====

  async predictRealtime(request: RealtimePredictionRequest): Promise<any> {
    log.debug(` Making real-time predictions`);
    
    const endpoint = `/ml/deployments/${request.deploymentId}/realtime-predictions/actions/run`;
    const params = new URLSearchParams();
    
    if (request.includeShap) params.append('includeShap', 'true');
    if (request.includeSource) params.append('includeSource', 'true');
    
    const url = params.toString() ? `${endpoint}?${params}` : endpoint;
    
    try {
      const response = await this.apiClient.makeRequest(url, 'POST', {
        rows: request.rows,
        schema: request.schema
      });
      
      return response.data?.attributes || response;
    } catch (error) {
      log.debug('[ Failed to make predictions:', error);
      throw error;
    }
  }

  async predictRealtimeWithAlias(
    deploymentId: string,
    aliasName: string,
    request: Omit<RealtimePredictionRequest, 'deploymentId'>
  ): Promise<any> {
    log.debug(` Making real-time predictions with alias: ${aliasName}`);
    
    const endpoint = `/ml/deployments/${deploymentId}/realtime-predictions/aliases/${aliasName}/actions/run`;
    const params = new URLSearchParams();
    
    if (request.includeShap) params.append('includeShap', 'true');
    if (request.includeSource) params.append('includeSource', 'true');
    
    const url = params.toString() ? `${endpoint}?${params}` : endpoint;
    
    try {
      const response = await this.apiClient.makeRequest(url, 'POST', {
        rows: request.rows,
        schema: request.schema
      });
      
      return response.data?.attributes || response;
    } catch (error) {
      log.debug('[ Failed to make predictions with alias:', error);
      throw error;
    }
  }

  // ===== BATCH PREDICTIONS =====
 

async createBatchPrediction(config: BatchPredictionConfig): Promise<BatchPrediction> {
  log.debug(` Creating batch prediction configuration`);
  
  // Convert dataset ID if needed
  const { mlResourceId } = await this.convertToMLResourceId(config.dataSetId);
  
  const endpoint = `/ml/deployments/${config.deploymentId}/batch-predictions`;
  
  // Build request body
  const body = {
    data: {
      type: 'batch-prediction',
      attributes: {
        name: config.name,
        deploymentId: config.deploymentId,  // Required by API
        dataSetId: mlResourceId,
        writeback: config.writeback
      } as any
    }
  };

  // Add optional fields only if they exist
  if (config.description) {
    body.data.attributes.description = config.description;
  }
  
  if (config.indexColumn) {
    body.data.attributes.indexColumn = config.indexColumn;
  }
  
  // Handle schedule with applyDatasetChangeOnly
  if (config.schedule) {
    body.data.attributes.schedule = config.schedule;
  }
  
  // DO NOT add applyDatasetChangeOnly as a direct attribute
  // It should only be part of the schedule object

  log.debug(` Request endpoint: ${endpoint}`);
  log.debug(` Request body:`, JSON.stringify(body, null, 2));

  try {
    const response = await this.apiClient.makeRequest(endpoint, 'POST', body);
    log.debug(` Batch prediction created successfully!`);
    return this.normalizeBatchPrediction(response);
  } catch (error) {
    log.debug('[ Failed to create batch prediction:', error);
    throw error;
  }
}

  async getBatchPrediction(
    deploymentId: string,
    batchPredictionId: string
  ): Promise<BatchPrediction> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return this.normalizeBatchPrediction(response);
    } catch (error) {
      log.debug('[ Failed to get batch prediction:', error);
      throw error;
    }
  }

  async listBatchPredictions(
    deploymentId: string,
    options?: {
      limit?: number;
      offset?: number;
      filter?: string;
      sort?: string;
    }
  ): Promise<{ batchPredictions: BatchPrediction[]; total: number }> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions`;
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.filter) params.append('filter', options.filter);
    if (options?.sort) params.append('sort', options.sort);

    try {
      const response = await this.apiClient.makeRequest(
        params.toString() ? `${endpoint}?${params}` : endpoint,
        'GET'
      );
      
      return {
        batchPredictions: response.data?.map((bp: any) => 
          this.normalizeBatchPrediction({ data: bp })
        ) || [],
        total: response.meta?.total || response.data?.length || 0
      };
    } catch (error) {
      log.debug('[ Failed to list batch predictions:', error);
      throw error;
    }
  }

  async updateBatchPrediction(
    deploymentId: string,
    batchPredictionId: string,
    updates: Array<{
      op: 'replace';
      path: string;
      value: any;
    }>
  ): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}`;
    
    try {
      // ML API uses PATCH for updates
      const url = `${(this.apiClient as any).config.tenantUrl}${endpoint}`;
      
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
        throw new Error(`Failed to update batch prediction: ${response.status} - ${errorText}`);
      }
      
      log.debug(` Updated batch prediction: ${batchPredictionId}`);
    } catch (error) {
      log.debug('[ Failed to update batch prediction:', error);
      throw error;
    }
  }

  async deleteBatchPrediction(
    deploymentId: string,
    batchPredictionId: string
  ): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}`;
    
    try {
      await this.apiClient.makeRequest(endpoint, 'DELETE');
      log.debug(` Deleted batch prediction: ${batchPredictionId}`);
    } catch (error) {
      log.debug('[ Failed to delete batch prediction:', error);
      throw error;
    }
  }

  async triggerBatchPrediction(
    deploymentId: string,
    batchPredictionId: string
  ): Promise<PredictionJob> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}/actions/predict`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'POST');
      return this.normalizePredictionJob(response);
    } catch (error) {
      log.debug('[ Failed to trigger batch prediction:', error);
      throw error;
    }
  }

  // ===== BATCH PREDICTION SCHEDULES =====

  async getBatchPredictionSchedule(
    deploymentId: string,
    batchPredictionId: string
  ): Promise<BatchPredictionSchedule | null> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}/schedule`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return response.data?.attributes || null;
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null; // No schedule exists
      }
      log.debug('[ Failed to get batch prediction schedule:', error);
      throw error;
    }
  }

  async createBatchPredictionSchedule(
    deploymentId: string,
    batchPredictionId: string,
    schedule: BatchPredictionSchedule
  ): Promise<BatchPredictionSchedule> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}/schedule`;
    
    const body = {
      data: {
        type: 'batch-prediction-schedule',
        attributes: schedule
      }
    };

    try {
      const response = await this.apiClient.makeRequest(endpoint, 'PUT', body);
      return response.data?.attributes;
    } catch (error) {
      log.debug('[ Failed to create batch prediction schedule:', error);
      throw error;
    }
  }

  async updateBatchPredictionSchedule(
    deploymentId: string,
    batchPredictionId: string,
    updates: Array<{
      op: 'replace';
      path: string;
      value: any;
    }>
  ): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}/schedule`;
    
    try {
      // ML API uses PATCH for updates
      const url = `${(this.apiClient as any).config.tenantUrl}${endpoint}`;
      
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
        throw new Error(`Failed to update batch prediction schedule: ${response.status} - ${errorText}`);
      }
      
      log.debug(` Updated batch prediction schedule`);
    } catch (error) {
      log.debug('[ Failed to update batch prediction schedule:', error);
      throw error;
    }
  }

  async deleteBatchPredictionSchedule(
    deploymentId: string,
    batchPredictionId: string
  ): Promise<void> {
    const endpoint = `/ml/deployments/${deploymentId}/batch-predictions/${batchPredictionId}/schedule`;
    
    try {
      await this.apiClient.makeRequest(endpoint, 'DELETE');
      log.debug(` Deleted batch prediction schedule`);
    } catch (error) {
      log.debug('[ Failed to delete batch prediction schedule:', error);
      throw error;
    }
  }

  // ===== MONITORING =====

  async getModelMonitoring(deploymentId: string): Promise<ModelMonitoring> {
    const endpoint = `/ml/deployments/${deploymentId}/monitoring`;
    
    try {
      const response = await this.apiClient.makeRequest(endpoint, 'GET');
      return response.data?.attributes || response;
    } catch (error) {
      log.debug('[ Failed to get model monitoring:', error);
      throw error;
    }
  }

  // ===== AUTOMATED ML PIPELINE =====

  async runAutomatedPipeline(config: {
  dataSetId: string;
  targetColumn: string;
  experimentName: string;
  spaceId?: string;
  maxIterations?: number;
  targetMetric?: string;
  targetThreshold?: number;
}): Promise<any> {
  log.info('\n[AutoML] ========== STARTING AUTOMATED ML PIPELINE ==========');
  
  // Step 1: Convert and validate dataset
  log.info('\n[AutoML] Step 1: Validating dataset...');
  const { mlResourceId, datasetInfo } = await this.convertToMLResourceId(config.dataSetId);
  
  log.debug(` Using ML resource ID: ${mlResourceId}`);
  if (datasetInfo) {
    log.debug(` Dataset: ${datasetInfo.name || 'Unknown'}`);
    log.debug(` Rows: ${datasetInfo.rowCount || 'Unknown'}`);
    log.debug(` Columns: ${datasetInfo.columnCount || datasetInfo.schema?.dataFields?.length || 'Unknown'}`);
  }
  
  // Continue with the rest of the pipeline using mlResourceId
  let currentDataSetId = mlResourceId;
    const enhancedDatasets: Array<{iteration: number; datasetId: string; featuresAdded: number}> = [];
    let bestModel: Model | null = null;
    let bestMetric = 0;
    let experiment: Experiment;
    let totalIterations = 0;
    
    // Step 1: Validate dataset
    log.info('\n[AutoML] Step 1: Validating dataset...');
    let actualDatasetId = currentDataSetId;
    
    // Check if it's already a resourceId (24 chars)
    const isResourceId = currentDataSetId.length === 24;
    
    if (!isResourceId && this.catalogService) {
      try {
        const dataset = await this.catalogService!.getDatasetDetails(currentDataSetId);
        actualDatasetId = dataset.datasetId || dataset.rawDataset?.id || currentDataSetId;
        currentDataSetId = actualDatasetId;
        
        log.debug(` Dataset: ${dataset.name}`);
        log.debug(` Resource ID: ${actualDatasetId}`);
      } catch (error) {
        log.debug('[ Failed to get dataset details:', error);
        throw new Error(`Cannot fetch dataset details for ${currentDataSetId}`);
      }
    }
    
    // Step 2: Get profile insights
    log.info('\n[AutoML] Step 2: Analyzing dataset profile...');
    const profileInsights = await this.createProfileInsights({
      dataSetId: currentDataSetId,
      target: config.targetColumn,
      shouldWait: true
    });
    
    log.debug(` Found ${profileInsights.insights?.length || 0} features`);
    log.debug(` Recommended algorithms: ${profileInsights.algorithms?.join(', ')}`);
    
    // Step 3: Create experiment
    log.info('\n[AutoML] Step 3: Creating experiment...');
    experiment = await this.createExperiment({
      name: config.experimentName,
      spaceId: config.spaceId,
      description: `Automated ML experiment with Claude AI optimization`
    });
    
    log.debug(` Created experiment: ${experiment.id}`);
    
    // Step 4: Iterative training loop
    const maxIterations = config.maxIterations || 5;
    
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      log.info(`\n[AutoML] ========== ITERATION ${iteration} ==========`);
      totalIterations = iteration;
      
      // Create and train version
      log.debug(` Training with dataset: ${currentDataSetId}`);
      
      const versionConfig = profileInsights.defaultVersionConfig || {
        name: `Version ${iteration}`,
        target: config.targetColumn,
        dataSetId: currentDataSetId,
        experimentMode: 'QUICK',
        algorithms: profileInsights.algorithms || ['RANDOM_FOREST_CLASSIFICATION', 'LGBM_CLASSIFICATION']
      };
      
      const version = await this.createExperimentVersion(experiment.id, versionConfig);
      log.debug(` Created version: ${version.id}`);
      
      // Wait for training to complete
      const completedVersion = await this.waitForTraining(experiment.id, version.id);
      log.debug(` Training completed with top model: ${completedVersion.topModelId}`);
      
      // Get models and find the best one
      const models = await this.getModels(experiment.id, { versionId: version.id });
      log.debug(` Trained ${models.length} models`);
      
      // Find best model by target metric
      const targetMetric = config.targetMetric || 'f1Test';
      for (const model of models) {
        const metricValue = model.metrics?.[targetMetric] || 0;
        if (metricValue > bestMetric) {
          bestMetric = metricValue;
          bestModel = model;
        }
      }
      
      log.debug(` Best model so far: ${bestModel?.algorithm} with ${targetMetric}=${bestMetric}`);
      
      // Check if we've reached target threshold
      if (config.targetThreshold && bestMetric >= config.targetThreshold) {
        log.debug(` Reached target threshold of ${config.targetThreshold}`);
        break;
      }
      
      // TODO: Add Claude AI analysis for feature engineering
      // This would analyze the results and suggest new features
      
      // For now, stop after first iteration if no improvement expected
      if (iteration === 1 && bestMetric > 0.9) {
        log.debug(` Model performance is already excellent, stopping iterations`);
        break;
      }
    }
    
    // Step 5: Deploy best model
    let deployment: Deployment | undefined;
    if (bestModel) {
      log.info('\n[AutoML] Step 5: Deploying best model...');
      deployment = await this.deployModel({
        modelId: bestModel.id,
        name: `${config.experimentName} - Best Model`,
        spaceId: config.spaceId,
        enablePredictions: true
      });
      log.debug(` Deployed model to: ${deployment.id}`);
    }
    
    // Generate report
    const report = this.generatePipelineReport({
      experiment,
      bestModel: bestModel!,
      deployment,
      iterations: totalIterations,
      finalMetrics: bestModel?.metrics || {},
      enhancedDatasets
    });
    
    log.info('\n[AutoML] ========== PIPELINE COMPLETED ==========\n');
    
    return {
      experiment,
      bestModel: bestModel!,
      deployment,
      iterations: totalIterations,
      finalMetrics: bestModel?.metrics || {},
      enhancedDatasets,
      report
    };
  }

  // ===== CLAUDE AI INTEGRATION =====

  async prepareClaudeAnalysis(request: ClaudeAnalysisRequest): Promise<{
    analysisNeeded: boolean;
    prompt: string;
    recommendation?: ClaudeRecommendation;
  }> {
    log.debug('[ Preparing analysis for Claude Desktop...');

    const prompt = this.buildClaudePrompt(request);

    return {
      analysisNeeded: true,
      prompt: prompt,
      recommendation: undefined
    };
  }

  private buildClaudePrompt(request: ClaudeAnalysisRequest): string {
    return `You are an expert data scientist helping optimize a Qlik AutoML experiment.

Current Experiment Results:
${JSON.stringify(request.experimentResults, null, 2)}

Model Metrics:
${JSON.stringify(request.modelMetrics, null, 2)}

Data Profile:
${JSON.stringify(request.dataProfile, null, 2)}

Current Features:
${request.currentFeatures.join(', ')}

Please analyze these results and recommend:
1. Should we continue iterating? (consider diminishing returns)
2. What new features could improve the model?
3. Specific feature engineering expressions for Qlik
4. Any model or hyperparameter recommendations

Provide specific, actionable recommendations.`;
  }

  // ===== HELPER METHODS =====

  private normalizeProfileInsights(response: any): ProfileInsightsResponse {
    const data = response.data || response;
    return {
      id: data.id,
      status: data.attributes?.status || data.status,
      insights: data.attributes?.insights || data.insights,
      algorithms: data.attributes?.algorithms || data.algorithms,
      defaultVersionConfig: data.attributes?.defaultVersionConfig || data.defaultVersionConfig
    };
  }

  private normalizeExperiment(response: any): Experiment {
    const data = response.data || response;
    return {
      id: data.id,
      name: data.attributes?.name || data.name,
      ownerId: data.attributes?.ownerId || data.ownerId,
      spaceId: data.attributes?.spaceId || data.spaceId,
      tenantId: data.attributes?.tenantId || data.tenantId,
      createdAt: data.attributes?.createdAt || data.createdAt,
      updatedAt: data.attributes?.updatedAt || data.updatedAt,
      description: data.attributes?.description || data.description
    };
  }

  private normalizeExperimentVersion(response: any): ExperimentVersion {
    const data = response.data || response;
    return {
      id: data.id,
      name: data.attributes?.name || data.name,
      status: data.attributes?.status || data.status,
      target: data.attributes?.target || data.target,
      experimentId: data.attributes?.experimentId || data.experimentId,
      experimentType: data.attributes?.experimentType || data.experimentType,
      experimentMode: data.attributes?.experimentMode || data.experimentMode,
      versionNumber: data.attributes?.versionNumber || data.versionNumber,
      topModelId: data.attributes?.topModelId || data.topModelId,
      algorithms: data.attributes?.algorithms || data.algorithms || [],
      createdAt: data.attributes?.createdAt || data.createdAt,
      updatedAt: data.attributes?.updatedAt || data.updatedAt
    };
  }

  private normalizeModel(response: any): Model {
    const data = response.data || response;
    return {
      id: data.id,
      name: data.attributes?.name || data.name,
      status: data.attributes?.status || data.status,
      algorithm: data.attributes?.algorithm || data.algorithm,
      metrics: data.attributes?.metrics || data.metrics,
      experimentVersionId: data.attributes?.experimentVersionId || data.experimentVersionId,
      createdAt: data.attributes?.createdAt || data.createdAt,
      updatedAt: data.attributes?.updatedAt || data.updatedAt
    };
  }

  private normalizeDeployment(response: any): Deployment {
    const data = response.data || response;
    return {
      id: data.id,
      name: data.attributes?.name || data.name,
      modelId: data.attributes?.modelId || data.modelId,
      spaceId: data.attributes?.spaceId || data.spaceId,
      enablePredictions: data.attributes?.enablePredictions !== false,
      createdAt: data.attributes?.createdAt || data.createdAt,
      updatedAt: data.attributes?.updatedAt || data.updatedAt,
      description: data.attributes?.description || data.description,
      status: data.attributes?.status || data.status
    };
  }

  private normalizeAlias(response: any): DeploymentAlias {
    const data = response.data || response;
    return {
      id: data.id,
      name: data.attributes?.name || data.name,
      description: data.attributes?.description || data.description,
      deploymentId: data.attributes?.deploymentId || data.deploymentId,
      createdAt: data.attributes?.createdAt || data.createdAt,
      updatedAt: data.attributes?.updatedAt || data.updatedAt
    };
  }

  private normalizeBatchPrediction(response: any): BatchPrediction {
  const data = response.data || response;
  
  // Extract deploymentId from relationships if not in attributes
  const deploymentId = data.attributes?.deploymentId || 
                       data.relationships?.deployment?.data?.id ||
                       data.deploymentId;
  
  return {
    id: data.id,
    name: data.attributes?.name || data.name,
    deploymentId: deploymentId,
    dataSetId: data.attributes?.dataSetId || data.dataSetId,
    status: data.attributes?.status || data.status || 'pending',
    // Remove description as it's not part of BatchPrediction type
    // indexColumn and applyDatasetChangeOnly are also not in the type
    writeback: data.attributes?.writeback || data.writeback,
    schedule: data.attributes?.schedule || data.schedule,
    createdAt: data.attributes?.createdAt || data.createdAt,
    updatedAt: data.attributes?.updatedAt || data.updatedAt
  };
}

  private normalizePredictionJob(response: any): PredictionJob {
    const data = response.data || response;
    return {
      id: data.id,
      status: data.attributes?.status || data.status,
      createdAt: data.attributes?.createdAt || data.createdAt,
      startTime: data.attributes?.startTime || data.startTime,
      endTime: data.attributes?.endTime || data.endTime,
      progress: data.attributes?.progress || data.progress,
      error: data.attributes?.error || data.error
    };
  }

  private generatePipelineReport(data: {
    experiment: Experiment;
    bestModel: Model;
    deployment?: Deployment;
    iterations: number;
    finalMetrics: any;
    enhancedDatasets: Array<{
      iteration: number;
      datasetId: string;
      featuresAdded: number;
    }>;
  }): string {
    return `
# Automated ML Pipeline Report

## Experiment Summary
- **Name**: ${data.experiment.name}
- **ID**: ${data.experiment.id}
- **Iterations**: ${data.iterations}

## Best Model
- **Algorithm**: ${data.bestModel.algorithm}
- **Model ID**: ${data.bestModel.id}
- **Metrics**: ${JSON.stringify(data.finalMetrics, null, 2)}

## Deployment
${data.deployment ? `
- **Deployment ID**: ${data.deployment.id}
- **Status**: Active
- **Predictions Enabled**: ${data.deployment.enablePredictions}
` : 'Model not deployed'}

## Enhanced Datasets
${data.enhancedDatasets.length > 0 ? 
  data.enhancedDatasets.map((ds: { iteration: number; datasetId: string; featuresAdded: number }) => 
    `- Iteration ${ds.iteration}: ${ds.datasetId} (+${ds.featuresAdded} features)`
  ).join('\n') : 
  'No feature engineering performed'}

## Recommendations
- Consider setting up batch predictions for regular scoring
- Monitor model performance using the monitoring API
- Retrain periodically as new data becomes available
`;
  }
}