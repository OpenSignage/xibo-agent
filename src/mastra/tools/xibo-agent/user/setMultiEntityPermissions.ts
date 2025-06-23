import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const setMultiEntityPermissions = createTool({
  id: "set-multi-entity-permissions",
  description: "Sets permissions for multiple entities.",
  inputSchema: z.object({
    entity: z.string(),
    ids: z.array(z.number()),
    groupIds: z.array(z.string()),
    ownerId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/user/permissions/${context.entity}/multiple`);
    
    // フォームデータの作成
    const formData = new FormData();
    context.ids.forEach(id => {
      formData.append("ids[]", id.toString());
    });
    context.groupIds.forEach(groupId => {
      formData.append("groupIds[]", groupId);
    });
    if (context.ownerId) formData.append("ownerId", context.ownerId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Multi-entity permissions set successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default setMultiEntityPermissions; 