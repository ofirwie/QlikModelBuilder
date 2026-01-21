import * as vscode from 'vscode';

export interface QlikSpace {
    id: string;
    name: string;
    type: 'shared' | 'managed' | 'data' | 'personal';
    description?: string;
    ownerId?: string;
    createdAt?: string;
}

export interface QlikConnection {
    id: string;
    qName: string;
    qType: string;
    space?: string;
}

export interface TableInfo {
    name: string;
    schema?: string;
    type?: string;
    rowCount?: number;
}

export interface QlikApp {
    id: string;
    name: string;
    description?: string;
    spaceId?: string;
    ownerId?: string;
}

export interface QlikUser {
    id: string;
    name: string;
    email?: string;
    tenantId?: string;
}

export interface QlikReloadResult {
    id: string;
    status: 'queued' | 'reloading' | 'succeeded' | 'failed';
    startTime?: string;
    endTime?: string;
}

export interface SpaceRole {
    userId: string;
    type: 'owner' | 'producer' | 'consumer' | 'dataconsumer' | 'facilitator';
}

export class QlikApiService {
    private tenantUrl: string = '';
    private apiKey: string = '';

    constructor(private context: vscode.ExtensionContext) {
        this.loadCredentials();
    }

    private loadCredentials(): void {
        this.tenantUrl = this.context.globalState.get('qlik.tenantUrl', '');
        this.apiKey = this.context.globalState.get('qlik.apiKey', '');
    }

    async saveCredentials(tenantUrl: string, apiKey: string): Promise<void> {
        this.tenantUrl = tenantUrl.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = apiKey;
        await this.context.globalState.update('qlik.tenantUrl', this.tenantUrl);
        await this.context.globalState.update('qlik.apiKey', this.apiKey);
    }

    isConfigured(): boolean {
        return this.tenantUrl.length > 0 && this.apiKey.length > 0;
    }

    getCredentials(): { tenantUrl: string; apiKey: string } {
        return { tenantUrl: this.tenantUrl, apiKey: this.apiKey };
    }

