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

export const addFolder = createTool({
  id: "add-folder",
  description: "フォルダを追加",
  inputSchema: z.object({
    text: z.string(),
    parentId: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/folders`);
    console.log(`Requesting URL: ${url.toString()}`);

    const formData = new FormData();
    formData.append("text", context.text);
    if (context.parentId) formData.append("parentId", context.parentId);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Folder added successfully");
    return {
      success: true,
      data: data
    };
  },
});

export default addFolder; 