import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const inputSchema = z.object({
  menuProductId: z.number(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const deleteMenuBoardProduct = createTool({
  id: "delete-menu-board-product",
  description: "メニューボード商品を削除",
  inputSchema,
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = `${config.cmsUrl}/menuboard/${context.menuProductId}/product`;
    console.log(`Requesting URL: ${url}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Menu board product deleted successfully");
    return validatedData;
  },
});

export default deleteMenuBoardProduct; 