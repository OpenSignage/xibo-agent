import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const assignSyncGroupMembers = createTool({
  id: "assign-sync-group-members",
  description: "同期グループにメンバーを割り当て",
  inputSchema: z.object({
    syncGroupId: z.number(),
    displayId: z.array(z.number()),
    unassignDisplayId: z.array(z.number()).optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/syncgroup/${context.syncGroupId}/members`);
    const formData = new FormData();
    
    formData.append("displayId", JSON.stringify(context.displayId));
    if (context.unassignDisplayId) formData.append("unassignDisplayId", JSON.stringify(context.unassignDisplayId));

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Sync group members assigned successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default assignSyncGroupMembers; 