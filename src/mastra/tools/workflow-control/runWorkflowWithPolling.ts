/*
 * Start a workflow asynchronously and poll its status until completion.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config as toolsConfig } from '../xibo-agent/config';

const inputSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.any()).optional(),
  runtimeContext: z.record(z.any()).optional(),
  pollIntervalSec: z.number().optional().default(2),
  timeoutSec: z.number().optional().default(300),
});

const outputSchema = z.union([
  z.object({ success: z.literal(true), data: z.any() }),
  z.object({ success: z.literal(false), message: z.string() })
]);

export const runWorkflowWithPollingTool = createTool({
  id: 'run-workflow-with-polling',
  description: 'Start a workflow async and poll until finished, returning final result.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { workflowId, input, runtimeContext, pollIntervalSec, timeoutSec } = context as z.infer<typeof inputSchema>;
    try {
      const serverBase = toolsConfig.apiUrl.replace(/\/ext-api$/, '');
      // start-async
      const startUrl = `${serverBase}/api/workflows/${encodeURIComponent(workflowId)}/start-async`;
      const sres = await fetch(startUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input || {}, runtimeContext: runtimeContext || {} })
      });
      if (!sres.ok) return { success: false as const, message: `start-async failed: ${sres.status}` };
      const sjson = await sres.json();
      const runId = sjson?.runId || sjson?.data?.runId || sjson?.id || '';
      if (!runId) return { success: false as const, message: 'runId not found in response' };

      // poll
      const start = Date.now();
      while (true) {
        const url = `${serverBase}/api/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`;
        const res = await fetch(url);
        if (!res.ok) return { success: false as const, message: `status failed: ${res.status}` };
        const js = await res.json();
        const status = js?.status || js?.data?.status || '';
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
          break;
        }
        if (Date.now() - start > (timeoutSec || 300) * 1000) {
          return { success: false as const, message: 'timeout waiting for workflow completion' };
        }
        await new Promise(r => setTimeout(r, (pollIntervalSec || 2) * 1000));
      }

      // result
      const resultUrl = `${serverBase}/api/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}/execution-result`;
      const rres = await fetch(resultUrl);
      if (!rres.ok) return { success: false as const, message: `execution-result failed: ${rres.status}` };
      const rjson = await rres.json();
      return { success: true as const, data: rjson };
    } catch (err) {
      return { success: false as const, message: String(err) };
    }
  }
});