    private async fetch<T>(endpoint: string): Promise<T> {
        if (!this.isConfigured()) {
            throw new Error('Qlik Cloud credentials not configured');
        }

        const url = `${this.tenantUrl}${endpoint}`;
        console.log('Fetching:', url);

        // Use dynamic import for node-fetch compatibility
        const https = await import('https');
        const http = await import('http');

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('Response status:', res.statusCode);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data) as T);
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', (err) => {
                console.error('Request error:', err);
                reject(err);
            });

            req.end();
        });
    }

    /**
     * HTTP request with body (POST, PUT, PATCH, DELETE)
     */
    private async fetchWithBody<T>(
        endpoint: string,
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        body?: object
    ): Promise<T> {
        if (!this.isConfigured()) {
            throw new Error('Qlik Cloud credentials not configured');
        }

        const url = `${this.tenantUrl}${endpoint}`;
        console.log(`${method}:`, url);

        const https = await import('https');

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const bodyStr = body ? JSON.stringify(body) : '';

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyStr)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('Response status:', res.statusCode);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            // Handle empty response (204 No Content)
                            if (!data || data.trim() === '') {
                                resolve({} as T);
                            } else {
                                resolve(JSON.parse(data) as T);
                            }
                        } catch (e) {
                            reject(new Error(`Invalid JSON response: ${data}`));
                        }
                    } else {
                        reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage} - ${data}`));
                    }
                });
            });

            req.on('error', (err) => {
                console.error('Request error:', err);
                reject(err);
            });

            if (bodyStr) {
                req.write(bodyStr);
            }
            req.end();
        });
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const result = await this.fetch<{ data: QlikSpace[] }>('/api/v1/spaces?limit=1');
            return { success: true, message: `Connected! Found ${result.data.length > 0 ? 'spaces' : 'no spaces yet'}` };
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async getSpaces(): Promise<QlikSpace[]> {
        const result = await this.fetch<{ data: QlikSpace[] }>('/api/v1/spaces');
        return result.data;
    }

    async getConnections(): Promise<QlikConnection[]> {
        const result = await this.fetch<{ data: QlikConnection[] }>('/api/v1/data-connections');
        return result.data;
    }

    async getApps(): Promise<QlikApp[]> {
        const result = await this.fetch<{ data: Array<{ id: string; name: string; description?: string; spaceId?: string }> }>('/api/v1/items?resourceType=app');
        return result.data.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            spaceId: item.spaceId
        }));
    }

    // ==========================================
    // PHASE 2: Space Management
    // ==========================================

    /**
     * Create a new space
     */
    async createSpace(
        name: string,
        type: 'shared' | 'managed' | 'data' = 'shared',
        description?: string
    ): Promise<QlikSpace> {
        const result = await this.fetchWithBody<QlikSpace>(
            '/api/v1/spaces',
            'POST',
            {
                name,
                type,
                description: description || `Space created by QMB for ${name}`
            }
        );
        return result;
    }

    /**
     * Assign a role to a user in a space
     */
    async assignSpaceRole(
        spaceId: string,
        userId: string,
        role: 'owner' | 'producer' | 'consumer' | 'dataconsumer' | 'facilitator'
    ): Promise<void> {
        await this.fetchWithBody(
            `/api/v1/spaces/${spaceId}/assignments`,
            'POST',
            {
                type: role,
                assigneeId: userId
            }
        );
    }

    /**
     * Get current user information
     */
    async getCurrentUser(): Promise<QlikUser> {
        const result = await this.fetch<QlikUser>('/api/v1/users/me');
        return result;
    }

    /**
     * Get a specific space by ID
     */
    async getSpace(spaceId: string): Promise<QlikSpace> {
        const result = await this.fetch<QlikSpace>(`/api/v1/spaces/${spaceId}`);
        return result;
    }

    // ==========================================
    // PHASE 3: Application Management
    // ==========================================

    /**
     * Create a new app in a space
     */
    async createApp(name: string, spaceId: string, description?: string): Promise<QlikApp> {
        const result = await this.fetchWithBody<{ attributes: QlikApp }>(
            '/api/v1/apps',
            'POST',
            {
                attributes: {
                    name,
                    spaceId,
                    description: description || `Created by QlikModelBuilder`
                }
            }
        );
        return result.attributes;
    }

    /**
     * Get app details
     */
    async getApp(appId: string): Promise<QlikApp> {
        const result = await this.fetch<{ attributes: QlikApp }>(`/api/v1/apps/${appId}`);
        return result.attributes;
    }

    /**
     * Update app script
     */
    async updateAppScript(appId: string, script: string): Promise<void> {
        await this.fetchWithBody(
            `/api/v1/apps/${appId}/data/scripts`,
            'PUT',
            {
                script
            }
        );
    }

    // ==========================================
    // PHASE 4: Connection Management
    // ==========================================

    /**
     * Create a data connection
     */
    async createConnection(params: {
        name: string;
        type: string;
        spaceId?: string;
        connectionString?: string;
        path?: string;
    }): Promise<QlikConnection> {
        const body: Record<string, unknown> = {
            qName: params.name,
            qType: params.type,
            space: params.spaceId
        };

        if (params.connectionString) {
            body.qConnectionString = params.connectionString;
        }

        const result = await this.fetchWithBody<QlikConnection>(
            '/api/v1/data-connections',
            'POST',
            body
        );
        return result;
    }

    /**
     * Test a data connection
     */
    async testDataConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
        try {
            await this.fetch(`/api/v1/data-connections/${connectionId}`);
            return { success: true, message: 'Connection is valid' };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection test failed'
            };
        }
    }

    /**
     * Get connections in a specific space
     */
    async getConnectionsInSpace(spaceId: string): Promise<QlikConnection[]> {
        const result = await this.fetch<{ data: QlikConnection[] }>(
            `/api/v1/data-connections?spaceId=${spaceId}`
        );
        return result.data;
    }

    /**
     * Get tables from a data connection
     * Note: Full implementation requires engine session. Returns mock data for UI testing.
     */
    async getTables(connectionId: string): Promise<TableInfo[]> {
        if (!this.isConfigured()) {
            throw new Error('Qlik Cloud credentials not configured');
        }

        if (!connectionId) {
            throw new Error('Connection ID is required');
        }

        console.log(`[QlikApi] Getting tables for connection: ${connectionId}`);

        // Mock data for testing UI flow
        // TODO: Implement via Qlik engine API using connection metadata
        return [
            { name: 'customers', schema: 'public', rowCount: 1500 },
            { name: 'orders', schema: 'public', rowCount: 25000 },
            { name: 'products', schema: 'public', rowCount: 340 },
            { name: 'order_items', schema: 'public', rowCount: 75000 },
            { name: 'categories', schema: 'public', rowCount: 25 }
        ];
    }

    // ==========================================
    // PHASE 8: Reload & Automation
    // ==========================================

    /**
     * Trigger app reload
     */
    async reloadApp(appId: string): Promise<QlikReloadResult> {
        const result = await this.fetchWithBody<QlikReloadResult>(
            `/api/v1/reloads`,
            'POST',
            { appId }
        );
        return result;
    }

    /**
     * Get reload status
     */
    async getReloadStatus(reloadId: string): Promise<QlikReloadResult> {
        const result = await this.fetch<QlikReloadResult>(`/api/v1/reloads/${reloadId}`);
        return result;
    }

    /**
     * Wait for reload to complete (polls every 5 seconds)
     */
    async waitForReload(reloadId: string, maxWaitMs: number = 300000): Promise<QlikReloadResult> {
        const startTime = Date.now();
        const pollInterval = 5000; // 5 seconds

        while (Date.now() - startTime < maxWaitMs) {
            const status = await this.getReloadStatus(reloadId);

            if (status.status === 'succeeded' || status.status === 'failed') {
                return status;
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Reload timed out after ${maxWaitMs / 1000} seconds`);
    }
}
