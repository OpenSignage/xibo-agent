import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const folderSchema = z.object({
  id: z.number(),
  type: z.string(),
  text: z.string(),
  parentId: z.number(),
  isRoot: z.number(),
  children: z.string(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const deleteFolder = createTool({
  id: "delete-folder",
  description: "フォルダを削除",
  inputSchema: z.object({
    folderId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/folders/${context.folderId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 削除の場合は204レスポンスが返ってくるため、空のデータを返す
    console.log("Folder deleted successfully");
    return {
      success: true,
      data: null
    };
  },
});

export default deleteFolder; 