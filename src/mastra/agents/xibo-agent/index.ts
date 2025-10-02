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
 * 4. Memory functionality to maintain context across conversations
 */

import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { getTools } from '../../tools/xibo-agent/';
import { xiboAgentInstructions } from './instructions';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';

/**
 * Xibo Agent instance
 * 
 * An AI agent specialized for managing and interacting with 
 * Xibo Digital Signage CMS through natural language.
 * 
 * Features:
 * - Natural language interaction with Xibo CMS
 * - Context-aware responses using memory
 * - Specialized tools for CMS operations
 * - Persistent conversation history
 */
export const xiboAgent = new Agent({
  name: 'Xibo Agent',
  instructions: xiboAgentInstructions,
  model: google('gemini-2.0-flash-exp'),
  tools: getTools(),
  memory: new Memory({
    options: {
      // Retain the last 40 messages for context.
      lastMessages: 40,
      semanticRecall: {
        topK: 2,
        messageRange: {
          before: 2,
          after: 2
        },
        scope: 'resource',
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