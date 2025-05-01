import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent } from './agents/weather';
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';

export const mastra = new Mastra({
  agents: {
    weather: weatherAgent,
    xibo: xiboAgent,
    manual: xiboManualAgent,
  },
  workflows: {
    weather: weatherWorkflow,
  },
  logger: createLogger({
    name: 'Xibo-Agent',
    level: 'debug',
  }),
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
});

