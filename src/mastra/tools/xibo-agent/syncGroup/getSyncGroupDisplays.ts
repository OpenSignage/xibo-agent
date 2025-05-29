import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

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

export const getSyncGroupDisplays = createTool({
  id: "get-sync-group-displays",
  description: "同期グループのメンバーを取得",
  inputSchema: z.object({
    syncGroupId: z.number(),
    eventId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/syncgroup/${context.syncGroupId}/displays`);
    if (context.eventId) url.searchParams.append("eventId", context.eventId.toString());

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
    console.log("Sync group displays retrieved successfully");
    return validatedData;
  },
});

export default getSyncGroupDisplays;

 