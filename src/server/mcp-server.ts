// ===== MCP SERVER WRAPPER =====
// Provides clean abstraction over the MCP SDK

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry, ToolDefinition } from './tool-registry.js';
import { logger } from '../utils/logger.js';
import { KNOWLEDGE_RESOURCES, readKnowledgeResource } from './knowledge-loader.js';

export interface MCPServerOptions {
  name: string;
  version: string;
  platform: 'cloud' | 'on-premise';
}

/**
 * MCP Server wrapper that handles tool registration and request routing
 */
export class MCPServer {
  private server: Server;
  private registry: ToolRegistry;
  private platform: 'cloud' | 'on-premise';

  constructor(options: MCPServerOptions) {
    this.platform = options.platform;

    // Create MCP SDK server instance
    this.server = new Server(
      {
        name: options.name,
        version: options.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Create tool registry
    this.registry = new ToolRegistry(options.platform);

    // Setup handlers
    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.registry.getAllTools();
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};

      try {
        const tool = this.registry.getTool(toolName);

        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool not found: ${toolName}`
          );
        }

        if (!this.registry.isToolAvailable(toolName, this.platform)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Tool ${toolName} is not available on ${this.platform}`
          );
        }

        const result = await tool.handler(args);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool failed', { tool: toolName, error: error instanceof Error ? error.message : String(error) });

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    });

    // Error handler
    this.server.onerror = (error) => {
      logger.error('MCP Server error', error instanceof Error ? error : new Error(String(error)));
    };

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: KNOWLEDGE_RESOURCES.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        })),
      };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      try {
        const content = readKnowledgeResource(uri);

        if (!content) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Resource not found: ${uri}`
          );
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: content,
            },
          ],
        };
      } catch (error) {
        logger.error('Resource read failed', { uri, error: error instanceof Error ? error.message : String(error) });

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  /**
   * Register a single tool
   */
  registerTool(tool: ToolDefinition): void {
    this.registry.registerTool(tool);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: ToolDefinition[]): void {
    this.registry.registerTools(tools);
  }

  /**
   * Start the MCP server using stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Get server instance (for advanced usage)
   */
  getServerInstance(): Server {
    return this.server;
  }

  /**
   * Get tool registry (for advanced usage)
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }
}
