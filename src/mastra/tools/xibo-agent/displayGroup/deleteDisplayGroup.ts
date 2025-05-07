import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const deleteDisplayGroup = createTool({
  id: "delete-display-group",
  description: "ディスプレイグループの削除",
  inputSchema: z.object({
    displayGroupId: z.number(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup/${context.displayGroupId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display group deleted successfully");
    return JSON.stringify(data);
  },
}); 