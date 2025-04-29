import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent } from './agents/weather';
import { xiboAgent } from './agents/xibo-agent';
import { xiboManualAgent } from './agents/xibo-manual';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, xiboAgent, xiboManualAgent },
  logger: createLogger({
    name: 'Xibo-Agent',
    level: 'info',
  }),
});

