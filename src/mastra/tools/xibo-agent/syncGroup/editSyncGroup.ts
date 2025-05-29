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
  data: syncGroupSchema,
});

export const editSyncGroup = createTool({
  id: "edit-sync-group",
  description: "同期グループを編集",
  inputSchema: z.object({
    syncGroupId: z.number(),
    name: z.string(),
    syncPublisherPort: z.number().optional(),
    syncSwitchDelay: z.number().optional(),
    syncVideoPauseDelay: z.number().optional(),
    leadDisplayId: z.number(),
    folderId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/syncgroup/${context.syncGroupId}/edit`);
    const formData = new FormData();
    
    formData.append("name", context.name);
    formData.append("leadDisplayId", context.leadDisplayId.toString());
    if (context.syncPublisherPort) formData.append("syncPublisherPort", context.syncPublisherPort.toString());
    if (context.syncSwitchDelay) formData.append("syncSwitchDelay", context.syncSwitchDelay.toString());
    if (context.syncVideoPauseDelay) formData.append("syncVideoPauseDelay", context.syncVideoPauseDelay.toString());
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
    console.log("Sync group edited successfully");
    return validatedData;
  },
});

export default editSyncGroup; 