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
  data: folderSchema,
});

export const editFolder = createTool({
  id: "edit-folder",
  description: "フォルダを編集",
  inputSchema: z.object({
    folderId: z.number(),
    text: z.string(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/folders/${context.folderId}`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("text", context.text);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Folder edited successfully");
    return {
      success: true,
      data: data
    };
  },
});

export default editFolder; 