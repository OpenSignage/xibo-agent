import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

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
  data: menuBoardProductSchema,
});

export const addMenuBoardProduct = createTool({
  id: "add-menu-board-product",
  description: "メニューボード商品を追加",
  inputSchema: z.object({
    menuCategoryId: z.number(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number().optional(),
    allergyInfo: z.string().optional(),
    calories: z.number().optional(),
    displayOrder: z.number(),
    availability: z.number().optional(),
    mediaId: z.number().optional(),
    code: z.string().optional(),
    productOptions: z.array(z.string()).optional(),
    productValues: z.array(z.string()).optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuCategoryId}/product`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    formData.append("displayOrder", context.displayOrder.toString());
    if (context.description) formData.append("description", context.description);
    if (context.price) formData.append("price", context.price.toString());
    if (context.allergyInfo) formData.append("allergyInfo", context.allergyInfo);
    if (context.calories) formData.append("calories", context.calories.toString());
    if (context.availability) formData.append("availability", context.availability.toString());
    if (context.mediaId) formData.append("mediaId", context.mediaId.toString());
    if (context.code) formData.append("code", context.code);
    if (context.productOptions) {
      context.productOptions.forEach(option => {
        formData.append("productOptions[]", option);
      });
    }
    if (context.productValues) {
      context.productValues.forEach(value => {
        formData.append("productValues[]", value);
      });
    }

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
    console.log("Menu board product added successfully");
    return validatedData;
  },
});

export default addMenuBoardProduct; 