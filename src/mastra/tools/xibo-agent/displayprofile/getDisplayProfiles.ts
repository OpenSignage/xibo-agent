import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const getDisplayProfiles = createTool({
  id: "get-display-profiles",
  description: "ディスプレイプロファイルの検索",
  inputSchema: z.object({
    displayProfileId: z.number().optional(),
    displayProfile: z.string().optional(),
    type: z.string().optional(),
    embed: z.string().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/displayprofile`);
    if (context.displayProfileId) url.searchParams.append("displayProfileId", context.displayProfileId.toString());
    if (context.displayProfile) url.searchParams.append("displayProfile", context.displayProfile);
    if (context.type) url.searchParams.append("type", context.type);
    if (context.embed) url.searchParams.append("embed", context.embed);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display profiles retrieved successfully");
    return JSON.stringify(data);
  },
}); 