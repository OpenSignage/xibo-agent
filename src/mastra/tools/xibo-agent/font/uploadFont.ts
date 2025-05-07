import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const fontSchema = z.object({
  id: z.number(),
  createdAt: z.string(),
  modifiedAt: z.string(),
  modifiedBy: z.string(),
  name: z.string(),
  fileName: z.string(),
  familyName: z.string(),
  size: z.number(),
  md5: z.string(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: fontSchema,
});

export const uploadFont = createTool({
  id: "upload-font",
  description: "フォントをアップロード",
  inputSchema: z.object({
    file: z.instanceof(File),
    name: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/fonts`);
    const formData = new FormData();
    
    formData.append("files", context.file);
    if (context.name) formData.append("name", context.name);

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
    console.log("Font uploaded successfully");
    return validatedData;
  },
});

export default uploadFont; 