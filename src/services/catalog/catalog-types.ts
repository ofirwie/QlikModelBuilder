/**
 * Type definitions for Data Catalog Service
 * Extracted from data-catalog-service.ts for better modularity
 */

// ===== DATASET TYPES =====

/**
 * Dataset subcategory types
 */
export type DatasetSubType = 'dataset' | 'qvd' | 'data-file' | 'dataconnection';

/**
 * Main item types with dataset as a parent category
 */
export type MainItemType = 'app' | 'dataset' | 'script' | 'automation' | 'ml-deployment' |
                    'ml-experiment' | 'assistant' | 'note' | 'link' | 'glossary' |
                    'knowledge-base' | 'dataflow' | 'datafilefolder';

// ===== SPACE INTERFACES =====

export interface SpaceCatalogSearchOptions {
  query?: string;
  spaceType?: 'personal' | 'shared' | 'managed' | 'data' | 'all';
  ownerId?: string;
  memberUserId?: string;
  hasDataAssets?: boolean;
  minItems?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created' | 'modified' | 'itemCount' | 'memberCount';
  sortOrder?: 'asc' | 'desc';
  includeMembers?: boolean;
  includeItems?: boolean;
  includeCounts?: boolean;
}

export interface SpaceCatalogResult {
  spaces: QlikSpace[];
  totalCount: number;
  searchTime: number;
  facets: SpaceFacets;
  summary: SpaceSummary;
}

export interface QlikSpace {
  id: string;
  name: string;
  description?: string;
  type: string;

  spaceInfo: {
    ownerId: string;
    ownerName: string;
    ownerEmail?: string;
    createdDate: string;
    modifiedDate: string;
    isActive: boolean;
    visibility: string;
  };

  members: SpaceMember[];
  dataAssets: DataAsset[];
  spaceItems: SpaceItem[];

  statistics: SpaceStatistics;
}

export interface SpaceMember {
  userId: string;
  userName: string;
  userEmail?: string;
  role: 'owner' | 'admin' | 'contributor' | 'consumer' | 'viewer';
  assignedDate?: string;
  assignedBy?: string;
  isActive: boolean;
}

export interface DataAsset {
  id: string;
  name: string;
  type: 'dataset' | 'qvd' | 'data-file';
  ownerId: string;
  ownerName: string;
  createdDate?: string;
  modifiedDate?: string;
  size?: number;
  resourceType?: string;
  resourceSubType?: string;
  resourceAttributes?: any;
  description?: string;
  tags: string[];
}

export interface SpaceItem {
  id: string;
  name: string;
  type: MainItemType;
  ownerId: string;
  ownerName: string;
  createdDate?: string;
  modifiedDate?: string;
  size?: number;
  resourceType?: string;
  resourceSubType?: string;
  resourceAttributes?: any;
  description?: string;
  tags: string[];
}

export interface SpaceStatistics {
  totalItems: number;
  totalMembers: number;
  membersByRole: Record<string, number>;
  lastActivity: string;
  storageUsed: number;

  itemsByType?: Record<string, number>;
  datasetsCount?: number;
  dataAssetsCount?: number;
  datasetsBySubType?: {
    dataset: number;
    qvd: number;
    dataFile: number;
  };

  appsCount?: number;
  automationsCount?: number;
  scriptsCount?: number;
  mlDeploymentsCount?: number;
  dataflowsCount?: number;
  knowledgeBasesCount?: number;
  assistantsCount?: number;
  mlExperimentsCount?: number;
}

export interface SpacePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canCreateItems: boolean;
}

export interface SpaceFacets {
  spaceTypes: Array<{ type: string; count: number }>;
  owners: Array<{ ownerId: string; ownerName: string; count: number }>;
  itemTypes: Array<{ type: string; count: number }>;
  activityRanges: Array<{ range: string; count: number }>;
}

export interface SpaceSummary {
  totalSpaces: number;
  totalItems: number;
  totalMembers: number;
  totalDataAssets: number;
  averageStats: {
    itemsPerSpace: number;
    membersPerSpace: number;
  };
  topSpacesByItems: Array<{ name: string; items: number; type: string }>;
  topSpacesByMembers: Array<{ name: string; members: number; type: string }>;
  recentActivity: Array<{ name: string; lastActivity: string; type: string }>;
}

// ===== SPACE ITEMS INTERFACES =====

export interface SpaceItemsOptions {
  spaceId?: string;
  spaceIds?: string[];
  allSpaces?: boolean;
  skipPagination?: boolean;

  query?: string;
  itemTypes?: string[];
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  spaceType?: 'personal' | 'shared' | 'managed' | 'data' | 'all';
  hasDataAssets?: boolean;

