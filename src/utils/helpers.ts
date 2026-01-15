import { BulkOperationResult } from '../config/qlik-config.js';

// ===== DATE FORMATTING UTILITIES =====

export function formatDateForAPI(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function getFirstDayOfCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `01.${month}.${year}`;
}

export function getLastDayOfCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');
  return `${String(lastDay).padStart(2, '0')}.${monthStr}.${year}`;
}

export function calculateDuration(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  
  try {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return Math.round((end - start) / 1000);
  } catch (error) {
    return 0;
  }
}

export function compareDates(date1?: string, date2?: string): number {
  if (!date1 && !date2) return 0;
  if (!date1) return 1;
  if (!date2) return -1;
  return new Date(date1).getTime() - new Date(date2).getTime();
}

// ===== STRING UTILITIES =====



export function fuzzyMatch(text: string, query: string, threshold: number): boolean {
  const distance = levenshteinDistance(text, query);
  const maxLength = Math.max(text.length, query.length);
  const similarity = 1 - (distance / maxLength);
  return similarity >= threshold;
}

export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + substitutionCost
      );
    }
  }

  return matrix[str2.length][str1.length];
}

// ===== ARRAY UTILITIES =====

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ===== CONVERSION UTILITIES =====

export function bytesToMegabytes(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function bytesToGigabytes(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

// ===== NORMALIZATION UTILITIES =====

export function normalizeReloadStatus(status: string): 'SUCCESS' | 'FAILED' | 'RUNNING' | 'QUEUED' {
  const normalizedStatus = status?.toUpperCase();
  
  // Qlik Cloud specific statuses
  if (['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'FINISHED'].includes(normalizedStatus)) return 'SUCCESS';
  if (['FAILED', 'ERROR', 'ABORTED', 'CANCELED', 'CANCELLED', 'EXCEEDED_LIMIT'].includes(normalizedStatus)) return 'FAILED';
  if (['RELOADING', 'RUNNING', 'EXECUTING', 'IN_PROGRESS', 'CANCELING'].includes(normalizedStatus)) return 'RUNNING';
  if (['QUEUED', 'PENDING', 'WAITING'].includes(normalizedStatus)) return 'QUEUED';
  
  // Default to FAILED for unknown statuses
  return 'FAILED';
}

// ===== BULK OPERATIONS UTILITIES =====

export async function performBulkOperation<T>(
  items: string[],
  operation: (item: string) => Promise<T>,
  operationName: string,
  concurrencyLimit: number = 5
): Promise<BulkOperationResult> {
  const startTime = Date.now();
  const successful: Array<{ appId: string; appName: string; result: T }> = [];
  const failed: Array<{ appId: string; appName?: string; error: string; suggestion?: string }> = [];

  const chunks = chunkArray(items, concurrencyLimit);

  for (const chunk of chunks) {
    const promises = chunk.map(async (itemId) => {
      try {
        const result = await operation(itemId);
        const itemName = `Item ${itemId}`;
        successful.push({ appId: itemId, appName: itemName, result });
      } catch (error) {
        const itemName = `Item ${itemId}`;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const suggestion = generateErrorSuggestion(errorMessage, operationName);
        failed.push({ appId: itemId, appName: itemName, error: errorMessage, suggestion });
      }
    });

    await Promise.all(promises);
  }

  const executionTime = Date.now() - startTime;

  return {
    successful,
    failed,
    summary: {
      total: items.length,
      succeeded: successful.length,
      failed: failed.length,
      executionTime
    }
  };
}

export function generateErrorSuggestion(error: string, operation: string): string {
  if (error.includes('404') || error.includes('not found')) {
    return 'Item may have been deleted or you may not have access permissions';
  }
  if (error.includes('403') || error.includes('forbidden')) {
    return 'Check your permissions for this item';
  }
  if (error.includes('401') || error.includes('unauthorized')) {
    return 'Authentication issue - check your API key';
  }
  if (error.includes('timeout')) {
    return 'Request timed out - try again or check network connection';
  }
  return `Failed to perform ${operation} - check item status and permissions`;
}

// ===== URL GENERATION UTILITIES =====

export function generateAppUrls(tenantUrl: string, appId: string): {
  url: string;
  directLink: string;
  editLink: string;
} {
  const baseUrl = tenantUrl.replace('/api/v1', '');
  return {
    url: `${baseUrl}/sense/app/${appId}`,
    directLink: `${baseUrl}/sense/app/${appId}/overview`,
    editLink: `${baseUrl}/sense/app/${appId}/editor`
  };
}

// ===== ENHANCED NAME RESOLUTION UTILITIES =====

export function extractReadableNameFromId(id: string): string | undefined {
  // Try to extract readable parts from auth0 IDs or email-like IDs
  if (id.includes('@')) {
    const emailPart = id.split('@')[0];
    return cleanupDisplayName(emailPart);
  }
  
  if (id.startsWith('auth0|')) {
    const cleanId = id.replace('auth0|', '');
    if (cleanId.includes('@')) {
      const emailPart = cleanId.split('@')[0];
      return cleanupDisplayName(emailPart);
    }
    // Handle other auth0 formats
    if (cleanId.length > 10) {
      return cleanupDisplayName(cleanId.substring(0, 10));
    }
  }
  
  return undefined;
}

export function cleanupDisplayName(name: string): string {
  // Convert common separators to spaces and title case
  return name
    .replace(/[._-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

// ===== ENHANCED APP FIELD MAPPING =====

export interface EnhancedAppFieldMapping {
  id: string;
  name: string;
  description: string;
  
  // Enhanced owner mapping
  owner: string;                    // Display value (name or ID)
  ownerName?: string;               // Human-readable name
  ownerId?: string;                 // Technical ID
  
  // Enhanced space mapping  
  spaceId?: string;                 // Technical ID
  spaceName?: string;               // Human-readable name
  
  // Enhanced size mapping
  appMemoryFootprint: number;       // Primary memory indicator (MB)
  size: number;                     // DEPRECATED: For backwards compatibility
  
  // Standard fields
  createdDate?: string;
  modifiedDate?: string;
  url?: string;
  directLink?: string;
  editLink?: string;
}

export function buildEnhancedAppFieldMapping(
  basicApp: any,
  ownerName?: string,
  spaceName?: string,
  memoryFootprintMB?: number
): EnhancedAppFieldMapping {
  const appId = basicApp.id || basicApp.attributes?.id;
  const ownerId = basicApp.owner || basicApp.attributes?.owner;
  const spaceId = basicApp.spaceId || basicApp.attributes?.spaceId;
  
  // Determine best display value for owner
  const ownerDisplay = ownerName || extractReadableNameFromId(ownerId) || ownerId;
  
  return {
    id: appId,
    name: basicApp.name || basicApp.attributes?.name || 'Unknown App',
    description: basicApp.description || basicApp.attributes?.description || '',
    
    // ENHANCED: Owner field mapping
    owner: ownerDisplay,              // Best available display name
    ownerName: ownerName,             // Explicit human name (if available)
    ownerId: ownerId,                 // Technical ID
    
    // ENHANCED: Space field mapping
    spaceId: spaceId,                 // Technical ID
    spaceName: spaceName,             // Human-readable name
    
    // ENHANCED: Memory field mapping
    appMemoryFootprint: memoryFootprintMB || 0,  // Primary memory indicator
    size: memoryFootprintMB || 0,                 // DEPRECATED compatibility
    
    // Standard fields
    createdDate: basicApp.createdDate || basicApp.attributes?.createdDate,
    modifiedDate: basicApp.modifiedDate || basicApp.attributes?.modifiedDate,
  };
}

// ===== VALIDATION UTILITIES =====

export function isValidAppId(appId: string): boolean {
  return typeof appId === 'string' && appId.length > 0;
}

export function isValidUserId(userId: string): boolean {
  return typeof userId === 'string' && userId.length > 0;
}

export function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// ===== MEMORY FOOTPRINT UTILITIES =====

export function formatMemoryFootprint(sizeInMB: number): string {
  if (sizeInMB === 0) return '0 MB';
  if (sizeInMB < 1) return `${(sizeInMB * 1024).toFixed(1)} KB`;
  if (sizeInMB < 1024) return `${sizeInMB.toFixed(1)} MB`;
  return `${(sizeInMB / 1024).toFixed(2)} GB`;
}

export function categorizeMemoryFootprint(sizeInMB: number): 'small' | 'medium' | 'large' | 'very-large' {
  if (sizeInMB < 10) return 'small';
  if (sizeInMB < 100) return 'medium';
  if (sizeInMB < 1000) return 'large';
  return 'very-large';
}

export function getMemoryRecommendation(sizeInMB: number): string {
  const category = categorizeMemoryFootprint(sizeInMB);
  
  switch (category) {
    case 'small':
      return 'App has a small memory footprint - good for performance';
    case 'medium':
      return 'App has a moderate memory footprint - monitor for growth';
    case 'large':
      return 'App has a large memory footprint - consider optimization';
    case 'very-large':
      return 'App has a very large memory footprint - optimization recommended';
    default:
      return 'Memory footprint analysis not available';
  }
}