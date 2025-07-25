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
import { webSearchTool } from '../../tools/market-research/webSearch';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { marketResearchAgentInstructions } from './instructions';

/**
 * @module marketResearchAgent
 * @description An agent specialized in conducting market research by leveraging a suite of tools and workflows.
 */
export const marketResearchAgent = new Agent({
  id: 'market-research-agent',
  name: 'Market Research Agent',
  description: 'An AI agent that performs market research, analyzes trends, and gathers competitive intelligence.',
  model: google('gemini-1.5-pro-latest'),
  instructions: marketResearchAgentInstructions,
  workflows: {
    marketResearch: marketResearchWorkflow,
  },
  tools: {
    webSearch: webSearchTool,
    contentScrape: contentScrapeTool,
    summarizeAndAnalyze: summarizeAndAnalyzeTool,
  },
}); 