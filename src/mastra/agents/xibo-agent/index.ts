import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { getTools } from '../../tools/xibo-agent/';
import { xiboAgentInstructions } from './instructions';

export const xiboAgent = new Agent({
  name: 'Xibo Agent',
  instructions: xiboAgentInstructions,
  model: google('gemini-1.5-pro'),
  tools: getTools()
}); 