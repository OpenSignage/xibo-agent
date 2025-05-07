import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const menuBoardCategorySchema = z.object({
  menuCategoryId: z.number(),
  menuId: z.number(),
  name: z.string(),
  description: z.string().optional(),
  code: z.string().optional(),
  mediaId: z.number().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: menuBoardCategorySchema,
});

export const addMenuBoardCategory = createTool({
  id: "add-menu-board-category",
  description: "メニューボードカテゴリを追加",
  inputSchema: z.object({
    menuId: z.number(),
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

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuId}/category`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    if (context.mediaId) formData.append("mediaId", context.mediaId.toString());
    if (context.code) formData.append("code", context.code);
    if (context.description) formData.append("description", context.description);

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
    console.log("Menu board category added successfully");
    return validatedData;
  },
});

export default addMenuBoardCategory; 