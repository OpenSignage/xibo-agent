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

export const addMenuBoard = createTool({
  id: "add-menu-board",
  description: "新しいメニューボードを追加",
  inputSchema: z.object({
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

    const url = new URL(`${config.cmsUrl}/menuboard`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    if (context.description) formData.append("description", context.description);
    if (context.code) formData.append("code", context.code);
    if (context.folderId) formData.append("folderId", context.folderId.toString());

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
    console.log("Menu board added successfully");
    return validatedData;
  },
});

export default addMenuBoard; 