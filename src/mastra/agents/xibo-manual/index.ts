import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { xiboManualTool } from '../../tools/xibo-manual/manual';
import { xiboManualInstructions } from './instructions';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';

export const xiboManualAgent = new Agent({
  name: 'Xibo Manual Agent',
  instructions: xiboManualInstructions,
  model: google('gemini-1.5-pro-latest'),
  tools: { xiboManualTool },
  memory: new Memory({
    options: {
      lastMessages: 40,
      semanticRecall: {
        topK: 2,
        messageRange: {
          before: 2,
          after: 2
        }
      },
      threads: {
        generateTitle: true
      }
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