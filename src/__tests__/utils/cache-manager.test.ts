/**
 * CacheManager Unit Tests
 */

import { CacheManager } from '../../utils/cache-manager.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    cacheManager.clearAllCaches();
  });

  describe('constructor', () => {
    it('should create instance with default TTL', () => {
      const manager = new CacheManager();
      expect(manager).toBeInstanceOf(CacheManager);
    });

    it('should create instance with custom TTL', () => {
      const customTTL = 10 * 60 * 1000; // 10 minutes
      const manager = new CacheManager(customTTL);
      expect(manager).toBeInstanceOf(CacheManager);
    });
  });

  describe('App Cache', () => {
    const mockApp = {
      id: 'app-123',
      name: 'Test App',
      resourceType: 'app' as const,
      description: 'Test description',
      spaceId: 'space-1',
    };

    it('should set and get app', () => {
      cacheManager.setApp('app-123', mockApp as any);
      const result = cacheManager.getApp('app-123');
      expect(result).toEqual(mockApp);
    });

    it('should return undefined for non-existent app', () => {
      const result = cacheManager.getApp('non-existent');
      expect(result).toBeUndefined();
    });

    it('should check if app exists', () => {
      expect(cacheManager.hasApp('app-123')).toBe(false);
      cacheManager.setApp('app-123', mockApp as any);
      expect(cacheManager.hasApp('app-123')).toBe(true);
    });

    it('should remove app from cache', () => {
      cacheManager.setApp('app-123', mockApp as any);
      expect(cacheManager.hasApp('app-123')).toBe(true);

      const removed = cacheManager.removeApp('app-123');
      expect(removed).toBe(true);
      expect(cacheManager.hasApp('app-123')).toBe(false);
    });

    it('should clear all apps', () => {
      cacheManager.setApp('app-1', { ...mockApp, id: 'app-1' } as any);
      cacheManager.setApp('app-2', { ...mockApp, id: 'app-2' } as any);

      cacheManager.clearAppCache();

      expect(cacheManager.hasApp('app-1')).toBe(false);
      expect(cacheManager.hasApp('app-2')).toBe(false);
    });

    it('should preload multiple apps', () => {
      const apps = [
        { ...mockApp, id: 'app-1' },
        { ...mockApp, id: 'app-2' },
        { ...mockApp, id: 'app-3' },
      ];

      cacheManager.preloadApps(apps as any[]);

      expect(cacheManager.hasApp('app-1')).toBe(true);
      expect(cacheManager.hasApp('app-2')).toBe(true);
      expect(cacheManager.hasApp('app-3')).toBe(true);
    });
  });

  describe('Search Cache', () => {
    const mockSearchResult = {
      apps: [{ id: 'app-1', name: 'App 1' }],
      totalCount: 1,
      query: 'test',
    };

    it('should set and get search result', () => {
      cacheManager.setSearchResult('search:test', mockSearchResult as any);
      const result = cacheManager.getSearchResult('search:test');
      expect(result).toEqual(mockSearchResult);
    });

    it('should return undefined for non-existent search', () => {
      const result = cacheManager.getSearchResult('non-existent');
      expect(result).toBeUndefined();
    });

    it('should check if search result exists', () => {
      expect(cacheManager.hasSearchResult('search:test')).toBe(false);
      cacheManager.setSearchResult('search:test', mockSearchResult as any);
      expect(cacheManager.hasSearchResult('search:test')).toBe(true);
    });

    it('should remove search result', () => {
      cacheManager.setSearchResult('search:test', mockSearchResult as any);
      const removed = cacheManager.removeSearchResult('search:test');
      expect(removed).toBe(true);
      expect(cacheManager.hasSearchResult('search:test')).toBe(false);
    });

    it('should clear all search results', () => {
      cacheManager.setSearchResult('search:1', mockSearchResult as any);
      cacheManager.setSearchResult('search:2', mockSearchResult as any);

      cacheManager.clearSearchCache();

      expect(cacheManager.hasSearchResult('search:1')).toBe(false);
      expect(cacheManager.hasSearchResult('search:2')).toBe(false);
    });
  });

  describe('Quota Cache', () => {
    const mockQuotas = {
      apps: { used: 10, limit: 100 },
      users: { used: 5, limit: 50 },
    };

    it('should set and get quotas', () => {
      cacheManager.setQuotas(mockQuotas);
      const result = cacheManager.getQuotas();
      expect(result).toEqual(mockQuotas);
    });

    it('should return null when no quotas cached', () => {
      const result = cacheManager.getQuotas();
      expect(result).toBeNull();
    });

    it('should clear quota cache', () => {
      cacheManager.setQuotas(mockQuotas);
      cacheManager.clearQuotaCache();
      const result = cacheManager.getQuotas();
      expect(result).toBeNull();
    });
  });

  describe('Cache Stats', () => {
    it('should return correct stats for empty cache', () => {
      const stats = cacheManager.getCacheStats();
      expect(stats).toEqual({
        appCacheSize: 0,
        searchCacheSize: 0,
        hasQuotaCache: false,
      });
    });

    it('should return correct stats with cached data', () => {
      cacheManager.setApp('app-1', { id: 'app-1' } as any);
      cacheManager.setApp('app-2', { id: 'app-2' } as any);
      cacheManager.setSearchResult('search:1', { apps: [] } as any);
      cacheManager.setQuotas({ test: true });

      const stats = cacheManager.getCacheStats();
      expect(stats).toEqual({
        appCacheSize: 2,
        searchCacheSize: 1,
        hasQuotaCache: true,
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate app and related search results', () => {
      const app = { id: 'app-123', name: 'Test' };
      const searchResult = {
        apps: [app],
        query: 'test',
      };

      cacheManager.setApp('app-123', app as any);
      cacheManager.setSearchResult('search:test', searchResult as any);

      cacheManager.invalidateAppCache('app-123');

      expect(cacheManager.hasApp('app-123')).toBe(false);
      expect(cacheManager.hasSearchResult('search:test')).toBe(false);
    });

    it('should invalidate search cache by pattern', () => {
      cacheManager.setSearchResult('search:sales', { apps: [] } as any);
      cacheManager.setSearchResult('search:hr', { apps: [] } as any);
      cacheManager.setSearchResult('filter:sales', { apps: [] } as any);

      cacheManager.invalidateSearchCacheByPattern('sales');

      expect(cacheManager.hasSearchResult('search:sales')).toBe(false);
      expect(cacheManager.hasSearchResult('filter:sales')).toBe(false);
      expect(cacheManager.hasSearchResult('search:hr')).toBe(true);
    });
  });

  describe('Clear All Caches', () => {
    it('should clear all caches at once', () => {
      cacheManager.setApp('app-1', { id: 'app-1' } as any);
      cacheManager.setSearchResult('search:1', { apps: [] } as any);
      cacheManager.setQuotas({ test: true });

      cacheManager.clearAllCaches();

      const stats = cacheManager.getCacheStats();
      expect(stats).toEqual({
        appCacheSize: 0,
        searchCacheSize: 0,
        hasQuotaCache: false,
      });
    });
  });
});
