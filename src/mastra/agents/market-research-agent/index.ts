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
import { openai } from '@ai-sdk/openai';
import { marketResearchWorkflow } from '../../workflows/market-research-workflow';
import { webSearchTool } from '../../tools/market-research/webSearch';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';

/**
 * @module marketResearchAgent
 * @description An agent specialized in conducting market research by leveraging a suite of tools and workflows.
 */
export const marketResearchAgent = new Agent({
  id: 'market-research-agent',
  name: 'Market Research Agent',
  description: 'An AI agent that performs market research, analyzes trends, and gathers competitive intelligence.',
  model: openai('gpt-4o-mini'), // Specify the language model to use
  instructions: `You are a professional market research analyst. Your goal is to provide insightful and concise reports based on user requests.
- When a user asks for a general market analysis, competitive overview, or trend report, utilize the 'marketResearch' workflow to conduct a comprehensive investigation.
- Clearly state the research topic to the workflow.
- Synthesize the final report from the workflow's output into a clear and easy-to-understand format for the user.
- For simple, direct queries, you can use individual tools, but prefer the workflow for complex requests.`,
  workflows: {
    marketResearch: marketResearchWorkflow,
  },
  tools: {
    webSearch: webSearchTool,
    contentScrape: contentScrapeTool,
    summarizeAndAnalyze: summarizeAndAnalyzeTool,
  },
}); 