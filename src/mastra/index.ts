import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent } from './agents/weather';
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';
import { svgWorkflow } from './workflows/svg-illustration';

export const mastra = new Mastra({
  agents: {
    weather: weatherAgent,
    xibo: xiboAgent,
    manual: xiboManualAgent,
  },
  workflows: {
    weather: weatherWorkflow,
    illustration: svgWorkflow,
  },
  logger: createLogger({
    name: 'Xibo-Agent',
    level: 'debug',
  }),
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
});
