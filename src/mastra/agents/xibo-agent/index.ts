import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { getCmsTime, getAbout, getUser, getUsers, getUserMe } from '../../tools/xibo-agent/';
import { xiboAgentInstructions } from './instructions';

export const xiboAgent = new Agent({
  name: 'Xibo Agent',
  instructions: xiboAgentInstructions,
  model: google('gemini-1.5-pro'),
  tools: {
    'get-cms-time': getCmsTime,
    'get-about': getAbout,
    'get-user': getUser,
    'get-users': getUsers,
    'get-user-me': getUserMe
  }
}); 