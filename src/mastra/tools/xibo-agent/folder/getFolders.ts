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
  data: z.array(folderSchema),
});

export const getFolders = createTool({
  id: "get-folders",
  description: "フォルダを検索",
  inputSchema: z.object({
    folderId: z.number().optional(),
    gridView: z.number().optional(),
    folderName: z.string().optional(),
    exactFolderName: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/folders`);
    
    // クエリパラメータの追加
    if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());
    if (context.gridView) url.searchParams.append("gridView", context.gridView.toString());
    if (context.folderName) url.searchParams.append("folderName", context.folderName);
    if (context.exactFolderName) url.searchParams.append("exactFolderName", context.exactFolderName.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Folders retrieved successfully");
    return {
      success: true,
      data: data
    };
  },
});

export default getFolders; 