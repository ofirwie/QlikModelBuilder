// lineage-service.ts - ENHANCED VERSION WITH BOTH METHODS
// This version includes both the impact/source endpoint AND the nodes endpoint

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { DataCatalogService } from './data-catalog-service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'Lineage' });

// ===== INTERFACES =====

export interface LineageOptions {
  nodeId: string;
  direction?: 'upstream' | 'downstream' | 'both';
  levels?: number;
  includeFields?: boolean;
  includeTables?: boolean;
  includeDetails?: boolean;
  useCache?: boolean;
  method?: 'nodes' | 'impact'; // NEW: Choose which API method to use
}

export interface LineageGraph {
  id: string;
  directed: boolean;
  type: 'RESOURCE' | 'TABLE' | 'FIELD';
  label: string;
  nodes: Record<string, LineageNode>;
  edges: LineageEdge[];
  metadata?: {
    id: string;
    generatedAt: string;
    total?: number;
    createdAt?: string;
    producerId?: string;
    specVersion?: string;
    producerType?: string;
  };
}

export interface LineageNode {
  id?: string;
  label: string;
  metadata: {
    type: string;
    subtype?: string;
    [key: string]: any;
  };
}

export interface LineageEdge {
  source: string;
  target: string;
  relation?: string;
  metadata?: any;
}

export interface ImpactAnalysisOptions {
  sourceQri: string;
  downstream?: number;
  filter?: LineageFilter;
  includeMetadata?: boolean;
  useImpactEndpoint?: boolean; // NEW: Option to use impact-specific endpoint
}

export interface LineageFilter {
  prefix?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ImpactAnalysisResult {
  sourceNode: LineageNode;
  impactedResources: ImpactedResource[];
  summary: {
    totalImpacted: number;
    directImpact: number;
    indirectImpact: number;
    byType: Record<string, number>;
    criticalResources: number;
  };
  graph?: LineageGraph;
  analysisTime: number;
}

export interface ImpactedResource {
  id: string;
  label: string;
  type: string;
  subtype?: string;
  ownerId?: string;
  ownerName?: string;
  spaceId?: string;
  spaceName?: string;
  impactLevel: 'direct' | 'indirect';
  distance: number;
  metadata?: {
    lastReloadTime?: string;
    numberOfFields?: number;
    numberOfTables?: number;
    criticalityScore?: number;
  };
}

export interface LineageVisualizationData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    x?: number;
    y?: number;
    color?: string;
    size?: number;
    metadata?: any;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    type?: string;
    weight?: number;
  }>;
  layout?: 'hierarchical' | 'force' | 'circular';
}

// ===== SINGLETON =====

let lineageServiceInstance: LineageService | null = null;

/**
 * Get or create the singleton LineageService instance
 */
export function getLineageService(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  catalogService?: DataCatalogService
): LineageService {
  if (!lineageServiceInstance) {
    lineageServiceInstance = new LineageService(apiClient, cacheManager, catalogService);
  }
  return lineageServiceInstance;
}

/**
 * Reset the singleton instance (useful for tenant switching)
 */
export function resetLineageService(): void {
  if (lineageServiceInstance) {
    lineageServiceInstance.clearCache();
    lineageServiceInstance = null;
  }
}

// ===== MAIN SERVICE CLASS =====

export class LineageService {
  private readonly apiClient: ApiClient;
  private readonly cacheManager: CacheManager;
  private readonly catalogService?: DataCatalogService;
  
  // Cache configuration
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly lineageCache = new Map<string, any>();
  private readonly impactCache = new Map<string, any>();
  
