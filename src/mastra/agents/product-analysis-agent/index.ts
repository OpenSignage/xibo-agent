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
import { productAnalysisWorkflow } from '../../workflows/product-analysis';
import { productAnalysisAgentInstructions } from './instructions';

/**
 * @module productAnalysisAgent
 * @description An agent specialized in analyzing product information from various documents.
 */
export const productAnalysisAgent = new Agent({
  id: 'product-analysis-agent',
  name: 'Product Analysis Agent',
  description: 'An AI agent that analyzes product information from a directory of files and generates a report.',
  model: google('gemini-1.5-pro-latest'),
  instructions: productAnalysisAgentInstructions,
  workflows: {
    productAnalysis: productAnalysisWorkflow,
  },
  tools: {},
}); 