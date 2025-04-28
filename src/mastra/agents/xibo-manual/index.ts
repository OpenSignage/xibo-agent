import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { xiboManualTool } from '../../tools/xibo-manual/manual';
import { instructions } from './instructions';

export const xiboManualAgent = new Agent({
  name: 'Xibo Manual Agent',
  instructions,
  model: google('gemini-1.5-pro-latest'),
  tools: { xiboManualTool },
}); 