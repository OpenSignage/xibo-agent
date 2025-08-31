/*
 * Get final execution result of a workflow run.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config as toolsConfig } from '../xibo-agent/config';

const inputSchema = z.object({
  workflowId: z.string(),
  runId: z.string(),
});

const outputSchema = z.union([
  z.object({ success: z.literal(true), data: z.any() }),
  z.object({ success: z.literal(false), message: z.string() })
]);

export const getWorkflowExecutionResultTool = createTool({
  id: 'get-workflow-execution-result',
  description: 'Get final execution result of a workflow run.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { workflowId, runId } = context as z.infer<typeof inputSchema>;
    try {
      const serverBase = toolsConfig.apiUrl.replace(/\/ext-api$/, '');
      const url = `${serverBase}/api/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}/execution-result`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return { success: false as const, message: `execution-result failed: ${res.status}` };
      const json = await res.json();
      return { success: true as const, data: json };
    } catch (err) {
      return { success: false as const, message: String(err) };
    }
  },
});

