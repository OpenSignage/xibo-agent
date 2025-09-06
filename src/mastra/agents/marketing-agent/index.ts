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
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { marketResearchWorkflow } from '../../workflows/market-research/marketResearch';
import { productAnalysisWorkflow } from '../../workflows/product-analysis/productAnalysis';
import { getProductsInfoUploadUrlsTool } from '../../tools/product-analysis';
import { strategyPlannerWorkflow } from '../../workflows/strategy-planner/strategyPlanner';
import { podcastPlannerWorkflow } from '../../workflows/podcast/podcastPlanner';
import { signageAdsPlannerWorkflow } from '../../workflows/signage-ads/signageAdsPlanner';
import { intelligentPresenterWorkflow } from '../../workflows/presenter/intelligentPresenter';
import { marketingAgentInstructions } from './instructions';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import { getReportsList } from '../../tools/util';

/**
 * @module marketingAgent
 * @description An agent specialized in conducting market research by leveraging a suite of tools and workflows.
 */
export const marketingAgent = new Agent({
  id: 'marketing-agent',
  name: 'Marketing Agent',
  description: 'An AI agent that performs market research, analyzes trends, and gathers competitive intelligence.',
  // Use a lighter model to reduce post-workflow quota pressure
  model: google('gemini-1.5-pro-latest'),
  instructions: marketingAgentInstructions,
  workflows: {
    marketResearch: marketResearchWorkflow,
    productAnalysis: productAnalysisWorkflow,
    strategyPlanner: strategyPlannerWorkflow,
    podcastPlanner: podcastPlannerWorkflow,
    signageAdsPlanner: signageAdsPlannerWorkflow,
    intelligentPresenter: intelligentPresenterWorkflow,
  },
  tools: {
    getProductsInfoUploadUrls: getProductsInfoUploadUrlsTool,
    getReportsList: getReportsList,
  },
  memory: new Memory({
    options: {
      // Retain the last 20 messages for context.
      lastMessages: 20,
      semanticRecall: {
        topK: 2,
        messageRange: {
          before: 2,
          after: 2
        }
      },
      threads: {
        generateTitle: true
      },
      workingMemory: {
        enabled: true,
      },
    },
    storage: new LibSQLStore({
      url: 'file:../../memory.db'
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:../../memory.db'
    }),
    embedder: fastembed
  })
}); 