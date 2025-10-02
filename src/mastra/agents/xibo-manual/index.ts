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
 * Xibo Manual Agent Definition
 *
 * This module defines the 'xiboManualAgent', a specialized agent for interacting
 * with the Xibo CMS user manual. It integrates the xiboManualTool to provide
 * up-to-date answers based on the manual's content. The agent is configured
 * with a specific AI model, instructions, and a memory system to retain
 * conversation context and improve performance.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { getTools } from '../../tools/xibo-manual/manual';
import { xiboManualInstructions } from './instructions';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';

// Defines and exports the specialized agent for handling Xibo manual queries.
export const xiboManualAgent = new Agent({
  name: 'Xibo Manual Agent',
  instructions: xiboManualInstructions,
  model: google('gemini-2.0-flash-exp'),
  tools: getTools(),
  memory: new Memory({
    options: {
      // Retain the last 40 messages for context.
      lastMessages: 40,
      // Use semantic search to recall relevant past conversations.
      semanticRecall: {
        topK: 3,
        messageRange: {
          before: 2,
          after: 2
        },
        scope: 'resource',
      },
      // Automatically generate titles for conversation threads.
      threads: {
        generateTitle: true
      },
      workingMemory: {
        enabled: true,
      },
    },
    // Use a LibSQL database for persistent storage of memories.
    storage: new LibSQLStore({
      url: 'file:../../memory.db'
    }),
    // Use a LibSQL vector store for efficient semantic searching.
    vector: new LibSQLVector({
      connectionUrl: 'file:../../memory.db'
    }),
    // Use the 'fastembed' model for creating vector embeddings of text.
    embedder: fastembed
  })
}); 