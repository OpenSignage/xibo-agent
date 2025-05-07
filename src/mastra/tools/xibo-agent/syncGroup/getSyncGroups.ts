import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const syncGroupSchema = z.object({
  syncGroupId: z.number(),
  name: z.string(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  modifiedBy: z.number(),
  modifiedByName: z.string(),
  ownerId: z.number(),
  owner: z.string(),
  syncPublisherPort: z.number(),
  syncSwitchDelay: z.number(),
  syncVideoPauseDelay: z.number(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(syncGroupSchema),
});

export const getSyncGroups = createTool({
  id: "get-sync-groups",
  description: "同期グループを検索",
  inputSchema: z.object({
    syncGroupId: z.number().optional(),
    name: z.string().optional(),
    ownerId: z.number().optional(),
    folderId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/syncgroups`);
    
    // クエリパラメータの追加
    if (context.syncGroupId) url.searchParams.append("syncGroupId", context.syncGroupId.toString());
    if (context.name) url.searchParams.append("name", context.name);
    if (context.ownerId) url.searchParams.append("ownerId", context.ownerId.toString());
    if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Sync groups retrieved successfully");
    return validatedData;
  },
});

export default getSyncGroups; 