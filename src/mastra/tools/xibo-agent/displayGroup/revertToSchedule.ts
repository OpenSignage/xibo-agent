import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const revertToSchedule = createTool({
  id: "revert-to-schedule",
  description: "スケジュールへの復帰",
  inputSchema: z.object({
    displayGroupId: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}/revertToSchedule`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Reverted to schedule successfully");
    return JSON.stringify(data);
  },
}); 