  constructor(
    apiClient: ApiClient, 
    cacheManager: CacheManager,
    catalogService?: DataCatalogService
  ) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    this.catalogService = catalogService;
    log.debug('[LineageService] Initialized with both impact and node lineage capabilities');
  }

  // ===== CORE LINEAGE METHODS =====

  /**
   * Get lineage graph for a resource - ENHANCED with both methods
   */
  async getLineage(options: LineageOptions): Promise<LineageGraph[]> {
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey('lineage', options);
    
    // Check cache
    if (options.useCache !== false) {
      const cached = this.lineageCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        log.debug(`[LineageService] Returning cached lineage for ${options.nodeId}`);
        return cached.data;
      }
    }
    
    try {
      let graphs: LineageGraph[] = [];
      
      // Choose method based on options
      if (options.method === 'impact') {
        // Use the original impact/source endpoint
        graphs = await this.getLineageUsingImpactMethod(options);
      } else {
        // Use the nodes endpoint (default)
        graphs = await this.getLineageUsingNodesMethod(options);
      }
      
      // Cache the result
      this.lineageCache.set(cacheKey, {
        data: graphs,
        timestamp: Date.now()
      });
      
      log.debug(`[LineageService] Retrieved ${graphs.length} lineage graphs with ${this.countTotalNodes(graphs)} nodes and ${this.countTotalEdges(graphs)} edges in ${Date.now() - startTime}ms`);
      
      return graphs;
      
    } catch (error) {
      log.debug('[LineageService] Failed to get lineage:', error);
      throw error;
    }
  }

  /**
   * Original method using impact/source endpoint - useful for getting source node details
   */
  private async getLineageUsingImpactMethod(options: LineageOptions): Promise<LineageGraph[]> {
    const encodedQri = encodeURIComponent(options.nodeId);
    const endpoint = `/lineage-graphs/impact/${encodedQri}/source`;
    
    log.debug(`[LineageService] Fetching lineage using IMPACT method from: ${endpoint}`);
    const response = await this.apiClient.makeRequest(endpoint);
    
    // Parse and enhance the response
    const graphs = response.graphs || [];
    return this.enhanceLineageGraphs(graphs);
  }

  /**
   * New method using nodes endpoint - gets full lineage with relationships
   */
  private async getLineageUsingNodesMethod(options: LineageOptions): Promise<LineageGraph[]> {
    const encodedQri = encodeURIComponent(options.nodeId);
    let endpoint = `/lineage-graphs/nodes/${encodedQri}`;
    
    // Build query parameters based on direction
    const params = new URLSearchParams();
    
    if (options.direction === 'upstream') {
      params.set('up', String(options.levels ?? -1));
      params.set('down', '0');
    } else if (options.direction === 'downstream') {
      params.set('up', '0');
      params.set('down', String(options.levels ?? -1));
    } else {
      // Both directions (default)
      params.set('up', String(options.levels ?? 5));
      params.set('down', String(options.levels ?? 5));
    }
    
    // Add level parameter if needed
    if (options.includeFields && options.includeTables) {
      // Don't set level to get all types
    } else if (options.includeFields) {
      params.set('level', 'field');
    } else if (options.includeTables) {
      params.set('level', 'table');
    } else {
      params.set('level', 'resource');
    }
    
    const fullEndpoint = `${endpoint}?${params.toString()}`;
    log.debug(`[LineageService] Fetching lineage using NODES method from: ${fullEndpoint}`);
    
    const response = await this.apiClient.makeRequest(fullEndpoint);
    
    // Handle different response structures
    let graphs: LineageGraph[] = [];
    
    if (response.graph) {
      graphs = [response.graph];
    } else if (response.graphs) {
      graphs = response.graphs.graphs || response.graphs || [];
    } else if (Array.isArray(response)) {
      graphs = response;
    } else {
      graphs = [response];
    }
    
    return this.enhanceLineageGraphs(graphs);
  }

  /**
   * Get detailed node information - uses impact endpoint for rich metadata
   */
  async getNodeDetails(nodeId: string): Promise<LineageGraph[]> {
    return await this.getLineage({
      nodeId,
      method: 'impact', // Use impact method for detailed node info
      includeDetails: true
    });
  }

  /**
   * Get full lineage with relationships - uses nodes endpoint
   */
  async getFullLineage(
    nodeId: string,
    upstreamLevels: number = -1,
    downstreamLevels: number = -1,
    level: 'resource' | 'table' | 'field' = 'resource'
  ): Promise<LineageGraph> {
    // IMPORTANT: nodeId must be a QRI
    if (!nodeId.startsWith('qri:')) {
      throw new Error('nodeId must be a QRI (Qlik Resource Identifier). Use dataset.rawDataset.secureQri');
    }
    
    const encodedQri = encodeURIComponent(nodeId);
    const endpoint = `/lineage-graphs/nodes/${encodedQri}`;
    
    const params = new URLSearchParams({
      up: upstreamLevels.toString(),
      down: downstreamLevels.toString(),
      level: level
    });
    
    log.debug(`[LineageService] Getting full lineage for ${nodeId}`);
    const response = await this.apiClient.makeRequest(`${endpoint}?${params}`);
    
    return response.graph || response;
  }

  /**
   * Get impact analysis for a dataset or resource - ENHANCED with both methods
   */
  async getImpactAnalysis(options: ImpactAnalysisOptions): Promise<ImpactAnalysisResult> {
    // IMPORTANT: sourceQri must be a QRI
    if (!options.sourceQri.startsWith('qri:')) {
      throw new Error('sourceQri must be a QRI (Qlik Resource Identifier). Use dataset.rawDataset.secureQri');
    }
    
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey('impact', options);
    
    // Check cache
    if (!options.filter) {
      const cached = this.impactCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        log.debug(`[LineageService] Returning cached impact analysis`);
        return cached.data;
      }
    }
    
    try {
      let result: ImpactAnalysisResult;
      
      if (options.useImpactEndpoint) {
        // Use dedicated impact endpoints
        result = await this.getImpactUsingDedicatedEndpoint(options);
      } else {
        // Use lineage nodes endpoint
        result = await this.getImpactUsingLineageEndpoint(options);
      }
      
      // Cache the result
      if (!options.filter) {
        this.impactCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }
      
      log.debug(`[LineageService] Impact analysis completed in ${result.analysisTime}ms`);
      return result;
      
    } catch (error) {
      log.debug('[LineageService] Failed to perform impact analysis:', error);
      throw error;
    }
  }

  /**
   * Impact analysis using dedicated impact endpoints
   */
  /**
 * Impact analysis using dedicated impact endpoints
 */
