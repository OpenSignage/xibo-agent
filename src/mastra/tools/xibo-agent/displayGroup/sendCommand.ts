import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const sendCommand = createTool({
  id: "send-command",
  description: "コマンドの送信",
  inputSchema: z.object({
    displayGroupId: z.number(),
    command: z.string(),
    params: z.string().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}/command`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("command", context.command);
    if (context.params) formData.append("params", context.params);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Command sent successfully");
    return JSON.stringify(data);
  },
}); 