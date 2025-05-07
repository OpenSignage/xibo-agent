import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const editMenuBoard = createTool({
  id: "edit-menu-board",
  description: "メニューボードを編集",
  inputSchema: z.object({
    menuId: z.number(),
    name: z.string(),
    description: z.string().optional(),
    code: z.string().optional(),
    folderId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    if (context.description) formData.append("description", context.description);
    if (context.code) formData.append("code", context.code);
    if (context.folderId) formData.append("folderId", context.folderId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Menu board edited successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default editMenuBoard; 