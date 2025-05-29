import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const menuBoardSchema = z.object({
  menuId: z.number(),
  name: z.string(),
  description: z.string().optional(),
  code: z.string().optional(),
  userId: z.number(),
  modifiedDt: z.number(),
  folderId: z.string(),
  permissionsFolderId: z.number(),
  groupsWithPermissions: z.string(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(menuBoardSchema),
});

export const getMenuBoards = createTool({
  id: "get-menu-boards",
  description: "メニューボードを検索",
  inputSchema: z.object({
    menuId: z.number().optional(),
    userId: z.number().optional(),
    folderId: z.number().optional(),
    name: z.string().optional(),
    code: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboards`);
    
    // クエリパラメータの追加
    if (context.menuId) url.searchParams.append("menuId", context.menuId.toString());
    if (context.userId) url.searchParams.append("userId", context.userId.toString());
    if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());
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
    console.log("Menu boards retrieved successfully");
    return validatedData;
  },
});

export default getMenuBoards; 