  startDate?: string;
  endDate?: string;
  dateField?: 'created' | 'modified';
  timeframe?: number;
  timeframeUnit?: 'hours' | 'days' | 'weeks' | 'months';

  includeSpaceInfo?: boolean;
  includeOwnerInfo?: boolean;
  includeDetails?: boolean;
  groupBySpace?: boolean;
  groupByType?: boolean;

  cursor?: string;
  limit?: number;
  offset?: number;

  sortBy?: 'name' | 'created' | 'modified' | 'size' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface SpaceItemsResult {
  success: boolean;
  items?: SpaceItemResult[];
  groupedBySpace?: SpaceGroupResult[];
  groupedByType?: TypeGroupResult[];
  metadata?: {
    totalItems: number;
    returnedItems: number;
    cursor?: string;
    offset: number;
    limit: number;
    hasMore: boolean;
    searchTime: number;
    spacesSearched: number;
    filters: any;
  };
  error?: string;
}

export interface SpaceItemResult {
  id: string;
  name: string;
  normalizeItemType: string;
  resourceType?: string;
  owner?: string;
  ownerId?: string;
  created?: string;
  modified?: string;
  size?: number;
  sizeFormatted?: string;
  description?: string;
  tags?: string[];
  space?: {
    id: string;
    name: string;
    type: string;
    owner: string;
  };
}

export interface SpaceGroupResult {
  space: {
    id: string;
    name: string;
    type: string;
    owner: string;
  };
  itemCount: number;
  items: SpaceItemResult[];
}

export interface TypeGroupResult {
  type: string;
  count: number;
  items: SpaceItemResult[];
}

export interface EnhancedSpaceItem extends SpaceItem {
  _spaceId: string;
  _spaceName: string;
  _spaceType: string;
  _spaceOwner: string;
  _spaceOwnerId: string;
  owner?: string | { id?: string; name?: string };
  resourceSubType?: string;
}

// ===== CONTENT STATISTICS =====

export interface ContentStatistics {
  summary: {
    totalSpaces: number;
    totalItems: number;
    totalDataAssets: number;
    totalMembers: number;
    totalStorage: number;
    averageItemsPerSpace: number;
    averageMembersPerSpace: number;
  };

  typeDistribution: Record<string, {
    count: number;
    percentage: number;
    spacesWithType: number;
    uniqueOwners: number;
    totalSizeFormatted?: string;
    averageSize?: string;
  }>;

  assetTypes: string[];
  detailedTable: any[][];

  spaceBreakdown: {
    personal: number;
    shared: number;
    managed: number;
    data: number;
  };

  lastUpdated: string;

  dateMetrics?: {
    oldestContent: any;
    newestContent: any;
    contentByMonth: Array<{ month: string; count: number }>;
    monthsWithContent: number;
  };

  userMetrics?: {
    totalContentOwners: number;
    topContentOwners: any[];
    averageItemsPerOwner: number;
  };

  bySpace?: any[];
  byType?: any[];
  byOwner?: any[];
}

// ===== DATASET DETAILS =====

export interface DatasetDetails {
  itemId?: string;
  itemName: string;
  itemType: string;
  spaceId?: string;
  spaceName?: string;
  spaceTitle?: string;
  spaceType?: string;

  datasetId: string;
  resourceId: string;
  name: string;
  description?: string;

  isConnectionBased: boolean;
  connectionName?: string;
  connectionType?: string;
  connectionId?: string;
  appType?: string;

  size?: number;
  rowCount?: number;
  columnCount?: number;
  sizeFormatted: string;

  fields: any[];
  schema?: any;

  technicalName?: string;
  projectId?: string;
  datasetName?: string;
  tableName?: string;

  createdDate?: string;
  modifiedDate?: string;
  lastReloadDate?: string;
  createdBy?: string;
  modifiedBy?: string;

  rawItem?: any;
  rawDataset?: any;
}

export interface DatasetConnectionInfo {
  itemId?: string;
  itemName?: string;
  spaceName?: string;
  isConnectionBased: boolean;
  sourceType?: string;
  connectionType?: string;
  connectionName?: string;
  loadScriptGuidance?: string[];
  connectionTemplate?: string;
  loadTemplate?: string;
  selectiveLoadTemplate?: string;
  binaryLoadSyntax?: string;
  sourceApp?: any;
  fileName?: string;
  fileExtension?: string;
  datasetType?: string;
  loadSyntax?: string;
  datasetMetadata?: any;
  schema?: any;
  dataQuality?: any;
  warning?: string;
  spacePlaceholder?: string;
  error?: string;
}
