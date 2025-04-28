import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { weatherTool, weeklyWeatherTool, weatherByCoordinatesTool } from '../../tools/weather';
import { weatherAgentInstructions } from './instructions';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: weatherAgentInstructions,
  model: google('gemini-1.5-pro-latest'),
  tools: { weatherTool, weeklyWeatherTool, weatherByCoordinatesTool },
});