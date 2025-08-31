/*
 * Get workflow run status by runId.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config as toolsConfig } from '../xibo-agent/config';

const inputSchema = z.object({
  workflowId: z.string(),
  runId: z.string(),
});

const outputSchema = z.union([
  z.object({ success: z.literal(true), data: z.object({ status: z.string(), raw: z.any().optional() }) }),
  z.object({ success: z.literal(false), message: z.string() })
]);

export const getWorkflowRunStatusTool = createTool({
  id: 'get-workflow-run-status',
  description: 'Get workflow run status by runId.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { workflowId, runId } = context as z.infer<typeof inputSchema>;
    try {
      const serverBase = toolsConfig.apiUrl.replace(/\/ext-api$/, '');
      const url = `${serverBase}/api/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return { success: false as const, message: `status failed: ${res.status}` };
      const json = await res.json();
      const status = json?.status || json?.data?.status || '';
      if (!status) return { success: false as const, message: 'status not found' };
      return { success: true as const, data: { status, raw: json } };
    } catch (err) {
      return { success: false as const, message: String(err) };
    }
  },
});

