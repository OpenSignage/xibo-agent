/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * Main entry point for the Mastra application
 * This file initializes and provides the main components including
 * agents, workflows, logger, and storage
 */

// Import required modules
import { config } from 'dotenv';
import { resolve } from 'path';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createLogger } from '@mastra/core/logger';

// Import workflows and agents
import { weatherWorkflow } from './workflows';
import { weatherAgent } from './agents/weather';
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';
import { svgWorkflow } from './workflows/svg-illustration';
import { mcpAgent } from './agents/mcp-agent';

// Load environment variables
// Reads configuration from .env.development file
const envPath = resolve(process.cwd(), '.env.development');
config({ path: envPath });

// Create shared logger instance
// Used for centralized logging across the application
export const logger = createLogger({
  name: 'Xibo-System',
  level: 'info',  // Only outputs info, warn, and error levels (no debug)
});

// Initialize Mastra instance
// This is the core of the application that provides various services
export const mastra = new Mastra({
  // Register available agents
  agents: {
    weather: weatherAgent,   // Weather information agent
    xibo: xiboAgent,         // Xibo system operation agent
    manual: xiboManualAgent, // Xibo manual operation agent
    mcp: mcpAgent            // MCP (Master Control Program) agent
  },
  // Register available workflows
  workflows: {
    weather: weatherWorkflow,      // Weather information processing workflow
    illustration: svgWorkflow,     // SVG illustration generation workflow
  },
  // Set shared logger
  logger: logger,
  // Configure storage for data persistence
  storage: new LibSQLStore({
    url: 'file:../mastra.db',  // Path to SQLite database file
  }),
});

// Export workflows list
// These workflows are available for external use
export const workflows = [
  // ... existing workflows ...
];
