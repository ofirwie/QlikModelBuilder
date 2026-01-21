/**
 * Jest Setup File
 * Runs before all tests
 */

// Note: jest.setTimeout is set in jest.config.js via testTimeout

// Save REAL environment variables for integration tests BEFORE mocking
if (process.env.QLIK_API_KEY && process.env.QLIK_API_KEY !== 'test-api-key') {
  process.env.QLIK_API_KEY_REAL = process.env.QLIK_API_KEY;
  process.env.QLIK_TENANT_URL_REAL = process.env.QLIK_TENANT_URL || 'https://iyil7lpmybpzhbm.de.qlikcloud.com';
}

// Mock environment variables for unit testing
process.env.QLIK_TENANT_URL = 'https://test-tenant.qlikcloud.com';
process.env.QLIK_API_KEY = 'test-api-key';
process.env.QLIK_DEPLOYMENT = 'cloud';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Global test utilities
global.testUtils = {
  /**
   * Create a mock MCP response
   */
  createMcpResponse: (data: any, success = true) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success, ...data }),
      },
    ],
  }),

  /**
   * Create a mock API error
   */
  createApiError: (message: string, status = 500) => ({
    response: {
      status,
      data: { message },
    },
  }),

  /**
   * Wait for a condition with timeout
   */
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  },
};

// Type declaration for global test utilities
declare global {
  var testUtils: {
    createMcpResponse: (data: any, success?: boolean) => {
      content: Array<{ type: string; text: string }>;
    };
    createApiError: (message: string, status?: number) => {
      response: { status: number; data: { message: string } };
    };
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
  };
}

// Suppress console output during tests (optional)
// Uncomment to silence logs:
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

export {};
