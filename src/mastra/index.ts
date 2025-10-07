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
import { config as dotEnvConfig } from 'dotenv';
import { resolve } from 'path';
import pino from 'pino';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { apiRoutes } from './api';
import { config } from './tools/xibo-agent/config';

// Import agents
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';
import { marketingAgent } from './agents/marketing-agent';
import { testAgent } from './agents/test-agent';
//import { voiceAgent } from './agents/voice-agent';

// Import workflows
import { marketResearchWorkflow } from './workflows/market-research/marketResearch';
import { productAnalysisWorkflow } from './workflows/product-analysis/productAnalysis';
import { intelligentPresenterWorkflow } from './workflows/presenter/intelligentPresenter';  
import { strategyPlannerWorkflow } from './workflows/strategy-planner/strategyPlanner';
import { podcastPlannerWorkflow } from './workflows/podcast/podcastPlanner';
import { signageAdsPlannerWorkflow } from './workflows/signage-ads/signageAdsPlanner';
import { recipeToPptxWorkflow } from './workflows/presenter/recipeToPptx';
import { mdToRecipeWorkflow } from './workflows/presenter/mdToRecipe';


// Load environment variables from .env.development
const envPath = resolve(process.cwd(), '.env.development');
dotEnvConfig({ path: envPath });

// Create pino logger instance
const pinoLogger = pino(
  {
    level: 'info',
  },
  pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'hostname',
          singleLine: false,
        },
      },
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: resolve(config.logsDir, 'system.log'), // Base file name
          frequency: 'daily', // Rotate daily
          dateFormat: 'yyyy-MM-dd',
          size: '1G', // サイズの上限を1GBに設定し、サイズによるローテーションを事実上無効化
          maxFiles: 7, // Keep 7 days of old logs
          mkdir: true,
        },
      },
    ],
  })
);

// The pino logger is structurally compatible with what Mastra expects at runtime.
// We cast it to 'any' to bypass the strict compile-time type checking of Mastra's Logger interface.
export const logger = pinoLogger as any;

// Initialize Mastra instance with core services
export const mastra = new Mastra({
  // Register available agents
  agents: {
    xibo: xiboAgent,         // Xibo system operation agent
    manual: xiboManualAgent, // Xibo manual operation agent
    marketing: marketingAgent, // Marketing agent
    test: testAgent // Test agent
  },
  // Register available workflows
  workflows: {
    marketResearch: marketResearchWorkflow,
    'market-research-workflow': marketResearchWorkflow,
    'market-research': marketResearchWorkflow,
    productAnalysis: productAnalysisWorkflow,
    intelligentPresenter: intelligentPresenterWorkflow,
    strategyPlanner: strategyPlannerWorkflow,
    podcastPlanner: podcastPlannerWorkflow,
    signageAdsPlanner: signageAdsPlannerWorkflow,
    recipeToPptx: recipeToPptxWorkflow,
    mdToRecipe: mdToRecipeWorkflow
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

// Expose mastra on global to allow tools to access memory without importing this file
(globalThis as any).__mastra = mastra;