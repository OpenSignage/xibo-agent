import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const getDisplayGroups = createTool({
  id: "get-display-groups",
  description: "ディスプレイグループの検索",
  inputSchema: z.object({
    displayGroupId: z.number().optional(),
    displayGroup: z.string().optional(),
    displayId: z.number().optional(),
    nestedDisplayId: z.number().optional(),
    dynamicCriteria: z.string().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displaygroup`);
    if (context.displayGroupId) url.searchParams.append("displayGroupId", context.displayGroupId.toString());
    if (context.displayGroup) url.searchParams.append("displayGroup", context.displayGroup);
    if (context.displayId) url.searchParams.append("displayId", context.displayId.toString());
    if (context.nestedDisplayId) url.searchParams.append("nestedDisplayId", context.nestedDisplayId.toString());
    if (context.dynamicCriteria) url.searchParams.append("dynamicCriteria", context.dynamicCriteria);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display groups retrieved successfully");
    return JSON.stringify(data);
  },
}); 