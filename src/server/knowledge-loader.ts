// ===== KNOWLEDGE BASE LOADER =====
// Loads SysAid field intelligence and business context for MCP Resources

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'KnowledgeLoader' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface KnowledgeBase {
  fieldIntelligence: any;
  businessContext: any;
}

// Cache the loaded knowledge base
let cachedKnowledgeBase: KnowledgeBase | null = null;

/**
 * Load the knowledge base files from docs/knowledge/
 * Uses caching to avoid repeated file reads
 */
export function loadKnowledgeBase(): KnowledgeBase {
  if (cachedKnowledgeBase) {
    return cachedKnowledgeBase;
  }

  const basePath = path.join(__dirname, '../../docs/knowledge');

  try {
    const fieldIntelligence = JSON.parse(
      fs.readFileSync(path.join(basePath, 'field-intelligence.json'), 'utf8')
    );

    const businessContext = JSON.parse(
      fs.readFileSync(path.join(basePath, 'business-context.json'), 'utf8')
    );

    cachedKnowledgeBase = {
      fieldIntelligence,
      businessContext,
    };

    return cachedKnowledgeBase;
  } catch (error) {
    log.error('Failed to load knowledge base', error as Error);
    throw error;
  }
}

/**
 * Get field intelligence data
 */
export function getFieldIntelligence(): any {
  return loadKnowledgeBase().fieldIntelligence;
}

/**
 * Get business context data
 */
export function getBusinessContext(): any {
  return loadKnowledgeBase().businessContext;
}

/**
 * Resource definitions for MCP
 */
export const KNOWLEDGE_RESOURCES = [
  {
    uri: 'knowledge://sysaid/field-intelligence',
    name: 'SysAid Field Intelligence',
    description: 'Complete mapping of 232 SysAid fields with Hebrew/English aliases, correlations, and benchmarks',
    mimeType: 'application/json',
  },
  {
    uri: 'knowledge://sysaid/business-context',
    name: 'SysAid Business Context',
    description: 'SLA facts, benchmarks, and team information for SysAid analytics',
    mimeType: 'application/json',
  },
];

/**
 * Read a knowledge resource by URI
 */
export function readKnowledgeResource(uri: string): string | null {
  const kb = loadKnowledgeBase();

  if (uri === 'knowledge://sysaid/field-intelligence') {
    return JSON.stringify(kb.fieldIntelligence, null, 2);
  }

  if (uri === 'knowledge://sysaid/business-context') {
    return JSON.stringify(kb.businessContext, null, 2);
  }

  return null;
}
