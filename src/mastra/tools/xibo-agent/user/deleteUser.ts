import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const deleteUser = createTool({
  id: "delete-user",
  description: "ユーザーを削除",
  inputSchema: z.object({
    userId: z.number(),
    deleteAllItems: z.number().optional(),
    reassignUserId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/user/${context.userId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    if (context.deleteAllItems) formData.append("deleteAllItems", context.deleteAllItems.toString());
    if (context.reassignUserId) formData.append("reassignUserId", context.reassignUserId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("User deleted successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default deleteUser; 