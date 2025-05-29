import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const editMenuBoardCategory = createTool({
  id: "edit-menu-board-category",
  description: "メニューボードカテゴリを編集",
  inputSchema: z.object({
    menuCategoryId: z.number(),
    name: z.string(),
    mediaId: z.number().optional(),
    code: z.string().optional(),
    description: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuCategoryId}/category`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    if (context.mediaId) formData.append("mediaId", context.mediaId.toString());
    if (context.code) formData.append("code", context.code);
    if (context.description) formData.append("description", context.description);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Menu board category edited successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default editMenuBoardCategory; 