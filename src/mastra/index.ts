import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent } from './agents/weather';
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';
import { svgWorkflow } from './workflows/svg-illustration';
import { createMCPAgent } from './agents/mcp-agent';

export const mastra = new Mastra({
  agents: {
    weather: weatherAgent,
    xibo: xiboAgent,
    manual: xiboManualAgent,
    mcp: await createMCPAgent()
  },
  workflows: {
    weather: weatherWorkflow,
    illustration: svgWorkflow,
  },
  logger: createLogger({
    name: 'Xibo-System',
    level: 'debug',
  }),
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
});

export const workflows = [
  // ... existing workflows ...
];
