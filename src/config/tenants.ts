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
// API keys are loaded from environment variables
const TENANT_CONFIGS: TenantConfig[] = [
  {
    id: 'qmb-main',
    name: 'QMB Main',
    url: 'https://iyil7lpmybpzhbm.de.qlikcloud.com',
    apiKey: process.env.QLIK_API_KEY || '',
    description: 'Qlik Model Builder main tenant',
  },
];

// Global state for active tenant
let activeTenantId: string = 'qmb-main';

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
