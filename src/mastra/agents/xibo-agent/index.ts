import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { getCmsTime,
         getAbout,
         getUser,
         getUsers,
         getUserMe,
         getModules,
         getDisplays,
         getLayouts } from '../../tools/xibo-agent/';
import { xiboAgentInstructions } from './instructions';
import { getMCPTools } from '../../tools/xibo-agent/mcp';

const mcpTools = await getMCPTools();

export const xiboAgent = new Agent({
  name: 'Xibo Agent',
  instructions: xiboAgentInstructions,
  model: google('gemini-1.5-pro'),
  tools: {
    'get-cms-time': getCmsTime,
    'get-about': getAbout,
    'get-user': getUser,
    'get-users': getUsers,
    'get-user-me': getUserMe,
    'get-modules': getModules,
    'get-displays': getDisplays,
    'get-layouts': getLayouts,
    'canva': mcpTools.canva
  }
}); 