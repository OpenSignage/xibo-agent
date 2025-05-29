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

export const getTags = createTool({
  id: "get-tags",
  description: "タグを検索",
  inputSchema: z.object({
    tagId: z.number().optional(),
    tag: z.string().optional(),
    exactTag: z.string().optional(),
    isSystem: z.number().optional(),
    isRequired: z.number().optional(),
    haveOptions: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/tag`);
    
    // クエリパラメータの追加
    if (context.tagId) url.searchParams.append("tagId", context.tagId.toString());
    if (context.tag) url.searchParams.append("tag", context.tag);
    if (context.exactTag) url.searchParams.append("exactTag", context.exactTag);
    if (context.isSystem) url.searchParams.append("isSystem", context.isSystem.toString());
    if (context.isRequired) url.searchParams.append("isRequired", context.isRequired.toString());
    if (context.haveOptions) url.searchParams.append("haveOptions", context.haveOptions.toString());

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
    console.log("Tags retrieved successfully");
    return validatedData;
  },
});

export default getTags; 