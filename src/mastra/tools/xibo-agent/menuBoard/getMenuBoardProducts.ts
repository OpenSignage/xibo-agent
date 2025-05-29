import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const menuBoardProductSchema = z.object({
  menuProductId: z.number(),
  menuCategoryId: z.number(),
  menuId: z.number(),
  name: z.string(),
  price: z.number().optional(),
  description: z.string().optional(),
  code: z.string().optional(),
  displayOrder: z.number(),
  availability: z.number().optional(),
  allergyInfo: z.string().optional(),
  calories: z.number().optional(),
  mediaId: z.number().optional(),
  productOptions: z.array(z.string()).optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(menuBoardProductSchema),
});

export const getMenuBoardProducts = createTool({
  id: "get-menu-board-products",
  description: "メニューボード商品を検索",
  inputSchema: z.object({
    menuCategoryId: z.number(),
    menuId: z.number().optional(),
    name: z.string().optional(),
    code: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuCategoryId}/products`);
    
    // クエリパラメータの追加
    if (context.menuId) url.searchParams.append("menuId", context.menuId.toString());
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
    console.log("Menu board products retrieved successfully");
    return validatedData;
  },
});

export default getMenuBoardProducts; 