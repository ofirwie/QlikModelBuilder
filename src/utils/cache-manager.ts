import { EnhancedAppInfo, UnifiedSearchResult } from '../config/qlik-config.js';

export class CacheManager {
  private appCache: Map<string, EnhancedAppInfo> = new Map();
  private searchCache: Map<string, UnifiedSearchResult> = new Map();
  private quotaCache: { data?: any; timestamp?: number } = {};
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes default TTL

  constructor(cacheTTL?: number) {
    if (cacheTTL) {
      this.cacheTTL = cacheTTL;
    }
  }

  // ===== APP CACHE METHODS =====

  setApp(appId: string, app: EnhancedAppInfo): void {
    this.appCache.set(appId, app);
  }

  getApp(appId: string): EnhancedAppInfo | undefined {
    const app = this.appCache.get(appId);
    if (app && this.isAppCacheValid(app)) {
      return app;
    }
    
    // Remove expired cache entry
    if (app) {
      this.appCache.delete(appId);
    }
    
    return undefined;
  }

  hasApp(appId: string): boolean {
    return this.appCache.has(appId) && this.isAppCacheValid(this.appCache.get(appId)!);
  }

  removeApp(appId: string): boolean {
    return this.appCache.delete(appId);
  }

  clearAppCache(): void {
    this.appCache.clear();
  }

  private isAppCacheValid(app: EnhancedAppInfo): boolean {
    // For now, assume apps are always valid
    // In the future, you could add timestamp-based validation
    return true;
  }

  // ===== SEARCH CACHE METHODS =====

  setSearchResult(searchKey: string, result: UnifiedSearchResult): void {
    this.searchCache.set(searchKey, result);
  }

  getSearchResult(searchKey: string): UnifiedSearchResult | undefined {
    const result = this.searchCache.get(searchKey);
    if (result && this.isCacheValid(result, this.cacheTTL)) {
      return result;
    }
    
    // Remove expired cache entry
    if (result) {
      this.searchCache.delete(searchKey);
    }
    
    return undefined;
  }

  hasSearchResult(searchKey: string): boolean {
    return this.searchCache.has(searchKey) && 
           this.isCacheValid(this.searchCache.get(searchKey)!, this.cacheTTL);
  }

  removeSearchResult(searchKey: string): boolean {
    return this.searchCache.delete(searchKey);
  }

  clearSearchCache(): void {
    this.searchCache.clear();
  }

  // ===== QUOTA CACHE METHODS =====

  setQuotas(quotas: any): void {
    this.quotaCache = {
      data: quotas,
      timestamp: Date.now()
    };
  }

  getQuotas(): any | null {
    const cacheExpiry = 60 * 60 * 1000; // 1 hour for quota cache
    const now = Date.now();
    
    if (this.quotaCache.data && this.quotaCache.timestamp && 
        (now - this.quotaCache.timestamp) < cacheExpiry) {
      return this.quotaCache.data;
    }
    
    return null;
  }

  clearQuotaCache(): void {
    this.quotaCache = {};
  }

  // ===== GENERAL CACHE METHODS =====

  private isCacheValid(cachedResult: any, maxAge: number): boolean {
    // For now, return true since we don't have timestamp-based validation
    // In the future, you could add timestamp validation here
    return true;
  }

  clearAllCaches(): void {
    this.clearAppCache();
    this.clearSearchCache();
    this.clearQuotaCache();
  }

  getCacheStats(): {
    appCacheSize: number;
    searchCacheSize: number;
    hasQuotaCache: boolean;
  } {
    return {
      appCacheSize: this.appCache.size,
      searchCacheSize: this.searchCache.size,
      hasQuotaCache: Boolean(this.quotaCache.data)
    };
  }

  // ===== CACHE WARMUP METHODS =====

  preloadApps(apps: EnhancedAppInfo[]): void {
    apps.forEach(app => {
      this.setApp(app.id, app);
    });
  }

  // ===== CACHE INVALIDATION METHODS =====

  invalidateAppCache(appId: string): void {
    this.removeApp(appId);
    
    // Also remove any search results that might contain this app
    const searchKeys = Array.from(this.searchCache.keys());
    searchKeys.forEach(key => {
      const result = this.searchCache.get(key);
      if (result && result.apps.some(app => app.id === appId)) {
        this.removeSearchResult(key);
      }
    });
  }

  invalidateSearchCacheByPattern(pattern: string): void {
    const searchKeys = Array.from(this.searchCache.keys());
    searchKeys.forEach(key => {
      if (key.includes(pattern)) {
        this.removeSearchResult(key);
      }
    });
  }
}