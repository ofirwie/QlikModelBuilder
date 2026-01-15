// ===== ENHANCED QLIK CONFIGURATION WITH STRUCTURED OUTPUT SUPPORT =====

export interface QlikConfig {
  tenantUrl: string;
  apiKey?: string;  // Optional for certificate auth (on-premise)
}

// ===== ENHANCED TYPE DEFINITIONS =====

export type ResourceType = 
  | 'automations' 
  | 'data' 
  | 'external.data' 
  | 'data.volume.consumption' 
  | 'amlDepModel' 
  | 'assistant' 
  | 'knowledgebase'
  | 'app'
  | 'reload'
  | 'analysis'
  | 'report';

export type ResourceAction = 
  | 'executed' 
  | '3rd_party_executed' 
  | 'move' 
  | 'register' 
  | 'aggregation' 
  | 'deployed' 
  | 'question.asked' 
  | 'pages.indexed'
  | 'reload'
  | 'scheduledReload'
  | 'analysis.performed'
  | 'report.generated'
  | 'visualization.rendered';

export type SearchStrategy = 'exact' | 'fuzzy' | 'contains' | 'startsWith' | 'endsWith';
export type SortOption = 'name' | 'createdDate' | 'modifiedDate' | 'appMemoryFootprint' | 'size' | 'usage' | 'performance';
export type ActivityLevel = 'low' | 'medium' | 'high';
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

// ===== ENHANCED APP INFORMATION WITH ALL REQUIRED ATTRIBUTES =====

export interface EnhancedAppInfo {
  // Core identification
  id: string;
  name: string;
  description?: string;
  
  // ENHANCED: Owner information with email
  owner: string;                    // Display name (e.g., "Önder Altınbilek")
  ownerName: string;               // Same as owner for clarity
  ownerId: string;                 // Qlik User ID (e.g., "6698f79565ae0490ab2af669")
  ownerAuth0Subject?: string;      // Auth0 subject for reference
  ownerEmail?: string;             // CRITICAL: Email from Users API
  ownerStatus?: string;            // Status from Users API
  
  // ENHANCED: Space information with resolved names
  spaceId?: string;                // Keep for backwards compatibility  
  spaceName?: string;              // CRITICAL: Resolved display-friendly space name
  
  // ENHANCED: Date information
  createdDate?: string;            // CRITICAL: Creation date
  modifiedDate?: string;           // CRITICAL: Last modified date
  
  // ENHANCED: Reload information
  lastReloadDate?: string;         // CRITICAL: Most recent reload date (ISO string)
  lastReloadStatus?: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'QUEUED'; // CRITICAL: Last reload status
  
  // Enhanced size mapping - size always means memory footprint for apps
  appMemoryFootprint?: number;      // Explicit memory footprint field (MB)
  size?: number;                    // App memory footprint (same as appMemoryFootprint)
  
  // Standard attributes
  url?: string;
  directLink?: string;
  editLink?: string;
  tags?: string[];
  category?: string;
  businessArea?: string;
  
  memoryUsage?: {
    current: number;
    peak: number;
    average: number;
    unit: 'MB' | 'GB';
    footprintMB: number;           // Clear memory footprint indicator
  };
  
  performance?: BasicPerformanceMetrics;
  
  lastReload?: {
    id: string;
    status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'QUEUED';
    startTime: string;
    endTime?: string;
    duration?: number;
    dataSize?: number;
    log?: string;
    errorMessage?: string;
    triggeredBy?: string;
    isScheduled?: boolean;
  };
  
  health?: {
    status: HealthStatus;
    uptime: number;
    reliability: number;
    issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      category: string;
      message: string;
      timestamp: string;
    }>;
    lastHealthCheck: string;
  };
  
  userInteraction?: {
    isFavorite?: boolean;
    personalNotes?: string;
    lastPersonalAccess?: string;
    personalRating?: number;
    bookmarks?: Array<{
      name: string;
      url: string;
      description?: string;
    }>;
  };

  recommendations?: string[];
}

// ===== NEW: STRUCTURED OUTPUT TYPES =====

export interface StructuredAppResult {
  name: string;
  id: string;
  owner: string;
  ownerEmail: string;
  created: string;
  lastModified: string;
  spaceId: string;
  spaceName: string;
  lastReload: string;
  formattedDisplay: string;
  rawAppData: EnhancedAppInfo;
}

// ===== ENHANCED SEARCH INTERFACES =====

