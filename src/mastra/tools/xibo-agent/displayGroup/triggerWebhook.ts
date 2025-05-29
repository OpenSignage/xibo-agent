import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const triggerWebhook = createTool({
  id: "trigger-webhook",
  description: "Webhookのトリガー",
  inputSchema: z.object({
    displayGroupId: z.number(),
    triggerCode: z.string(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}/webhook`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("triggerCode", context.triggerCode);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Webhook triggered successfully");
    return JSON.stringify(data);
  },
}); 