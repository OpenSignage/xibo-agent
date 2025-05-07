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
  data: syncGroupSchema,
});

export const addSyncGroup = createTool({
  id: "add-sync-group",
  description: "新しい同期グループを追加",
  inputSchema: z.object({
    name: z.string(),
    syncPublisherPort: z.number().optional(),
    folderId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/syncgroup/add`);
    const formData = new FormData();
    
    formData.append("name", context.name);
    if (context.syncPublisherPort) formData.append("syncPublisherPort", context.syncPublisherPort.toString());
    if (context.folderId) formData.append("folderId", context.folderId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Sync group added successfully");
    return validatedData;
  },
});

export default addSyncGroup; 