import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

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

export const editTag = createTool({
  id: "edit-tag",
  description: "タグを編集",
  inputSchema: z.object({
    tagId: z.number(),
    name: z.string().optional(),
    isRequired: z.number().optional(),
    options: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/tag/${context.tagId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    if (context.name) formData.append("name", context.name);
    if (context.isRequired) formData.append("isRequired", context.isRequired.toString());
    if (context.options) formData.append("options", context.options);

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
    console.log("Tag edited successfully");
    return validatedData;
  },
});

export default editTag; 