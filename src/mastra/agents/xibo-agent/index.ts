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
 * Xibo CMS Agent Definition
 * 
 * This module defines the Xibo Agent, an AI assistant specifically designed
 * to work with the Xibo CMS platform. The agent is configured with:
 * 
 * 1. A set of specialized tools for interacting with Xibo CMS API
 * 2. Custom instructions tailored for Xibo-specific tasks
 * 3. The Gemini 1.5 Pro model for sophisticated natural language understanding
 */

import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { getTools } from '../../tools/xibo-agent/';
import { xiboAgentInstructions } from './instructions';

/**
 * Xibo Agent instance
 * 
 * An AI agent specialized for managing and interacting with 
 * Xibo Digital Signage CMS through natural language.
 */
export const xiboAgent = new Agent({
  name: 'Xibo Agent',
  instructions: xiboAgentInstructions, // Custom instructions for Xibo operations
  model: google('gemini-1.5-pro'),     // Using Google's Gemini 1.5 Pro model
  tools: getTools()                     // All Xibo CMS API tools
}); 