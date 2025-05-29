import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

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
  data: z.array(menuBoardCategorySchema),
});

export const getMenuBoardCategories = createTool({
  id: "get-menu-board-categories",
  description: "メニューボードカテゴリを検索",
  inputSchema: z.object({
    menuId: z.number(),
    menuCategoryId: z.number().optional(),
    name: z.string().optional(),
    code: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuId}/categories`);
    
    // クエリパラメータの追加
    if (context.menuCategoryId) url.searchParams.append("menuCategoryId", context.menuCategoryId.toString());
    if (context.name) url.searchParams.append("name", context.name);
    if (context.code) url.searchParams.append("code", context.code);

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
    console.log("Menu board categories retrieved successfully");
    return validatedData;
  },
});

export default getMenuBoardCategories; 