/**
 * App Types - All interfaces and type definitions for Qlik App services
 *
 * Extracted from qlik-app-service.ts
 */

// ===== VISUALIZATION TYPES =====

export interface SimpleObject {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  isVisuallyHidden?: boolean;
  dimensions?: Array<{
    label: string;
    fieldName: string;
    dataType: string;
    distinctValues?: number;
  }>;
  measures?: Array<{
    label: string;
    expression: string;
    format?: string;
  }>;
  chartConfiguration?: any;
  parentContainer?: string;
  nestingLevel?: number;
  lastDataUpdate?: string;
  sampleData?: Array<Record<string, any>>;
  dataExtractedAt?: string;
}

export interface ObjectDataSample {
  objectId: string;
  objectType: string;
  sampleData: Array<Record<string, any>>;
  totalRows: number;
  columnInfo: Array<{
    name: string;
    type: 'dimension' | 'measure';
    dataType: 'text' | 'numeric' | 'date' | 'timestamp' | 'dual';
    isCalculated?: boolean;
    expression?: string;
    format?: any;
  }>;
  dataExtractedAt: string;
}

export interface ContainerInfo {
  id: string;
  type: string;
  title: string;
  isContainer: boolean;
  nestedObjects: SimpleObject[];
  totalNestedCount: number;
}

// ===== SHEET TYPES =====

export interface SimpleSheet {
  id: string;
  title: string;
  description?: string;
  totalObjects: number;
  visualizationObjects: SimpleObject[];
  containerInfo: ContainerInfo[];
  sheetDataSummary?: {
    totalDataRows: number;
    uniqueDimensions: string[];
    uniqueMeasures: string[];
    dataSourceTables: string[];
    lastDataRefresh?: string;
  };
}

// ===== APP METADATA TYPES =====

export interface AppMetadataCompleteResult {
  appInfo: {
    id: string;
    name: string;
    owner: string;
  };
  sheets: SimpleSheet[];
  totalVisualizationObjects: number;
  extractionStats: {
    totalLayoutContainers: number;
    totalNestedObjects: number;
    successfulExtractions: number;
    failedExtractions: number;
    visualizationTypeBreakdown: Record<string, number>;
    containerAnalysis: {
      totalContainers: number;
      containersWithNested: number;
      averageNestedPerContainer: number;
      maxNestingDepth: number;
    };
    dataExtractionStats: {
      objectsWithData: number;
      totalDataRows: number;
      hypercubesExtracted: number;
      listObjectsExtracted: number;
      fieldValuesExtracted: number;
      dataExtractionErrors: number;
    };
  };
  appDataSummary?: {
    totalDataPoints: number;
    dimensionsUsed: string[];
    measuresUsed: string[];
    dataSources: string[];
    dataModelComplexity: 'simple' | 'moderate' | 'complex';
    estimatedDataFreshness?: string;
  };
  restMetadata?: any;
  engineMetadata?: any;
}

export interface AppMetadataOptions {
  includeEngineMetadata?: boolean;
  includeRestMetadata?: boolean;
  includeSheets?: boolean;
  includeObjects?: boolean;
  includeObjectData?: boolean;
  maxContainerDepth?: number;
  maxDataRows?: number;
  timeoutMs?: number;
  extractFieldValues?: boolean;
  sampleDataOnly?: boolean;
}

// ===== SESSION TYPES =====

export interface AppSession {
  session: any;
  global: any;
  doc: any;
  appId: string;
  lastAccessed: Date;
  currentSelections: Map<string, any>;
}

export interface SelectionRequest {
  field: string;
  values?: any[];
  searchString?: string;
  rangeSelection?: { min: any; max: any };
  exclude?: boolean;
}

export interface FieldInfo {
  name: string;
  cardinality: number;
  tags?: string[];
  isNumeric?: boolean;
  dataType?: string;
  sampleValues?: string[];
}

// ===== SERVICE OPTIONS =====

export interface QlikAppServiceOptions {
  platform?: 'cloud' | 'on-premise';
  tenantUrl?: string;
  certPath?: string;
  keyPath?: string;
  userDirectory?: string;
  userId?: string;
}

// ===== FIELD MAPPING TYPES =====

export interface FieldMappingResult {
  fields: FieldInfo[];
  totalCount: number;
  batches: number;
}

export interface MasterDimensionResult {
  dimensions: Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    grouping: string;
    fieldDefs: string[];
    fieldLabels: string[];
  }>;
  totalCount: number;
  batches: number;
}

export interface MasterMeasureResult {
  measures: Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    expression: string;
    label: string;
    numFormat: any;
  }>;
  totalCount: number;
  batches: number;
}

export interface FieldsWithTimeoutResult {
  success: boolean;
  fields: Array<{
    name: string;
    cardinality: number;
    dataType: string;
    isNumeric: boolean;
    isInteger: boolean;
    isText: boolean;
    isDate: boolean;
    isTimestamp: boolean;
    isKey: boolean;
    isHidden: boolean;
    isSystem: boolean;
    isSynthetic: boolean;
    srcTables: string[];
    sampleValues: string[];
  }>;
  totalCount: number;
  processedCount: number;
  skippedCount: number;
  batches: number;
  timeoutOccurred: boolean;
  elapsedMs: number;
  errors: string[];
}

export interface DimensionsWithTimeoutResult {
  success: boolean;
  dimensions: Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    grouping: string;
    groupingType: string;
    isHierarchy: boolean;
    isCyclic: boolean;
    fieldCount: number;
    fieldDefs: string[];
    fieldLabels: string[];
  }>;
  totalCount: number;
  processedCount: number;
  skippedCount: number;
  timeoutOccurred: boolean;
  elapsedMs: number;
  errors: string[];
}

export interface MeasuresWithTimeoutResult {
  success: boolean;
  measures: Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    expression: string;
    label: string;
    formatType: string;
    formatPattern: string;
    decimals: number;
    useThousands: boolean;
  }>;
  totalCount: number;
  processedCount: number;
  skippedCount: number;
  reconnects: number;
  timeoutOccurred: boolean;
  elapsedMs: number;
  errors: string[];
}

export interface ScriptResult {
  success: boolean;
  script: string;
  sections: Array<{
    name: string;
    content: string;
  }>;
  elapsedMs: number;
  error?: string;
}

// ===== HYPERCUBE TYPES =====

export interface HypercubeDefinition {
  qDimensions?: Array<{
    qDef: {
      qFieldDefs: string[];
      qFieldLabels?: string[];
    };
  }>;
  qMeasures?: Array<{
    qDef: {
      qDef: string;
      qLabel?: string;
    };
  }>;
  qInitialDataFetch?: Array<{
    qTop: number;
    qLeft: number;
    qWidth: number;
    qHeight: number;
  }>;
}

export interface HypercubeData {
  columns: Array<{
    name: string;
    type: 'dimension' | 'measure';
    index: number;
    field?: string;
    expression?: string;
    format?: any;
  }>;
  rows: Array<Record<string, any>>;
  totalRows: number;
  fetchedRows: number;
  hasMore: boolean;
}
