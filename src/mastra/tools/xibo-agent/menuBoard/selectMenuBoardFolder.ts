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
  data: menuBoardSchema,
});

export const selectMenuBoardFolder = createTool({
  id: "select-menu-board-folder",
  description: "メニューボードのフォルダを選択",
  inputSchema: z.object({
    menuId: z.number(),
    folderId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/menuboard/${context.menuId}/selectfolder`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("folderId", context.folderId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Menu board folder selected successfully");
    return validatedData;
  },
});

export default selectMenuBoardFolder; 