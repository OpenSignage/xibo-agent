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
import { intelligentPresenterWorkflow } from '../../workflows/presenter';
import { intelligentPresenterAgentInstructions } from './instructions';

/**
 * @module intelligentPresenterAgent
 * @description An agent that orchestrates the generation of a presentation from a report.
 */
export const intelligentPresenterAgent = new Agent({
  id: 'intelligent-presenter-agent',
  name: 'Intelligent Presenter Agent',
  description: 'An AI agent that takes a markdown report and generates a PowerPoint presentation and a speech script.',
  model: google('gemini-1.5-pro-latest'),
  instructions: intelligentPresenterAgentInstructions,
  workflows: {
    intelligentPresenter: intelligentPresenterWorkflow,
  },
  tools: {},
}); 