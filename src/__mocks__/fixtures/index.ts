/**
 * Test Fixtures Index
 * Central export for all test fixtures
 */

export * from './apps.fixture.js';
export * from './spaces.fixture.js';

// Common test data
export const testTenantUrl = 'https://test-tenant.qlikcloud.com';
export const testApiKey = 'test-api-key-12345';
export const testAppId = 'e2f1700e-98dc-4ac9-b483-ca4a0de183ce';

// Common error responses
export const errorResponses = {
  unauthorized: {
    status: 401,
    message: 'Unauthorized',
    data: { error: 'Invalid or expired API key' },
  },
  notFound: {
    status: 404,
    message: 'Not Found',
    data: { error: 'Resource not found' },
  },
  serverError: {
    status: 500,
    message: 'Internal Server Error',
    data: { error: 'An unexpected error occurred' },
  },
  rateLimited: {
    status: 429,
    message: 'Too Many Requests',
    data: { error: 'Rate limit exceeded' },
  },
};
