import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const tagSchema = z.object({
  tagId: z.number(),
  tag: z.string(),
  isSystem: z.number(),
  isRequired: z.number(),
  options: z.array(z.string()).optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(tagSchema),
});

export const addTag = createTool({
  id: "add-tag",
  description: "新しいタグを追加",
  inputSchema: z.object({
    name: z.string(),
    isRequired: z.number().optional(),
    options: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/tag`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("name", context.name);
    if (context.isRequired) formData.append("isRequired", context.isRequired.toString());
    if (context.options) formData.append("options", context.options);

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
    console.log("Tag added successfully");
    return validatedData;
  },
});

export default addTag; 