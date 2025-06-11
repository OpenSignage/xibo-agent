/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
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
import { apiRoutes } from './api';

// Import workflows and agents
import { weatherWorkflow } from './workflows';
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';
import { svgWorkflow } from './workflows/svg-illustration';
import { mcpAgent } from './agents/mcp-agent';

// Load environment variables from .env.development
const envPath = resolve(process.cwd(), '.env.development');
config({ path: envPath });

// Create shared logger instance for centralized logging
export const logger = createLogger({
  name: 'Xibo-System',
  level: 'info',  // Set to info level to exclude debug logs
});

// Initialize Mastra instance with core services
export const mastra = new Mastra({
  // Register available agents
  agents: {
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
  // カスタムAPIルートを追加
  server: {
    apiRoutes,
  },
});

// Export workflows list for external use
export const workflows = [
  // ... existing workflows ...
];