export interface UnifiedSearchOptions {
  query?: string;
  strategy?: SearchStrategy;
  ownerId?: string;
  ownerName?: string;
  spaceId?: string;
  spaceName?: string;
  tags?: string[];
  category?: string;
  businessArea?: string;
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minAppMemoryFootprint?: number;    // Minimum app memory footprint in MB
  maxAppMemoryFootprint?: number;    // Maximum app memory footprint in MB  
  minSize?: number;                  // Minimum app memory footprint (same as minAppMemoryFootprint)
  maxSize?: number;                  // Maximum app memory footprint (same as maxAppMemoryFootprint)
  minPerformanceScore?: number;
  maxLoadTime?: number;
  minViews?: number;
  minUsers?: number;
  accessFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely';
  healthStatus?: HealthStatus[];
  reloadStatus?: ('SUCCESS' | 'FAILED' | 'RUNNING' | 'QUEUED')[];
  hasIssues?: boolean;
  visualizationTypes?: string[];
  hasAdvancedFeatures?: boolean;
  complexityLevel?: ('simple' | 'moderate' | 'complex')[];
  isShared?: boolean;
  collaboratorId?: string;
  onlyFavorites?: boolean;
  onlyRecent?: boolean;
  sort?: SortOption;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  fuzzyThreshold?: number;
  boostFavorites?: boolean;
  boostRecent?: boolean;
  includeMetadata?: boolean;
  autoDisambiguate?: boolean;
  returnFormat?: 'full' | 'summary' | 'links';
}

// ===== ENHANCED SEARCH METADATA INTERFACE =====

export interface SearchMetadata {
  query?: string;
  strategy: SearchStrategy;
  filtersApplied: number;
  exactMatches: number;
  partialMatches: number;
  fuzzyMatches: number;
  disambiguationRequired: boolean;
  suggestions: string[];
  searchQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

// ===== ENHANCED SEARCH RESULT WITH STRUCTURED OUTPUT =====

export interface UnifiedSearchResult {
  apps: EnhancedAppInfo[];
  totalCount: number;
  executionTime: number;
  searchMetadata: SearchMetadata;
  disambiguation?: {
    message: string;
    choices: Array<{
      index: number;
      app: EnhancedAppInfo;
      matchScore: number;
      matchReasons: string[];
      distinguishingFeatures: string[];
    }>;
    refinementOptions: Array<{
      description: string;
      filter: Partial<UnifiedSearchOptions>;
    }>;
  };
  filters: Record<string, any>;
  insights?: {
    bestMatch?: EnhancedAppInfo;
    recommendedAction?: string;
    alternativeSearches?: string[];
  };
  
  // ENHANCED: New attributes for search results metadata
  enhancedAttributes?: {
    spaceNamesResolved?: number;     // Number of space names resolved
    reloadDataFetched?: number;      // Number of reload data entries fetched
    newAttributesIncluded?: string[]; // List of new attributes included
    structuredResultsGenerated?: number; // Number of structured results generated
  };
  
