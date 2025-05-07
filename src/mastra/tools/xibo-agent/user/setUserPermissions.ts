import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const setUserPermissions = createTool({
  id: "set-user-permissions",
  description: "ユーザー権限を設定",
  inputSchema: z.object({
    entity: z.string(),
    objectId: z.number(),
    groupIds: z.array(z.string()),
    ownerId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/user/permissions/${context.entity}/${context.objectId}`);
    
    // フォームデータの作成
    const formData = new FormData();
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

    console.log("User permissions set successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default setUserPermissions; 