/**
 * Impact analysis using dedicated impact endpoints
 */
private async getImpactUsingDedicatedEndpoint(options: ImpactAnalysisOptions): Promise<ImpactAnalysisResult> {
  const startTime = Date.now();
  
  let impactedResources: ImpactedResource[] = [];
  let graph: LineageGraph | undefined;
  
  // Always use filter endpoint when we need detailed information (labels, metadata)
  if (options.filter && options.filter.prefix) {
    // Use filtered impact details endpoint with specific filter
    impactedResources = await this.getFilteredImpactDetails(
      options.sourceQri,
      options.downstream ?? -1,
      options.filter
    );
  } else if (options.includeMetadata !== false) {
    // When includeMetadata is true (default) but no filter specified,
    // use filter endpoint with a broad filter to get all apps with labels
    const defaultFilter = {
      prefix: 'qri:app:sense',  // Default to Sense apps
      limit: options.filter?.limit || 100
    };
    
    try {
      impactedResources = await this.getFilteredImpactDetails(
        options.sourceQri,
        options.downstream ?? -1,
        defaultFilter
      );
    } catch (error) {
      log.debug('[LineageService] Could not get filtered details, falling back to overview:', error);
      // Fallback to overview if filter fails
      const overview = await this.getImpactOverview(options.sourceQri, options.downstream ?? -1);
      graph = overview.graph;
      if (overview.graph && overview.graph.nodes) {
        impactedResources = this.convertNodesToImpactedResources(overview.graph);
      }
    }
  } else {
    // Only use overview when explicitly told not to include metadata
    const overview = await this.getImpactOverview(options.sourceQri, options.downstream ?? -1);
    graph = overview.graph;
    
    // Convert overview nodes to impacted resources (won't have labels)
    if (overview.graph && overview.graph.nodes) {
      impactedResources = this.convertNodesToImpactedResources(overview.graph);
    }
  }
  
  // Get graph from overview if we don't have it yet
  if (!graph && options.includeMetadata !== false) {
    try {
      const overview = await this.getImpactOverview(options.sourceQri, options.downstream ?? -1);
      graph = overview.graph;
    } catch (error) {
      log.debug('[LineageService] Could not get overview graph:', error);
    }
  }
  
  // Get source node details
  const sourceNode = await this.getSourceNodeDetails(options.sourceQri);
  
  return {
    sourceNode,
    impactedResources,
    summary: this.calculateImpactSummary(impactedResources),
    graph,
    analysisTime: Date.now() - startTime
  };
}

  /**
   * Impact analysis using lineage nodes endpoint
   */
  private async getImpactUsingLineageEndpoint(options: ImpactAnalysisOptions): Promise<ImpactAnalysisResult> {
    const startTime = Date.now();
    
    // Use the getLineage method with downstream direction for impact analysis
    const lineageGraphs = await this.getLineage({
      nodeId: options.sourceQri,
      direction: 'downstream',
      levels: options.downstream ?? -1,
      includeDetails: true,
      method: 'nodes' // Use nodes method for relationships
    });
    
    // Convert lineage graphs to impact analysis result
    const impactedResources = this.extractImpactedResources(lineageGraphs, options.sourceQri);
    
    // Get source node details
    const sourceNode = await this.getSourceNodeDetails(options.sourceQri);
    
    return {
      sourceNode,
      impactedResources,
      summary: this.calculateImpactSummary(impactedResources),
      graph: lineageGraphs[0], // Use the first graph as the main graph
      analysisTime: Date.now() - startTime
    };
  }

  /**
   * Get lineage visualization data - combines both methods for best results
   */
  async getLineageVisualization(
    nodeId: string,
    options: {
      layout?: 'hierarchical' | 'force' | 'circular';
      includeMetadata?: boolean;
      maxNodes?: number;
    } = {}
  ): Promise<LineageVisualizationData> {
    // Get full lineage using nodes method for relationships
    const lineageGraphs = await this.getLineage({
      nodeId,
      direction: 'both',
      levels: -1,
      includeDetails: options.includeMetadata,
      method: 'nodes' // Use nodes for full graph
    });
    
    // If we need metadata, also get detailed node info
    if (options.includeMetadata) {
      const detailGraphs = await this.getLineage({
        nodeId,
        method: 'impact', // Use impact for detailed metadata
        includeDetails: true
      });
      
      // Merge metadata from detail graphs
      this.mergeMetadata(lineageGraphs, detailGraphs);
    }
    
    // Merge all graphs into visualization format
    const vizData = this.mergeGraphsForVisualization(lineageGraphs, options);
    
    // Apply layout if specified
    if (options.layout) {
      this.applyLayout(vizData, options.layout);
    }
    
    // Limit nodes if specified
    if (options.maxNodes && vizData.nodes.length > options.maxNodes) {
      this.pruneVisualizationData(vizData, nodeId, options.maxNodes);
    }
    
    return vizData;
  }

  // ===== HELPER METHODS =====

  private async getImpactOverview(sourceQri: string, downstream: number = -1): Promise<any> {
    const encodedQri = encodeURIComponent(sourceQri);
    const endpoint = `/lineage-graphs/impact/${encodedQri}/overview`;
    
    const params = new URLSearchParams({
      down: downstream.toString()
    });
    
    return await this.apiClient.makeRequest(`${endpoint}?${params}`);
  }

  private async getFilteredImpactDetails(
    sourceQri: string,
    downstream: number = -1,
    filter?: LineageFilter
  ): Promise<ImpactedResource[]> {
    const encodedQri = encodeURIComponent(sourceQri);
    const doubleEncodedQri = encodeURIComponent(encodedQri);
    const endpoint = `/lineage-graphs/impact/${encodedQri}/actions/filter`;
    
    const params = new URLSearchParams({
      down: downstream.toString(),
      id: doubleEncodedQri,
      page: (filter?.page || 0).toString(),
      limit: (filter?.limit || 100).toString(),
      sort: filter?.sortBy ? `${filter.sortOrder === 'desc' ? '-' : '+'}${filter.sortBy}` : '+label'
    });
    
    if (filter?.prefix) params.append('prefix', filter.prefix);
    
    const response = await this.apiClient.makeRequest(`${endpoint}?${params}`);
    
    return response.data.map((item: any) => this.mapToImpactedResource(item));
  }

  private async getSourceNodeDetails(nodeId: string): Promise<LineageNode> {
    // Try multiple methods to get the best details
    
    // First, try using the impact method for rich metadata
    try {
      const detailGraphs = await this.getLineage({
        nodeId,
        method: 'impact',
        includeDetails: true
      });
      
      if (detailGraphs.length > 0 && detailGraphs[0].nodes[nodeId]) {
        return detailGraphs[0].nodes[nodeId];
      }
    } catch (error) {
      log.debug('[LineageService] Could not get node details from impact method:', error);
    }
    
    // Second, try catalog service if available
    if (this.catalogService && nodeId.includes('qdf:space')) {
      try {
        const itemId = this.extractItemIdFromQri(nodeId);
        if (itemId) {
          const details = await this.catalogService.getDatasetDetails(itemId);
          return this.mapDatasetToNode(details);
        }
      } catch (error) {
        log.debug('[LineageService] Could not get dataset details:', error);
      }
    }
    
    // Fallback to basic node info
    return {
      id: nodeId,
      label: 'Unknown Resource',
      metadata: {
        type: 'RESOURCE'
      }
    };
  }

  private mergeMetadata(targetGraphs: LineageGraph[], sourceGraphs: LineageGraph[]): void {
    // Create a map of all nodes from source graphs with their metadata
    const metadataMap = new Map<string, any>();
    
    sourceGraphs.forEach(graph => {
      Object.entries(graph.nodes || {}).forEach(([nodeId, node]) => {
        metadataMap.set(nodeId, node.metadata);
      });
    });
    
    // Merge metadata into target graphs
    targetGraphs.forEach(graph => {
      Object.entries(graph.nodes || {}).forEach(([nodeId, node]) => {
        const metadata = metadataMap.get(nodeId);
        if (metadata) {
          node.metadata = { ...node.metadata, ...metadata };
        }
      });
    });
  }

  private countTotalNodes(graphs: LineageGraph[]): number {
    return graphs.reduce((total, graph) => {
      return total + Object.keys(graph.nodes || {}).length;
    }, 0);
  }

  private countTotalEdges(graphs: LineageGraph[]): number {
    return graphs.reduce((total, graph) => {
      return total + (graph.edges || []).length;
    }, 0);
  }

  private extractImpactedResources(graphs: LineageGraph[], sourceQri: string): ImpactedResource[] {
    const resources: ImpactedResource[] = [];
    const processedIds = new Set<string>();
    
    // Process all graphs
    graphs.forEach(graph => {
      // Process edges to determine distance
      const distances = this.calculateDistances(graph, sourceQri);
      
      // Process nodes
      Object.entries(graph.nodes || {}).forEach(([nodeId, node]) => {
        if (nodeId !== sourceQri && !processedIds.has(nodeId)) {
          processedIds.add(nodeId);
          
          resources.push({
            id: nodeId,
            label: node.label,
            type: node.metadata.type,
            subtype: node.metadata.subtype,
            impactLevel: distances.get(nodeId) === 1 ? 'direct' : 'indirect',
            distance: distances.get(nodeId) || 999,
            metadata: {
              numberOfFields: node.metadata.fields,
              numberOfTables: node.metadata.tables
            }
          });
        }
      });
    });
    
    return resources.sort((a, b) => a.distance - b.distance);
  }

  private calculateDistances(graph: LineageGraph, sourceId: string): Map<string, number> {
    const distances = new Map<string, number>();
    distances.set(sourceId, 0);
    
    // BFS to calculate distances
    const queue = [sourceId];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      
      const currentDistance = distances.get(current) || 0;
      
      // Find all edges from current node
      graph.edges.forEach(edge => {
        if (edge.source === current && !distances.has(edge.target)) {
          distances.set(edge.target, currentDistance + 1);
          queue.push(edge.target);
        }
      });
    }
    
    return distances;
  }

  private convertNodesToImpactedResources(graph: LineageGraph): ImpactedResource[] {
    if (!graph || !graph.nodes) return [];
    
    return Object.entries(graph.nodes).map(([nodeId, node]) => ({
      id: nodeId,
      label: node.label,
      type: node.metadata.type,
      subtype: node.metadata.subtype,
      impactLevel: 'direct' as const,
      distance: 1,
      metadata: {
        numberOfFields: node.metadata.fields,
        numberOfTables: node.metadata.tables
      }
    }));
  }

  private mapToImpactedResource(item: any): ImpactedResource {
  // Handle the actual response structure from the API
  // The data comes directly on the item, not under attributes
  return {
    id: item.id,
    label: item.label,
    type: item.metadata?.type || item.type || 'UNKNOWN',
    subtype: item.metadata?.subtype || item.subtype,
    ownerId: item.ownerId,
    spaceId: item.spaceId,
    impactLevel: item.distance === 1 ? 'direct' : 'indirect',
    distance: item.distance || 1,
    metadata: {
      ...item.metadata,
      lastReloadTime: item.metadata?.lastReloadTime,
      numberOfFields: item.metadata?.numberOfFields,
      numberOfTables: item.metadata?.numberOfTables
    }
  };
}

  private mapDatasetToNode(dataset: any): LineageNode {
    return {
      id: dataset.rawDataset?.secureQri || dataset.id,
      label: dataset.name,
      metadata: {
        type: 'DATASET',
        subtype: dataset.type,
        spaceId: dataset.spaceId,
        ownerId: dataset.ownerId,
        created: dataset.createdAt,
        modified: dataset.updatedAt
      }
    };
  }

  private mergeGraphsForVisualization(
    graphs: LineageGraph[], 
    options: any
  ): LineageVisualizationData {
    const nodeMap = new Map<string, any>();
    const edgeSet = new Set<string>();
    const edges: any[] = [];
    
    // Merge all nodes and edges
    graphs.forEach(graph => {
      // Process nodes
      Object.entries(graph.nodes || {}).forEach(([nodeId, node]) => {
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            label: node.label,
            type: node.metadata.type,
            metadata: options.includeMetadata ? node.metadata : undefined,
            color: this.getNodeColor(node.metadata.type),
            size: this.getNodeSize(node.metadata)
          });
        }
      });
      
      // Process edges
      (graph.edges || []).forEach(edge => {
        const edgeKey = `${edge.source}->${edge.target}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: edge.source,
            target: edge.target,
            label: edge.relation,
            type: edge.relation
          });
        }
      });
    });
    
    return {
      nodes: Array.from(nodeMap.values()),
      edges,
      layout: options.layout
    };
  }

  private pruneVisualizationData(
    vizData: LineageVisualizationData, 
    centerNodeId: string, 
    maxNodes: number
  ): void {
    // Keep the most relevant nodes based on distance from center
    const distances = new Map<string, number>();
    distances.set(centerNodeId, 0);
    
    // Calculate distances using BFS
    const queue = [centerNodeId];
    while (queue.length > 0 && distances.size < maxNodes) {
      const current = queue.shift()!;
      const currentDistance = distances.get(current) || 0;
      
      vizData.edges.forEach(edge => {
        if (edge.source === current && !distances.has(edge.target)) {
          distances.set(edge.target, currentDistance + 1);
          queue.push(edge.target);
        }
        if (edge.target === current && !distances.has(edge.source)) {
          distances.set(edge.source, currentDistance + 1);
          queue.push(edge.source);
        }
      });
    }
    
    // Keep only nodes within distance limit
    const keepNodes = new Set(
      Array.from(distances.entries())
        .sort((a, b) => a[1] - b[1])
        .slice(0, maxNodes)
        .map(([nodeId]) => nodeId)
    );
    
    // Filter nodes and edges
    vizData.nodes = vizData.nodes.filter(node => keepNodes.has(node.id));
    vizData.edges = vizData.edges.filter(edge => 
      keepNodes.has(edge.source) && keepNodes.has(edge.target)
    );
  }

  private enhanceLineageGraphs(graphs: any[]): LineageGraph[] {
    return graphs.map(graph => ({
      ...graph,
      metadata: {
        ...graph.metadata,
        generatedAt: new Date().toISOString()
      }
    }));
  }

  private calculateImpactSummary(resources: ImpactedResource[]): ImpactAnalysisResult['summary'] {
    const byType: Record<string, number> = {};
    let directImpact = 0;
    let criticalResources = 0;
    
    resources.forEach(resource => {
      byType[resource.type] = (byType[resource.type] || 0) + 1;
      if (resource.impactLevel === 'direct') directImpact++;
      if (resource.metadata?.criticalityScore && resource.metadata.criticalityScore > 0.8) {
        criticalResources++;
      }
    });
    
    return {
      totalImpacted: resources.length,
      directImpact,
      indirectImpact: resources.length - directImpact,
      byType,
      criticalResources
    };
  }

  private getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      'DATASET': '#FBBC04',
      'QVD': '#34A853',
      'DA_APP': '#EA4335',
      'APP': '#4285F4',
      'PROCESSOR': '#34A853',
      'DATABASE': '#9333EA',
      'TABLE': '#06B6D4',
      'FIELD': '#6366F1'
    };
    return colors[type] || '#999999';
  }

  private getNodeSize(metadata: any): number {
    // Size based on number of fields/tables
    const fields = metadata.fields || 0;
    const tables = metadata.tables || 0;
    return Math.min(50, 20 + Math.sqrt(fields + tables * 10));
  }

  private applyLayout(vizData: LineageVisualizationData, layout: string): void {
    // This would implement actual layout algorithms
    // For now, just set the layout type
    vizData.layout = layout as any;
  }

  private extractItemIdFromQri(qri: string): string | null {
    // Extract the item ID from QRI format
    // e.g., qri:qdf:space://spaceId#itemId -> itemId
    const match = qri.match(/#(.+)$/);
    return match ? match[1] : null;
  }

  private buildCacheKey(type: string, options: any): string {
    const parts = [type];
    if (options.nodeId) parts.push(options.nodeId);
    if (options.sourceQri) parts.push(options.sourceQri);
    if (options.direction) parts.push(options.direction);
    if (options.levels !== undefined) parts.push(`l${options.levels}`);
    if (options.downstream !== undefined) parts.push(`d${options.downstream}`);
    if (options.upstream !== undefined) parts.push(`u${options.upstream}`);
    if (options.method) parts.push(`m:${options.method}`);
    if (options.useImpactEndpoint) parts.push('impact');
    return parts.join(':');
  }

  // ===== PUBLIC UTILITY METHODS =====

  /**
   * Clear all lineage caches
   */
  clearCache(): void {
    this.lineageCache.clear();
    this.impactCache.clear();
    log.debug('[LineageService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { lineage: number; impact: number } {
    return {
      lineage: this.lineageCache.size,
      impact: this.impactCache.size
    };
  }
}