  // NEW: Structured output support
  structuredResults?: string[];      // Array of formatted display strings
  structuredData?: StructuredAppResult[]; // Array of structured result objects
}

// ===== CONSUMPTION API INTERFACES =====

export interface LicenseConsumptionRecord {
  appId?: string;
  id: string;                    // SessionID
  endTime?: string;             // SessionEndTime
  duration?: number;            // SessionDuration
  userId?: string;              // SessionUserID
  startTime?: string;
  timestamp?: string;
  resourceType?: string;
  resourceAction?: string;
  localUsage?: number;
}

export interface RealUsageData {
  totalViews: number;           // Count of sessions
  uniqueUsers: number;          // Count(DISTINCT SessionUserID)
  totalSessions: number;        // Count(DISTINCT SessionID)
  lastAccessed: string;
  accessFrequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
  averageSessionDuration: number; // Avg(SessionDuration) converted to minutes
  avgSessionDurationMs: number;   // Avg(SessionDuration) in milliseconds
  popularityScore: number;
  trendingScore: number;
}

export interface SessionDetails {
  sessionId: string;            // [id] AS SessionID
  userId?: string;              // SessionUserID
  userName?: string;
  startTime?: string;
  endTime?: string;             // SessionEndTime
  duration?: number;            // SessionDuration
  appId?: string;
}

// ===== BASIC PERFORMANCE INTERFACES =====

export interface AppMetadata {
  reload_meta?: {
    cpu_time_spent_ms: number;
    peak_memory_bytes: number;
    fullReloadPeakMemoryBytes?: number;
    partialReloadPeakMemoryBytes?: number;
    hardware?: {
      logical_cores: number;
      total_memory: number;
    };
  };
  static_byte_size?: number;
  has_section_access?: boolean;
  is_direct_query_mode?: boolean;
  tables?: Array<{
    name: string;
    name_u0?: string;
    no_of_rows?: number;
    no_of_fields?: number;
    no_of_key_fields?: number;
    is_system?: boolean;
    is_system_u0?: boolean;
    byte_size?: number;
    byte_size_u0?: number;
    is_semantic?: boolean;
    is_semantic_u0?: boolean;
    is_loose?: boolean;           // KEY: Indicates circular references
    comment?: string;
    comment_u0?: string;
    __FK_tables?: string;
  }>;
  fields?: Array<{
    name: string;
    is_system?: boolean;
    is_hidden?: boolean;
    is_semantic?: boolean;
    distinct_only?: boolean;
    cardinal?: number;            // Distinct values count
    total_count?: number;         // Total values count
    is_locked?: boolean;
    always_one_selected?: boolean;
    is_numeric?: boolean;
    comment?: string;
    byte_size?: number;           // Field size in bytes
    is_synthetic?: boolean;
    is_loose?: boolean;           // KEY: Indicates circular references
    __KEY_fields?: string;
    __FK_fields?: string;
    src_tables?: Array<{
      "@Value": string;
      __FK_src_tables?: string;
    }>;
    tags?: Array<{               // KEY: This contains the synthetic key tags!
      "@Value_u0": string;       // This is where '$keypart', '$syn' values are!
      __FK_tags?: string;
    }>;
  }>;
  __FK_tables?: any;
  __FK_fields?: any;
  __KEY_root?: any;
}

export interface BasicPerformanceMetrics {
  reloadCpuTime: number;
  appRAMSizeMB: number;
  performanceScore: number;
  performanceBreakdown: {
    reloadTimeScore: number;
    memoryUsageScore: number;
    peakMemoryScore: number;
    dataModelScore: number;
  };
}

// ===== BULK OPERATIONS =====

export interface BulkOperationResult {
  successful: Array<{
    appId: string;
    appName: string;
    result: any;
  }>;
  failed: Array<{
    appId: string;
    appName?: string;
    error: string;
    suggestion?: string;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    executionTime: number;
  };
}

// ===== CAPACITY CONSUMPTION TYPES =====

export interface MultiPeriodCapacityResult {
  periodType: 'month' | 'quarter' | 'year' | 'custom' | 'all-time';
  dateRange: {
    start: string;
    end: string;
    totalPeriods: number;
  };
  overallConsumption: OverallConsumptionSummary;
  periodBreakdown: PeriodBreakdownItem[];
  historicalTrends?: HistoricalTrendsAnalysis;
  periodComparisons?: PeriodComparisons;
  capacityProjections?: CapacityProjections;
  capacityAlerts: CapacityAlert[];
  recommendations: string[];
  rawConsumptionData?: RawConsumptionByPeriod[];
  generatedAt: string;
  dataSource: string;
}

export interface OverallConsumptionSummary {
  totalLicenseConsumptionEvents: number;
  totalAutomationConsumption: number;
  totalAnalyticsConsumption: number;
  
  periodInsights: {
    totalPeriods: number;
    periodsWithData: number;
    averageEventsPerPeriod: number;
    peakUsagePeriod: {
      period: string;
      events: number;
      date: string;
    };
    lowestUsagePeriod: {
      period: string;
      events: number;
      date: string;
    };
    usageGrowthRate: number;
    usageVariability: 'low' | 'moderate' | 'high';
  };
  
  coveragePeriod: {
    start: string;
    end: string;
    totalDays: number;
  };
}

export interface PeriodBreakdownItem {
  period: string;
  startDate: string;
  endDate: string;
  totalEvents: number;
  summary: any; // License consumption summary for this period
}

export interface HistoricalTrendsAnalysis {
  status: 'insufficient-data' | 'analyzed';
  message?: string;
  trends?: {
    overall: 'increasing' | 'decreasing' | 'stable';
    byCategory: {
      automations: 'increasing' | 'decreasing' | 'stable';
      analytics: 'increasing' | 'decreasing' | 'stable';
      dataIntegration: 'increasing' | 'decreasing' | 'stable';
    };
    seasonality: {
      detected: boolean;
      pattern: string | null;
    };
    anomalies: any[];
    forecast: {
      nextPeriodPrediction: string;
      confidence: 'low' | 'medium' | 'high';
    };
  };
  analysisMetadata?: {
    periodsAnalyzed: number;
    trendConfidence: 'low' | 'medium' | 'high';
    dataQuality: 'poor' | 'fair' | 'good' | 'excellent';
  };
}

export interface PeriodComparisons {
  periodToperiodComparisons: PeriodComparison[];
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  significantChanges: SignificantChange[];
}

export interface PeriodComparison {
  currentPeriod: string;
  previousPeriod: string;
  changes: {
    totalEvents: ChangeMetric;
    automations: ChangeMetric;
    analytics: ChangeMetric;
  };
}

export interface ChangeMetric {
  current: number;
  previous: number;
  change: number;
  percentChange: number;
}

export interface SignificantChange {
  period: string;
  type: 'spike' | 'drop';
  magnitude: number;
}

export interface CapacityProjections {
  nextMonth: number;
  nextQuarter: number;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
}

export interface CapacityAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  category: string;
  message: string;
  recommendation: string;
  impact: string;
  dataSource?: string;
}

export interface RawConsumptionByPeriod {
  period: string;
  data: LicenseConsumptionRecord[];
}