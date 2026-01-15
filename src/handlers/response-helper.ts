/**
 * MCP Response Helper - Standardized response formatting
 *
 * Provides consistent response format for all MCP tool handlers.
 * Replaces repetitive JSON.stringify patterns across handlers.
 */

/**
 * MCP Response type - standard format for tool responses
 */
export interface McpResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Create a successful MCP response
 * @param data - The data to include in the response
 * @returns Formatted MCP response object
 */
export function createMcpResponse(data: any): McpResponse {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

/**
 * Create an error MCP response
 * @param message - Error message
 * @param details - Optional additional error details
 * @returns Formatted MCP error response
 */
export function createMcpError(message: string, details?: Record<string, any>): McpResponse {
  return createMcpResponse({
    success: false,
    error: message,
    ...details
  });
}

/**
 * Create a success MCP response with standard success flag
 * @param data - The data to include
 * @returns Formatted MCP success response
 */
export function createMcpSuccess(data: any): McpResponse {
  return createMcpResponse({
    success: true,
    ...data
  });
}

/**
 * Wrap a handler function with standard error handling
 * @param fn - The handler function to wrap
 * @returns Wrapped function with error handling
 */
export function withErrorHandling<T extends any[]>(
  fn: (...args: T) => Promise<any>
): (...args: T) => Promise<McpResponse> {
  return async (...args: T): Promise<McpResponse> => {
    try {
      const result = await fn(...args);
      // If result is already McpResponse format, return as-is
      if (result?.content?.[0]?.type === 'text') {
        return result;
      }
      return createMcpResponse(result);
    } catch (error) {
      return createMcpError(
        error instanceof Error ? error.message : String(error)
      );
    }
  };
}
