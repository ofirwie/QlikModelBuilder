/**
 * Mock API Client for Testing
 * Provides Jest mock functions for all API client methods
 */

export interface MockApiClientOptions {
  tenantUrl?: string;
  apiKey?: string;
}

/**
 * Create a mock API client instance
 */
export function createMockApiClient(options: MockApiClientOptions = {}) {
  const { tenantUrl = 'https://test-tenant.qlikcloud.com', apiKey = 'test-key' } = options;

  return {
    tenantUrl,
    apiKey,

    // HTTP methods
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),

    // Utility methods
    request: jest.fn().mockResolvedValue({ data: {} }),
    getHeaders: jest.fn().mockReturnValue({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),

    // Reset all mocks
    resetMocks: function () {
      this.get.mockClear();
      this.post.mockClear();
      this.put.mockClear();
      this.patch.mockClear();
      this.delete.mockClear();
      this.request.mockClear();
    },

    // Setup mock response for next call
    mockNextResponse: function (method: 'get' | 'post' | 'put' | 'patch' | 'delete', response: any) {
      this[method].mockResolvedValueOnce(response);
    },

    // Setup mock error for next call
    mockNextError: function (method: 'get' | 'post' | 'put' | 'patch' | 'delete', error: any) {
      this[method].mockRejectedValueOnce(error);
    },
  };
}

/**
 * Mock responses for common API endpoints
 */
export const mockResponses = {
  // Health check
  healthCheck: {
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  },

  // Tenant info
  tenantInfo: {
    data: {
      id: 'test-tenant-id',
      name: 'Test Tenant',
      hostName: 'test-tenant.qlikcloud.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  },

  // Users list
  usersList: {
    data: {
      data: [
        { id: 'user-1', name: 'Test User 1', email: 'user1@test.com' },
        { id: 'user-2', name: 'Test User 2', email: 'user2@test.com' },
      ],
      links: {},
    },
  },

  // Spaces list
  spacesList: {
    data: {
      data: [
        { id: 'space-1', name: 'Personal', type: 'personal' },
        { id: 'space-2', name: 'Shared', type: 'shared' },
      ],
      links: {},
    },
  },

  // Apps list
  appsList: {
    data: {
      data: [
        { id: 'app-1', name: 'Sales Dashboard', resourceType: 'app' },
        { id: 'app-2', name: 'HR Analytics', resourceType: 'app' },
      ],
      links: {},
    },
  },

  // Collections list
  collectionsList: {
    data: {
      data: [
        { id: 'coll-1', name: 'Favorites', type: 'favorite' },
        { id: 'coll-2', name: 'Sales Reports', type: 'public' },
      ],
      links: {},
    },
  },

  // Empty response
  empty: {
    data: {
      data: [],
      links: {},
    },
  },

  // Error responses
  errors: {
    unauthorized: {
      response: {
        status: 401,
        data: { message: 'Unauthorized' },
      },
    },
    notFound: {
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
    },
    serverError: {
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    },
  },
};

export type MockApiClient = ReturnType<typeof createMockApiClient>;
