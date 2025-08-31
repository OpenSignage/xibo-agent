/*
 * Start a workflow asynchronously and return its runId.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config as toolsConfig } from '../xibo-agent/config';

const inputSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.any()).optional(),
  runtimeContext: z.record(z.any()).optional(),
});

const outputSchema = z.union([
  z.object({ success: z.literal(true), data: z.object({ runId: z.string() }) }),
  z.object({ success: z.literal(false), message: z.string() })
]);

export const startWorkflowAsyncTool = createTool({
  id: 'start-workflow-async',
  description: 'Start a workflow asynchronously and return runId.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { workflowId, input, runtimeContext } = context as z.infer<typeof inputSchema>;
    try {
      const serverBase = toolsConfig.apiUrl.replace(/\/ext-api$/, '');
      const url = `${serverBase}/api/workflows/${encodeURIComponent(workflowId)}/start-async`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input || {}, runtimeContext: runtimeContext || {} }),
      });
      if (!res.ok) {
        return { success: false as const, message: `start-async failed: ${res.status}` };
      }
      const json = await res.json();
      const runId = json?.runId || json?.data?.runId || json?.id || '';
      if (!runId) return { success: false as const, message: 'runId not found in response' };
      return { success: true as const, data: { runId } };
    } catch (err) {
      return { success: false as const, message: String(err) };
    }
  },
});

