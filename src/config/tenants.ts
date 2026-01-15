/**
 * Multi-Tenant Configuration
 * Supports switching between multiple Qlik Cloud tenants
 */

export interface TenantConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  description?: string;
}

export interface TenantsConfig {
  tenants: TenantConfig[];
  defaultTenant: string;
  activeTenant: string;
}

// Hardcoded tenant configurations
// API keys are loaded from environment or hardcoded for specific tenants
// QLIK_API_KEY_REAL is set by Jest setup before it mocks the real key
const TENANT_CONFIGS: TenantConfig[] = [
  {
    id: 'sysaid-main',
    name: 'SysAid Main',
    url: 'https://sysaid-main.eu.qlikcloud.com',
    apiKey: process.env.QLIK_API_KEY_REAL || process.env.QLIK_API_KEY || '',
    description: 'Main SysAid analytics tenant',
  },
  {
    id: 'sysaid-internal',
    name: 'SysAid Internal IT',
    url: 'https://sysaid-sysaidinternalit.eu.qlikcloud.com',
    apiKey: process.env.QLIK_API_KEY_INTERNAL || 'eyJhbGciOiJFUzM4NCIsImtpZCI6IjU2NjQzM2FmLTJhNWUtNDk0Mi1iZjBkLWQ3Y2MzMzFlM2Q3NyIsInR5cCI6IkpXVCJ9.eyJzdWJUeXBlIjoidXNlciIsInRlbmFudElkIjoiUjFxM2ZVUzdvRnIwSEZLZ2VleGpsb3Fwc2RxcVN6WW8iLCJqdGkiOiI1NjY0MzNhZi0yYTVlLTQ5NDItYmYwZC1kN2NjMzMxZTNkNzciLCJhdWQiOiJxbGlrLmFwaSIsImlzcyI6InFsaWsuYXBpL2FwaS1rZXlzIiwic3ViIjoiNjVjZjFkMTJkNDdmMjBkZjk4MWU5ZGUwIn0.D7_lHmEutes1rbEL9HwTX8eRQZ28_RXX-6joKfvzGbOXtAHyJl5JihfdQDus-darhFLb7c6d0OEYhXVuu7nrVcR1WtZ2TaON8Dl9qCw-Rrg6Y-S_sw0e0RywxZ3R1vXN',
    description: 'SysAid Internal IT tenant',
  },
];

// Global state for active tenant
let activeTenantId: string = 'sysaid-internal';

/**
 * Get all configured tenants
 */
export function getTenants(): TenantConfig[] {
  return TENANT_CONFIGS;
}

/**
 * Get tenant by ID
 */
export function getTenant(tenantId: string): TenantConfig | undefined {
  return TENANT_CONFIGS.find(t => t.id === tenantId);
}

/**
 * Get the currently active tenant
 */
export function getActiveTenant(): TenantConfig {
  const tenant = getTenant(activeTenantId);
  if (!tenant) {
    // Fallback to first tenant
    return TENANT_CONFIGS[0];
  }
  return tenant;
}

/**
 * Set the active tenant
 */
export function setActiveTenant(tenantId: string): TenantConfig {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Unknown tenant: ${tenantId}. Available: ${TENANT_CONFIGS.map(t => t.id).join(', ')}`);
  }
  activeTenantId = tenantId;
  return tenant;
}

/**
 * Get tenant ID from URL (for auto-detection)
 */
export function getTenantIdFromUrl(url: string): string | undefined {
  const tenant = TENANT_CONFIGS.find(t => url.includes(t.url.replace('https://', '')));
  return tenant?.id;
}

/**
 * List tenants in a formatted way
 */
export function listTenantsFormatted(): string {
  return TENANT_CONFIGS.map(t => {
    const isActive = t.id === activeTenantId ? ' (ACTIVE)' : '';
    return `- ${t.id}: ${t.name}${isActive}\n  URL: ${t.url}`;
  }).join('\n\n');
}
